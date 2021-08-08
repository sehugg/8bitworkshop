
/*
 * A ZX Spectrum port of the Cosmic Impalas game 
 * described in the book
 * "Making 8-bit Arcade Games in C"
 */

#include <string.h>
#include "bios.h"
//#link "bios.c"

// type aliases for byte/signed byte/unsigned 16-bit
typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;

// speaker click
__sfr __at (0xfe) portfe;
static byte spkr;
#define CLICK		portfe = spkr ^= 0x10;

#define VHEIGHT 192	// number of scanlines
#define VBWIDTH 32	// number of bytes per scanline
#define PIXWIDTH 256	// 8 pixels per byte

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

// bitmask table
const byte BIT8[8] = { 0x80, 0x40, 0x20, 0x10, 0x08, 0x04, 0x02, 0x01 };

/// SOUND FUNCTIONS

void tone(byte period, byte dur, sbyte mod) {
  word i;
  while (dur--) {
    for (i=0; i<period; i++) ;
    CLICK;
    period += mod;
  }
}

/// GRAPHICS FUNCTIONS

// draw (xor) vertical line
void xor_vline(byte x, byte y1, byte y2) {
  byte xb = x>>3;		// divide x by 8
  byte mask = BIT8[x&7];	// lookup bitmask for remainder
  byte y;
  for (y=y1; y<=y2; y++) {
    byte* dest = &vidmem[y][xb]; // lookup dest. address
    *dest ^= mask;		 // XOR mask with destination
  }
}

// clear screen and set graphics mode
void clrscr() {
  memset(vidmem[0], 0, 0x1800); // clear page 1
  memset(vidattrs, 0x4, 0x300); // set attributes
}

// draw (xor) a pixel
void xor_pixel(byte x, byte y) {
  xor_vline(x, y, y);		// draw line with 1-pixel height
}

typedef enum {
  OP_DRAW, OP_XOR, OP_ERASE
} GraphicsOperation;

// render a sprite with the given graphics operation
byte render_sprite(const byte* src, byte x, byte y, byte op) {
  byte i,j;
  byte w = *src++;	// get width from 1st byte of sprite
  byte h = *src++;	// get height from 2nd byte of sprite
  byte xb = x>>3;	// xb = x DIV 8
  byte xs = x&7;	// xs = x MOD 8
  byte result = 0;	// result (used only with XOR)
  for (j=0; j<h; j++) {
    byte* dest = &vidmem[y++][xb];	// lookup video address
    byte rest = 0;			// rest = leftover bits
    for (i=0; i<w; i++) {
      byte data = *src++;		// get next sprite byte
      byte next = (data >> xs) | rest; // shift and OR with leftover
      // compute graphics operation, write to dest
      switch (op) {
        case OP_DRAW:  *dest++ = next; break;
        case OP_XOR:   result |= (*dest++ ^= next); break;
        case OP_ERASE: *dest++ &= ~next; break;
      }
      rest = data << (8-xs);	// save leftover bits
    }
    // compute final byte operation
    switch (op) {
      case OP_DRAW:  *dest = rest; break;
      case OP_XOR:   result |= (*dest ^= rest); break;
      case OP_ERASE: *dest &= ~rest; break;
    }
  }
  return result;
}

void draw_sprite(const byte* src, byte x, byte y) {
  render_sprite(src, x, y, OP_DRAW);
}

// XOR returns non-zero if any pixels were overlapped
byte xor_sprite(const byte* src, byte x, byte y) {
  return render_sprite(src, x, y, OP_XOR);
}

void erase_sprite(const byte* src, byte x, byte y) {
  render_sprite(src, x, y, OP_ERASE);
}

// clear just sets all bytes to 0, and is fast
void clear_sprite(const byte* src, byte x, byte y) {
  byte i,j;
  byte w = *src++;
  byte h = *src++;
  byte xb = x>>3;
  for (j=0; j<h; j++) {
    byte* dest = &vidmem[y++][xb];
    for (i=0; i<=w; i++) {
      dest[i] = 0;
    }
  }
}

// draw character from column 0..39, row 0..23
void draw_char(char ch, byte col, byte row) {
  byte i;
  const byte* src = &font8x8[(ch-LOCHAR)][0];
  byte y = row*8;
  for (i=0; i<8; i++) {
    byte* dest = &vidmem[y++][col];
    *dest = *src;
    src += 1;
  }
}

// draw string starting at row/col (vert 1 = draw vertical)
void draw_string(const char* str, byte col, byte row, byte vert) {
  do {
    byte ch = *str++;
    if (!ch) break;
    draw_char(ch, col, row);
    if (vert) row++; else col++;
  } while (1);
}

// draw 4-digit BCD word
void draw_bcd_word(word bcd, byte col, byte row, byte vert) {
  byte j;
  if (vert) row+=3; else col+=3; // move to rightmost digit
  for (j=0; j<4; j++) {
    draw_char('0'+(bcd&0xf), col, row);
    if (vert) row--; else col--;
    bcd >>= 4;
  }
}

// add two 16-bit BCD values
word bcd_add(word a, word b) __naked {
  a; b; // to avoid warning
__asm
 	push	ix
 	ld	ix,#0
	add	ix,sp
 	ld	a,4 (ix)
 	add	a, 6 (ix)
	daa
	ld	c,a
 	ld	a,5 (ix)
 	adc	a, 7 (ix)
	daa
 	ld	b,a
 	ld	l, c
 	ld	h, b
	pop	ix
 	ret
__endasm;
}

//
// GAME GRAPHICS
//

const byte player_bitmap[] =
{3,16,/*{w:24,h:16,bpp:1,brev:1}*/0x00,0x00,0x00,0x00,0x18,0x00,0x00,0x3C,0x00,0x04,0x18,0x20,0x04,0x18,0x20,0x0E,0x3C,0x70,0x1D,0x3C,0xB8,0x2C,0xE7,0x34,0x2E,0x66,0x74,0x25,0xE7,0xA4,0x34,0xDB,0x2C,0x2E,0x5A,0x74,0x2D,0xE7,0xB4,0x1C,0x3C,0x38,0x0D,0xDB,0xB0,0x07,0x18,0xE0};
const byte bomb_bitmap[] =
{1,5,/*{w:8,h:5,bpp:1,brev:1}*/0x88,0x55,0x77,0x55,0x88};
const byte bullet_bitmap[] =
{1,5,/*{w:8,h:5,bpp:1,brev:1}*/0x14,0x28,0x14,0x14,0x28};
const byte enemy1_bitmap[] =
{2,16,/*{w:16,h:16,bpp:1,brev:1}*/0x00,0x00,0x7F,0xF8,0xF8,0x7C,0x8C,0xC4,0xAC,0xD4,0x8C,0xC4,0xFC,0xFC,0xF8,0x7C,0xF0,0x3C,0x8B,0x44,0xF3,0x3C,0xF3,0x3C,0xD3,0x2C,0x8C,0xC4,0x48,0x48,0x80,0x04};
const byte enemy2_bitmap[] =
{2,16,/*{w:16,h:16,bpp:1,brev:1}*/0x00,0x00,0x30,0x0C,0x14,0x28,0x2F,0xF4,0x08,0x10,0x22,0x44,0xE0,0x07,0xD0,0x0B,0xB0,0x0D,0xB2,0x4D,0x19,0x98,0x8E,0x71,0x82,0x41,0xB1,0x8D,0x59,0x9A,0x4A,0x52};
const byte enemy3_bitmap[] =
{2,16,/*{w:16,h:16,bpp:1,brev:1}*/0x00,0x00,0x00,0x00,0x04,0x20,0x05,0xA0,0x05,0xA0,0x25,0xA4,0xA7,0xE5,0xF7,0xEF,0xF7,0xEF,0xFE,0x7F,0xFC,0x3F,0xBC,0x3D,0x64,0x26,0x20,0x04,0x00,0x00,0x00,0x00};
const byte enemy4_bitmap[] =
{2,16,/*{w:16,h:16,bpp:1,brev:1}*/0x00,0x00,0x00,0x00,0x37,0xEC,0x78,0x1E,0x5A,0x5A,0xFA,0x5F,0xF8,0x1F,0xF8,0x1F,0xF1,0x8F,0xA8,0x15,0xCC,0x33,0xE8,0x17,0x66,0x66,0x33,0xCC,0x0D,0xB0,0x00,0x00};

const byte* const enemy_bitmaps[4] = {
  enemy1_bitmap,
  enemy2_bitmap,
  enemy3_bitmap,
  enemy4_bitmap
};

//
// GAME CODE
//

byte attract;
word score;
byte lives;

#define MAXLIVES 5

byte player_x;
byte bullet_x;
byte bullet_y;
byte bomb_x;
byte bomb_y;

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

void draw_lives() {
  byte i;
  byte n = lives;
  byte y = 18;
  byte x = VBWIDTH-1;
  for (i=0; i<MAXLIVES; i++) {
    draw_char(i<n?'*':' ', x, y++);
  }
}

void draw_score() {
  byte x = VBWIDTH-1;
  byte y = 10;
  draw_bcd_word(score, x, y, 1);
}

void draw_bunker(byte x, byte y, byte y2, byte h, byte w) {
  byte i,a,b;
  a=0; b=0;
  for (i=0; i<h; i++) {
    a = y-y2-i*2;
    b = y-i;
    xor_vline(x+i, a, b);
    xor_vline(x+h*2+w-i-1, a, b);
  }
  for (i=0; i<w; i++) {
    xor_vline(x+h+i, a, b);
  }
}

void draw_playfield() {
  byte i;
  clrscr();
  draw_string("PLAYER 1", VBWIDTH-1, 0, 1);
  draw_score();
  draw_lives();
  for (i=0; i<VBWIDTH-2; i++)
    vidmem[191][i] = 0x55;
  draw_bunker(20, 165, 15, 15, 20);
  draw_bunker(160, 165, 15, 15, 20);
}

void add_score(word pts) {
  if (attract) return;
  score = bcd_add(score, pts);
  draw_score();
}

void xor_player_derez() {
  byte i,j;
  byte x = player_x+13;
  byte y = 190;
  byte* rand = (byte*) &clrscr; // use code as random #'s
  for (j=1; j<=0x1f; j++) {
    for (i=0; i<50; i++) {
      signed char xx = x + (*rand++ & 0x1f) - 15;
      signed char yy = y - (*rand++ & j);
      xor_pixel(xx, yy);
      if ((xx & 0x1f) > j) { CLICK; }
    }
  }
}

void destroy_player() {
  xor_player_derez(); // xor derez pattern
  xor_sprite(player_bitmap, player_x, VHEIGHT-17); // erase ship via xor
  xor_player_derez(); // xor 2x to erase derez pattern
  player_x = 0xff;
  lives--;
}

void init_enemies() {
  byte i,x,y,bm;
  x=0;
  y=10;
  bm=0;
  for (i=0; i<MAX_ENEMIES; i++) {
    Enemy* e = &enemies[i];
    e->x = x;
    e->y = y;
    e->shape = enemy_bitmaps[bm];
    x += 29;
    if (x >= 200) {
      x = 0;
      y += 20;
      bm++;
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
  clear_sprite(e->shape, e->x, e->y);
  memmove(e, e+1, sizeof(Enemy)*(enemies-e+MAX_ENEMIES-1));
  num_enemies--; // update_next_enemy() will check enemy_index
  tone(1,10,10);
}

void update_next_enemy() {
  Enemy* e;
  if (enemy_index >= num_enemies) {
    enemy_index = 0;
    memcpy(&this_mode, &next_mode, sizeof(this_mode));
    tone(220+num_enemies,3,1);
  }
  e = &enemies[enemy_index];
  clear_sprite(e->shape, e->x, e->y);
  if (this_mode.down) {
    e->y += 4;
    // if too close to ground, end game
    if (e->y > 170) {
      destroy_player();
      lives = 0;
    }
    next_mode.down = 0;
  } else {
    if (this_mode.right) {
      e->x += 2;
      if (e->x >= 255-32) {
        next_mode.down = 1;
        next_mode.right = 0;
      }
    } else {
      e->x -= 2;
      if (e->x == 0) {
        next_mode.down = 1;
        next_mode.right = 1;
      }
    }
  }
  draw_sprite(e->shape, e->x, e->y);
  enemy_index++;
}

char in_rect(Enemy* e, byte x, byte y, byte w, byte h) {
  byte ew = e->shape[0]*8;
  byte eh = e->shape[1];
  return (x >= e->x-w && x <= e->x+ew+w && y >= e->y-h && y <= e->y+eh+h);
}

Enemy* find_enemy_at(byte x, byte y) {
  byte i;
  for (i=0; i<num_enemies; i++) {
    Enemy* e = &enemies[i];
    if (in_rect(e, x, y, 4, 4)) {
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
  bullet_x = player_x + 13;
  bullet_y = VHEIGHT-22;
  xor_sprite(bullet_bitmap, bullet_x, bullet_y); // draw
}

void move_bullet() {
  byte leftover = xor_sprite(bullet_bitmap, bullet_x, bullet_y); // erase
  if (leftover || bullet_y < 10) {
    clear_sprite(bullet_bitmap, bullet_x, bullet_y);
    check_bullet_hit(bullet_x, bullet_y+2);
    bullet_y = 0;
  } else {
    bullet_y -= 4;
    tone(bullet_y,3,0);
    xor_sprite(bullet_bitmap, bullet_x, bullet_y); // draw
  }
}

void drop_bomb() {
  Enemy* e = &enemies[enemy_index];
  bomb_x = e->x + 7;
  bomb_y = e->y + 16;
  xor_sprite(bomb_bitmap, bomb_x, bomb_y);
}

void move_bomb() {
  byte leftover = xor_sprite(bomb_bitmap, bomb_x, bomb_y); // erase
  if (bomb_y > VHEIGHT-12) {
    bomb_y = 0;
  } else if (leftover & 0x7f) { // don't count hi bit
    erase_sprite(bomb_bitmap, bomb_x, bomb_y); // erase bunker
    if (bomb_y > VHEIGHT-23) {
      // player was hit (probably)
      destroy_player();
    }
    bomb_y = 0;
  } else {
    bomb_y += 3;
    xor_sprite(bomb_bitmap, bomb_x, bomb_y);
  }
}

byte frame;
signed char player_dir = 0;

void move_player() {
  if (attract) {
    if (bullet_y == 0) fire_bullet();
    player_dir = 0;
  } else {
    char key = keyscan();
    // handle keyboard 
    if (key != 0xff) {
      switch (key) {
        case 0x04: // left arrow
          player_dir = -2;
          break;
        case 0x13: // right arrow
          player_dir = 2;
          break;
        case ' ': // space
          if (bullet_y == 0) {
            fire_bullet();
          }
          break;
      }
    } else {
      player_dir = 0;
    }
  }
  // move player
  if (player_dir < 0 && player_x > 0)
    player_x += player_dir;
  else if (player_dir > 0 && player_x < 255-40)
    player_x += player_dir;
  draw_sprite(player_bitmap, player_x, VHEIGHT-17);
}

void play_round() {
  draw_playfield();
  player_x = VHEIGHT/2-8;
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
  byte x=8;
  byte y=10;
  for (i=0; i<50; i++) {
    draw_string(" *************** ", x, y+0, 0);
    draw_string("***           ***", x, y+1, 0);
    draw_string("**  GAME OVER  **", x, y+2, 0);
    draw_string("***           ***", x, y+3, 0);
    draw_string(" *************** ", x, y+4, 0);
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

void main() {
  // NOTE: initializers don't get run, so we init here
  while (1) {
    //attract_mode();
    play_game();
  }
}
