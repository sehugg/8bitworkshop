
#include "common.h"
//#link "common.c"

#include "sprites.h"
//#link "sprites.c"

#define NUM_SPRITE_PATTERNS 2
#define SPRITE_SHAPE 192
#define SPRITES_PER_ROW 6

/*{w:12,h:21,bpp:2,brev:1,count:2}*/
const char SPRITEMC[64*NUM_SPRITE_PATTERNS] = {
  0x00,0xAA,0x80,0x02,0xAA,0xA0,0x0A,0xAA,0xA8,
  0x0A,0xAE,0xA8,0x0A,0xBB,0xA8,0x0A,0xBA,0xA8,
  0x0A,0xBB,0xA8,0x0A,0xAE,0xA8,0x0A,0xAA,0xA8,
  0x09,0xAA,0x98,0x08,0x6A,0x48,0x08,0x1D,0x08,
  0x02,0x0C,0x20,0x02,0x0C,0x20,0x02,0x0C,0x20,
  0x00,0x8C,0x80,0x00,0x8C,0x80,0x00,0x55,0x40,
  0x00,0x77,0x40,0x00,0x5D,0x40,0x00,0x15,0x00,
  0,
  0x00,0xAE,0x80,0x02,0xBF,0xA0,0x0B,0xBF,0xB8,
  0x0B,0xBF,0xB8,0x0B,0xBF,0xB8,0x0B,0xBF,0xB8,
  0x0B,0xBF,0xB8,0x0B,0xBF,0xB8,0x0B,0xAE,0xB8,
  0x09,0xAE,0x98,0x08,0x6E,0x48,0x08,0x1D,0x08,
  0x02,0x0C,0x20,0x02,0x0C,0x20,0x02,0x0C,0x20,
  0x08,0x8C,0x88,0x08,0x8C,0x88,0x20,0x55,0x42,
  0x20,0x77,0x42,0x20,0x5D,0x42,0x20,0x15,0x02,
  0,
};

SpriteShadow* sprite_rows[3];	// row sprite buffers
int player_x = 172;		// player X coordinate
byte player_y = 222;		// player Y coordinate

void init_sprites(void) {
  byte row,i;
  // iterate through each row of sprites
  for (row=0; row<3; row++) {
    // fill in data for local sprite buffer
    sprite_clear();
    sprshad.spr_mcolor = 0xff;
    for (i=0; i<SPRITES_PER_ROW; i++) {
      sprite_draw(i, i*50+50, row*50+60, SPRITE_SHAPE);
      sprshad.spr_color[i] = (i+row)|8;
    }
    // allocate sprite buffer for row
    sprite_rows[row] = (SpriteShadow*) malloc(sizeof(SpriteShadow));
    // and copy local buffer into it
    *sprite_rows[row] = sprshad;
  }
}

void draw_sprite_row(byte row, byte rasterline) {
  // copy sprite row data to sprite shadow buffer
  sprshad = *sprite_rows[row];
  // player is part of row 2, draw player?
  if (row == 2) {
    sprite_draw(7, player_x, player_y, SPRITE_SHAPE+1);
    sprshad.spr_color[7] = 15;
  }
  // wait for the raster line
  raster_wait(rasterline);
  // then update sprite registers from shadow buffer
  VIC.bordercolor = row+1; // (so we see the timing)
  sprite_update(DEFAULT_SCREEN);
  VIC.bordercolor = 0;
}

void move_sprite_x(SpriteShadow* spr, 
                   byte index,
                   sbyte delta_x)
{
  word x = spr->spr_pos[index].x;
  byte mask = BITS[index]; // lookup table for (1 << index)
  if (spr->spr_hi_x & mask) {
    x |= 0x100;
  }
  x += delta_x;
  spr->spr_pos[index].x = x;
  if (x & 0x100) {
    spr->spr_hi_x |= mask;
  } else {
    spr->spr_hi_x &= ~mask;
  }
}

void move_sprites() {
  byte i;
  for (i=0; i<SPRITES_PER_ROW; i++) {
    move_sprite_x(sprite_rows[0], i, 3);
    move_sprite_x(sprite_rows[1], i, -2);
  }
}

void move_player() {
  byte joy = PEEK(0xdc01); // read joystick #0
  if (joy & 0x8) { player_x -= 1; } // left
  if (joy & 0x4) { player_x += 1; } // right
}

void iterate_game(void) {
  waitvsync();
  draw_sprite_row(0, 1);
  draw_sprite_row(1, 60+21);
  draw_sprite_row(2, 110+21);
  move_sprites();
  move_player();
  VIC.bordercolor = 9;
}

void main(void) {
  
  VIC.bordercolor = 0;
  clrscr();
  
  // setup sprite library and copy sprite to VIC bank
  sprite_clear();
  sprite_set_shapes(SPRITEMC, SPRITE_SHAPE, NUM_SPRITE_PATTERNS);
  
  // set colors
  VIC.spr_mcolor0 = 4;
  VIC.spr_mcolor1 = 7;

  // set sprite initial positions
  init_sprites();

  // turn off interrupts so we don't mess up timing
  asm("sei");
  
  // game loop
  while (1) {
    iterate_game();
  }
}

