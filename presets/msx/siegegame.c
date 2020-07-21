/*
Text-based version of a Blockade-style game.
For more information, see "Making Arcade Games in C".
*/

#include <stdlib.h>
#include <string.h>
#include <stdint.h>

#include "msxbios.h"
//#link "msxbios.c"

typedef uint8_t byte;
typedef uint16_t word;
typedef uint8_t bool;

void cursorxy(byte x, byte y) {
  POSIT(y+1+(x<<8));
}
void cputcxy(byte x, byte y, char ch) {
  cursorxy(x,y);
  CHPUT(ch);
}
void putstring(byte x, byte y, const char* str) {
  cursorxy(x,y);
  while (*str) {
    CHPUT(*str++);
  }
}
byte getchar(byte x, byte y) {
  word addr = 0x1800 | (x+1) | y*32; // TODO: use variable for base address
  byte result;
  result = RDVRM(addr);
  //LDIRMV(&result, addr, 1);
  return result;
}
void vsync() {
  __asm__("HALT");
}
void delay(int x) {
  while (x--) {
    vsync();
  }
}

#define CHAR(x) (x)

#define COLS (LINL32)
#define ROWS (LINLEN-5)

////////// GAME DATA

typedef struct {
  byte x;
  byte y;
  byte dir;
  word score;
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
  CHAR('-'), CHAR('-'), CHAR('!'), CHAR('!') };

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
  draw_box(0,1,COLS-1,ROWS-1,BOX_CHARS);
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
  cputcxy(p->x, p->y, p->head_attr);
}

void move_player(Player* p) {
  cputcxy(p->x, p->y, p->tail_attr);
  p->x += DIR_X[p->dir];
  p->y += DIR_Y[p->dir];
  if (getchar(p->x, p->y) != CHAR(' '))
    p->collided = 1;
  draw_player(p);
}

void human_control(Player* p) {
  byte dir = 0xff;
  byte joystick = GTSTCK(STCK_Joy1);
  if (!p->human) return;
  if (joystick == STCK_W) dir = D_LEFT;
  if (joystick == STCK_E) dir = D_RIGHT;
  if (joystick == STCK_N) dir = D_UP;
  if (joystick == STCK_S) dir = D_DOWN;
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
  if (x < 29 && y < 27 && getchar(x, y) == CHAR(' ')) {
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
    //cv_set_frequency(CV_SOUNDCHANNEL_0, 1000+i*8);
    //cv_set_attenuation(CV_SOUNDCHANNEL_0, i/2);
    if (players[0].collided) players[0].head_attr ^= 0x80;
    if (players[1].collided) players[1].head_attr ^= 0x80;
    delay(2);
    draw_player(&players[0]);
    draw_player(&players[1]);
  }
  //cv_set_attenuation(CV_SOUNDCHANNEL_0, 28);
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
  CLS();
  for (i=0; i<ROWS/2-3; i++) {
    draw_box(i,i,COLS-1-i,ROWS-1-i,BOX_CHARS);
    delay(1);
  }
  putstring(12,10,"WINNER:");
  putstring(12,13,"PLAYER ");
  cputcxy(12+7, 13, CHAR('1')+winner);
  delay(75);
  gameover = 1;
}

void play_round() {
  reset_players();
  CLS();
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
  INIT32();
  play_game();
}
