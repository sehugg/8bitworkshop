/*
 * Chase for Game Boy — port of Shiru's NES Chase (presets/nes/chase).
 *
 * Level maps match the NES nametables exactly (cropped to content).
 * Camera scrolls only when a level exceeds the 160×136 playfield.
 * Title bounce matches NES title_screen() physics.
 * Music/SFX from Coleco (NES FamiTone transcription).
 * Graphics from presets/nes/chase/tileset.chr
 * (regenerate with: python3 scripts/gen_chase_nes_gfx.py).
 *
 * Controls: D-pad move, Start = pause, A = start / continue.
 */

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"
#include <stdint.h>
#include <string.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"

typedef uint8_t byte;
typedef uint16_t word;

#define MAP_W_MAX    16
#define MAP_H_MAX    13
#define LEVELS_FIXED 5   /* hand-authored NES layouts */
#define ACTORS_MAX   4

#define TILE_PX      16
#define FP_BITS      4
#define TILE_TO_POS(t)  ((word)(t) << (4 + FP_BITS))
#define POS_TO_TILE(p)  ((byte)((p) >> (4 + FP_BITS)))
#define POS_SNAP_MASK   0xff00

/* Visible playfield above bottom HUD (window at WY=136) */
#define VIEW_W       160
#define VIEW_H       136
#define VIEW_TILES_W 20
#define VIEW_TILES_H 17
#define HUD_WY       136

#define T_FLOOR  0
#define T_WALL   1
#define T_ITEM   2
#define T_VOID   3  /* outside irregular NES silhouette — blank, solid */

#define DIR_NONE  0
#define DIR_LEFT  1
#define DIR_RIGHT 2
#define DIR_UP    4
#define DIR_DOWN  8

#define BKG_BASE     32
#define TILE_WTL     (BKG_BASE + 0)
#define TILE_WTR     (BKG_BASE + 1)
#define TILE_WBL     (BKG_BASE + 2)
#define TILE_WBR     (BKG_BASE + 3)
#define TILE_FLOOR   (BKG_BASE + 4)
#define TILE_GTL     (BKG_BASE + 5)
#define TILE_GTR     (BKG_BASE + 6)
#define TILE_GBL     (BKG_BASE + 7)
#define TILE_GBR     (BKG_BASE + 8)
#define TILE_GTL2    (BKG_BASE + 9)
#define TILE_GTR2    (BKG_BASE + 10)
#define TILE_GBL2    (BKG_BASE + 11)
#define TILE_GBR2    (BKG_BASE + 12)

#define SPR_TILE_PL   16
#define SPR_TILE_PL2  20
#define SPR_TILE_EN   24

#define ENV_MAX 13
#define ENV_SUSTAIN 7
#define MUSIC_VOICES 2

typedef struct {
  word x, y;
  word cnt;
  word speed;
  byte dir;
  byte wait;
  byte kind;
} Actor;

byte joy_left, joy_right, joy_up, joy_down, joy_fire, joy_start;
byte fire_prev, start_prev;
byte start_level; /* chosen on title screen (0-based) */

byte map[MAP_W_MAX * MAP_H_MAX];
Actor actors[ACTORS_MAX];
byte actor_n;
byte game_level;
byte game_lives;
byte items_count;
byte items_collected;
byte game_clear;
byte game_done;
byte game_paused;
byte spawn_wait;
word rnd = 0xCACE;
byte frame_cnt;
byte cam_x, cam_y;
byte cam_max_x, cam_max_y;
byte map_w, map_h;       /* current level size (cells) */
byte map_tx0, map_ty0;   /* BG tile origin — inset when level fits */
byte map_ox, map_oy;     /* pixel origin (= map_t*8) */

byte voice_vol[3];
byte voice_note[3];
word voice_per[3];
byte cur_duration;
byte music_speed;
byte music_release;
byte music_enable;
byte music_paused;
const uint8_t* music_ptr;
const uint8_t* music_loop;
byte chord[4];
byte chord_n;
const uint8_t* sfx_ptr;
byte sfx_timer;
byte sfx_vol;
byte sfx_busy; /* ch1 claimed by SFX */
byte hw_note[3]; /* last note pushed to hardware (avoid retrigger clicks) */


/*
 * Level maps — exact NES Chase layouts (from levelN_nam.h metatiles).
 *   # wall   * gem   P player   1/2/3 enemies   (space) void outside shape
 * After these five, generate_level() builds endless mazes (no dead ends,
 * corner pillars so diagonals stay walls, orthogonal exits only).
 */
typedef struct {
  byte w, h;
  const char* const* rows;
} Level;

const char* const level_1[] = {
  "########",
  "#P*****#",
  "#*####*#",
  "#******#",
  "#*####*#",
  "#*****1#",
  "########",
};

const char* const level_2[] = {
  "##########",
  "#P***#**1#",
  "#*##*#*#*#",
  "#********#",
  "###*#*#*##",
  "#********#",
  "#*#*#*##*#",
  "#2*******#",
  "##########",
};

const char* const level_3[] = {
  "  ##########  ",
  "  #P***#**1#  ",
  "###*##*#*#*###",
  "#********#***#",
  "#*#*#*##*#*#*#",
  "#***#********#",
  "###*#*#*##*###",
  "  #***#***2#  ",
  "  ##########  ",
};

const char* const level_4[] = {
  "  ######      ",
  "  #P***#######",
  "  #*##*#****1#",
  "###*##*#*#*#*#",
  "#**********#*#",
  "#*#*#*##*#*#*#",
  "#*#**********#",
  "#*#*#*#*##*###",
  "#2****#*##*#  ",
  "#######***3#  ",
  "      ######  ",
};

const char* const level_5[] = {
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
};

const Level levels[LEVELS_FIXED] = {
  {  8,  7, level_1 },
  { 10,  9, level_2 },
  { 14,  9, level_3 },
  { 14, 11, level_4 },
  { 16, 13, level_5 },
};

/* Filled by generate_level() for endless mazes after the fixed set */
char gen_row[MAP_H_MAX][MAP_W_MAX + 1];
byte gen_w, gen_h;
/* Compact CHASE wordmark (wall tiles), fits GB 20-tile width */
const uint8_t title_logo[6][20] = {
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,35,34,0,34,0,34,0,0,35,0,0,0,35,34,0,34,35,34,0},
  {32,0,0,0,32,0,32,0,32,0,32,0,32,0,0,0,32,0,0,0},
  {34,0,0,0,34,35,34,0,34,35,34,0,0,35,0,0,34,35,0,0},
  {32,0,0,0,32,0,32,0,32,0,32,0,0,0,32,0,32,0,0,0},
  {0,35,34,0,34,0,34,0,34,0,34,0,34,35,0,0,34,35,34,0},
};


/* GB pulse periods; index 0x28 ~= C4 (matches Coleco/SFX note indices) */
const word gb_note_per[64] = {
  0x000,0x000,0x000,0x000,0x000,0x000,0x000,0x000,
  0x000,0x000,0x000,0x000,0x000,0x000,0x000,0x000,
  0x02c,0x09d,0x107,0x16b,0x1c9,0x223,0x277,0x2c7,
  0x312,0x358,0x39b,0x3da,0x416,0x44e,0x483,0x4b5,
  0x4e5,0x511,0x53b,0x563,0x589,0x5ac,0x5ce,0x5ed,
  0x60b,0x627,0x642,0x65b,0x672,0x689,0x69e,0x6b2,
  0x6c4,0x6d6,0x6e7,0x6f7,0x706,0x714,0x721,0x72d,
  0x739,0x744,0x74f,0x759,0x762,0x76b,0x773,0x77b,
};

const uint8_t mus_level[] = {
0x1c,0x28,0x82, 0x1c,0x28,0x82, 0x1e,0x2a,0x8c,
  0xff
};

const uint8_t mus_game[] = {
0x17,0x23,0x81,0x00,0x00,0x83,0x17,0x23,0x81,0x00,0x00,0x81,0x16,0x22,0x82,
  0x1c,0x28,0x81,0x00,0x00,0x87,0x15,0x21,0x81,0x00,0x00,0x83,0x15,0x21,0x82,
  0x14,0x20,0x82,0x1c,0x28,0x81,0x00,0x00,0x87,0x17,0x23,0x81,0x00,0x00,0x83,
  0x17,0x23,0x81,0x00,0x00,0x81,0x16,0x22,0x82,0x1c,0x28,0x81,0x00,0x00,0x83,
  0x16,0x22,0x81,0x00,0x00,0x83,0x15,0x21,0x81,0x00,0x00,0x83,0x15,0x21,0x82,
  0x1c,0x28,0x81,0x14,0x20,0x83,0x00,0x00,0x86,0x17,0x23,0x81,0x00,0x00,0x83,
  0x17,0x23,0x81,0x00,0x00,0x81,0x16,0x22,0x82,0x1c,0x28,0x81,0x00,0x00,0x83,
  0x16,0x22,0x81,0x00,0x00,0x83,0x15,0x21,0x81,0x00,0x00,0x83,0x15,0x21,0x82,
  0x14,0x20,0x82,0x1c,0x28,0x81,0x00,0x00,0x87,0x12,0x1e,0x81,0x00,0x00,0x83,
  0x12,0x1e,0x81,0x00,0x00,0x81,0x14,0x20,0x82,0x1c,0x28,0x81,0x00,0x00,0x83,
  0x15,0x21,0x82,0x1c,0x28,0x81,0x17,0x23,0x85,0x00,0x00,0x8c,
  0xff
};

const uint8_t mus_clear[] = {
0x21,0x2d,0x81,0x00,0x00,0x81,0x21,0x2d,0x81,0x00,0x00,0x81,0x21,0x2d,0x81,
  0x00,0x00,0x83,0x21,0x2d,0x81,0x00,0x00,0x81,0x21,0x2d,0x81,0x00,0x00,0x81,
  0x23,0x2f,0x89,0x00,0x00,0x8b,
  0xff
};

const uint8_t mus_lose[] = {
0x1c,0x28,0x88, 0x19,0x25,0x84, 0x17,0x23,0x94,
  0xff
};

const uint8_t mus_gameover[] = {
0x15,0x21,0x81,0x15,0x21,0x83,0x14,0x20,0x81,0x14,0x20,0x83,0x13,0x1f,0x81,
  0x13,0x1f,0x83,0x12,0x1e,0x82,0x10,0x1c,0x86,0x1c,0x28,0x8c,
  0xff
};

const uint8_t mus_welldone[] = {
0x17,0x23,0x88,0x23,0x2f,0x86,0x23,0x2f,0x86,0x23,0x2f,0x88,0x17,0x23,0x84,
  0x15,0x21,0x88,0x21,0x2d,0x86,0x21,0x2d,0x86,0x21,0x2d,0x88,0x15,0x21,0x84,
  0x17,0x23,0x88,0x23,0x2f,0x86,0x23,0x2f,0x86,0x23,0x2f,0x88,0x17,0x23,0x84,
  0x10,0x1c,0x88,0x1c,0x28,0x86,0x1e,0x2a,0x86,0x1e,0x2a,0x8c,
  0xff
};

const uint8_t sfx_start[] = {
/* C4 F4 G4 C5 F5 G5 ×3, volume steps like NES $7f/$74/$71 */
  0x28,15,4, 0x2d,14,4, 0x2f,14,4, 0x34,13,4, 0x39,12,4, 0x3b,12,4,
  0x28,12,4, 0x2d,11,4, 0x2f,11,4, 0x34,10,4, 0x39,10,4, 0x3b,9,4,
  0x28,9,4,  0x2d,8,4,  0x2f,8,4,  0x34,7,4,  0x39,7,4,  0x3b,6,4,
  0xff
};

const uint8_t sfx_item[] = {
/* short high blip: C4→F4→E4→G4 then softer repeat */
  0x28,12,1, 0x2d,11,1, 0x2c,10,1, 0x2f,9,1,
  0x28,8,1,  0x2d,7,1,  0x2c,6,1,  0x2f,5,1,
  0xff
};

const uint8_t sfx_respawn_p[] = {
/* NES pulse arpeggio — bright rising chirp */
  0x3c,10,1, 0x3e,11,1, 0x3f,12,1, 0x3c,13,1, 0x3e,14,1,
  0x3f,14,1, 0x3c,13,1, 0x3e,12,1, 0x3f,11,1,
  0x3c,9,1,  0x3e,8,1,  0x3f,7,1,  0x3c,6,1,  0x3e,5,1,
  0x3f,4,1,  0x3c,3,1,  0x3e,2,1,  0x3f,2,1,
  0xff
};

const uint8_t sfx_respawn_e[] = {
/* slightly lower / darker than player respawn */
  0x38,9,1, 0x3a,10,1, 0x3c,11,1, 0x38,12,1, 0x3a,13,1,
  0x3c,13,1, 0x38,12,1, 0x3a,11,1, 0x3c,10,1,
  0x38,8,1,  0x3a,7,1,  0x3c,6,1,  0x38,5,1,  0x3a,4,1,
  0x3c,3,1,  0x38,3,1,  0x3a,2,1,  0x3c,2,1,
  0xff
};

const uint8_t font_1bpp[] = {
  /* 0 space */ 0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  /* 1 '0' */ 0x3C,0x66,0x6E,0x76,0x66,0x66,0x3C,0x00,
  /* 2 '1' */ 0x18,0x38,0x18,0x18,0x18,0x18,0x7E,0x00,
  /* 3 '2' */ 0x3C,0x66,0x06,0x0C,0x18,0x30,0x7E,0x00,
  /* 4 '3' */ 0x3C,0x66,0x06,0x1C,0x06,0x66,0x3C,0x00,
  /* 5 '4' */ 0x0C,0x1C,0x3C,0x6C,0x7E,0x0C,0x0C,0x00,
  /* 6 '5' */ 0x7E,0x60,0x7C,0x06,0x06,0x66,0x3C,0x00,
  /* 7 '6' */ 0x1C,0x30,0x60,0x7C,0x66,0x66,0x3C,0x00,
  /* 8 '7' */ 0x7E,0x06,0x0C,0x18,0x30,0x30,0x30,0x00,
  /* 9 '8' */ 0x3C,0x66,0x66,0x3C,0x66,0x66,0x3C,0x00,
  /*10 '9' */ 0x3C,0x66,0x66,0x3E,0x06,0x0C,0x38,0x00,
  /*11 'A' */ 0x3C,0x66,0x66,0x7E,0x66,0x66,0x66,0x00,
  /*12 'C' */ 0x3C,0x66,0x60,0x60,0x60,0x66,0x3C,0x00,
  /*13 'D' */ 0x78,0x6C,0x66,0x66,0x66,0x6C,0x78,0x00,
  /*14 'E' */ 0x7E,0x60,0x60,0x7C,0x60,0x60,0x7E,0x00,
  /*15 'G' */ 0x3C,0x66,0x60,0x6E,0x66,0x66,0x3C,0x00,
  /*16 'H' */ 0x66,0x66,0x66,0x7E,0x66,0x66,0x66,0x00,
  /*17 'I' */ 0x3C,0x18,0x18,0x18,0x18,0x18,0x3C,0x00,
  /*18 'L' */ 0x60,0x60,0x60,0x60,0x60,0x60,0x7E,0x00,
  /*19 'M' */ 0x63,0x77,0x7F,0x6B,0x63,0x63,0x63,0x00,
  /*20 'N' */ 0x66,0x76,0x7E,0x7E,0x6E,0x66,0x66,0x00,
  /*21 'O' */ 0x3C,0x66,0x66,0x66,0x66,0x66,0x3C,0x00,
  /*22 'P' */ 0x7C,0x66,0x66,0x7C,0x60,0x60,0x60,0x00,
  /*23 'R' */ 0x7C,0x66,0x66,0x7C,0x6C,0x66,0x66,0x00,
  /*24 'S' */ 0x3C,0x66,0x60,0x3C,0x06,0x66,0x3C,0x00,
  /*25 'T' */ 0x7E,0x18,0x18,0x18,0x18,0x18,0x18,0x00,
  /*26 'U' */ 0x66,0x66,0x66,0x66,0x66,0x66,0x3C,0x00,
  /*27 'V' */ 0x66,0x66,0x66,0x66,0x66,0x3C,0x18,0x00,
  /*28 'W' */ 0x63,0x63,0x63,0x6B,0x7F,0x77,0x63,0x00,
  /*29 'Y' */ 0x66,0x66,0x66,0x3C,0x18,0x18,0x18,0x00,
  /*30 '/' */ 0x06,0x06,0x0C,0x18,0x30,0x60,0x60,0x00,
  /*31 ':' */ 0x00,0x18,0x18,0x00,0x18,0x18,0x00,0x00,
};

const uint8_t bkg_tiles[] = {
/* From presets/nes/chase/tileset.chr (walls/floor/gems);
 * BG pens 1:1 — NES bright → GB dark ink under BGP 0xE4. */
/*{w:8,h:8,bpp:1,count:13,brev:1,np:2,pofs:1,sl:2}*/
  0xff,0x00,0xff,0x7f,0xff,0x7f,0xe0,0x7f,
  0xef,0x7f,0xe8,0x7f,0xe8,0x7f,0xe8,0x7f,
  0xfe,0x00,0xfc,0xfe,0xfa,0xfc,0x06,0xf8,
  0xf6,0xf8,0x16,0xe8,0x16,0xe8,0x16,0xe8,
  0xe8,0x7f,0xe8,0x7f,0xe8,0x7f,0xef,0x78,
  0xe0,0x7f,0xdf,0x60,0xbf,0x40,0x00,0x00,
  0x16,0xe8,0x16,0xe8,0x16,0xe8,0xf6,0x08,
  0x06,0xf8,0xfe,0x00,0xfe,0x00,0x00,0x00,
  0xea,0x00,0xe5,0x00,0xea,0x00,0x05,0x00,
  0xae,0x00,0x5e,0x00,0xae,0x00,0x50,0x00,
  0xea,0x00,0xe5,0x00,0xea,0x00,0x05,0x00,
  0xac,0x00,0x58,0x03,0xa3,0x07,0x53,0x07,
  0xea,0x00,0xe5,0x00,0xea,0x00,0x05,0x00,
  0x2e,0x00,0x1e,0xc0,0x8e,0xe0,0x40,0xa0,
  0xe2,0x07,0xe1,0x06,0xe0,0x03,0x00,0x00,
  0xae,0x00,0x5e,0x00,0xae,0x00,0x50,0x00,
  0x8a,0x20,0x05,0x20,0x0a,0xc0,0x05,0x00,
  0xae,0x00,0x5e,0x00,0xae,0x00,0x50,0x00,
  0xea,0x00,0xe5,0x00,0xea,0x00,0x04,0x00,
  0xa8,0x03,0x53,0x07,0xa3,0x07,0x52,0x07,
  0xea,0x00,0xe5,0x00,0xea,0x00,0x05,0x00,
  0x0e,0xc0,0x8e,0xe0,0x4e,0xa0,0x80,0x20,
  0xe1,0x06,0xe0,0x03,0xe8,0x00,0x05,0x00,
  0xae,0x00,0x5e,0x00,0xae,0x00,0x50,0x00,
  0x0a,0x20,0x05,0xc0,0x2a,0x00,0x05,0x00,
  0xae,0x00,0x5e,0x00,0xae,0x00,0x50,0x00,
};

const uint8_t sprite_tiles[] = {
/* From NES metasprites; 8x16 L/R pairs (player, player2, enemy);
 * pen0 clear; pen1 black→3, pen2 body→2, pen3 white→1. */
/*{w:8,h:8,bpp:1,count:12,brev:1,np:2,pofs:1,sl:2}*/
  0x00,0x00,0x3f,0x3f,0x60,0x7f,0x5f,0x60,
  0x5f,0x6e,0x5f,0x72,0x5f,0x76,0x5f,0x76,
  0x5f,0x7e,0x5f,0x60,0x5f,0x60,0x47,0x7f,
  0x67,0x7c,0x7f,0x7e,0x3f,0x3f,0x00,0x00,
  0x00,0x00,0xfc,0xfc,0x06,0xfe,0xf2,0x0e,
  0xf2,0x7e,0xfa,0x4e,0xfa,0x6e,0xfa,0x6e,
  0xfa,0x7e,0xf2,0x0e,0xf2,0x0e,0xe2,0xfe,
  0xe6,0x3e,0xfe,0x7e,0xfc,0xfc,0x00,0x00,
  0x3f,0x3f,0x60,0x7f,0x5f,0x60,0x5f,0x6e,
  0x5f,0x72,0x5f,0x76,0x5f,0x76,0x5f,0x7e,
  0x5f,0x60,0x5f,0x60,0x47,0x7f,0x67,0x7c,
  0x7f,0x7e,0x3f,0x3f,0x00,0x00,0x00,0x00,
  0xfc,0xfc,0x06,0xfe,0xf2,0x0e,0xf2,0x7e,
  0xfa,0x4e,0xfa,0x6e,0xfa,0x6e,0xfa,0x7e,
  0xf2,0x0e,0xf2,0x0e,0xe2,0xfe,0xe6,0x3e,
  0xfe,0x7e,0xfc,0xfc,0x00,0x00,0x00,0x00,
  0x00,0x00,0x7f,0x7f,0x40,0x7f,0x5f,0x60,
  0x7f,0x7f,0x5f,0x7f,0x5e,0x77,0x5f,0x76,
  0x5f,0x72,0x5f,0x6e,0x5f,0x60,0x4b,0x77,
  0x67,0x7e,0x3f,0x3c,0x1f,0x1f,0x00,0x00,
  0x00,0x00,0xfe,0xfe,0x02,0xfe,0xf2,0x0e,
  0xfe,0xfe,0xfa,0xfe,0x7a,0xee,0xfa,0x6e,
  0xfa,0x4e,0xf2,0x7e,0xf2,0x0e,0xd2,0xee,
  0xe6,0x7e,0xfc,0x3c,0xf8,0xf8,0x00,0x00,
};


byte rand8(void) {
  rnd = rnd * 17 + 53;
  return (byte)(rnd >> 8);
}

void read_controls(void) {
  byte j = joypad();
  joy_left  = (j & J_LEFT) != 0;
  joy_right = (j & J_RIGHT) != 0;
  joy_up    = (j & J_UP) != 0;
  joy_down  = (j & J_DOWN) != 0;
  joy_fire  = (j & J_A) != 0;
  joy_start = (j & J_START) != 0;
}

void psg_init(void) {
  NR52_REG = 0x80;
  NR51_REG = 0xFF;
  NR50_REG = 0x77;
  NR10_REG = 0x00;
}

void gb_ch_off(byte ch) {
  if (ch == 0) { NR12_REG = 0x00; NR14_REG = 0x80; hw_note[0] = 0; }
  else { NR22_REG = 0x00; NR24_REG = 0x80; hw_note[1] = 0; }
}

void gb_ch_on(byte ch, byte note, word per, byte vol) {
  byte lo = (byte)(per & 0xFF);
  byte hi = (byte)((per >> 8) & 0x07);
  byte v = vol > 15 ? 15 : vol;
  byte retrig = (hw_note[ch] != note);
  hw_note[ch] = note;
  if (ch == 0) {
    NR10_REG = 0x00;
    NR11_REG = 0x80; /* 50% duty */
    if (retrig) NR12_REG = (byte)((v << 4) | 0x00);
    NR13_REG = lo;
    NR14_REG = (byte)((retrig ? 0x80 : 0x00) | hi);
  } else {
    NR21_REG = 0x80;
    if (retrig) NR22_REG = (byte)((v << 4) | 0x00);
    NR23_REG = lo;
    NR24_REG = (byte)((retrig ? 0x80 : 0x00) | hi);
  }
}

void set_voice(byte ch, byte note, byte vol) {
  if (note < 0x10) {
    voice_note[ch] = 0;
    voice_vol[ch] = 0;
    return;
  }
  voice_per[ch] = gb_note_per[note & 63];
  voice_note[ch] = note;
  voice_vol[ch] = vol;
}

void mute_voice(byte ch) {
  voice_note[ch] = 0;
  voice_vol[ch] = 0;
}

void sn_update_hw(void) {
  /* bass = ch2 (NR2), lead = ch1 (NR1) unless SFX owns ch1 */
  if (voice_vol[0] && voice_note[0])
    gb_ch_on(1, voice_note[0], voice_per[0], voice_vol[0]);
  else
    gb_ch_off(1);

  if (sfx_busy) {
    if (sfx_vol)
      gb_ch_on(0, voice_note[2], voice_per[2], sfx_vol);
    else
      gb_ch_off(0);
  } else if (voice_vol[1] && voice_note[1]) {
    gb_ch_on(0, voice_note[1], voice_per[1], voice_vol[1]);
  } else {
    gb_ch_off(0);
  }
}

byte next_music_byte(void) {
  if (!music_ptr) return 0xff;
  return *music_ptr++;
}

void sfx_stop(void) {
  sfx_ptr = 0;
  sfx_timer = 0;
  sfx_vol = 0;
  sfx_busy = 0;
  mute_voice(2);
  hw_note[0] = 0; /* allow lead to retrigger after SFX */
}

void sfx_play(const uint8_t* seq) {
  sfx_ptr = seq;
  sfx_timer = 0;
  sfx_vol = 0;
  sfx_busy = 1;
  hw_note[0] = 0; /* force retrigger on first SFX note */
}

void sfx_update(void) {
  byte note, frames;
  if (!sfx_ptr) return;
  if (sfx_timer) {
    sfx_timer--;
    if (sfx_timer) return;
  }
  note = *sfx_ptr++;
  if (note == 0xff) {
    sfx_stop();
    return;
  }
  sfx_vol = *sfx_ptr++;
  frames = *sfx_ptr++;
  if (!frames) frames = 1;
  sfx_timer = frames;
  if (note & 0x80) {
    mute_voice(2);
    sfx_vol = 0;
  } else {
    set_voice(2, note & 63, sfx_vol);
  }
}

void music_stop(void) {
  byte i;
  music_enable = 0;
  music_ptr = 0;
  music_loop = 0;
  chord_n = 0;
  music_release = 0;
  for (i = 0; i < MUSIC_VOICES; i++) mute_voice(i);
  hw_note[0] = hw_note[1] = hw_note[2] = 0;
}

void music_play(const uint8_t* music, byte loop) {
  byte i;
  music_enable = 0;
  music_paused = 0;
  music_ptr = music;
  music_loop = loop ? music : 0;
  cur_duration = 0;
  chord_n = 0;
  music_release = 0;
  if (music == mus_game || music == mus_welldone) music_speed = 4;
  else if (music == mus_gameover) music_speed = 6;
  else music_speed = 3;
  for (i = 0; i < MUSIC_VOICES; i++) mute_voice(i);
  music_enable = 1;
}

void flush_chord(void) {
  byte bass = (chord_n >= 1) ? chord[0] : 0;
  byte lead = (chord_n >= 2) ? chord[1] : 0;
  chord_n = 0;
  if (bass) { set_voice(0, bass & 63, ENV_MAX); music_release = 0; }
  else if (voice_note[0]) music_release = 1;
  else mute_voice(0);
  if (lead) { set_voice(1, lead & 63, ENV_MAX); music_release = 0; }
  else if (voice_note[1]) music_release = 1;
  else mute_voice(1);
}

void music_seq(void) {
  byte ch, floor, note;
  if (!music_enable || music_paused) return;
  floor = music_release ? 0 : ENV_SUSTAIN;
  for (ch = 0; ch < MUSIC_VOICES; ch++) {
    if (voice_vol[ch] > floor) {
      voice_vol[ch] -= music_release ? 2 : 1;
      if (voice_vol[ch] < floor || (music_release && voice_vol[ch] > 200))
        voice_vol[ch] = floor;
    } else if (music_release && voice_vol[ch] == 0 && voice_note[ch]) {
      mute_voice(ch);
    }
  }
  if (!music_ptr) {
    if (music_loop) music_ptr = music_loop;
    else return;
  }
  if (cur_duration) { cur_duration--; return; }
  while (1) {
    note = next_music_byte();
    if (note == 0xff) {
      music_ptr = music_loop;
      if (!music_ptr) { music_enable = 0; return; }
      continue;
    }
    if (note & 0x80) {
      flush_chord();
      cur_duration = (note & 63) * music_speed;
      if (!cur_duration) cur_duration = music_speed;
      cur_duration--;
      return;
    }
    if (chord_n < 4) chord[chord_n++] = note;
  }
}

void music_update(void) {
  sfx_update();
  music_seq();
  sn_update_hw();
}

void wait_vblank(void) {
  wait_vbl_done();
  music_update();
}

void wait_frames(byte n) {
  while (n--) wait_vblank();
}

byte map_at(byte x, byte y) {
  if (x >= map_w || y >= map_h) return T_WALL;
  return map[y * MAP_W_MAX + x];
}

void map_set(byte x, byte y, byte t) {
  map[y * MAP_W_MAX + x] = t;
}

byte can_enter(byte tx, byte ty) {
  byte t = map_at(tx, ty);
  return t == T_FLOOR || t == T_ITEM;
}

byte glyph(char c) {
  if (c == ' ') return 0;
  if (c >= '0' && c <= '9') return (byte)(1 + (c - '0'));
  if (c == '/') return 30;
  if (c == ':') return 31;
  switch (c) {
    case 'A': return 11; case 'C': return 12; case 'D': return 13;
    case 'E': return 14; case 'G': return 15; case 'H': return 16;
    case 'I': return 17; case 'L': return 18; case 'M': return 19;
    case 'N': return 20; case 'O': return 21; case 'P': return 22;
    case 'R': return 23; case 'S': return 24; case 'T': return 25;
    case 'U': return 26; case 'V': return 27; case 'W': return 28;
    case 'Y': return 29;
    default: return 0;
  }
}

void put_str(byte x, byte y, const char* s) {
  while (*s) set_bkg_tile_xy(x++, y, glyph(*s++));
}

void put_digit(byte x, byte y, byte d) {
  set_bkg_tile_xy(x, y, (byte)(1 + (d % 10)));
}

void put_str_win(byte x, byte y, const char* s) {
  while (*s) set_win_tile_xy(x++, y, glyph(*s++));
}

void put_digit_win(byte x, byte y, byte d) {
  set_win_tile_xy(x, y, (byte)(1 + (d % 10)));
}

void clrscr(void) {
  byte x, y;
  for (y = 0; y < 32; y++)
    for (x = 0; x < 32; x++)
      set_bkg_tile_xy(x, y, 0);
}

void hide_actor_sprites(byte i) {
  byte s = (byte)(i << 1);
  move_sprite(s, 0, 0);
  move_sprite((byte)(s + 1), 0, 0);
}

void hide_all_sprites(void) {
  byte i;
  for (i = 0; i < 40; i++) move_sprite(i, 0, 0);
}

void update_camera(void) {
  word px = actors[0].x >> FP_BITS;
  word py = actors[0].y >> FP_BITS;
  word tx, ty;
  /* Free axes follow the player; locked axes keep load_level placement. */
  if (cam_max_x == 0) {
    tx = cam_x;
  } else {
    if (px > (VIEW_W / 2)) tx = px - (VIEW_W / 2); else tx = 0;
    if (tx > cam_max_x) tx = cam_max_x;
  }
  if (cam_max_y == 0) {
    ty = cam_y;
  } else {
    if (py > (VIEW_H / 2)) ty = py - (VIEW_H / 2); else ty = 0;
    if (ty > cam_max_y) ty = cam_max_y;
  }
  cam_x = (byte)tx;
  cam_y = (byte)ty;
  move_bkg(cam_x, cam_y);
}

void draw_actors(void) {
  byte i;
  for (i = 0; i < actor_n; i++) {
    Actor* a = &actors[i];
    int16_t sx, sy;
    byte base, prop, s;
    s = (byte)(i << 1);
    if (a->wait) {
      if (a->wait >= 16 || (a->wait & 2)) { hide_actor_sprites(i); continue; }
    }
    sx = (int16_t)(a->x >> FP_BITS) + (int16_t)map_ox - (int16_t)cam_x;
    sy = (int16_t)(a->y >> FP_BITS) + (int16_t)map_oy - (int16_t)cam_y;
    /* hide if fully outside playfield */
    /* hide if off playfield or X would wrap through OAM (byte) cast */
    if (sx < -8 || sx >= VIEW_W || sy < -16 || sy >= VIEW_H) {
      hide_actor_sprites(i);
      continue;
    }
    if (a->kind == 0)
      base = (frame_cnt & 8) ? SPR_TILE_PL2 : SPR_TILE_PL;
    else
      base = SPR_TILE_EN;
    prop = (a->kind >= 2) ? S_PALETTE : 0;
    set_sprite_tile(s, base);
    set_sprite_tile((byte)(s + 1), (byte)(base + 2));
    set_sprite_prop(s, prop);
    set_sprite_prop((byte)(s + 1), prop);
    move_sprite(s, (byte)(sx + 8), (byte)(sy + 16));
    move_sprite((byte)(s + 1), (byte)(sx + 16), (byte)(sy + 16));
  }
}

void draw_cell(byte x, byte y) {
  byte t = map_at(x, y);
  byte sx = (byte)(map_tx0 + (x << 1));
  byte sy = (byte)(map_ty0 + (y << 1));
  byte spark = (frame_cnt & 16) != 0;
  if (t == T_VOID) {
    set_bkg_tile_xy(sx, sy, 0);
    set_bkg_tile_xy(sx + 1, sy, 0);
    set_bkg_tile_xy(sx, sy + 1, 0);
    set_bkg_tile_xy(sx + 1, sy + 1, 0);
  } else if (t == T_WALL) {
    set_bkg_tile_xy(sx, sy, TILE_WTL);
    set_bkg_tile_xy(sx + 1, sy, TILE_WTR);
    set_bkg_tile_xy(sx, sy + 1, TILE_WBL);
    set_bkg_tile_xy(sx + 1, sy + 1, TILE_WBR);
  } else if (t == T_ITEM) {
    if (spark) {
      set_bkg_tile_xy(sx, sy, TILE_GTL2);
      set_bkg_tile_xy(sx + 1, sy, TILE_GTR2);
      set_bkg_tile_xy(sx, sy + 1, TILE_GBL2);
      set_bkg_tile_xy(sx + 1, sy + 1, TILE_GBR2);
    } else {
      set_bkg_tile_xy(sx, sy, TILE_GTL);
      set_bkg_tile_xy(sx + 1, sy, TILE_GTR);
      set_bkg_tile_xy(sx, sy + 1, TILE_GBL);
      set_bkg_tile_xy(sx + 1, sy + 1, TILE_GBR);
    }
  } else {
    set_bkg_tile_xy(sx, sy, TILE_FLOOR);
    set_bkg_tile_xy(sx + 1, sy, TILE_FLOOR);
    set_bkg_tile_xy(sx, sy + 1, TILE_FLOOR);
    set_bkg_tile_xy(sx + 1, sy + 1, TILE_FLOOR);
  }
}

void draw_hud(void) {
  byte lv = (byte)(game_level + 1);
  put_str_win(0, 0, "L");
  put_digit_win(1, 0, lv / 10);
  put_digit_win(2, 0, lv % 10);
  put_str_win(4, 0, "G");
  put_digit_win(5, 0, items_collected / 10);
  put_digit_win(6, 0, items_collected % 10);
  put_str_win(7, 0, "/");
  put_digit_win(8, 0, items_count / 10);
  put_digit_win(9, 0, items_count % 10);
  put_str_win(11, 0, "H");
  put_digit_win(12, 0, game_lives > 0 ? (byte)(game_lives - 1) : 0);
  if (game_paused) put_str_win(14, 0, "PAUSE");
  else put_str_win(14, 0, "     ");
}

void show_menu_screen(void) {
  HIDE_WIN;
  hide_all_sprites();
  move_bkg(0, 0);
  cam_x = cam_y = 0;
  clrscr();
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
  a->cnt = (word)TILE_PX << FP_BITS;
}

void try_collect(byte id) {
  byte tx, ty;
  Actor* a = &actors[id];
  if (id != 0 || a->wait) return;
  tx = POS_TO_TILE(a->x);
  ty = POS_TO_TILE(a->y);
  if (map_at(tx, ty) != T_ITEM) return;
  map_set(tx, ty, T_FLOOR);
  draw_cell(tx, ty);
  items_collected++;
  sfx_play(sfx_item);
  draw_hud();
}

byte gen_is_open(char c) {
  return c == '*' || c == 'P' || c == '1' || c == '2' || c == '3';
}

/* Corner pillars (even,even) stay walls — diagonals of every floor stay solid. */
byte gen_is_pillar(byte x, byte y) {
  return !(x & 1) && !(y & 1);
}

byte gen_ortho_degree(byte x, byte y) {
  byte n = 0;
  if (gen_is_open(gen_row[y - 1][x])) n++;
  if (gen_is_open(gen_row[y + 1][x])) n++;
  if (gen_is_open(gen_row[y][x - 1])) n++;
  if (gen_is_open(gen_row[y][x + 1])) n++;
  return n;
}

/* May open (x,y) only if it is not a pillar and does not form a 2×2 floor block. */
byte gen_can_open(byte x, byte y) {
  if (x < 1 || y < 1 || x >= gen_w - 1 || y >= gen_h - 1) return 0;
  if (gen_is_pillar(x, y)) return 0;
  if (gen_is_open(gen_row[y][x])) return 0;
  /* Four possible 2×2 blocks that would include this cell */
  if (gen_is_open(gen_row[y - 1][x - 1]) && gen_is_open(gen_row[y - 1][x]) &&
      gen_is_open(gen_row[y][x - 1]))
    return 0;
  if (gen_is_open(gen_row[y - 1][x]) && gen_is_open(gen_row[y - 1][x + 1]) &&
      gen_is_open(gen_row[y][x + 1]))
    return 0;
  if (gen_is_open(gen_row[y][x - 1]) && gen_is_open(gen_row[y + 1][x - 1]) &&
      gen_is_open(gen_row[y + 1][x]))
    return 0;
  if (gen_is_open(gen_row[y][x + 1]) && gen_is_open(gen_row[y + 1][x]) &&
      gen_is_open(gen_row[y + 1][x + 1]))
    return 0;
  return 1;
}

byte gen_try_open(byte x, byte y) {
  if (!gen_can_open(x, y)) return 0;
  gen_row[y][x] = '*';
  return 1;
}

/* Keep every even,even cell as a wall (border + interior pillars). */
void gen_force_pillars(void) {
  byte x, y;
  for (y = 0; y < gen_h; y++) {
    for (x = 0; x < gen_w; x++) {
      if (gen_is_pillar(x, y)) gen_row[y][x] = '#';
    }
  }
}

/*
 * Remove cul-de-sacs: prefer opening an orthogonal wall (never a pillar / 2×2),
 * otherwise fill the dead-end floor as wall. Exits are U/D/L/R only.
 */
void braid_dead_ends(void) {
  byte x, y, n, guard, changed;

  for (guard = 0; guard < 64; guard++) {
    changed = 0;
    for (y = 1; y < gen_h - 1; y++) {
      for (x = 1; x < gen_w - 1; x++) {
        if (!gen_is_open(gen_row[y][x])) continue;
        n = gen_ortho_degree(x, y);
        if (n >= 2) continue;
        /* Prefer opening opposite the single exit. */
        if (n == 1) {
          if (gen_is_open(gen_row[y - 1][x]) && gen_try_open(x, (byte)(y + 1))) {
            changed = 1;
            continue;
          }
          if (gen_is_open(gen_row[y + 1][x]) && gen_try_open(x, (byte)(y - 1))) {
            changed = 1;
            continue;
          }
          if (gen_is_open(gen_row[y][x - 1]) && gen_try_open((byte)(x + 1), y)) {
            changed = 1;
            continue;
          }
          if (gen_is_open(gen_row[y][x + 1]) && gen_try_open((byte)(x - 1), y)) {
            changed = 1;
            continue;
          }
        }
        if (gen_try_open(x, (byte)(y - 1)) || gen_try_open(x, (byte)(y + 1)) ||
            gen_try_open((byte)(x - 1), y) || gen_try_open((byte)(x + 1), y)) {
          changed = 1;
          continue;
        }
        /* Cannot add a legal exit — shrink the cul-de-sac away. */
        gen_row[y][x] = '#';
        changed = 1;
      }
    }
    if (!changed) break;
  }
}

/*
 * Binary-tree on odd cells (corner pillars stay walls), extra orthogonal
 * openings, then braid. No dead ends; no 2×2 floors; exits are U/D/L/R only.
 */
void generate_level(byte diff) {
  byte x, y, i, n_en, placed;
  byte w, h;

  /* Size grows with progress; stay odd for the carve grid. */
  w = (byte)(9 + (diff % 4) * 2); /* 9,11,13,15 */
  if (w > MAP_W_MAX) w = MAP_W_MAX;
  if (!(w & 1)) w--;
  h = (byte)(9 + ((diff / 2) % 3) * 2); /* 9,11,13 */
  if (h > MAP_H_MAX) h = MAP_H_MAX;
  if (!(h & 1)) h--;
  gen_w = w;
  gen_h = h;

  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) gen_row[y][x] = '#';
    gen_row[y][w] = 0;
  }

  for (y = 1; y < h - 1; y += 2) {
    for (x = 1; x < w - 1; x += 2) {
      gen_row[y][x] = '*';
      if (x + 2 <= w - 2 && y + 2 <= h - 2) {
        if (rand8() & 1) gen_row[y][x + 1] = '*';
        else gen_row[y + 1][x] = '*';
      } else if (x + 2 <= w - 2) {
        gen_row[y][x + 1] = '*';
      } else if (y + 2 <= h - 2) {
        gen_row[y + 1][x] = '*';
      }
    }
  }

  /* Extra orthogonal openings between floors (never pillars / 2×2). */
  for (i = 0; i < (byte)(10 + diff * 2); i++) {
    x = (byte)(1 + (rand8() % (w - 2)));
    y = (byte)(1 + (rand8() % (h - 2)));
    if (!gen_can_open(x, y)) continue;
    if (gen_is_open(gen_row[y - 1][x]) || gen_is_open(gen_row[y + 1][x]) ||
        gen_is_open(gen_row[y][x - 1]) || gen_is_open(gen_row[y][x + 1]))
      gen_row[y][x] = '*';
  }

  braid_dead_ends();
  gen_force_pillars();
  braid_dead_ends(); /* pillars may recreate a cul-de-sac — clean again */

  /* Player near top-left floor */
  gen_row[1][1] = 'P';

  /* 1–3 enemies toward the bottom / right */
  n_en = 1;
  if (diff >= 2) n_en = 2;
  if (diff >= 5) n_en = 3;
  placed = 0;
  y = (byte)(h - 2);
  while (1) {
    x = (byte)(w - 2);
    while (1) {
      if (gen_row[y][x] == '*' && !(x <= 2 && y <= 2)) {
        gen_row[y][x] = (char)('1' + placed);
        placed++;
        if (placed >= n_en) break;
      }
      if (x <= 1) break;
      x--;
    }
    if (placed >= n_en || y <= 1) break;
    y--;
  }
  /* Fallback if we somehow placed none (h/w odd ⇒ bottom-right interior is a room). */
  if (!placed) gen_row[h - 2][w - 2] = '1';
}

void load_level_cells(const char* const* rows, byte w, byte h) {
  byte x, y;
  const char* row;
  map_w = w;
  map_h = h;
  actor_n = 0;
  items_count = 0;
  items_collected = 0;
  for (y = 0; y < h; y++) {
    row = rows[y];
    for (x = 0; x < w; x++) {
      char c = row[x];
      byte t = T_FLOOR;
      if (c == ' ') t = T_VOID;
      else if (c == '#') t = T_WALL;
      else if (c == '*') { t = T_ITEM; items_count++; }
      else if (c == 'P' || c == '1' || c == '2' || c == '3') {
        Actor* a = &actors[actor_n];
        a->x = TILE_TO_POS(x);
        a->y = TILE_TO_POS(y);
        a->cnt = 0;
        a->dir = DIR_NONE;
        if (c == 'P') { a->kind = 0; a->speed = 32; a->wait = 16; }
        else {
          a->kind = (byte)(c - '0');
          a->speed = (word)(10 + ((a->kind - 1) << 1) + (game_level >> 2));
          if (a->speed > 20) a->speed = 20;
          a->wait = (byte)(16 + (a->kind << 4));
        }
        actor_n++;
        t = T_FLOOR;
      }
      map[y * MAP_W_MAX + x] = t;
    }
  }
}

void load_level(byte li) {
  byte x, y, i;
  word map_px, map_py;
  const char* rowptrs[MAP_H_MAX];

  if (li < LEVELS_FIXED) {
    load_level_cells(levels[li].rows, levels[li].w, levels[li].h);
  } else {
    generate_level((byte)(li - LEVELS_FIXED));
    for (y = 0; y < gen_h; y++) rowptrs[y] = gen_row[y];
    load_level_cells(rowptrs, gen_w, gen_h);
  }

  /*
   * Place maze in the BG map. Prefer a 1-cell (2-tile) inset from the top
   * when leftover room allows; keep tile origin even so 16×16 metas align.
   * Outside the maze stays blank — do not invent border walls.
   */
  {
    byte tw = (byte)(map_w << 1);
    byte th = (byte)(map_h << 1);
    byte left;
    if (tw < VIEW_TILES_W) {
      left = (byte)(VIEW_TILES_W - tw);
      map_tx0 = (byte)((left >> 1) & ~1);
    } else {
      map_tx0 = 0;
    }
    if (th < VIEW_TILES_H) {
      left = (byte)(VIEW_TILES_H - th);
      if (left >= 4)
        map_ty0 = 2;
      else
        map_ty0 = (byte)(left & ~1);
    } else {
      map_ty0 = 0;
    }
    map_ox = (byte)(map_tx0 << 3);
    map_oy = (byte)(map_ty0 << 3);
  }
  clrscr();
  for (y = 0; y < map_h; y++)
    for (x = 0; x < map_w; x++)
      draw_cell(x, y);
  for (i = actor_n; i < ACTORS_MAX; i++) hide_actor_sprites(i);
  spawn_wait = (byte)(actor_n << 4);
  map_px = (word)map_w * TILE_PX;
  map_py = (word)map_h * TILE_PX;
  cam_max_x = (map_px > VIEW_W) ? (byte)(map_px - VIEW_W) : 0;
  cam_max_y = (map_py > VIEW_H) ? (byte)(map_py - VIEW_H) : 0;
  cam_x = 0;
  cam_y = 0;
  move_bkg(cam_x, cam_y);
  move_win(7, HUD_WY);
  SHOW_WIN;
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
    if (!((px + 4) >= (ex + 12) || (ex + 4) >= (px + 12) ||
          (py + 4) >= (ey + 12) || (ey + 4) >= (py + 12)))
      return 1;
  }
  return 0;
}

void animate_gems(void) {
  byte x, y;
  if ((frame_cnt & 15) != 0) return;
  for (y = 0; y < map_h; y++)
    for (x = 0; x < map_w; x++)
      if (map_at(x, y) == T_ITEM) draw_cell(x, y);
}

void enemy_ai(byte id) {
  Actor* a = &actors[id];
  byte tx = POS_TO_TILE(a->x);
  byte ty = POS_TO_TILE(a->y);
  byte dirs[4];
  byte n = 0;
  byte prev = a->dir;
  byte pick;
  if (prev != DIR_RIGHT && can_enter((byte)(tx - 1), ty)) dirs[n++] = DIR_LEFT;
  if (prev != DIR_LEFT  && can_enter((byte)(tx + 1), ty)) dirs[n++] = DIR_RIGHT;
  if (prev != DIR_DOWN  && can_enter(tx, (byte)(ty - 1))) dirs[n++] = DIR_UP;
  if (prev != DIR_UP    && can_enter(tx, (byte)(ty + 1))) dirs[n++] = DIR_DOWN;
  if (!n) return;
  pick = dirs[rand8() % n];
  actor_try_dir(id, pick);
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
    a->x &= POS_SNAP_MASK;
    a->y &= POS_SNAP_MASK;
    try_collect(id);
  }
}

void wait_for_button(void) {
  read_controls();
  while (!joy_fire && !joy_start) { wait_vblank(); read_controls(); }
  while (joy_fire || joy_start) { wait_vblank(); read_controls(); }
}

void draw_title_logo(byte y0) {
  byte y, x;
  for (y = 0; y < 6; y++)
    for (x = 0; x < 20; x++)
      set_bkg_tile_xy(x, (byte)(y0 + y), title_logo[y][x]);
}

void title_screen(void) {
  /*
   * NES starts at scroll Y=240 over a blank second nametable, then falls to 0.
   * GB has one 256px BG map that wraps, so Y=240 still shows the title.
   * Mirror the effect: keep the title in the top 112px, leave 112..255 blank,
   * and start at SCY=112 (a full screen of blank) before falling to 0.
   */
  int16_t iy, dy;
  byte wait, i;
  byte left_prev, right_prev;
  byte lv;
  show_menu_screen();
  HIDE_BKG;
  draw_title_logo(2);
  put_str(2, 8, "COLLECT ALL GEMS");
  put_str(3, 9, "AVOID ENEMIES");
  put_str(3, 13, "PD SHIRU 2012");
  iy = (int16_t)112 << FP_BITS;
  dy = (int16_t)(-8) << FP_BITS;
  move_bkg(0, (byte)(iy >> FP_BITS));
  SHOW_BKG;
  wait_frames(20);
  wait = 160;
  frame_cnt = 0;
  read_controls();
  while (1) {
    wait_vblank();
    move_bkg(0, (byte)(iy >> FP_BITS));
    read_controls();
    if (joy_start || joy_fire) break;
    iy += dy;
    if (iy < 0) {
      iy = 0;
      dy = (int16_t)((-dy) >> 1);
    }
    if (dy > ((int16_t)(-8) << FP_BITS)) dy -= 2;
    if (wait) {
      --wait;
    } else {
      if (frame_cnt & 32) put_str(4, 11, "PRESS START");
      else put_str(4, 11, "           ");
      ++frame_cnt;
    }
  }
  move_bkg(0, 0);
  put_str(4, 11, "PRESS START");
  sfx_play(sfx_start);
  for (i = 0; i < 16; ++i) {
    if (i & 1) put_str(4, 11, "           ");
    else put_str(4, 11, "PRESS START");
    wait_frames(4);
  }
  while (joy_fire || joy_start) { wait_vblank(); read_controls(); }

  /* Level select — L/R change start, Start/A to play */
  put_str(4, 11, "           ");
  put_str(3, 11, "LEVEL");
  put_str(1, 14, "L R TO PICK");
  put_str(4, 15, "START");
  left_prev = right_prev = 1;
  while (1) {
    lv = (byte)(start_level + 1);
    put_digit(9, 11, lv / 10);
    put_digit(10, 11, lv % 10);
    wait_vblank();
    read_controls();
    if (joy_left && !left_prev) {
      if (start_level) start_level--;
    }
    if (joy_right && !right_prev) {
      if (start_level < 29) start_level++; /* L30 = deep into procedural */
    }
    left_prev = joy_left;
    right_prev = joy_right;
    if (joy_start || joy_fire) break;
  }
  while (joy_fire || joy_start) { wait_vblank(); read_controls(); }
}

void show_level_banner(void) {
  byte lv = (byte)(game_level + 1);
  show_menu_screen();
  put_str(5, 8, "LEVEL");
  put_digit(11, 8, lv / 10);
  put_digit(12, 8, lv % 10);
  music_play(mus_level, 0);
  wait_frames(50);
  music_stop();
  sfx_stop();
}

void show_game_over(void) {
  show_menu_screen();
  put_str(5, 8, "GAME OVER");
  music_play(mus_gameover, 0);
  wait_for_button();
  music_stop();
}

void show_well_done(void) {
  show_menu_screen();
  put_str(5, 7, "WELL DONE");
  put_str(1, 10, "ALL GEMS COLLECTED");
  music_play(mus_welldone, 0);
  wait_for_button();
  music_stop();
}

void game_loop(void) {
  byte i;
  hide_all_sprites();
  load_level(game_level);
  draw_hud();
  update_camera();
  game_done = 0;
  game_clear = 0;
  game_paused = 0;
  music_paused = 0;
  frame_cnt = 0;
  start_prev = 1;
  music_stop();
  BGP_REG = 0xE4;
  while (!game_done) {
    wait_vblank();
    frame_cnt++;
    read_controls();
    if (joy_start && !start_prev) {
      game_paused = !game_paused;
      music_paused = game_paused;
      BGP_REG = game_paused ? 0xF9 : 0xE4;
      draw_hud();
    }
    start_prev = joy_start;
    if (game_paused) { draw_actors(); continue; }
    animate_gems();

    if (items_collected >= items_count && !game_clear) {
      game_clear = 1;
      game_done = 1;
      sfx_stop();
      music_play(mus_clear, 0);
    }

    if (spawn_wait) {
      --spawn_wait;
      if (!spawn_wait && !music_enable)
        music_play(mus_game, 1);
    }

    for (i = 0; i < actor_n; i++) {
      if (actors[i].wait) {
        if (actors[i].wait == 16)
          sfx_play(i ? sfx_respawn_e : sfx_respawn_p);
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
    update_camera();
    draw_actors();
    if (!game_clear && hit_player()) {
      sfx_stop();
      music_play(mus_lose, 0);
      game_done = 1;
      wait_frames(100);
    }
  }
  if (game_clear) wait_frames(100);
  music_stop();
  sfx_stop();
  hide_all_sprites();
  HIDE_WIN;
  BGP_REG = 0xE4;
}

void setup_graphics(void) {
  byte x;
  DISPLAY_OFF;
  set_bkg_1bpp_data(0, 32, font_1bpp);
  set_bkg_data(BKG_BASE, 13, bkg_tiles);
  set_sprite_data(16, 12, sprite_tiles);
  /* same font tiles for window HUD */
  for (x = 0; x < 20; x++) set_win_tile_xy(x, 0, 0);
  SPRITES_8x16;
  BGP_REG = 0xE4;
  OBP0_REG = 0xE4;
  OBP1_REG = 0xD2; /* slightly different for enemy kinds 2+ */
  psg_init();
  move_win(7, HUD_WY);
  HIDE_WIN;
  SHOW_BKG;
  SHOW_SPRITES;
  DISPLAY_ON;
}

void main(void) {
  setup_graphics();
  while (1) {
    title_screen();
    game_level = start_level;
    game_lives = 4;
    rnd ^= (word)frame_cnt << 8; /* fresh maze seed each run */
    /* Levels 1–5 fixed; then endless procedural until lives run out. */
    while (game_lives) {
      show_level_banner();
      game_loop();
      if (game_clear) {
        if (game_level != 255) game_level++;
      } else {
        game_lives--;
      }
    }
    show_game_over();
  }
}
