
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
byte bcdnum[3] = {0x96,0x99,0x09};
const byte bcdinc[3] = {0x01,0x00,0x00};

byte music_stack[16];
const byte MUSICDATA[] = {
 0x80,
 0x20,0xB0,0xCC,0x0F,0x0C,0x7E,0x00,0x00,
 0x0C,0x7E,0x00,0x00,0x24,0x5E,0x7E,0x96,
 0x0C,0x54,0x64,0x7E,0x0E,0x4A,0x5E,0x7E,
 0x10,0x46,0x54,0x7E,0x48,0x3E,0x4A,0x5E,
 0x0E,0x5E,0x8D,0x70,0x10,0x54,0x8D,0x70,
 0x36,0x4A,0x5E,0x70,0x12,0x46,0x54,0x7E,
 0x24,0x54,0x64,0x7E,0x48,0x5E,0x96,0x7E,
 0xE0,0x80,0x18,0x90,0xFD,0xB0,0xFF,0x1F,
 0xF0,
};

void main(void) {
  // setup palette
  set_palette(palette);
  // set screen height
  // set horizontal color split (position / 4)
  // set interrupt status
  // use SYS_SETOUT macro
  SYS_SETOUT(89*2, 23, 0);
  // clear screen w/ SYS_FILL macro
  SYS_FILL(0x4000, 89*40, 0);
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
  paint_rectangle(4, 72, 100, 5, 0x55);
  // more compact macro
  SYS_RECTAN(6, 74, 100, 4, 0xaa);
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
  // play music
  //SYS_BMUSIC(_music_stack, 0b11111100, _MUSICDATA);
  //begin_music(music_stack, 0b11111100, MUSICDATA);
  while (1) {
    // wait for SENTRY result
    word code;
    do {
      code = sense_transition(ALKEYS);
    } while (code == 0);
    // respond to SENTRY
    switch (code & 0xff) {
      case SSEC:
        display_bcd_number(80, 80, OPT_ON(2), bcdnum, 6|DISBCD_SML|DISBCD_NOZERO);
        bcdn_add(bcdnum, 3, bcdinc);
        break;
      case SP0:
        hw_horcb = (code>>8)>>2;
        break;
    }
  }
}
