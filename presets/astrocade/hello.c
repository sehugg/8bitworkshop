
//#resource "astrocade.inc"
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

// BCD number
static byte bcdnum[3] = {0x56,0x34,0x12};
const byte bcdinc[3] = {0x01,0x00,0x00};
const byte keypadMask[4] = { 0x3f,0x3f,0x3f,0x3f };

void main(void) {
  // setup palette
  set_palette(palette);
  // set screen height
  // set horizontal color split (position / 4)
  // set interrupt status
  SYS_SETOUT(89*2, 23, 0);
  // clear screen
  SYS_FILL(0x4000, 89*2, 0);
  // display standard characters
  display_string(2, 2, OPT_ON(1), "HELLO, WORLD!\xb1\xb2\xb3\xb4\xb5");
  // 2x2 must have X coordinate multiple of 2
  display_string(4, 16, OPT_2x2|OPT_ON(2), "BIG TEXT!");
  // 4x4 must have X coordinate multiple of 4
  display_string(4, 36, OPT_4x4|OPT_ON(2), "4X4");
  // we can use OR mode to make a shadow
  display_string(4, 38, OPT_4x4|OPT_ON(3)|OPT_OR, "4X4");
  // and XOR mode to invert existing pixels
  // (careful, there's no clipping)
  display_string(109, 24, OPT_8x8|OPT_ON(3)|OPT_XOR, "?");
  // small font must be aligned to multiple of 4
  display_string(4, 80, OPT_ON(1), "\xb0\xb1\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9");
  // paint a rectangle with a pattern mask (0xa5)
  paint_rectangle(4, 72, 100, 4, 0xa5);
  // write from pattern block
  write_relative(50, 80, M_XPAND, BALL);
  write_relative(60, 80, M_XPAND, BALL);
  // write_pattern() doesn't use the x/y offset
  write_pattern(70, 80, M_XPAND, BALL+2);
  write_pattern(0, 80, M_XPAND|M_FLOP, BALL+2);
  write_pattern(1, 70, M_XPAND|M_FLOP, BALL+2);
  write_pattern(2, 60, M_XPAND|M_FLOP, BALL+2);
  // infinite loop
  activate_interrupts();
  // make sure screen doesn't black out
  RESET_TIMEOUT();
  while (1) {
    display_bcd_number(80, 80, OPT_ON(2), bcdnum, 6|DISBCD_SML|DISBCD_NOZERO);
    bcdn_add(bcdnum, 3, bcdinc);
    while (sense_transition(keypadMask) == 0);
  }
}
