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

void put_char(byte x, byte y, char ch) {
  pce_put_tile(x, y, PCE_BAT(TILE0 + font_code(ch), 0));
}

void put_string(byte x, byte y, const char* s) {
  while (*s) put_char(x++, y, *s++);
}

void put_digit(byte x, byte y, byte d) {
  pce_put_tile(x, y, PCE_BAT(TILE0 + TILE_DIGIT + (d % 10), 0));
}

void hide_all_sprites(void) {
  byte i;
  for (i = 0; i < ACTORS_MAX; i++)
    PCE_SPR_HIDE(i);
  pce_satb_update_n(ACTORS_MAX);
}

void set_cell_tiles(byte mx, byte my, byte tl, byte tr, byte bl, byte br) {
  byte sx = (byte)(mx << 1);
  byte sy = (byte)((byte)(MAP_Y0 + my) << 1);
  static word row[2];
  word addr = PCE_BAT_ADDR_XY(sx, sy);
  row[0] = PCE_BAT(TILE0 + tl, 0);
  row[1] = PCE_BAT(TILE0 + tr, 0);
  pce_vram_burst(addr, row, 4);
  row[0] = PCE_BAT(TILE0 + bl, 0);
  row[1] = PCE_BAT(TILE0 + br, 0);
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
  pce_load_tiles(TILE0 + TILE_GEM0_TL, src, 4);
}

void draw_cell(byte x, byte y) {
  byte t = map_at(x, y);
  if (t == T_WALL)
    set_cell_tiles(x, y, TILE_WALL_TL, TILE_WALL_TR, TILE_WALL_BL, TILE_WALL_BR);
  else if (t == T_ITEM)
    set_cell_tiles(x, y, TILE_GEM0_TL, TILE_GEM0_TR, TILE_GEM0_BL, TILE_GEM0_BR);
  else if (t == T_FLOOR)
    set_cell_tiles(x, y, TILE_FLOOR, TILE_FLOOR, TILE_FLOOR, TILE_FLOOR);
  else
    set_cell_tiles(x, y, TILE_EMPTY, TILE_EMPTY, TILE_EMPTY, TILE_EMPTY);
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
  pce_fill_bat(0, 0, 32, 28, PCE_BAT(TILE0 + TILE_EMPTY, 0));
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
  spawn_wait = (byte)(actor_n << 4);
}

void draw_actors(void) {
  byte i;
  word attr = PCE_SPR_PRI | PCE_SPR_PAL(0);
  for (i = 0; i < ACTORS_MAX; i++)
    PCE_SPR_HIDE(i);
  for (i = 0; i < actor_n; i++) {
    Actor* a = &actors[i];
    word px = (word)(PCE_SPR_X0 + (a->x >> FP_BITS));
    word py = (word)(PCE_SPR_Y0 + (MAP_Y0 * TILE_SIZE) + (a->y >> FP_BITS));
    byte shape;
    if (a->wait && (a->wait >= 16 || (a->wait & 2)))
      continue;
    if (a->kind == 0)
      shape = (frame_cnt & 8) ? SPR_PLAYER2 : SPR_PLAYER;
    else
      shape = SPR_ENEMY;
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

void setup_gfx(void) {
  pce_gfx_init();
  pce_disp_off();
  pce_load_palette(0, chase_bg_pal, 16);
  pce_load_palette(256, chase_spr_pal, 16);
  pce_load_tiles(TILE0, chase_tiles, CHASE_NTILE);
  pce_load_sprites(SPR0, chase_sprites, CHASE_NSPR);
  pce_satb_clear();
  pce_satb_update();
  pce_disp_on();
}

void title_screen(void) {
  hide_all_sprites();
  pce_fill_bat(0, 0, 32, 28, PCE_BAT(TILE0 + TILE_EMPTY, 0));
  put_string(13, 10, "CHASE");
  put_string(9, 14, "PRESS RUN / I");
  wait_for_fire();
}

void show_level_banner(void) {
  hide_all_sprites();
  pce_fill_bat(0, 0, 32, 28, PCE_BAT(TILE0 + TILE_EMPTY, 0));
  put_string(11, 12, "LEVEL");
  put_digit(17, 12, (byte)(game_level + 1));
  wait_frames(50);
}

void show_game_over(void) {
  hide_all_sprites();
  pce_fill_bat(0, 0, 32, 28, PCE_BAT(TILE0 + TILE_EMPTY, 0));
  put_string(11, 12, "GAME OVER");
  wait_for_fire();
}

void show_well_done(void) {
  hide_all_sprites();
  pce_fill_bat(0, 0, 32, 28, PCE_BAT(TILE0 + TILE_EMPTY, 0));
  put_string(11, 12, "WELL DONE");
  wait_for_fire();
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
