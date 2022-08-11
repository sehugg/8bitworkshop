  
//#link "common.c"
#include "common.h"

//#link "rasterirq.ca65"
#include "rasterirq.h"

//#link "sprites.c"
#include "sprites.h"

#include <cbm_petscii_charmap.h>

/*{w:24,h:21,bpp:1,brev:1}*/
const char spriteshape[3*21] = {
  0x00,0x7F,0x00,0x01,0xFF,0xC0,0x03,0xFF,0xE0,
  0x03,0xE7,0xE0,0x07,0xD9,0xF0,0x07,0xDF,0xF0,
  0x07,0xD9,0xF0,0x03,0xE7,0xE0,0x03,0xFF,0xE0,
  0x03,0xFF,0xE0,0x02,0xFF,0xA0,0x01,0x7F,0x40,
  0x01,0x3E,0x40,0x00,0x9C,0x80,0x00,0x9C,0x80,
  0x00,0x49,0x00,0x00,0x49,0x00,0x00,0x3E,0x00,
  0x00,0x3E,0x00,0x00,0x3E,0x00,0x00,0x1C,0x00
};

byte scroll_x = 0;

void dlist_example(void) {
  VIC.bordercolor = 6;
  VIC.bordercolor = 5;
  VIC.ctrl1 = 0x18;
  VIC.ctrl2 = VIC.ctrl2 & 0xf8;
  VIC.ctrl2 |= (scroll_x & 7);
  DLIST_NEXT(150);

//  VIC.ctrl1 = 5 | 0x18;

  VIC.bordercolor = 2;
  sprshad.spr_pos[0].y += 1;
  scroll_x++;
  VIC.addr ^= 0xf0;
  VIC.ctrl2 = VIC.ctrl2 & 0xf8;
  DLIST_NEXT(0xf9);

  VIC.ctrl1 = 0x10;
  VIC.bordercolor = 3;
  VIC.addr ^= 0xf0;
  DLIST_NEXT(0xfc);
  
  VIC.ctrl1 = 0x18;
  VIC.bordercolor = 4;
  DLIST_RESTART(30);
}

void main(void) {
  byte i;
  
  clrscr();

  sprite_clear();
  sprite_set_shapes(spriteshape, 192, 1);
  
  // set colors
  sprshad.spr_exp_x = 0xff;
  for (i=0; i<8; i++) {
    sprshad.spr_color[i] = i+3;
    sprite_draw(i, i*38+24, 248, 192);
  }
  // TODO: can't do in IRQ

  DLIST_SETUP(dlist_example);
  while (1) {
    waitvsync();
    sprite_update(DEFAULT_SCREEN);
    printf("Raster IRQ-driven display list! ");
  }
}
