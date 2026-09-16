/*
Text-based version of a Blockade-style game.
For more information, see "Making Arcade Games in C".
*/

#include <stdlib.h>
#include <string.h>
#include "bios.h"
//#link "bios.c"

typedef unsigned char byte;
typedef unsigned short word;

#define VHEIGHT 192	// number of scanlines
#define VBWIDTH 32	// number of bytes per scanline

#define COLS 32		// character columns
#define ROWS 24		// character rows

#define CHAR(x) (x)

// swap bits of address for ZX screen layout 
// http://www.breakintoprogram.co.uk/computers/zx-spectrum/screen-memory-layout
// lookup table, starting address of each scanline (0 .. 191)
static byte* const vidmem[VHEIGHT] = {
      0x4000, 0x4100, 0x4200,  0x4300 
    , 0x4400, 0x4500, 0x4600,  0x4700 
    , 0x4020, 0x4120, 0x4220,  0x4320 
    , 0x4420, 0x4520, 0x4620,  0x4720 
    , 0x4040, 0x4140, 0x4240,  0x4340 
    , 0x4440, 0x4540, 0x4640,  0x4740 
    , 0x4060, 0x4160, 0x4260,  0x4360 
    , 0x4460, 0x4560, 0x4660,  0x4760 
    , 0x4080, 0x4180, 0x4280,  0x4380 
    , 0x4480, 0x4580, 0x4680,  0x4780 
    , 0x40A0, 0x41A0, 0x42A0,  0x43A0 
    , 0x44A0, 0x45A0, 0x46A0,  0x47A0 
    , 0x40C0, 0x41C0, 0x42C0,  0x43C0 
    , 0x44C0, 0x45C0, 0x46C0,  0x47C0 
    , 0x40E0, 0x41E0, 0x42E0,  0x43E0 
    , 0x44E0, 0x45E0, 0x46E0,  0x47E0 
    , 0x4800, 0x4900, 0x4A00,  0x4B00 
    , 0x4C00, 0x4D00, 0x4E00,  0x4F00 
    , 0x4820, 0x4920, 0x4A20,  0x4B20 
    , 0x4C20, 0x4D20, 0x4E20,  0x4F20 
    , 0x4840, 0x4940, 0x4A40,  0x4B40 
    , 0x4C40, 0x4D40, 0x4E40,  0x4F40 
    , 0x4860, 0x4960, 0x4A60,  0x4B60 
    , 0x4C60, 0x4D60, 0x4E60,  0x4F60 
    , 0x4880, 0x4980, 0x4A80,  0x4B80 
    , 0x4C80, 0x4D80, 0x4E80,  0x4F80 
    , 0x48A0, 0x49A0, 0x4AA0,  0x4BA0 
    , 0x4CA0, 0x4DA0, 0x4EA0,  0x4FA0 
    , 0x48C0, 0x49C0, 0x4AC0,  0x4BC0 
    , 0x4CC0, 0x4DC0, 0x4EC0,  0x4FC0 
    , 0x48E0, 0x49E0, 0x4AE0,  0x4BE0 
    , 0x4CE0, 0x4DE0, 0x4EE0,  0x4FE0 
    , 0x5000, 0x5100, 0x5200,  0x5300 
    , 0x5400, 0x5500, 0x5600,  0x5700 
    , 0x5020, 0x5120, 0x5220,  0x5320 
    , 0x5420, 0x5520, 0x5620,  0x5720 
    , 0x5040, 0x5140, 0x5240,  0x5340 
    , 0x5440, 0x5540, 0x5640,  0x5740 
    , 0x5060, 0x5160, 0x5260,  0x5360 
    , 0x5460, 0x5560, 0x5660,  0x5760 
    , 0x5080, 0x5180, 0x5280,  0x5380 
    , 0x5480, 0x5580, 0x5680,  0x5780 
    , 0x50A0, 0x51A0, 0x52A0,  0x53A0 
    , 0x54A0, 0x55A0, 0x56A0,  0x57A0 
    , 0x50C0, 0x51C0, 0x52C0,  0x53C0 
    , 0x54C0, 0x55C0, 0x56C0,  0x57C0 
    , 0x50E0, 0x51E0, 0x52E0,  0x53E0 
    , 0x54E0, 0x55E0, 0x56E0,  0x57E0
};

// attribute table
byte __at(0x5800) vidattrs[24][32];

// shadow copy of the text on screen (so getchar() can read it back)
static byte vidchars[ROWS][COLS];

// ZX colors: bit 6 = bright, bits 5-3 = paper, bits 2-0 = ink
#define COLOR_BOX  0x47	// bright white
#define COLOR_TEXT 0x46	// bright yellow
#define COLOR_P1   0x45	// bright cyan
#define COLOR_P2   0x43	// bright magenta

byte fgcolor = COLOR_BOX;	// ink+paper for the next character

////////// SCREEN FUNCTIONS

void cputcxy(byte x, byte y, char ch) {
  byte i;
  const byte* src = &font8x8[(ch-LOCHAR)][0];
  byte yy = y*8;
  for (i=0; i<8; i++) {
    vidmem[yy++][x] = *src++;
  }
  vidattrs[y][x] = fgcolor;
  vidchars[y][x] = ch;
}

void putstring(byte x, byte y, const char* str) {
  do {
    byte ch = *str++;
    if (!ch) break;
    cputcxy(x++, y, ch);
  } while (1);
}

byte getchar(byte x, byte y) {
  return vidchars[y][x];
}

void clrscr() {
  memset(vidmem[0], 0, 0x1800);		// clear bitmap
  memset(vidchars, ' ', sizeof(vidchars)); // clear text buffer
  memset(vidattrs, 0, 0x300);		// black on black
}

void vsync() {
  __asm
    halt
  __endasm;
}

void delay(int x) {
  while (x--) {
    vsync();
  }
}

////////// GAME DATA

typedef struct {
  byte x;
  byte y;
  byte dir;
  word score;
  byte color;
  char head_attr;
  char tail_attr;
  char collided:1;
  char human:1;
} Player;

Player players[2];

byte credits = 0;
byte frames_per_move;

#define START_SPEED 12
#define MAX_SPEED 5
#define MAX_SCORE 7

///////////

const char BOX_CHARS[8] = {
  CHAR('+'), CHAR('+'), CHAR('+'), CHAR('+'),
  CHAR('-'), CHAR('-'), CHAR('|'), CHAR('|') };

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
  fgcolor = COLOR_BOX;
  draw_box(0,1,COLS-1,ROWS-1,BOX_CHARS);
  fgcolor = COLOR_TEXT;
  putstring(0,0,"Plyr1:");
  putstring(20,0,"Plyr2:");
  cputcxy(7,0,CHAR(players[0].score+'0'));
  cputcxy(27,0,CHAR(players[1].score+'0'));
}

typedef enum { D_RIGHT, D_DOWN, D_LEFT, D_UP } dir_t;
const char DIR_X[4] = { 1, 0, -1, 0 };
const char DIR_Y[4] = { 0, 1, 0, -1 };

void init_game() {
  memset(players, 0, sizeof(players));
  players[0].head_attr = CHAR('1');
  players[1].head_attr = CHAR('2');
  players[0].tail_attr = CHAR('@');
  players[1].tail_attr = CHAR('%');
  players[0].color = COLOR_P1;
  players[1].color = COLOR_P2;
  frames_per_move = START_SPEED;
}

void reset_players() {
  players[0].x = players[0].y = 5;
  players[0].dir = D_RIGHT;
  players[1].x = 25;
  players[1].y = 19;
  players[1].dir = D_LEFT;
  players[0].collided = players[1].collided = 0;
}

void draw_player(Player* p) {
  fgcolor = p->color;
  cputcxy(p->x, p->y, p->head_attr);
}

void move_player(Player* p) {
  fgcolor = p->color & ~0x40;	// dimmer tail
  cputcxy(p->x, p->y, p->tail_attr);
  p->x += DIR_X[p->dir];
  p->y += DIR_Y[p->dir];
  if (getchar(p->x, p->y) != CHAR(' '))
    p->collided = 1;
  draw_player(p);
}

void human_control(Player* p) {
  byte dir = 0xff;
  char key;
  if (!p->human) return;
  key = keyscan();
  if (key != 0xff) {
    switch (key) {
      case 0x04: dir = D_LEFT; break;	// left arrow
      case 0x13: dir = D_RIGHT; break;	// right arrow
      case 0x0b: dir = D_UP; break;	// up arrow
      case 0x03: dir = D_DOWN; break;	// down arrow
    }
  }
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
  if (x < COLS && y < ROWS && getchar(x, y) == CHAR(' ')) {
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

byte gameover;

void flash_colliders() {
  byte i;
  // flash players that collided
  for (i=0; i<56; i++) {
    if (players[0].collided) players[0].color ^= 0x40;
    if (players[1].collided) players[1].color ^= 0x40;
    delay(2);
    draw_player(&players[0]);
    draw_player(&players[1]);
  }
}

void make_move() {
  byte i;
  for (i=0; i<frames_per_move; i++) {
    human_control(&players[0]);
    delay(1);
  }
  ai_control(&players[0]);
  ai_control(&players[1]);
  // if players collide, 2nd player gets the point
  move_player(&players[1]);
  move_player(&players[0]);
}

void play_game();

void declare_winner(byte winner) {
  byte i;
  clrscr();
  fgcolor = COLOR_BOX;
  for (i=0; i<ROWS/2-3; i++) {
    draw_box(i,i,COLS-1-i,ROWS-1-i,BOX_CHARS);
    delay(1);
  }
  fgcolor = COLOR_TEXT;
  putstring(12,10,"WINNER:");
  putstring(12,13,"PLAYER ");
  fgcolor = winner ? COLOR_P2 : COLOR_P1;
  cputcxy(12+7, 13, CHAR('1')+winner);
  delay(75);
  gameover = 1;
}

void play_round() {
  reset_players();
  clrscr();
  draw_playfield();
  while (1) {
    make_move();
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
  players[0].human = 1;
  while (!gameover) {
    play_round();
  }
}

void main() {
  // crt0 leaves interrupts disabled; enable them so HALT waits for a frame
  __asm
    ei
  __endasm;
  play_game();
  while (1) ;
}
