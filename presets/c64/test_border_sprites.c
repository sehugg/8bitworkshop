  
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

byte scroll_x = 0;
byte scroll_y = 0;

void dlist_example(void) {
  VIC.ctrl1 = VIC_CTRL1_DEN | VIC_CTRL1_RSEL;
  VIC.bordercolor = 5;
 
  // Flexible line distance (FLD)
  // this adds a gap of 1-6 scanlines
  DLIST_NEXT(150);
  VIC.ctrl1 = (scroll_y & 7) | 0x18;
  VIC.bordercolor = 2;

  // this opens up the vertical borders
  // it must be done on the last row (247-249)
  DLIST_NEXT(249);
  VIC.ctrl1 = VIC_CTRL1_DEN;

  // move sprites and restart the display list
  scroll_x++;
  scroll_y++;
  VIC.spr0_y++;
  VIC.spr7_y--;
  VIC.bordercolor = 4;
  DLIST_RESTART(30);
}


void SieveOfEratosthenes() {
  const int n = 1023;
  int primes[1024];
  int i,p;
  memset(primes, 1, sizeof(primes));

  for (p = 2; p*p <= n; p++) {
    if (primes[p]) {
      for (i = p*p; i <= n; i += p)
        primes[i] = 0;
    }
  }

  for (p = 2; p <= n; p++)
    if (primes[p])
      printf("%d ", p);
}

void main(void) {
  byte i;
  
  clrscr();

  sprite_clear();
  sprite_set_shapes(spriteshape, 192, 1);
  
  sprshad.spr_exp_x = 0xff;
  for (i=0; i<8; i++) {
    sprshad.spr_color[i] = i+3;
    sprite_draw(i, i*38+24, 248, 192);
  }
  sprite_update(DEFAULT_SCREEN);

  DLIST_SETUP(dlist_example);
  
  // do something complicated while IRQ runs...
  while (1) {
    SieveOfEratosthenes();
  }
}
