
#include "common.h"
//#link "common.c"

//#link "multisprite.ca65"

#include "rasterirq.h"
//#link "rasterirq.ca65"

#define NUM_TEST_SPRITES 24

byte* sprite_bank = (byte*)DEFAULT_SCREEN + 0x3f8;

/*{w:12,h:21,bpp:2,brev:1}*/
const char SPRITEMC[3*21] = {
  0x00,0xAA,0x80,0x02,0xAA,0xA0,0x0A,0xAA,0xA8,
  0x0A,0xAE,0xA8,0x0A,0xBB,0xA8,0x0A,0xBA,0xA8,
  0x0A,0xBB,0xA8,0x0A,0xAE,0xA8,0x0A,0xAA,0xA8,
  0x09,0xAA,0x98,0x08,0x6A,0x48,0x08,0x1D,0x08,
  0x02,0x0C,0x20,0x02,0x0C,0x20,0x02,0x0C,0x20,
  0x00,0x8C,0x80,0x00,0x8C,0x80,0x00,0x55,0x40,
  0x00,0x77,0x40,0x00,0x5D,0x40,0x00,0x15,0x00
};

/*
const byte BITS[8] = {
  0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80
};
const byte NOTBITS[8] = {
  ~0x01, ~0x02, ~0x04, ~0x08, ~0x10, ~0x20, ~0x40, ~0x80
};

typedef struct MSpriteFlags {
  byte xhi:1;
  byte exp_x:1;
  byte exp_y:1;
  byte mcolor:1;
  byte bgprio:1;
} MSpriteFlags;
*/

#include "multisprite.h"

void sprite_shape(char* vicbank, byte index, const char* sprite_data) {
  memmove(vicbank + index*64, sprite_data, 64);
}

void setup_sprites() {
  byte i;
  sprite_shape((void*)0x0, 255, SPRITEMC);
  for (i=0; i<MAX_MSPRITES; i++) {
    msprite_order[i] = i;
    msprite_y[i] = 255;
  }
  for (i=0; i<NUM_TEST_SPRITES; i++) {
    int x = i*13+20;
    msprite_x_lo[i] = x;
    msprite_x_hi[i] = x>>8;
    msprite_y[i] = i*0+50;
//    msprite_flags[i] = 0;
    msprite_shape[i] = 255;
    msprite_color[i] = i|8;
  }
}

void display_list() {
  msprite_render_init();
  msprite_render_section();
  DLIST_NEXT(Y1+YS*1);
  msprite_render_section();
  DLIST_NEXT(Y1+YS*2);
  msprite_render_section();
  DLIST_NEXT(Y1+YS*3);
  msprite_render_section();
  DLIST_NEXT(Y1+YS*4);
  msprite_render_section();
  DLIST_NEXT(Y1+YS*5);
  msprite_render_section();
  VIC.bordercolor = 3;
  msprite_sort();
  VIC.bordercolor = 4;
  msprite_add_velocity(NUM_TEST_SPRITES);
  VIC.bordercolor = 0;
  DLIST_RESTART(Y0);
}

void msprite_set_position(byte index, int x, byte y) {
  asm("sei");
  msprite_x_lo[index] = x;
  msprite_x_hi[index] = x >> 8;
  msprite_y[index] = y;
  asm("cli");
}

void msprite_add_position(byte index, byte dx, byte dy) {
  int x;
  x = msprite_x_lo[index] | msprite_x_hi[index]*256;
  x += dx;
  asm("sei");
  msprite_x_lo[index] = x;
  msprite_x_hi[index] = x >> 8;
  msprite_y[index] += dy;
  asm("cli");
}

void apply_gravity() {
  byte i;
  for (i=0; i<NUM_TEST_SPRITES; i++) {
    int xvel = msprite_xvel_lo[i] + msprite_xvel_hi[i]*256;
    int yvel = msprite_yvel_lo[i] + msprite_yvel_hi[i]*256;
    int xpos = msprite_x_lo[i] + msprite_x_hi[i]*256;
    int ypos = msprite_y[i];
    xpos -= 172;
    ypos -= 145;
    xvel -= xpos / 8;
    yvel -= ypos / 8;
    msprite_xvel_lo[i] = xvel;
    msprite_xvel_hi[i] = xvel >> 8;
    msprite_yvel_lo[i] = yvel;
    msprite_yvel_hi[i] = yvel >> 8;
  }
}

void do_test() {
  byte i;
  raster_wait(160);
  for (i=0; i<NUM_TEST_SPRITES; i++) {
    msprite_yvel_lo[i] = i*8;
     //msprite_add_position(i,i&3,i&3);
  }
}

void main() {
  
  clrscr();
  
  setup_sprites();

  // set colors
  VIC.spr_mcolor = 0xff;
  VIC.spr_mcolor0 = 4;
  VIC.spr_mcolor1 = 7;
  
  DLIST_SETUP(display_list);
  
  while (1) {
    do_test();
  }
}
