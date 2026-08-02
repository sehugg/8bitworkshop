/*
 * Solarian for PC Engine — a 1:1 gameplay port of
 * presets/galaxian-scramble/shoot2.c (the "source of truth" Galaxian-hardware
 * shoot-em-up), rendered with the pcegfx VDC/VCE tile+sprite SDK (no conio).
 *
 * All game math (attacker 8.8 fixed point, SINTBL, formation geometry,
 * think/dive thresholds, wave timing) runs in the original Galaxian pixel
 * space (0..255), exactly like shoot2.c. GX()/GY() convert that space to
 * PC Engine screen/sprite coordinates only at the point something is drawn.
 *
 * Gfx: scripts/gen_pce_solarian_gfx.py (from presets/nes/shoot2.c TILESET).
 * Controls: pad move, I or RUN = fire / start.
 */
//#resource "pcegfx.h"
//#resource "solarian_gfx.h"
//#link "pcegfx.c"
//#link "pcegfx_tia.s"

#include <joystick.h>
#include "pcegfx.h"
#include "solarian_gfx.h"

#define TILE0 PCE_TILE_BASE
#define SPR0  PCE_SPR_BASE

#define ENEMIES_PER_ROW 8
#define ENEMY_ROWS 4
#define MAX_IN_FORMATION (ENEMIES_PER_ROW * ENEMY_ROWS)
#define MAX_ATTACKERS 6
#define MAX_MISSILES 8
#define PLAYER_MISSILE 7

/* Exact shoot2.c formation geometry (Galaxian pixel space) */
#define FORMATION_X0 18
#define FORMATION_Y0 27
#define FORMATION_XS 24
#define FORMATION_YS 16
#define GAL_HIT 16          /* shoot2 in_rect w/h */
#define PLAYER_Y 232        /* shoot2 player_y (constant) */
#define PLAYER_X0 112       /* shoot2 new_player_ship */

#define FLIPX  0x40
#define FLIPY  0x80
#define FLIPXY 0xc0

#define TILE_COLS 32
#define TILE_ROWS 28

/* Galaxian space (0..255) -> PCE sprite/BAT space. X is 1:1 (both ~256px
 * wide); Y is squeezed 256->224 so player_y=232 stays on the 224-line screen.
 * (g*224)>>8 == (g*7)>>3 == ((g<<3)-g)>>3 — no runtime multiply/divide. */
#define GAL_TO_PY(g) ((word)(((((word)(byte)(g) << 3) - (byte)(g)) >> 3)))
#define GX(g) ((word)(PCE_SPR_X0 + (byte)(g)))
#define GY(g) ((word)(PCE_SPR_Y0 + GAL_TO_PY(g)))
#define BGX(g) ((byte)((byte)(g) >> 3))
#define BGY(g) ((byte)(GAL_TO_PY(g) >> 3))

typedef struct { byte shape; } FormationEnemy;
typedef struct {
  byte findex;
  byte shape;
  word x, y;   /* 8.8 fixed point, Galaxian pixel space */
  byte dir;
  byte returning;
} AttackingEnemy;
typedef struct {
  byte active;
  word x, y;   /* Galaxian pixel space */
  sbyte dy;
} Missile;

FormationEnemy formation[MAX_IN_FORMATION];
AttackingEnemy attackers[MAX_ATTACKERS];
Missile missiles[MAX_MISSILES];

word formation_offset_x;
sbyte formation_direction;
byte current_row;
byte player_x;
byte player_exploding;
byte enemy_exploding;
word boom_x, boom_y;
byte enemies_left;
word player_score;
word framecount;
byte lives;

/* Galaxian shoot2 DIR_TO_CODE — dive toward +Y (player at bottom) */
static const byte DIR_TO_CODE[32] = {
  0, 1, 2, 3, 4, 5, 6, 6,
  6|FLIPXY, 6|FLIPXY, 5|FLIPXY, 4|FLIPXY, 3|FLIPXY, 2|FLIPXY, 1|FLIPXY, 0|FLIPXY,
  0|FLIPX, 1|FLIPX, 2|FLIPX, 3|FLIPX, 4|FLIPX, 5|FLIPX, 6|FLIPX, 6|FLIPX,
  6|FLIPY, 6|FLIPY, 5|FLIPY, 4|FLIPY, 3|FLIPY, 2|FLIPY, 1|FLIPY, 0|FLIPY,
};

/* Exact Galaxian shoot2 SINTBL (unmultiplied) */
static const byte SINTBL[32] = {
  0, 25, 49, 71, 90, 106, 117, 125,
  127, 125, 117, 106, 90, 71, 49, 25,
  0, (byte)-25, (byte)-49, (byte)-71, (byte)-90, (byte)-106, (byte)-117, (byte)-125,
  (byte)-127, (byte)-125, (byte)-117, (byte)-106, (byte)-90, (byte)-71, (byte)-49, (byte)-25,
};

static word lfsr = 1;

word rand16(void) {
  byte lsb = (byte)(lfsr & 1);
  lfsr >>= 1;
  if (lsb) lfsr ^= 0xB400;
  return lfsr;
}

sbyte isin(byte dir) { return (sbyte)SINTBL[dir & 31]; }
sbyte icos(byte dir) { return isin((byte)(dir + 8)); }

#define PIX(fp) ((byte)((fp) >> 8))

/* ---- tile/text helpers ------------------------------------------------ */

void poke_tile(byte x, byte y, word code) {
  if (x >= TILE_COLS || y >= TILE_ROWS) return;
  pce_put_tile(x, y, PCE_BAT(TILE0 + code, 0));
}

byte font_code(char ch) {
  if (ch >= '0' && ch <= '9') return (byte)(T_DIGIT + (ch - '0'));
  if (ch >= 'a' && ch <= 'z') ch = (char)(ch - 32);
  if (ch >= 'A' && ch <= 'Z') return (byte)(T_LETTER + (ch - 'A'));
  return T_BLANK;
}

void put_char(byte x, byte y, char ch) { poke_tile(x, y, font_code(ch)); }

void put_string(byte x, byte y, const char* s) {
  while (*s) put_char(x++, y, *s++);
}

void put_digit(byte x, byte y, byte d) { poke_tile(x, y, (word)(T_DIGIT + (d & 15))); }

word bcd_add(word a, word b) {
  word r = 0;
  byte i, carry = 0;
  for (i = 0; i < 4; i++) {
    byte n = (byte)((a & 15) + (b & 15) + carry);
    if (n > 9) { n = (byte)(n - 10); carry = 1; }
    else carry = 0;
    r |= (word)n << (i * 4);
    a >>= 4;
    b >>= 4;
  }
  return r;
}

void clrscr(void) {
  pce_fill_bat(0, 0, TILE_COLS, TILE_ROWS, PCE_BAT(TILE0 + T_BLANK, 0));
  pce_satb_clear();
  pce_satb_update();
}

void draw_score(void) {
  byte i;
  word s = player_score;
  put_string(1, 0, "SCORE");
  for (i = 0; i < 4; i++) {
    put_digit((byte)(9 - i), 0, (byte)(s & 0xf));
    s >>= 4;
  }
  put_string(14, 0, "LIVES");
  put_digit(20, 0, lives);
  /* Lag digit: vsync overruns (0 = locked 60Hz). */
  put_digit(30, 0, (byte)(pce_vsync_overruns & 15));
}

void add_score(word bcd) {
  player_score = bcd_add(player_score, bcd);
  draw_score();
}

void seed_stars(void) {
  byte i;
  for (i = 0; i < 20; i++) {
    byte x = (byte)(rand16() & 31);
    byte y = (byte)(2 + (rand16() % 25));
    poke_tile(x, y, (rand16() & 1) ? T_STAR1 : T_STAR2);
  }
}

/* ---- formation (BAT once + BXR band scroll + CHR flap) -------------------- */

byte form_spark;

byte form_tile_x(byte col) {
  return (byte)((FORMATION_X0 >> 3) + col * 3);
}

byte form_tile_y(byte row) {
  return BGY((byte)(FORMATION_Y0 + row * FORMATION_YS));
}

void form_set_frame(byte spark) {
  const unsigned char *src =
    spark ? &solarian_tiles[T_FORM_B * 32]
          : &solarian_tiles[T_FORM_A * 32];
  form_spark = spark;
  pce_load_tiles_planar(TILE0 + T_FORM_A, src, T_FORM_NTILE);
}

void draw_formation_slot(byte fi) {
  byte col = (byte)(fi & (ENEMIES_PER_ROW - 1));
  byte row = (byte)(fi >> 3);
  byte tx = form_tile_x(col);
  byte ty = form_tile_y(row);
  if (tx >= TILE_COLS - 2) return;
  if (formation[fi].shape) {
    poke_tile(tx, ty, T_FORM_A);
    poke_tile((byte)(tx + 1), ty, (word)(T_FORM_A + 1));
    poke_tile((byte)(tx + 2), ty, (word)(T_FORM_A + 2));
  } else {
    poke_tile(tx, ty, T_BLANK);
    poke_tile((byte)(tx + 1), ty, T_BLANK);
    poke_tile((byte)(tx + 2), ty, T_BLANK);
  }
}

void redraw_formation(void) {
  byte i;
  for (i = 0; i < MAX_IN_FORMATION; i++)
    draw_formation_slot(i);
}

void setup_formation(void) {
  byte i;
  for (i = 0; i < MAX_IN_FORMATION; i++) formation[i].shape = 1;
  for (i = 0; i < MAX_ATTACKERS; i++) attackers[i].findex = 0;
  for (i = 0; i < MAX_MISSILES; i++) missiles[i].active = 0;
  enemies_left = MAX_IN_FORMATION;
  formation_offset_x = 0;
  formation_direction = 1;
  current_row = 0;
  form_spark = 0;
  pce_band_set_x(0);
}

byte get_attacker_x(byte fi) {
  byte col = (byte)(fi & (ENEMIES_PER_ROW - 1));
  return (byte)(FORMATION_X0 + formation_offset_x + col * FORMATION_XS);
}

byte get_attacker_y(byte fi) {
  byte row = (byte)(fi >> 3);
  return (byte)(FORMATION_Y0 + row * FORMATION_YS);
}

/* Advance scroll ~1px every ENEMY_ROWS frames (same pace as old BAT redraw). */
void update_formation_motion(void) {
  byte spark;
  if (++current_row >= ENEMY_ROWS) {
    current_row = 0;
    formation_offset_x = (word)(formation_offset_x + formation_direction);
    if (formation_offset_x == 40) formation_direction = -1;
    else if (formation_offset_x == 0) formation_direction = 1;
    pce_band_set_x(formation_offset_x);
  }
  spark = (byte)((framecount >> 4) & 1);
  if (spark != form_spark)
    form_set_frame(spark);
}

void enable_formation_scroll(void) {
  byte top = (byte)GAL_TO_PY(FORMATION_Y0);
  byte bot = (byte)(GAL_TO_PY((byte)(FORMATION_Y0 + ENEMY_ROWS * FORMATION_YS)) + 8);
  /* RCR applies BXR on the *next* line; start ~8 lines early so the first
   * alien row is fully inside the scrolled band (was ~2, looked 6 late). */
  if (top > 8) top = (byte)(top - 8);
  else top = 0;
  pce_band_enable(top, bot);
  pce_band_set_x(formation_offset_x);
}

/* ---- attackers ---------------------------------------------------------- */

/* shoot2: dock when ydist==0 (byte wrap); else aim and y += 128 */
void return_attacker(AttackingEnemy* a) {
  byte fi = (byte)(a->findex - 1);
  byte destx = get_attacker_x(fi);
  byte desty = get_attacker_y(fi);
  byte ydist = (byte)(desty - PIX(a->y));
  if (ydist == 0) {
    formation[fi].shape = a->shape;
    a->findex = 0;
    draw_formation_slot(fi);
  } else {
    a->dir = (byte)((ydist + 16) & 31);
    a->x = (word)destx << 8;
    a->y += 128;
  }
}

/* shoot2: x += isin*2, y += icos*2; head home when Y wraps to 0 */
void fly_attacker(AttackingEnemy* a) {
  a->x += (word)(isin(a->dir) * 2);
  a->y += (word)(icos(a->dir) * 2);
  if (PIX(a->y) == 0) a->returning = 1;
}

void move_attackers(void) {
  byte i;
  for (i = 0; i < MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (!a->findex) continue;
    if (a->returning) return_attacker(a);
    else fly_attacker(a);
  }
}

/* shoot2: y<128 or exploding -> turn on x<112; else fire if slot free */
void think_attackers(void) {
  byte i;
  for (i = 0; i < MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    byte x, y;
    if (!a->findex) continue;
    x = PIX(a->x);
    y = PIX(a->y);
    if (y < 128 || player_exploding) {
      if (x < 112) a->dir++;
      else a->dir--;
    } else if (!missiles[i].active) {
      missiles[i].active = 1;
      missiles[i].x = (word)(x + 8);
      missiles[i].y = (word)y;
      missiles[i].dy = 2;
    }
  }
}

void formation_to_attacker(byte fi) {
  byte i;
  if (fi >= MAX_IN_FORMATION || !formation[fi].shape) return;
  for (i = 0; i < MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex == 0) {
      a->x = (word)get_attacker_x(fi) << 8;
      a->y = (word)get_attacker_y(fi) << 8;
      a->shape = formation[fi].shape;
      a->findex = (byte)(fi + 1);
      a->dir = 0;
      a->returning = 0;
      formation[fi].shape = 0;
      draw_formation_slot(fi);
      break;
    }
  }
}

void new_attack_wave(void) {
  byte i = (byte)(rand16() & (MAX_IN_FORMATION - 1));
  byte j;
  for (j = 0; j < MAX_IN_FORMATION; j++) {
    i = (byte)((i + 1) & (MAX_IN_FORMATION - 1));
    if (formation[i].shape) {
      formation_to_attacker(i);
      formation_to_attacker((byte)(i + 1));
      formation_to_attacker((byte)(i + ENEMIES_PER_ROW));
      formation_to_attacker((byte)(i + ENEMIES_PER_ROW + 1));
      break;
    }
  }
}

/* Put divers back in their slots and redraw formation (restart wave). */
void recall_attackers(void) {
  byte i;
  for (i = 0; i < MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex) {
      formation[(byte)(a->findex - 1)].shape = a->shape;
      a->findex = 0;
      a->returning = 0;
    }
  }
  redraw_formation();
}

/* ---- missiles ------------------------------------------------------------ */

/* shoot2 after un-inverting HW Y: player dy=-4, enemy dy=+2.
 * All missiles are sprites (no BG erase/redraw — that was a major stall). */
void move_missiles(void) {
  byte i;
  for (i = 0; i < MAX_MISSILES; i++) {
    if (!missiles[i].active) continue;
    if (missiles[i].dy < 0) {
      byte step = (byte)(-missiles[i].dy);
      if (missiles[i].y < step) { missiles[i].active = 0; continue; }
      missiles[i].y -= step;
    } else if (missiles[i].dy > 0) {
      missiles[i].y += (byte)missiles[i].dy;
      if (missiles[i].y > 235) missiles[i].active = 0;
    }
  }
}

void hide_player_missile(void) { missiles[PLAYER_MISSILE].active = 0; }

void clear_all_missiles(void) {
  byte i;
  for (i = 0; i < MAX_MISSILES; i++) missiles[i].active = 0;
}

/* ---- player --------------------------------------------------------------- */

void new_player_ship(void) {
  player_exploding = 0;
  player_x = PLAYER_X0;
  clear_all_missiles();
}

void move_player(void) {
  byte joy = joy_read(JOY_1);
  if (JOY_LEFT(joy) && player_x > 16) player_x--;
  if (JOY_RIGHT(joy) && player_x < 224) player_x++;
  if ((JOY_BTN_I(joy) || JOY_RUN(joy)) && !missiles[PLAYER_MISSILE].active) {
    missiles[PLAYER_MISSILE].active = 1;
    missiles[PLAYER_MISSILE].x = player_x;
    missiles[PLAYER_MISSILE].y = (word)(PLAYER_Y - 8);
    missiles[PLAYER_MISSILE].dy = -4;
  }
}

/* Galaxian shoot2: unsigned wrap — (x-x0) < w as unsigned */
char in_rect(byte x, byte y, byte x0, byte y0, byte w, byte h) {
  return ((byte)(x - x0) < w && (byte)(y - y0) < h);
}

void blowup_at(word x, word y) {
  boom_x = x;
  boom_y = y;
  enemy_exploding = 1;
}

void animate_boom(void) {
  if (!enemy_exploding) return;
  enemy_exploding++;
  if (enemy_exploding > 8) enemy_exploding = 0;
}

void does_player_shoot_formation(void) {
  byte mx, my, column, localx, index;
  sbyte row;
  byte xoffset;
  if (!missiles[PLAYER_MISSILE].active) return;
  mx = (byte)missiles[PLAYER_MISSILE].x;
  my = (byte)missiles[PLAYER_MISSILE].y;
  /* FORMATION_YS == 16 */
  row = (sbyte)((byte)(my - FORMATION_Y0) >> 4);
  if (row < 0 || row >= ENEMY_ROWS) return;
  xoffset = (byte)(mx - FORMATION_X0 - (byte)formation_offset_x);
  column = (byte)(xoffset / FORMATION_XS);
  localx = (byte)(xoffset - column * FORMATION_XS);
  if (column < ENEMIES_PER_ROW && localx < GAL_HIT) {
    index = (byte)(column + (byte)row * ENEMIES_PER_ROW);
    if (formation[index].shape) {
      formation[index].shape = 0;
      enemies_left--;
      draw_formation_slot(index);
      blowup_at(GX(get_attacker_x(index)), GY(get_attacker_y(index)));
      hide_player_missile();
      add_score(0x0002);
    }
  }
}

void does_player_shoot_attacker(void) {
  byte i, mx, my;
  if (!missiles[PLAYER_MISSILE].active) return;
  mx = (byte)missiles[PLAYER_MISSILE].x;
  my = (byte)missiles[PLAYER_MISSILE].y;
  for (i = 0; i < MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex && in_rect(mx, my, PIX(a->x), PIX(a->y), GAL_HIT, GAL_HIT)) {
      blowup_at(GX(PIX(a->x)), GY(PIX(a->y)));
      a->findex = 0;
      enemies_left--;
      hide_player_missile();
      add_score(0x0005);
      break;
    }
  }
}

/* shoot2: enemy missile slots only; 16x16 in Galaxian space */
void does_missile_hit_player(void) {
  byte i;
  if (player_exploding) return;
  for (i = 0; i < MAX_ATTACKERS; i++) {
    if (missiles[i].active &&
        in_rect((byte)missiles[i].x, (byte)missiles[i].y, player_x, PLAYER_Y, GAL_HIT, GAL_HIT)) {
      player_exploding = 1;
      clear_all_missiles();
      break;
    }
  }
}

/* ---- sprite flush (once per frame) ---------------------------------------- */
/* slots: 0 ship, 1-6 divers, 7 player bullet, 8 boom, 9-14 enemy bullets */

#define SPR_SLOTS 15

static void update_sprites(void) {
  byte i;
  word attr = PCE_SPR_PRI | PCE_SPR_PAL(0);

  /* Park unused slots with Y=0; write actives via macros (no call overhead). */
  for (i = 0; i < SPR_SLOTS; i++)
    PCE_SPR_HIDE(i);

  if (player_exploding) {
    PCE_SPR_SET(0, GX(player_x), GY(PLAYER_Y),
                PCE_SPR_PATTERN((player_exploding & 1) ? S_BOOM1 : S_BOOM2), attr);
  } else {
    PCE_SPR_SET(0, GX(player_x), GY(PLAYER_Y), PCE_SPR_PATTERN(S_PLAYER), attr);
  }

  for (i = 0; i < MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex) {
      byte code = DIR_TO_CODE[a->dir & 31];
      word aattr = attr;
      if (code & FLIPX) aattr |= PCE_SPR_HFLIP;
      if (code & FLIPY) aattr |= PCE_SPR_VFLIP;
      PCE_SPR_SET((byte)(1 + i), GX(PIX(a->x)), GY(PIX(a->y)),
                  PCE_SPR_PATTERN(S_ATK0 + (code & 7)), aattr);
    }
  }

  if (missiles[PLAYER_MISSILE].active)
    PCE_SPR_SET(7, GX(missiles[PLAYER_MISSILE].x), GY(missiles[PLAYER_MISSILE].y),
                PCE_SPR_PATTERN(S_BULLET), attr);

  if (enemy_exploding)
    PCE_SPR_SET(8, boom_x, boom_y,
                PCE_SPR_PATTERN((enemy_exploding & 1) ? S_BOOM1 : S_BOOM2), attr);

  for (i = 0; i < MAX_ATTACKERS; i++) {
    if (!missiles[i].active) continue;
    PCE_SPR_SET((byte)(9 + i),
                GX(missiles[i].x), GY(missiles[i].y),
                PCE_SPR_PATTERN(S_BULLET), attr);
  }

  pce_satb_update_n(SPR_SLOTS);
}

/* ---- setup / rounds -------------------------------------------------------- */

static void setup_gfx(void) {
  pce_gfx_init();
  pce_disp_off();
  pce_load_palette(0, solarian_bg_pal, 16);
  pce_load_palette(256, solarian_spr_pal, 16);
  pce_load_tiles_planar(TILE0, solarian_tiles, SOLARIAN_NTILE);
  pce_load_sprites(SPR0, solarian_sprites, SOLARIAN_NSPR);
  pce_satb_clear();
  pce_satb_update();
  pce_disp_on();
}

void play_round(void) {
  byte end_timer = 255;

  player_score = 0;
  lives = 3;
  clrscr();
  seed_stars();
  draw_score();

  setup_formation();
  enemy_exploding = 0;
  framecount = 0;
  pce_vsync_overruns = 0;
  redraw_formation();
  enable_formation_scroll();
  new_player_ship();

  while (end_timer) {
    /* Post-DMA vblank: CHR flap / SATB. Scroll is RCR-driven. */
    pce_wait_vsync();
    update_formation_motion(); /* set_x first — updates HW BXR if already in-band */
    update_sprites();
    if ((framecount & 31) == 0)
      put_digit(30, 0, (byte)(pce_vsync_overruns & 15));

    framecount++;

    if (player_exploding) {
      if ((framecount & 7) == 0) {
        player_exploding++;
        if (player_exploding > 32) {
          lives--;
          draw_score();
          if (lives && enemies_left) {
            recall_attackers();
            new_player_ship();
          } else {
            player_exploding = 0;
            end_timer = 1;
          }
        }
      }
    } else {
      if ((framecount & 0x7f) == 0 && enemies_left > 8)
        new_attack_wave();
      move_player();
      does_missile_hit_player();
    }

    if ((framecount & 3) == 0) animate_boom();
    move_attackers();
    move_missiles();
    does_player_shoot_formation();
    does_player_shoot_attacker();
    if ((framecount & 0xf) == 0) think_attackers();

    if (!enemies_left) end_timer--;
    if (!lives && !player_exploding) end_timer--;
  }

  pce_band_disable();
  pce_satb_clear();
  pce_satb_update();
  put_string(11, 14, "GAME OVER");
  {
    byte t = 120;
    while (t--) pce_wait_vsync();
  }
}

#ifndef PCE_PERF_BENCH
static byte wait_for_start(void) {
  byte joy;
  do {
    pce_wait_vsync();
    joy = joy_read(JOY_1);
  } while (!(JOY_BTN_I(joy) || JOY_RUN(joy)));
  do {
    pce_wait_vsync();
    joy = joy_read(JOY_1);
  } while (JOY_BTN_I(joy) || JOY_RUN(joy));
  return joy;
}
#endif

int main(void) {
  joy_install(joy_static_stddrv);
  setup_gfx();

  while (1) {
#ifndef PCE_PERF_BENCH
    clrscr();
    put_string(10, 8, "SOLARIAN");
    put_string(3, 10, "GALAXIAN SCRAMBLE PORT");
    put_string(9, 14, "PRESS START");
    put_string(8, 16, "OR FIRE BUTTON");
    wait_for_start();
#endif
    play_round();
  }
  return 0;
}
