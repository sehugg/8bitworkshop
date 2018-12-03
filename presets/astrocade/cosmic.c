
/*
 * An Astrocade port of the Cosmic Impalas game 
 * described in the book
 * "Making 8-bit Arcade Games in C"
 */

#include <string.h>

#include "aclib.h"

//#link "aclib.c"

//#link "acheader.s"


//
// GAME GRAPHICS
//

const byte player_bitmap[] =
{3,14,/*{w:12,h:16,bpp:2,brev:1}*/0x00,0x3C,0x00,0x00,0x18,0x00,0x00,0x3C,0x00,0x00,0x18,0x00,0x04,0x18,0x20,0x0C,0x3C,0x30,0x3C,0x3C,0x3C,0x1F,0xE7,0xF4,0x1F,0x66,0xF4,0x17,0xE7,0xE4,0x17,0xE7,0xE4,0x1C,0x7E,0x34,0x1C,0xFF,0x34,0x3C,0x18,0x3C,0x0C,0x18,0x30,0x04,0x18,0x20};
const byte bomb_bitmap[] =
{1,5,/*{w:8,h:5,bpp:2,brev:1}*/0x88,0x55,0x77,0x55,0x88};
const byte bullet_bitmap[] =
{1,5,/*{w:8,h:5,bpp:2,brev:1}*/0x14,0x28,0x14,0x14,0x28};
const byte enemy1_bitmap[] =
{2,8,/*{w:16,h:8,bpp:2,brev:1}*/0x00,0x00,0x70,0x38,0xF8,0x7C,0xFC,0xFC,0xFE,0xFC,0xFE,0xFF,0xFC,0xFF,0xF8,0x7F,0xF0,0x3F,0x88,0x47,0xF0,0x3F,0xF0,0x3F,0xD0,0x2F,0x8C,0xC7,0x48,0x48,0x80,0x04};
const byte enemy2_bitmap[] =
{2,8,/*{w:16,h:8,bpp:2,brev:1}*/0x00,0x00,0x30,0x0C,0x14,0x28,0x2E,0x74,0x08,0x10,0x20,0x04,0xE0,0x07,0xD0,0x0B,0xB0,0x0D,0xB2,0x4D,0x19,0x98,0x8E,0x71,0x82,0x41,0xB1,0x8D,0x59,0x9A,0x4A,0x52};
const byte enemy3_bitmap[] =
{2,8,/*{w:16,h:8,bpp:2,brev:1}*/0x00,0x00,0x00,0x00,0x04,0x20,0x05,0xA0,0x05,0xA0,0x25,0xA4,0xA7,0xE5,0xF7,0xEF,0xF7,0xEF,0xFE,0x7F,0xFC,0x3F,0xBC,0x3D,0xE4,0x27,0x20,0x00,0x00,0x00,0x00,0x00};
const byte enemy4_bitmap[] =
{2,8,/*{w:16,h:8,bpp:2,brev:1}*/0x00,0x00,0x00,0x00,0xF0,0x0F,0xF8,0x1F,0xD8,0x1B,0xF8,0x1F,0xF8,0x1F,0xF8,0x1F,0xF0,0x0F,0xA8,0x15,0xCC,0x33,0xE8,0x17,0x66,0x66,0x33,0xCC,0x61,0x86,0x40,0x02};

const byte* const enemy_bitmaps[4] = {
  enemy1_bitmap,
  enemy2_bitmap,
  enemy3_bitmap,
  enemy4_bitmap
};

#define COLOR_BUNKER 1
#define COLOR_GROUND 2
#define COLOR_SCORE  3

//
// GAME CODE
//

#define MAXLIVES 5
#define PLYRHEIGHT 14
#define ENEMY_SPACING_X 17
#define ENEMY_SPACING_Y 11
#define ENEMY_MARCH_X 1
#define ENEMY_MARCH_Y 2

typedef struct {
  byte x,y;
  const byte* shape; // need const here
} Enemy;

#define MAX_ENEMIES 28

Enemy enemies[MAX_ENEMIES];
byte enemy_index;
byte num_enemies;

typedef struct {
  int right:1;
  int down:1;
} MarchMode;

MarchMode this_mode, next_mode;

byte attract;
word score;
byte lives;

const byte player_y = VHEIGHT-PLYRHEIGHT-1;
byte player_x;
byte bullet_x;
byte bullet_y;
byte bomb_x;
byte bomb_y;

void draw_lives() {
  byte i;
  byte n = lives;
  byte y = 0;
  byte x = PIXWIDTH-4*5;
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
    vline(x+i, a, b, M_XOR, COLOR_BUNKER);
    vline(x+h*2+w-i-1, a, b, M_XOR, COLOR_BUNKER);
  }
  for (i=0; i<w; i++) {
    vline(x+h+i, a, b, M_XOR, COLOR_BUNKER);
  }
}

void draw_playfield() {
  byte i;
  clrscr();
  hw_xpand = XPAND_COLORS(0, COLOR_SCORE);
  draw_string("PLAYER 1", 0, 0);
  draw_score();
  draw_lives();
  for (i=0; i<PIXWIDTH; i++)
    pixel(i, VHEIGHT-1, COLOR_GROUND, M_OR);
  // TODO: const
  draw_bunker(20, 65, 15, 15, 20);
  draw_bunker(100, 65, 15, 15, 20);
}

void add_score(word pts) {
  if (attract) return;
  score = bcd_add(score, pts);
  draw_score();
}

void xor_player_derez() {
  byte i,j;
  byte x = player_x+13;
  byte y = player_y+PLYRHEIGHT-1;
  byte* rand = (byte*) &clrscr; // use code as random #'s
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
  render_sprite(player_bitmap, player_x, VHEIGHT-PLYRHEIGHT, M_XOR); // erase ship via xor
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
  memmove(e, e+1, sizeof(Enemy)*(enemies-e+MAX_ENEMIES-1));
  num_enemies--; // update_next_enemy() will check enemy_index
}

void update_next_enemy() {
  Enemy* e;
  if (enemy_index >= num_enemies) {
    enemy_index = 0;
    memcpy(&this_mode, &next_mode, sizeof(this_mode));
  }
  e = &enemies[enemy_index];
  erase_sprite(e->shape, e->x, e->y);
  if (this_mode.down) {
    e->y += ENEMY_MARCH_Y;
    // if too close to ground, end game
    if (e->y > VHEIGHT-ENEMY_SPACING_Y) {
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
  render_sprite(e->shape, e->x, e->y, M_XOR);
  enemy_index++;
}

char in_rect(Enemy* e, byte x, byte y, byte w, byte h) {
  byte ew = e->shape[0]*8;
  byte eh = e->shape[1];
  return (x >= e->x-w && x <= e->x+ew && y >= e->y-h && y <= e->y+eh);
}

Enemy* find_enemy_at(byte x, byte y) {
  byte i;
  for (i=0; i<num_enemies; i++) {
    Enemy* e = &enemies[i];
    if (in_rect(e, x, y, 0, 2)) {
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

void fire_bullet() {
  bullet_x = player_x + 4;
  bullet_y = VHEIGHT-PLYRHEIGHT-6;
  render_sprite(bullet_bitmap, bullet_x, bullet_y, M_XOR); // draw
}

void move_bullet() {
  byte leftover;
  hw_intst; // reset intercept counters
  render_sprite(bullet_bitmap, bullet_x, bullet_y, M_XOR); // erase
  leftover = (hw_intst & 0xf0); // any pixels leftover?
  if (leftover || bullet_y < 10) {
    erase_sprite(bullet_bitmap, bullet_x, bullet_y);
    check_bullet_hit(bullet_x, bullet_y+2);
    bullet_y = 0;
  } else {
    bullet_y -= 4;
    render_sprite(bullet_bitmap, bullet_x, bullet_y, M_XOR); // draw
  }
}

void drop_bomb() {
  Enemy* e = &enemies[enemy_index];
  bomb_x = e->x + 7;
  bomb_y = e->y + 16;
  render_sprite(bomb_bitmap, bomb_x, bomb_y, M_XOR);
}

void move_bomb() {
  hw_intst; // reset intercept counters
  render_sprite(bomb_bitmap, bomb_x, bomb_y, M_XOR); // erase
  if (bomb_y > VHEIGHT-12) {
    bomb_y = 0;
  } else if (hw_intst & 0xf0) { // any pixels leftover?
    erase_sprite(bomb_bitmap, bomb_x, bomb_y); // erase bunker
    if (bomb_y > VHEIGHT-23) {
      // player was hit (probably)
      destroy_player();
    }
    bomb_y = 0;
  } else {
    bomb_y += 3;
    render_sprite(bomb_bitmap, bomb_x, bomb_y, M_XOR);
  }
}

byte frame;
signed char player_dir = 0;

void move_player() {
  if (attract) {
    if (bullet_y == 0) fire_bullet();
    player_dir = 0;
  } else {
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
  }
  // move player
  render_sprite(player_bitmap, player_x, player_y, M_MOVE);
}

void play_round() {
  draw_playfield();
  player_x = PIXWIDTH/2-8;
  bullet_y = 0;
  bomb_y = 0;
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
    draw_string(" *************** ", x, y+0*8);
    draw_string("***           ***", x, y+1*8);
    draw_string("**  GAME OVER  **", x, y+2*8);
    draw_string("***           ***", x, y+3*8);
    draw_string(" *************** ", x, y+4*8);
  }
}

void play_game() {
  attract = 0;
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

void attract_mode() {
  attract = 1;
  while (1) {
    init_enemies();
    play_round();
  }
}

void setup_registers() {
  hw_col0r = 0x00;
  hw_col1r = 0x2f;
  hw_col2r = 0xef;
  hw_col3r = 0xaf;
  hw_horcb = 0;
  hw_verbl = VHEIGHT*2;
}


void main() {
  setup_registers();
  // NOTE: initializers don't get run, so we init here
  while (1) {
    //attract_mode();
    play_game();
  }
}
