
#include "aclib.h"
//#link "aclib.c"
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

const byte BALL[] = {
  0, 0,		// x and y offset
  1, 6,		// width (bytes) and height (lines)
  /*{w:8,h:6,brev:1}*/
  0b01111000,
  0b11011100,
  0b10111100,	
  0b10111100,
  0b11111100,
  0b01111000,
};

void main() {
  // clear screen
  clrscr();
  // setup palette
  set_palette(palette);
  // set screen height
  // set horizontal color split (position / 4)
  // set interrupt status
  SYS_SETOUT(98*2, 23, 0);
  // display standard characters
  display_string(2, 2, OPT_ON(1), "HELLO, WORLD!!");
  // 2x2 must have X coordinate multiple of 2
  display_string(4, 16, OPT_2x2|OPT_ON(2), "BIG TEXT!");
  // 4x4 must have X coordinate multiple of 4
  display_string(4, 36, OPT_4x4|OPT_ON(2), "4X4");
  // we can use OR mode to make a shadow
  display_string(4, 38, OPT_4x4|OPT_ON(3)|OPT_OR, "4X4");
  // and XOR mode to invert existing pixels
  // (careful, there's no clipping)
  display_string(101, 24, OPT_8x8|OPT_ON(3)|OPT_XOR, "?");
  // small font must be aligned to multiple of 4
  display_string(4, 80, OPT_ON(1), "\xb0\xb1\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9");
  // paint a rectangle with a pattern mask (0xa5)
  paint_rectangle(4, 72, 90, 4, 0xa5);
  // write from pattern block
  write_relative(50, 80, M_XPAND, BALL);
  write_relative(60, 80, M_XPAND, BALL);
  write_relative(70, 80, M_XPAND, BALL);
  // infinite loop
  while (1) {
  }
}
