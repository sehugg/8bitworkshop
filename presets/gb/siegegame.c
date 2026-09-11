/*
Siege for Game Boy — port of presets/nes/siegegame.c.

A character-based surround-the-opponent game. Two players (one
human, one AI) leave trails that box each other in; the first
one to hit a wall, a trail, or the other player loses the round.

Porting notes:
- The NES version reads the nametable back from the PPU to
  detect collisions and steer the AI (see getchar()). On the
  Game Boy VRAM can only be accessed during VBlank, so we keep
  a shadow copy of the playfield in RAM instead.
- Text uses the gbtext.h font (tile index == ASCII code), so
  strings can be written straight to the tile map.
- The NES draws player tails as colored tiles; here we use two
  custom dither tiles (light for player 1, dark for player 2)
  appended after the font tiles.
- Flashing colliding players reuses the NES trick of XORing the
  head tile index with 0x80: tiles 0x80 and up are blank, so
  the head alternates between visible and hidden.
- Playfield is cropped to 20x17 tiles to fit the GB screen.

Controls: D-pad moves player 1, Start starts the game.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gb/cgb.h"
#include "gbtext.h"

typedef uint8_t byte;
typedef uint16_t word;

// screen is 20x18 tiles; leave the bottom row blank
#define COLS 20
#define ROWS 17

/*{pal:555,n:4}*/
palette_color_t bkg_palette[4] = {
  0x6FFF, 0x5A31, 0x2A1F, 0x00,
};

////////// GAME DATA

typedef struct {
  byte x;
  byte y;
  byte dir;
  word score;
  char head_attr;
  char tail_attr;
  int collided:1;
  int human:1;
} Player;

Player players[2];

byte attract;
byte gameover;
byte frames_per_move;

// shadow copy of the tile map, for collision checks and AI
// (GB VRAM can only be read during VBlank, so mirror in RAM)
byte playfield[COLS*ROWS];

#define START_SPEED 12
#define MAX_SPEED 5
#define MAX_SCORE 7

// two custom tail tiles appended after the font tiles
// (the NES version uses two colored tiles for the tails)
#define TAIL_TILE_P1  (FONT_TILE_BASE + FONT_NUM_TILES)		// 0x7b
#define TAIL_TILE_P2  (FONT_TILE_BASE + FONT_NUM_TILES + 1)	// 0x7c

// three custom tiles for the border
#define BORDER_LR     (FONT_TILE_BASE + FONT_NUM_TILES + 2)	// 0x7d
#define BORDER_UD     (FONT_TILE_BASE + FONT_NUM_TILES + 3)	// 0x7e
#define BORDER_CORNER (FONT_TILE_BASE + FONT_NUM_TILES + 4)	// 0x7f

// blank tile used to clear tiles 0x80-0xff (see init)
const uint8_t zero_tile[16] = {0};

// tail tiles: dark checkerboard (player 1), light (player 2)
const uint8_t tail_tiles[5*16] = {
/*;;{w:8,h:8,bpp:1,count:5,brev:1,np:2,pofs:1,sl:2};;*/
  0x55,0x55,0xAA,0xAA, 0x55,0x55,0xAA,0xAA,
  0x55,0x55,0xAA,0xAA, 0x55,0x55,0xAA,0xAA,
  0x55,0x00,0xAA,0x00, 0x55,0x00,0xAA,0x00,
  0x55,0x00,0xAA,0x00, 0x55,0x00,0xAA,0x00,
  0x00,0x00,0x00,0xFF, 0x55,0x00,0xAA,0x00,
  0x55,0x00,0xAA,0x00, 0x00,0xFF,0x00,0x00,
  0x14,0x42,0x28,0x42, 0x14,0x42,0x28,0x42,
  0x14,0x42,0x28,0x42, 0x14,0x42,0x28,0x42,
  0x00,0xFF,0x2A,0x81, 0x54,0x81,0x2A,0x81,
  0x54,0x81,0x2A,0x81, 0x54,0x81,0x00,0xFF,
/*;;*/
};

////////// TEXT ROUTINES

// read a playfield character: from the shadow buffer,
// no VBlank tricks needed (unlike the NES nametable read)
byte getchar(byte x, byte y) {
  return playfield[y*COLS+x];
}

void cputcxy(byte x, byte y, char ch) {
  put_char(x, y, ch);
  // keep shadow buffer in sync with the screen
  playfield[y*COLS+x] = ch;
}

void cputsxy(byte x, byte y, const char* str) {
  byte i;
  for (i=0; str[i]; i++)
    cputcxy(x+i, y, str[i]);
}

void clrscr() {
  byte x, y;
  memset(playfield, 0, sizeof(playfield));
  // fill the visible tile map with spaces
  for (y=0; y<ROWS; y++)
    for (x=0; x<COLS; x++)
      put_char(x, y, ' ');
}

///////////

const char BOX_CHARS[8] = {
  BORDER_CORNER,
  BORDER_CORNER,
  BORDER_CORNER,
  BORDER_CORNER,
  BORDER_LR,
  BORDER_LR,
  BORDER_UD,
  BORDER_UD,
};

void draw_box(byte x, byte y, byte x2, byte y2, const char* chars) {
  byte x1 = x;
  cputcxy(x, y, chars[2]);
  cputcxy(x2, y, chars[3]);
  cputcxy(x, y2, chars[0]);
  cputcxy(x2, y2, chars[1]);
  while (++x < x2) {
    cputcxy(x, y, chars[5]);
    cputcxy(x, y2, chars[4]);
  }
  while (++y < y2) {
    cputcxy(x1, y, chars[6]);
    cputcxy(x2, y, chars[7]);
  }
}

void draw_playfield() {
  draw_box(1,2,COLS-2,ROWS-1,BOX_CHARS);
  if (attract) {
    cputsxy(4,ROWS-1,"PRESS START");
  } else {
    cputsxy(1,1,"P1:");
    cputcxy(4,1,players[0].score+'0');
    cputsxy(13,1,"P2:");
    cputcxy(16,1,players[1].score+'0');
  }
}

typedef enum { D_RIGHT, D_DOWN, D_LEFT, D_UP } dir_t;
const char DIR_X[4] = { 1, 0, -1, 0 };
const char DIR_Y[4] = { 0, 1, 0, -1 };

void init_game() {
  memset(players, 0, sizeof(players));
  players[0].head_attr = '1';
  players[1].head_attr = '2';
  players[0].tail_attr = TAIL_TILE_P1;
  players[1].tail_attr = TAIL_TILE_P2;
  frames_per_move = START_SPEED;
}

void reset_players() {
  players[0].x = players[0].y = 5;
  players[0].dir = D_RIGHT;
  players[1].x = COLS-6;
  players[1].y = ROWS-6;
  players[1].dir = D_LEFT;
  players[0].collided = players[1].collided = 0;
}

void draw_player(Player* p) {
  cputcxy(p->x, p->y, p->head_attr);
}

void move_player(Player* p) {
  cputcxy(p->x, p->y, p->tail_attr);
  p->x += DIR_X[p->dir];
  p->y += DIR_Y[p->dir];
  if (getchar(p->x, p->y) != 0)
    p->collided = 1;
  draw_player(p);
}

void human_control(Player* p) {
  byte dir = 0xff;
  byte joy = joypad();
  // start game if attract mode
  if (attract && (joy & J_START))
    gameover = 1;
  // do not allow movement unless human player
  if (!p->human) return;
  if (joy & J_LEFT) dir = D_LEFT;
  if (joy & J_RIGHT) dir = D_RIGHT;
  if (joy & J_UP) dir = D_UP;
  if (joy & J_DOWN) dir = D_DOWN;
  // don't let the player reverse
  if (dir < 0x80 && dir != (p->dir ^ 2)) {
    p->dir = dir;
  }
}

byte ai_try_dir(Player* p, dir_t dir, byte shift) {
  byte x,y;
  dir &= 3;
  x = p->x + (DIR_X[dir] << shift);
  y = p->y + (DIR_Y[dir] << shift);
  if (x < COLS && y < ROWS && getchar(x, y) == 0) {
    p->dir = dir;
    return 1;
  } else {
    return 0;
  }
}

void ai_control(Player* p) {
  dir_t dir;
  if (p->human) return;
  dir = p->dir;
  if (!ai_try_dir(p, dir, 0)) {
    ai_try_dir(p, dir+1, 0);
    ai_try_dir(p, dir-1, 0);
  } else {
    ai_try_dir(p, dir-1, 0) && ai_try_dir(p, dir-1, 1+(rand() & 3));
    ai_try_dir(p, dir+1, 0) && ai_try_dir(p, dir+1, 1+(rand() & 3));
    ai_try_dir(p, dir, rand() & 3);
  }
}

void flash_colliders() {
  byte i;
  // flash players that collided by toggling the head tile
  // between the glyph and the blank tile 0x80 up
  for (i=0; i<56; i++) {
    wait_vbl_done();	// head draws happen right after VBlank
    if (players[0].collided) players[0].head_attr ^= 0x80;
    if (players[1].collided) players[1].head_attr ^= 0x80;
    draw_player(&players[0]);
    draw_player(&players[1]);
    wait_vbl_done();	// two frames per flash, like the NES version
  }
  // even number of flashes leaves head_attr restored
}

void make_move() {
  byte i;
  for (i=0; i<frames_per_move; i++) {
    human_control(&players[0]);
    wait_vbl_done();	// pace one move every frames_per_move frames
  }
  ai_control(&players[0]);
  ai_control(&players[1]);
  // if players collide, 2nd player gets the point
  // (draws happen right after the last VBlank above)
  move_player(&players[1]);
  move_player(&players[0]);
}

void declare_winner(byte winner) {
  byte i;
  clrscr();
  // draw nested boxes closing in on the center
  for (i=0; i<ROWS/2-3; i++) {
    draw_box(i,i,COLS-1-i,ROWS-1-i,BOX_CHARS);
    wait_vbl_done();
  }
  cputsxy(6,10,"WINNER:");
  cputsxy(6,13,"PLAYER ");
  cputcxy(6+7, 13, '1'+winner);
  // ~1.25 seconds (NES delay() counts frames)
  for (i=0; i<75; i++) wait_vbl_done();
  gameover = 1;
}

void play_round() {
  display_off();
  clrscr();
  draw_playfield();
  reset_players();
  DISPLAY_ON;
  while (1) {
    make_move();
    if (gameover) return; // attract mode -> start
    if (players[0].collided || players[1].collided) break;
  }
  flash_colliders();
  // add scores to players that didn't collide
  if (players[0].collided) players[1].score++;
  if (players[1].collided) players[0].score++;
  // increase speed
  if (frames_per_move > MAX_SPEED) frames_per_move--;
  // game over?
  if (players[0].score != players[1].score) {
    if (players[0].score >= MAX_SCORE)
      declare_winner(0);
    else if (players[1].score >= MAX_SCORE)
      declare_winner(1);
  }
}

void play_game() {
  gameover = 0;
  init_game();
  if (!attract)
    players[0].human = 1;
  while (!gameover) {
    play_round();
  }
}

void main() {
  byte i, x, y;
  DISPLAY_OFF;
  // set CGB background palette 0
  set_bkg_palette(0, 1, bkg_palette);
  // unsigned tile indexing so ASCII codes work; must be set before
  // set_bkg_data(), which uses it to pick the VRAM tile base
  LCDC_REG |= LCDCF_BG8000;
  // load font (tiles 0x20-0x7a, tile index == ASCII) + tail tiles
  font_init();
  set_bkg_data(TAIL_TILE_P1, sizeof(tail_tiles)/16, tail_tiles);
  // clear tiles 0x80-0xff so head_attr^0x80 flashing shows blank
  for (i=0x80; i!=0; i++)
    set_bkg_data(i, 1, zero_tile);
  // 4-shade palette
  BGP_REG = 0xE4;
  // fill the tile map with spaces
  for (y=0; y<ROWS; y++)
    for (x=0; x<COLS; x++)
      put_char(x, y, ' ');
  SHOW_BKG;
  DISPLAY_ON;
  while (1) {
    attract = 1;
    play_game();
    attract = 0;
    play_game();
  }
}
