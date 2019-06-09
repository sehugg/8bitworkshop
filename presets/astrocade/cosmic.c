
/*
 * An Astrocade port of the Cosmic Impalas game 
 * described in the book
 * "Making 8-bit Arcade Games in C"
 */

#include <string.h>
#include <stdlib.h>

//#resource "astrocade.inc"
#include "acbios.h"
//#link "acbios.s"
#include "aclib.h"
//#link "aclib.s"
#include "acextra.h"
//#link "acextra.c"
//#link "hdr_autostart.s"


//
// GAME GRAPHICS
//

const byte player_bitmap[2+9*3] =
{3,9,/*{w:12,h:9,bpp:2,brev:1}*/0x00,0x00,0x00,0x00,0xFF,0x00,0x00,0x14,0x00,0x30,0x3C,0x0C,0x3A,0xBE,0xAC,0x3E,0xFF,0xBC,0x3F,0xFF,0xFC,0x37,0x7D,0xDC,0x3C,0x3C,0x3C};
const byte bomb_bitmap[] =
{1,3,/*{w:4,h:3,bpp:2,brev:1}*/0xF8,0x3E,0xF8};
const byte bullet_bitmap[] =
{1,5,/*{w:4,h:5,bpp:2,brev:1}*/0x0C,0x24,0x18,0x10,0x04};
const byte enemy1_bitmap[18] =
{2,8,/*{w:8,h:8,bpp:2,brev:1}*/0x22,0x88,0x2A,0xA8,0x3F,0xFC,0x37,0xDC,0x3F,0xFC,0x38,0x2C,0x30,0x0C,0x0C,0x30};
const byte enemy2_bitmap[] =
{2,8,/*{w:8,h:8,bpp:2,brev:1}*/0x0C,0x30,0x30,0x0C,0x17,0xE8,0x23,0xC4,0x0B,0xD0,0x2C,0x34,0x2F,0xF4,0x10,0x08};
const byte enemy3_bitmap[] =
{2,8,/*{w:8,h:8,bpp:2,brev:1}*/0x0F,0xC0,0x00,0xC0,0x10,0xC4,0x26,0xD8,0x27,0x98,0x26,0xD8,0x14,0x14,0x10,0x04};
const byte enemy4_bitmap[] =
{2,8,/*{w:8,h:8,bpp:2,brev:1}*/0x30,0x0C,0x3C,0x3C,0x0F,0xF0,0x3A,0xE8,0x3B,0xEC,0x3F,0xFC,0x30,0x0C,0x00,0x00};
const byte mothership_bitmap[2+3*6] =
{3,6,/*{w:12,h:6,bpp:2,brev:1}*/0x00,0x28,0x00,0x02,0xBE,0x80,0x2A,0xFF,0xA8,0x25,0x55,0x58,0x0A,0xAA,0xA0,0x02,0xAA,0x80};
const byte explode_bitmap[18] =
{2,8,/*{w:8,h:8,bpp:2,brev:1}*/0x40,0x44,0x10,0x40,0x06,0x81,0x0B,0xE4,0x5B,0xE0,0x02,0x81,0x04,0x10,0x10,0x44};

const byte* const enemy_bitmaps[4] = {
  enemy1_bitmap,
  enemy2_bitmap,
  enemy3_bitmap,
  enemy4_bitmap
};

/*{pal:"astrocade",layout:"astrocade"}*/
const byte palette[8] = {
  0x07, 0xD4, 0x35, 0x01,
  0x07, 0xD4, 0x35, 0x01,
};

#define COLOR_BUNKER 1
#define COLOR_GROUND 2
#define COLOR_SCORE  2

//
// GAME CODE
//

#define MAXLIVES 5
#define PLYRHEIGHT 9
#define ENEMY_WIDTH 8
#define ENEMY_HEIGHT 8
#define ENEMY_SPACING_X 14
#define ENEMY_SPACING_Y 11
#define ENEMY_WIDTH 8
#define ENEMY_MARCH_X 1
#define ENEMY_MARCH_Y 2
#define EXPLODE_TIME 8

typedef struct {
  byte x,y;
  const byte* shape; // need const here
} Enemy;

#define MAX_ENEMIES 40

Enemy enemies[MAX_ENEMIES];
byte enemy_index;
byte num_enemies;

typedef struct {
  int right:1;
  int down:1;
} MarchMode;

MarchMode this_mode, next_mode;

word score;
byte lives;

const byte player_y = VHEIGHT-PLYRHEIGHT-1;
byte player_x;
byte bullet_x;
byte bullet_y;
byte bomb_x;
byte bomb_y;
byte explode_x;
byte explode_y;
byte explode_timer;

void draw_lives() {
  byte i;
  byte n = lives;
  byte y = 0;
  byte x = PIXWIDTH-4*6;
  hw_xpand = XPAND_COLORS(0, COLOR_SCORE);
  for (i=0; i<MAXLIVES; i++) {
    draw_char(i<n?'|':' ', x, y, M_MOVE);
    x += 4;
  }
}

void draw_score() {
  byte x = 10*8;
  byte y = 0;
  hw_xpand = XPAND_COLORS(0, COLOR_SCORE);
  draw_bcd_word(score, x, y, M_MOVE);
}

void draw_bunker(byte x, byte y, byte y2, byte h, byte w) {
  byte i,a=0,b=0;
  for (i=0; i<h; i++) {
    a = y-y2-i*2;
    b = y-i;
    vline(x+i, a, b, COLOR_BUNKER, M_XOR);
    vline(x+h*2+w-i-1, a, b, COLOR_BUNKER, M_XOR);
  }
  for (i=0; i<w; i++) {
    vline(x+h+i, a, b, COLOR_BUNKER, M_XOR);
  }
}

void draw_playfield() {
  byte i;
  clrscr();
  draw_string(0, 0, COLOR_SCORE, "PLAYER 1");
  draw_score();
  draw_lives();
  for (i=0; i<PIXWIDTH; i++)
    pixel(i, VHEIGHT-1, COLOR_GROUND, M_OR);
  // TODO: const
  draw_bunker(20, 75, 5, 5, 20);
  draw_bunker(100, 75, 5, 5, 20);
}

void add_score(word pts) {
  score = bcd_add(score, pts);
  draw_score();
}

void xor_player_derez() {
  byte i,j;
  byte x = player_x+13;
  byte y = player_y+PLYRHEIGHT-1;
  byte* rand = (byte*) &xor_player_derez; // use code as random #'s
  for (j=1; j<=0xf; j++) {
    for (i=0; i<100; i++) {
      signed char xx = x + (*rand++ & 0xf) - 15;
      signed char yy = y - (*rand++ & j);
      pixel(xx, yy, *rand++, M_XOR);
    }
  }
}

void destroy_player() {
  xor_player_derez(); // xor derez pattern
  render_sprite(player_bitmap, player_x, player_y, M_XOR); // erase ship via xor
  xor_player_derez(); // xor 2x to erase derez pattern
  player_x = 0xff;
  lives--;
}

void init_enemies() {
  byte i,x,y,bm;
  x = 0;
  y = ENEMY_SPACING_Y;
  bm=0;
  for (i=0; i<MAX_ENEMIES; i++) {
    Enemy* e = &enemies[i];
    e->x = x;
    e->y = y;
    e->shape = enemy_bitmaps[bm];
    x += ENEMY_SPACING_X;
    if (x >= PIXWIDTH-ENEMY_SPACING_X*2) {
      x = 0;
      y += ENEMY_SPACING_Y;
      bm++; // TODO: can overflow
    }
  }
  enemy_index = 0;
  num_enemies = MAX_ENEMIES;
  this_mode.right = 1;
  this_mode.down = 0;
  next_mode.right = 1;
  next_mode.down = 0;
}

void delete_enemy(Enemy* e) {
  erase_sprite(e->shape, e->x, e->y);
  if (explode_timer == 0) {
    explode_x = e->x;
    explode_y = e->y;
    explode_timer = EXPLODE_TIME;
  }
  memmove(e, e+1, sizeof(Enemy)*(enemies-e+MAX_ENEMIES-1));
  num_enemies--; // update_next_enemy() will check enemy_index
  // TODO: enemy_index might skip updating an enemy
}

void update_next_enemy() {
  Enemy* e;
  if (enemy_index >= num_enemies) {
    enemy_index = 0;
    memcpy(&this_mode, &next_mode, sizeof(this_mode));
  }
  e = &enemies[enemy_index];
  if (this_mode.down) {
    erase_sprite(e->shape, e->x, e->y);
    e->y += ENEMY_MARCH_Y;
    // if too close to ground, end game
    if (e->y >= player_y) {
      destroy_player();
      lives = 0;
    }
    next_mode.down = 0;
  } else {
    if (this_mode.right) {
      e->x += ENEMY_MARCH_X;
      if (e->x >= PIXWIDTH-ENEMY_SPACING_X) {
        next_mode.down = 1;
        next_mode.right = 0;
      }
    } else {
      e->x -= ENEMY_MARCH_X;
      if (e->x == 0) {
        next_mode.down = 1;
        next_mode.right = 1;
      }
    }
  }
  render_sprite(e->shape, e->x, e->y, M_MOVE);
  enemy_index++;
}

char in_rect(Enemy* e, byte x, byte y, byte w, byte h) {
  byte ew = e->shape[0]*4;
  byte eh = e->shape[1];
  return (x >= e->x-w && x <= e->x+ew+w && y >= e->y-h && y <= e->y+eh+h);
}

Enemy* find_enemy_at(byte x, byte y) {
  byte i;
  for (i=0; i<num_enemies; i++) {
    Enemy* e = &enemies[i];
    if (in_rect(e, x, y, 4, 1)) {
      return e;
    }
  }
  return NULL;
}

void check_bullet_hit(byte x, byte y) {
  Enemy* e = find_enemy_at(x,y);
  if (e) {
    delete_enemy(e);
    add_score(0x25);
  }
}

void xor_bullet() {
  render_sprite(bullet_bitmap, bullet_x, bullet_y, M_XOR);
}

void fire_bullet() {
  bullet_x = player_x + 4;
  bullet_y = VHEIGHT-PLYRHEIGHT-6;
  xor_bullet();
}

void move_bullet() {
  byte leftover;
  xor_bullet();
  //erase_sprite(bullet_bitmap, bullet_x, bullet_y);
  hw_intst; // reset intercept counters
  bullet_y -= 2;
  xor_bullet();
  leftover = hw_intst; // any pixels leftover?
  if (leftover || bullet_y < 10) {
    erase_sprite(bullet_bitmap, bullet_x, bullet_y);
    check_bullet_hit(bullet_x, bullet_y+2);
    bullet_y = 0;
  }
}

void xor_bomb() {
  render_sprite(bomb_bitmap, bomb_x, bomb_y, M_XOR);
}

void drop_bomb() {
  byte i = rand() % num_enemies;
  Enemy* e = &enemies[i];
  // don't drop on someone else!
  if (find_enemy_at(e->x, e->y+ENEMY_HEIGHT+ENEMY_SPACING_Y+1)) {
    return;
  }
  bomb_x = e->x + ENEMY_WIDTH/4;
  bomb_y = e->y + ENEMY_HEIGHT;
  xor_bomb();
}

void move_bomb() {
  xor_bomb();
  if (bomb_y >= VHEIGHT-5) {
    bomb_y = 0;
  } else {
    bomb_y += 1;
    hw_intst; // reset intercept counters
    xor_bomb();
    if (hw_intst & 0xf0) { // any pixels leftover?
      erase_sprite(bomb_bitmap, bomb_x, bomb_y);
      if (bomb_y >= player_y-2) {
        // player was hit (probably)
        destroy_player();
      }
      bomb_y = 0;
    }
  }
}

byte frame;
signed char player_dir = 0;

void move_player() {
  byte mask = hw_p1ctrl;
  if (mask & 0x4) {
    if (player_x > 0)
      player_x--;
  }
  if (mask & 0x8) {
    if (player_x < PIXWIDTH-16)
      player_x++;
  }
  if (mask & 0x10) {
    if (bullet_y == 0) {
      fire_bullet();
    }
  }
  // move player
  render_sprite(player_bitmap, player_x, player_y, M_MOVE);
}

void animate_explosion() {
  if (--explode_timer == 0) {
    erase_sprite(explode_bitmap, explode_x, explode_y);
  } else {
    render_sprite(explode_bitmap, explode_x, explode_y, M_OR);
  }
}

void play_round() {
  draw_playfield();
  player_x = PIXWIDTH/2-8;
  bullet_y = 0;
  bomb_y = 0;
  explode_timer = 0;
  frame = 0;
  while (player_x != 0xff && num_enemies) {
    move_player();
    if (bullet_y) {
      move_bullet();
    }
    update_next_enemy();
    if (frame & 1) {
      if (bomb_y == 0) {
        drop_bomb();
      } else {
        move_bomb();
      }
    }
    if (explode_timer) {
      animate_explosion();
    }
    frame++;
  }
}

void init_game() {
  score = 0;
  lives = 5;
}

void game_over_msg() {
  byte i;
  byte x=16;
  byte y=10;
  hw_xpand = XPAND_COLORS(0, COLOR_SCORE);
  for (i=0; i<50; i++) {
    draw_string(x, y+0*8, COLOR_SCORE, " *************** ");
    draw_string(x, y+1*8, COLOR_SCORE, "***           ***");
    draw_string(x, y+2*8, COLOR_SCORE, "**  GAME OVER  **");
    draw_string(x, y+3*8, COLOR_SCORE, "***           ***");
    draw_string(x, y+4*8, COLOR_SCORE, " *************** ");
  }
}

void play_game() {
  init_game();
  init_enemies();
  while (lives) {
    play_round();
    if (num_enemies == 0) {
      init_enemies();
    }
  }
  game_over_msg();
}

void main() {
  hw_horcb = 40;
  hw_verbl = VHEIGHT*2;
  set_palette(palette);
  // NOTE: initializers don't get run, so we init here
  while (1) {
    //attract_mode();
    play_game();
  }
}
