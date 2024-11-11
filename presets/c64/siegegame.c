/*
Text-based version of a Blockade-style game.
For more information, see "Making Arcade Games in C".
*/

#include "common.h"

// get the character at a specfic x/y position
byte readcharxy(byte x, byte y) {
  return PEEK(SCRNADR(0x400, x, y));
}

// delay for 'count' frames
void delay(byte count) {
  while (count--) {
    waitvsync();
  }
}

////////// GAME DATA

typedef struct {
  byte x;          // x coordinate
  byte y;          // y coordinate
  byte dir;        // direction (0-3)
  byte score;      // current score
  char head_attr;  // char to draw player
  char tail_attr;  // char to draw trail
  bool collided;  // did we collide?
  bool human;     // is this player a human?
} Player;

Player players[2];  // player #0 and #1 data

byte frames_per_move;  // speed of game
byte gameover;         // = 1 if game is over

#define START_SPEED 12
#define MAX_SPEED 5
#define MAX_SCORE 7

///////////

const char BOX_CHARS[8] = { '+', '+', '+', '+',
                            '-', '-', '!', '!'};

// draw a box from coordinate (x,y) to (x2,y2)
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

// draw the playfield border and score
void draw_playfield() {
  draw_box(0,1,COLS-1,ROWS-1,BOX_CHARS);
  cputsxy( 0, 0, "plyr1:");
  cputsxy(20, 0, "plyr2:");
  cputcxy( 7, 0, players[0].score+'0');
  cputcxy(27, 0, players[1].score+'0');
}

// constants for the 4 cardinal directions
typedef enum { D_RIGHT, D_DOWN, D_LEFT, D_UP } dir_t;
const sbyte DIR_X[4] = { 1, 0, -1, 0 };
const sbyte DIR_Y[4] = { 0, 1, 0, -1 };

// initialize game and player data
void init_game() {
  memset(players, 0, sizeof(players));
  players[0].head_attr = '1';
  players[1].head_attr = '2';
  players[0].tail_attr = '#';
  players[1].tail_attr = '*';
  frames_per_move = START_SPEED;
}

// reset players to initial conditions
void reset_players() {
  players[0].x = players[0].y = 5;
  players[0].dir = D_RIGHT;
  players[1].x = COLS-6;
  players[1].y = ROWS-6;
  players[1].dir = D_LEFT;
  players[0].collided = players[1].collided = 0;
}

// draw player character at head
void draw_player(Player* p) {
  cputcxy(p->x, p->y, p->head_attr);
}

// move player and detect collision
void move_player(Player* p) {
  cputcxy(p->x, p->y, p->tail_attr);
  p->x += DIR_X[p->dir];
  p->y += DIR_Y[p->dir];
  if ((readcharxy(p->x, p->y) & 0x7f) != ' ')
    p->collided = 1;
  draw_player(p);
}

// read joystick and move player
void human_control(Player* p) {
  byte dir = 0xff;
  char joy;
  if (!p->human) return;
  if (!kbhit()) return;
  joy = joy_read(1);
  if (JOY_UP(joy)) dir = D_UP;
  if (JOY_LEFT(joy)) dir = D_LEFT;
  if (JOY_RIGHT(joy)) dir = D_RIGHT;
  if (JOY_DOWN(joy)) dir = D_DOWN;
  // don't let the player reverse direction
  if (dir < 0x80 && dir != (p->dir ^ 2)) {
    p->dir = dir;
  }
}

// AI player: try to move in direction 'dir'
// the number of squares (1 << shift)
// return 1 if successful, and change p->dir
byte ai_try_dir(Player* p, dir_t dir, byte shift) {
  byte x,y;
  dir &= 3;
  x = p->x + (DIR_X[dir] << shift);
  y = p->y + (DIR_Y[dir] << shift);
  if (x < COLS && y < ROWS 
      && (readcharxy(x, y) & 0x7f) == ' ') {
    p->dir = dir;
    return 1;
  } else {
    return 0;
  }
}

// AI computer player routine
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

// flash player(s) that collided
void flash_colliders() {
  byte i;
  for (i=0; i<56; i++) {
    delay(2);
    revers(players[0].collided && (i&1));
    draw_player(&players[0]);
    revers(players[1].collided && (i&1));
    draw_player(&players[1]);
  }
  revers(0);
}

// move both players
void make_move() {
  byte i;
  for (i=0; i<frames_per_move; i++) {
    human_control(&players[0]);
    delay(1);
  }
  ai_control(&players[0]);
  ai_control(&players[1]);
  // if players collide, 2nd player gets the point
  textcolor(COLOR_CYAN);
  move_player(&players[1]);
  textcolor(COLOR_YELLOW);
  move_player(&players[0]);
  textcolor(COLOR_WHITE);
}

// end of game, show the winner
void declare_winner(byte winner) {
  byte i;
  clrscr();
  for (i=0; i<ROWS/2-3; i++) {
    draw_box(i,i,COLS-1-i,ROWS-1-i,BOX_CHARS);
    delay(1);
  }
  cputsxy(12,10,"WINNER:");
  cputsxy(12,13,"PLAYER ");
  cputcxy(12+7, 13, '1'+winner);
  delay(200);
  gameover = 1;
}

// play a round of the game
// if someone got MAX_SCORE points, show the winner
void play_round() {
  reset_players();
  clrscr();
  textcolor(COLOR_WHITE);
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

// play a complete game until someone wins
void play_game() {
  gameover = 0;
  init_game();
  players[0].human = 1;
  while (!gameover) {
    play_round();
  }
}

// main routine
void main() {
  joy_install (joy_static_stddrv);
  play_game();
}
