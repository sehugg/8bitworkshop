
//#resource "astrocade.inc"
#include "aclib.h"
//#link "aclib.s"
//#link "hdr_autostart.s"
#include "acbios.h"
//#link "acbios.s"

#include <stdlib.h>
#include <string.h>

/*{pal:"astrocade",layout:"astrocade"}*/
const byte palette[8] = {
  0x77, 0xD4, 0x35, 0x01,
  0x07, 0xD4, 0x35, 0x01,
};

const byte SPRITE[] = {
  0, 0,		// x and y offset
  1, 4,		// width (bytes) and height (lines)
  /*{w:4,h:4,bpp:2,brev:1}*/
  0xA0,
  0xD0,
  0xC4,
  0xC1
};

void draw_pattern(byte x) {
  vmagic[0][x] = SPRITE[4];
  vmagic[1][x] = SPRITE[5];
  vmagic[2][x] = SPRITE[6];
  vmagic[3][x] = SPRITE[7];
}

void draw_pattern_inv(byte x) {
  vmagic[3][x] = SPRITE[4];
  vmagic[2][x] = SPRITE[5];
  vmagic[1][x] = SPRITE[6];
  vmagic[0][x] = SPRITE[7];
}

void main(void) {
  // setup palette
  set_palette(palette);
  // set screen height
  // set horizontal color split (position / 4)
  // set interrupt status
  SYS_SETOUT(89*2, 23, 0);
  // clear screen
  SYS_FILL(0x4000, 89*40, 0);
  // draw pattern
  hw_magic = M_ROTATE;
  draw_pattern(0);
  draw_pattern(2);
  // draw pattern flopped
  hw_magic = M_ROTATE|M_FLOP;
  draw_pattern(4);
  draw_pattern(6);
  // draw pattern
  hw_magic = M_ROTATE;
  draw_pattern_inv(8);
  draw_pattern_inv(10);
  // draw pattern flopped
  hw_magic = M_ROTATE|M_FLOP;
  draw_pattern_inv(12);
  draw_pattern_inv(14);
  
  while (1) {
  }
}
