/*
 * Chase for PC Engine — 1:1 port of Shiru's NES Chase
 * (presets/nes/chase), same Actor/FP/AI/levels as presets/mcr/chase.c.
 *
 * NES cells are 16×16; PCE uses 2×2 of 8×8 BAT tiles per cell and 16×16
 * sprites so the playfield is 16×13 cells on a 256×224 screen (MAP_Y0=1).
 *
 * Gfx: scripts/gen_pce_chase_gfx.py ← presets/nes/chase/tileset.chr
 * Controls: pad move, I / RUN = start / continue / pause
 */
//#resource "pcegfx.h"
//#resource "chase_gfx.h"
//#link "pcegfx.c"
//#link "pcegfx_tia.s"

#include <joystick.h>
#include <string.h>
#include "pcegfx.h"
#include "chase_gfx.h"

#define TILE0 PCE_TILE_BASE
#define SPR0  PCE_SPR_BASE

void load_level_palette(byte li);

#define MAP_W        16
#define MAP_H        13
#define MAP_Y0       1   /* tile-rows above map[0] (HUD) */
#define LEVELS_ALL   5
#define ACTORS_MAX   4

#define TILE_SIZE    16
#define TILE_SIZE_BIT 4
#define FP_BITS      4
#define TILE_TO_POS(t)  ((word)(t) << (TILE_SIZE_BIT + FP_BITS))
#define POS_TO_TILE(p)  ((byte)((p) >> (TILE_SIZE_BIT + FP_BITS)))

#define T_BLANK  0
#define T_FLOOR  1
#define T_WALL   2
#define T_ITEM   3

#define DIR_NONE  0
#define DIR_LEFT  1
#define DIR_RIGHT 2
#define DIR_UP    4
#define DIR_DOWN  8

byte joy_left, joy_right, joy_up, joy_down, joy_fire;
byte fire_prev;

typedef struct {
  word x, y, cnt, speed;
  byte dir, kind, wait;
} Actor;

/* NES levels — 16×13, from nametables (same strings as MCR port). */
const char* const levels[LEVELS_ALL][MAP_H] = {
  {
  "                ",
  "                ",
  "    ########    ",
  "    #P*****#    ",
  "    #*####*#    ",
  "    #******#    ",
  "    #*####*#    ",
  "    #*****1#    ",
  "    ########    ",
  "                ",
  "                ",
  "                ",
  "                ",
  },
  {
  "                ",
  "   ##########   ",
  "   #P***#**1#   ",
  "   #*##*#*#*#   ",
  "   #********#   ",
  "   ###*#*#*##   ",
  "   #********#   ",
  "   #*#*#*##*#   ",
  "   #2*******#   ",
  "   ##########   ",
  "                ",
  "                ",
  "                ",
  },
  {
  "                ",
  "   ##########   ",
  "   #P***#**1#   ",
  " ###*##*#*#*### ",
  " #********#***# ",
  " #*#*#*##*#*#*# ",
  " #***#********# ",
  " ###*#*#*##*### ",
  "   #***#***2#   ",
  "   ##########   ",
  "                ",
  "                ",
  "                ",
  },
  {
  "   ######       ",
  "   #P***####### ",
  "   #*##*#****1# ",
  " ###*##*#*#*#*# ",
  " #**********#*# ",
  " #*#*#*##*#*#*# ",
  " #*#**********# ",
  " #*#*#*#*##*### ",
  " #2****#*##*#   ",
  " #######***3#   ",
  "       ######   ",
  "                ",
  "                ",
  },
  {
  "  ############  ",
  "  #P********1#  ",
  "###*##*##*##*###",
  "#**************#",
  "##*#*###*#*#*#*#",
  "#*****#********#",
  "#*###*#*#*###*##",
  "#*******#******#",
  "##*#*#*###*#*#*#",
  "#**************#",
  "###*##*##*##*###",
  "  #2********3#  ",
  "  ############  ",
  }
};

byte map[MAP_W * MAP_H];
Actor actors[ACTORS_MAX];
byte actor_n;
byte game_level, game_lives, items_count, items_collected;
byte game_clear, game_done, game_paused, spawn_wait;
word rnd = 0xCACE;
byte frame_cnt;

/* Gem locations for cheap sparkle anim (avoid scanning the whole map). */
byte gem_x[64], gem_y[64];
byte gem_n;

byte rand8(void) {
  rnd = (word)(rnd * 0x41C6 + 0x5B3F);
  return (byte)(rnd >> 8);
}

void read_controls(void) {
  unsigned char j = joy_read(JOY_1);
  joy_left  = JOY_LEFT(j)  ? 1 : 0;
  joy_right = JOY_RIGHT(j) ? 1 : 0;
  joy_up    = JOY_UP(j)    ? 1 : 0;
  joy_down  = JOY_DOWN(j)  ? 1 : 0;
  joy_fire  = (JOY_BTN_I(j) || JOY_RUN(j)) ? 1 : 0;
}

byte map_at(byte x, byte y) {
  if (x >= MAP_W || y >= MAP_H) return T_WALL;
  return map[y * MAP_W + x];
}

void map_set(byte x, byte y, byte t) {
  map[y * MAP_W + x] = t;
}

byte font_code(char ch) {
  if (ch >= '0' && ch <= '9') return (byte)(TILE_DIGIT + (ch - '0'));
  if (ch >= 'a' && ch <= 'z') ch = (char)(ch - 32);
  if (ch >= 'A' && ch <= 'Z') return (byte)(TILE_LETTER + (ch - 'A'));
  if (ch == ':') return TILE_COLON;
  if (ch == '/') return TILE_SLASH;
  return TILE_EMPTY;
}

void put_char_pal(byte x, byte y, char ch, byte pal) {
  pce_put_tile(x, y, PCE_BAT(TILE0 + font_code(ch), pal));
}

void put_char(byte x, byte y, char ch) {
  put_char_pal(x, y, ch, PAL_HUD);
}

void put_string_pal(byte x, byte y, const char* s, byte pal) {
  while (*s) put_char_pal(x++, y, *s++, pal);
}

void put_string(byte x, byte y, const char* s) {
  put_string_pal(x, y, s, PAL_HUD);
}

void put_digit(byte x, byte y, byte d) {
  pce_put_tile(x, y, PCE_BAT(TILE0 + TILE_DIGIT + (d % 10), PAL_HUD));
}

void hide_all_sprites(void) {
  byte i;
  for (i = 0; i < ACTORS_MAX; i++)
    PCE_SPR_HIDE(i);
  pce_satb_update_n(ACTORS_MAX);
}

void set_cell_tiles(byte mx, byte my, byte tl, byte tr, byte bl, byte br, byte pal) {
  byte sx = (byte)(mx << 1);
  byte sy = (byte)((byte)(MAP_Y0 + my) << 1);
  static word row[2];
  word addr = PCE_BAT_ADDR_XY(sx, sy);
  row[0] = PCE_BAT(TILE0 + tl, pal);
  row[1] = PCE_BAT(TILE0 + tr, pal);
  pce_vram_burst(addr, row, 4);
  row[0] = PCE_BAT(TILE0 + bl, pal);
  row[1] = PCE_BAT(TILE0 + br, pal);
  pce_vram_burst((word)(addr + PCE_BAT_W), row, 4);
}

byte gem_spark;

/* Gem cells always BAT-point at TILE_GEM0_*; sparkle rewrites those
 * 4 tile patterns in VRAM (128 bytes) so every gem flips at once. */
void gem_set_frame(byte spark) {
  const unsigned char *src =
    spark ? &chase_tiles[TILE_GEM1_TL * 32]
          : &chase_tiles[TILE_GEM0_TL * 32];
  gem_spark = spark;
  pce_load_tiles_planar(TILE0 + TILE_GEM0_TL, src, 4);
}

void draw_cell(byte x, byte y) {
  byte t = map_at(x, y);
  /* Alternate wall subpals 1/3 like NES attribute checkerboard */
  byte wall_pal = (byte)(((x ^ y) & 1) ? PAL_WALLB : PAL_WALL);
  if (t == T_WALL)
    set_cell_tiles(x, y, TILE_WALL_TL, TILE_WALL_TR, TILE_WALL_BL, TILE_WALL_BR, wall_pal);
  else if (t == T_ITEM)
    /* NES: floor + gems share attr pal 2 (black, floor bg, 2 gem colours) */
    set_cell_tiles(x, y, TILE_GEM0_TL, TILE_GEM0_TR, TILE_GEM0_BL, TILE_GEM0_BR, PAL_FLOOR);
  else if (t == T_FLOOR)
    set_cell_tiles(x, y, TILE_FLOOR, TILE_FLOOR, TILE_FLOOR, TILE_FLOOR, PAL_FLOOR);
  else
    set_cell_tiles(x, y, TILE_EMPTY, TILE_EMPTY, TILE_EMPTY, TILE_EMPTY, PAL_HUD);
}

void draw_hud(void) {
  put_string(2, 0, "LEVEL:");
  put_digit(8, 0, (byte)(game_level + 1));
  put_string(10, 0, "GEMS:");
  put_digit(15, 0, (byte)(items_collected / 100));
  put_digit(16, 0, (byte)((items_collected / 10) % 10));
  put_digit(17, 0, (byte)(items_collected % 10));
  put_char(18, 0, '/');
  put_digit(19, 0, (byte)(items_count / 100));
  put_digit(20, 0, (byte)((items_count / 10) % 10));
  put_digit(21, 0, (byte)(items_count % 10));
  put_string(23, 0, "LIVES:");
  put_digit(29, 0, game_lives > 0 ? (byte)(game_lives - 1) : 0);
}

byte can_enter(byte tx, byte ty) {
  byte t = map_at(tx, ty);
  return t == T_FLOOR || t == T_ITEM;
}

void actor_try_dir(byte id, byte dir) {
  Actor* a = &actors[id];
  byte tx = POS_TO_TILE(a->x);
  byte ty = POS_TO_TILE(a->y);
  if (dir == DIR_LEFT) tx--;
  else if (dir == DIR_RIGHT) tx++;
  else if (dir == DIR_UP) ty--;
  else if (dir == DIR_DOWN) ty++;
  else return;
  if (!can_enter(tx, ty)) return;
  a->dir = dir;
  a->cnt = (word)TILE_SIZE << FP_BITS;
}

void gem_remove_at(byte tx, byte ty) {
  byte i;
  for (i = 0; i < gem_n; i++) {
    if (gem_x[i] == tx && gem_y[i] == ty) {
      gem_n--;
      gem_x[i] = gem_x[gem_n];
      gem_y[i] = gem_y[gem_n];
      return;
    }
  }
}

void try_collect(byte id) {
  byte tx, ty;
  Actor* a = &actors[id];
  if (id != 0 || a->wait) return;
  tx = POS_TO_TILE(a->x);
  ty = POS_TO_TILE(a->y);
  if (map_at(tx, ty) != T_ITEM) return;
  map_set(tx, ty, T_FLOOR);
  gem_remove_at(tx, ty);
  draw_cell(tx, ty);
  items_collected++;
  draw_hud();
}

void load_level(byte li) {
  byte x, y;
  const char* row;
  actor_n = 0;
  items_count = 0;
  items_collected = 0;
  gem_n = 0;
  game_level = li;
  gem_set_frame(0);
  pce_disp_off();
  load_level_palette(li);
  __asm__("sei");
  pce_fill_bat(0, 0, 32, 28, PCE_BAT(TILE0 + TILE_EMPTY, PAL_HUD));
  hide_all_sprites();
  for (y = 0; y < MAP_H; y++) {
    row = levels[li][y];
    for (x = 0; x < MAP_W; x++) {
      char c = row[x];
      byte t = T_BLANK;
      if (c == '#') t = T_WALL;
      else if (c == '*') {
        t = T_ITEM;
        items_count++;
        if (gem_n < 64) {
          gem_x[gem_n] = x;
          gem_y[gem_n] = y;
          gem_n++;
        }
      }
      else if (c == 'P' || c == '1' || c == '2' || c == '3') {
        Actor* a = &actors[actor_n];
        a->x = TILE_TO_POS(x);
        a->y = TILE_TO_POS(y);
        a->cnt = 0;
        a->dir = DIR_NONE;
        if (c == 'P') {
          a->kind = 0;
          a->speed = (word)(2 << FP_BITS);
          a->wait = 16;
        } else {
          a->kind = (byte)(c - '0');
          a->speed = (word)(10 + ((a->kind - 1) << 1));
          a->wait = (byte)(16 + (a->kind << 4));
        }
        actor_n++;
        t = T_FLOOR;
      } else if (c == '.') {
        t = T_FLOOR;
      } else {
        t = T_BLANK;
      }
      map[y * MAP_W + x] = t;
    }
  }
  for (y = 0; y < MAP_H; y++)
    for (x = 0; x < MAP_W; x++)
      draw_cell(x, y);
  __asm__("cli");
  spawn_wait = (byte)(actor_n << 4);
  pce_disp_on();
}

void draw_actors(void) {
  byte i;
  for (i = 0; i < ACTORS_MAX; i++)
    PCE_SPR_HIDE(i);
  for (i = 0; i < actor_n; i++) {
    Actor* a = &actors[i];
    word px = (word)(PCE_SPR_X0 + (a->x >> FP_BITS));
    word py = (word)(PCE_SPR_Y0 + (MAP_Y0 * TILE_SIZE) + (a->y >> FP_BITS));
    byte shape;
    word attr;
    if (a->wait && (a->wait >= 16 || (a->wait & 2)))
      continue;
    /* NES: player pal 0, enemy1/2/3 → spr pal 1/2/3 */
    attr = PCE_SPR_PRI | PCE_SPR_PAL(a->kind & 3);
    if (a->kind == 0)
      shape = (frame_cnt & 8) ? SPR_PLAYER2 : SPR_PLAYER;
    else
      shape = (frame_cnt & 8) ? SPR_ENEMY2 : SPR_ENEMY;
    PCE_SPR_SET(i, px, py, PCE_SPR_PATTERN(shape), attr);
  }
  pce_satb_update_n(ACTORS_MAX);
}

byte hit_player(void) {
  byte i;
  word px = actors[0].x >> FP_BITS;
  word py = actors[0].y >> FP_BITS;
  if (actors[0].wait) return 0;
  for (i = 1; i < actor_n; i++) {
    word ex, ey;
    if (actors[i].wait) continue;
    ex = actors[i].x >> FP_BITS;
    ey = actors[i].y >> FP_BITS;
    /* NES 4..12 box inside 16×16 */
    if (!((px + 4) >= (ex + 12) || (ex + 4) >= (px + 12) ||
          (py + 4) >= (ey + 12) || (ey + 4) >= (py + 12)))
      return 1;
  }
  return 0;
}

/* One 128-byte CHR upload flips every gem; BAT stays put. */
void animate_gems(void) {
  byte spark = (frame_cnt & 16) != 0;
  if (spark != gem_spark)
    gem_set_frame(spark);
}

void enemy_ai(byte id) {
  Actor* a = &actors[id];
  byte tx = POS_TO_TILE(a->x);
  byte ty = POS_TO_TILE(a->y);
  byte dirs[4];
  byte n = 0;
  byte prev = a->dir;
  if (prev != DIR_RIGHT && can_enter((byte)(tx - 1), ty)) dirs[n++] = DIR_LEFT;
  if (prev != DIR_LEFT  && can_enter((byte)(tx + 1), ty)) dirs[n++] = DIR_RIGHT;
  if (prev != DIR_DOWN  && can_enter(tx, (byte)(ty - 1))) dirs[n++] = DIR_UP;
  if (prev != DIR_UP    && can_enter(tx, (byte)(ty + 1))) dirs[n++] = DIR_DOWN;
  if (!n) return;
  actor_try_dir(id, dirs[rand8() % n]);
  if (n > 1) {
    Actor* p = &actors[0];
    if (prev != DIR_DOWN && p->y < a->y) actor_try_dir(id, DIR_UP);
    if (prev != DIR_UP   && p->y > a->y) actor_try_dir(id, DIR_DOWN);
    if (prev != DIR_RIGHT && p->x < a->x) actor_try_dir(id, DIR_LEFT);
    if (prev != DIR_LEFT  && p->x > a->x) actor_try_dir(id, DIR_RIGHT);
  }
}

void player_controls(void) {
  byte j = 0;
  Actor* a = &actors[0];
  if (joy_left) j |= DIR_LEFT;
  if (joy_right) j |= DIR_RIGHT;
  if (joy_up) j |= DIR_UP;
  if (joy_down) j |= DIR_DOWN;
  if (j & a->dir) {
    j = (byte)(j & ~a->dir);
    actor_try_dir(0, a->dir);
  }
  if (j & DIR_LEFT) actor_try_dir(0, DIR_LEFT);
  if (j & DIR_RIGHT) actor_try_dir(0, DIR_RIGHT);
  if (j & DIR_UP) actor_try_dir(0, DIR_UP);
  if (j & DIR_DOWN) actor_try_dir(0, DIR_DOWN);
}

void advance_actor(byte id) {
  Actor* a = &actors[id];
  word step;
  if (!a->cnt) return;
  step = a->speed;
  if (step > a->cnt) step = a->cnt;
  if (a->dir == DIR_LEFT) a->x -= step;
  else if (a->dir == DIR_RIGHT) a->x += step;
  else if (a->dir == DIR_UP) a->y -= step;
  else if (a->dir == DIR_DOWN) a->y += step;
  a->cnt -= step;
  if (!a->cnt) {
    a->x &= 0xff00;
    a->y &= 0xff00;
    try_collect(id);
  }
}

void wait_frame(void) { pce_wait_vsync(); }

void wait_frames(byte n) {
  while (n--) wait_frame();
}

void wait_for_fire(void) {
  read_controls();
  while (!joy_fire) { wait_frame(); read_controls(); }
  while (joy_fire) { wait_frame(); read_controls(); }
}

void load_level_palette(byte li) {
  /* NES 4×4 pack → PCE BG pals 0..3 */
  pce_load_nes_pal(0, chase_level_pal[li]);
}

void setup_gfx(void) {
  pce_gfx_init();
  pce_disp_off();
  pce_load_nes_pal(0, chase_bg_pal);
  pce_load_nes_pal(256, chase_spr_pal);
  pce_load_tiles_planar(TILE0, chase_tiles, CHASE_NTILE);
  pce_load_sprites(SPR0, chase_sprites, CHASE_NSPR);
  pce_satb_clear();
  pce_satb_update();
  pce_disp_on();
}

void draw_title_bat_at(int y_off_tiles) {
  byte dy;
  static word blank_row[32];
  static byte blank_init;
  if (!blank_init) {
    byte x;
    for (x = 0; x < 32; x++)
      blank_row[x] = PCE_BAT(TILE0 + TILE_EMPTY, 0);
    blank_init = 1;
  }
  for (dy = 0; dy < 28; dy++) {
    int src = (int)dy - y_off_tiles;
    if (src >= 0 && src < (int)CHASE_TITLE_H)
      pce_put_bat_row(0, dy, &chase_title_bat[(word)src * CHASE_TITLE_W], 32);
    else
      pce_put_bat_row(0, dy, blank_row, 32);
  }
}

/* Only rewrite rows that change. Blank→blank is skipped (BYR wrap isn't
 * viable here: title is taller than the empty gap on a 32-row BAT). */
void draw_title_bat_delta(int old_off, int new_off) {
  byte dy;
  static word blank_row[32];
  static byte blank_init;
  if (!blank_init) {
    byte x;
    for (x = 0; x < 32; x++)
      blank_row[x] = PCE_BAT(TILE0 + TILE_EMPTY, 0);
    blank_init = 1;
  }
  if (old_off == new_off) return;
  for (dy = 0; dy < 28; dy++) {
    int src_o = (int)dy - old_off;
    int src_n = (int)dy - new_off;
    byte on_o = (byte)(src_o >= 0 && src_o < (int)CHASE_TITLE_H);
    byte on_n = (byte)(src_n >= 0 && src_n < (int)CHASE_TITLE_H);
    if (!on_o && !on_n) continue;
    if (on_o && on_n && src_o == src_n) continue;
    if (on_n)
      pce_put_bat_row(0, dy, &chase_title_bat[(word)src_n * CHASE_TITLE_W], 32);
    else
      pce_put_bat_row(0, dy, blank_row, 32);
  }
}

void draw_title_bat(void) {
  draw_title_bat_at(0);
}

void draw_level_bat(void) {
  byte y;
  for (y = 0; y < CHASE_LEVEL_H; y++)
    pce_put_bat_row(0, y, &chase_level_bat[(word)y * CHASE_LEVEL_W], 32);
}

/* NES largeNums: digit 1..5 as 2×3 tiles at nametable (20,12). */
void put_large_digit(byte digit) {
  byte j, r;
  if (digit < 1) digit = 1;
  if (digit > 5) digit = 5;
  j = (byte)((digit - 1) << 1);
  for (r = 0; r < 3; r++) {
    pce_put_tile(20, (byte)(12 + r), PCE_BAT(TILE0 + chase_large_nums[j], PAL_HUD));
    pce_put_tile(21, (byte)(12 + r), PCE_BAT(TILE0 + chase_large_nums[j + 1], PAL_HUD));
    j = (byte)(j + 10);
  }
}

/* NES blink colors: 0x0f black, 0x20 gray/white */
#define COL_BLINK_OFF  PCE_RGB(0, 0, 0)
#define COL_BLINK_ON   PCE_RGB(5, 5, 5)
/* NES scroll(-8,…): content nudged right (BXR decreases). */
#define TITLE_BXR      ((word)(0x400 - 8))
/* NES scroll(-4,…) on level banner */
#define LEVEL_BXR      ((word)(0x400 - 4))

void title_screen(void) {
  byte wait;
  int iy, dy;
  byte i;
  int last_tiles;

  hide_all_sprites();
  pce_disp_off();
  pce_band_disable();
  pce_load_nes_pal(0, chase_title_pal);
  pce_load_nes_pal(256, chase_spr_pal);
  pce_scroll(TITLE_BXR, 0);
  pce_satb_clear();
  pce_satb_update();

  /*
   * Soft tile offset (no BYR wrap): title starts fully above the screen
   * and drops in from the top. iy is in pixels (NES FP units).
   */
  iy = -(224 << FP_BITS);
  dy = 8 << FP_BITS;
  last_tiles = -100;
  draw_title_bat_at(iy >> (FP_BITS + 3));
  last_tiles = iy >> (FP_BITS + 3);
  pce_disp_on();

  wait_frames(20);
  wait = 160;
  frame_cnt = 0;
  read_controls();
  fire_prev = 1;

  while (1) {
    int tiles;
    wait_frame();
    tiles = iy >> (FP_BITS + 3);
    if (tiles != last_tiles) {
      draw_title_bat_delta(last_tiles, tiles);
      last_tiles = tiles;
    }

    read_controls();
    if (joy_fire && !fire_prev) break;
    fire_prev = joy_fire;

    iy += dy;
    if (iy > 0) {
      iy = 0;
      dy = -dy >> 1;
    }
    if (dy < (8 << FP_BITS)) dy += 2;

    if (wait)
      --wait;
    else {
      pce_set_color(2, (frame_cnt & 32) ? COL_BLINK_OFF : COL_BLINK_ON);
      ++frame_cnt;
    }
  }

  if (last_tiles != 0)
    draw_title_bat_delta(last_tiles, 0);
  for (i = 0; i < 16; i++) {
    pce_set_color(2, (i & 1) ? COL_BLINK_OFF : COL_BLINK_ON);
    wait_frames(4);
  }
  pce_scroll(0, 0);
}

void show_level_banner(void) {
  hide_all_sprites();
  pce_disp_off();
  load_level_palette(game_level);
  pce_fill_bat(0, 0, 32, 28, PCE_BAT(TILE0 + TILE_EMPTY, PAL_HUD));
  draw_level_bat();
  put_large_digit((byte)(game_level + 1));
  pce_scroll(LEVEL_BXR, 0);
  pce_disp_on();
  wait_frames(50);
  pce_scroll(0, 0);
}

void show_game_over(void) {
  byte blink = 0;
  hide_all_sprites();
  pce_disp_off();
  pce_fill_bat(0, 0, 32, 28, PCE_BAT(TILE0 + TILE_EMPTY, PAL_HUD));
  put_string(11, 12, "GAME OVER");
  pce_disp_on();
  read_controls();
  fire_prev = 1;
  while (1) {
    wait_frame();
    read_controls();
    blink++;
    if ((blink & 1) == 0)
      pce_set_color(2, (blink & 2) ? PCE_RGB(5, 1, 4) : PCE_RGB(2, 4, 7));
    if (joy_fire && !fire_prev) break;
    fire_prev = joy_fire;
  }
  while (joy_fire) { wait_frame(); read_controls(); }
}

void show_well_done(void) {
  byte blink = 0;
  hide_all_sprites();
  pce_disp_off();
  pce_fill_bat(0, 0, 32, 28, PCE_BAT(TILE0 + TILE_EMPTY, PAL_HUD));
  put_string(11, 12, "WELL DONE");
  pce_disp_on();
  read_controls();
  fire_prev = 1;
  while (1) {
    wait_frame();
    read_controls();
    blink++;
    if ((blink & 1) == 0)
      pce_set_color(2, (blink & 2) ? PCE_RGB(0, 3, 6) : PCE_RGB(2, 4, 7));
    if (joy_fire && !fire_prev) break;
    fire_prev = joy_fire;
  }
  while (joy_fire) { wait_frame(); read_controls(); }
}

void game_loop(void) {
  byte i;
  hide_all_sprites();
  load_level(game_level);
  draw_hud();
  game_done = 0;
  game_clear = 0;
  game_paused = 0;
  frame_cnt = 0;
  fire_prev = 1;
  while (!game_done) {
    wait_frame();
    /* Post-DMA vblank: BAT + sprites */
    animate_gems();
    draw_actors();

    frame_cnt++;
    read_controls();
    if (joy_fire && !fire_prev) {
      game_paused = !game_paused;
      draw_hud();
    }
    fire_prev = joy_fire;
    if (game_paused) continue;

    if (items_collected >= items_count && !game_clear) {
      game_clear = 1;
      game_done = 1;
    }

    if (spawn_wait) --spawn_wait;

    for (i = 0; i < actor_n; i++) {
      if (actors[i].wait) {
        actors[i].wait--;
        continue;
      }
      if (spawn_wait) continue;
      advance_actor(i);
      if (!actors[i].cnt) {
        if (i == 0) player_controls();
        else enemy_ai(i);
      }
    }
    if (!game_clear && hit_player()) {
      game_done = 1;
      wait_frames(60);
    }
  }
  if (game_clear) wait_frames(50);
  hide_all_sprites();
}

int main(void) {
  joy_install(joy_static_stddrv);
  setup_gfx();

  for (;;) {
    title_screen();
    game_level = 0;
    game_lives = 4;
    while (game_lives && game_level < LEVELS_ALL) {
      show_level_banner();
      game_loop();
      if (game_clear) game_level++;
      else game_lives--;
    }
    if (!game_lives) show_game_over();
    else show_well_done();
  }
  return 0;
}
