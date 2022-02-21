/*
Text-based version of a Blockade-style game.
For more information, see "Making Arcade Games in C".
*/

#include <stdlib.h>
#include <string.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"
//#link "common.c"

// for SMS
//#link "fonts.s"

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
  putcharxy(x, y, chars[2]);
  putcharxy(x2, y, chars[3]);
  putcharxy(x, y2, chars[0]);
  putcharxy(x2, y2, chars[1]);
  while (++x < x2) {
    putcharxy(x, y, chars[5]);
    putcharxy(x, y2, chars[4]);
  }
  while (++y < y2) {
    putcharxy(x1, y, chars[6]);
    putcharxy(x2, y, chars[7]);
  }
}

void draw_playfield() {
  draw_box(0,1,COLS-1,ROWS-1,BOX_CHARS);
  putstringxy(0,0,"Plyr1:");
  putstringxy(20,0,"Plyr2:");
  putcharxy(7,0,CHAR(players[0].score+'0'));
  putcharxy(27,0,CHAR(players[1].score+'0'));
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
  putcharxy(p->x, p->y, p->head_attr);
}

void move_player(Player* p) {
  putcharxy(p->x, p->y, p->tail_attr);
  p->x += DIR_X[p->dir];
  p->y += DIR_Y[p->dir];
  if (getcharxy(p->x, p->y) != 0)
    p->collided = 1;
  draw_player(p);
}

void human_control(Player* p) {
  byte dir = 0xff;
  struct cv_controller_state cs;
  cv_get_controller_state(&cs, 0);	// Read the controller.
  if (!p->human) return;
  if (cs.joystick & CV_LEFT) dir = D_LEFT;
  if (cs.joystick & CV_RIGHT) dir = D_RIGHT;
  if (cs.joystick & CV_UP) dir = D_UP;
  if (cs.joystick & CV_DOWN) dir = D_DOWN;
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
  if (x < 29 && y < 27 && getcharxy(x, y) == 0) {
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
  clrscr();
  for (i=0; i<ROWS/2-3; i++) {
    draw_box(i,i,COLS-1-i,ROWS-1-i,BOX_CHARS);
    delay(1);
  }
  putstringxy(12,10,"WINNER:");
  putstringxy(12,13,"PLAYER ");
  putcharxy(12+7, 13, CHAR('1')+winner);
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

void setup_32_column_font() {
  copy_default_character_set();
  cv_set_colors(0, CV_COLOR_BLUE);
  cvu_vmemset(COLOR, COLOR_FG(CV_COLOR_YELLOW), 8); // set color for chars 0-63
  cvu_vmemset(COLOR+8, COLOR_FG(CV_COLOR_WHITE), 32-8); // set chars 63-255
}

void main() {
  vdp_setup();
  setup_32_column_font();
  cv_set_screen_active(true);
  cv_set_vint_handler(&vint_handler);
  draw_playfield();
  play_game();
}
