  
//#link "common.c"
#include "common.h"

//#link "rasterirq.ca65"
#include "rasterirq.h"

//#link "sprites.c"
#include "sprites.h"

#include <cbm_petscii_charmap.h>
#include <cc65.h>

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

void sprite_stretch() {
  // get current raster line
  asm("lda $d012"); 
  // sprite Y expand bits = 255
  asm("ldx #$ff");
  asm("stx $d017");
  // wait for next raster line
  asm("@loop:");
  asm("cmp $d012");
  asm("beq @loop");
  // sprite Y expand bits = 0
  asm("inx");
  asm("stx $d017"); 
}

void dlist_example(void) {
 
  // stretch for the next 40 lines
  while (VIC.rasterline != 160) {
    sprite_stretch();
  }
  
  VIC.spr0_y+=3;
  VIC.spr7_y-=2;
 
  DLIST_RESTART(8*15);
}

void main(void) {
  byte i;
  
  clrscr();
  VIC.bordercolor = 0;

  sprite_clear();
  sprite_set_shapes(spriteshape, 192, 1);
  
  sprshad.spr_exp_x = 0xff;
  for (i=0; i<8; i++) {
    sprshad.spr_color[i] = i|8;
    sprite_draw(i, i*38+24, 120-i, 192);
  }
  sprite_update(DEFAULT_SCREEN);

  DLIST_SETUP(dlist_example);
  
  while (1) {
    if (STICK_MOVED(READ_STICK(0))) break;
  }
  
  DLIST_DONE();
}
