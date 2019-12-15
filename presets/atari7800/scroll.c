
/*
This demo sets up two DLLs (Display List Lists) of
16 slots each. By adjusting the address and fine offset
of the first DL entry, the screen can scroll vertically
across the two DLLs. It can only wrap from the first 16
to the second 16 slots.

Note that this scheme can be used also for double-buffering.
By swapping between the two DLLs each frame, one DLL can
be written while the other is displayed.
*/

#include "atari7800.h"
#include <string.h>

#include "dll.h"
//#link "dll.c"

//#link "chr_font.s"
//#link "generic8x16.s"

char* hello = "\2\4\6\0\220\222\102";

void main() {
  byte i;
  byte y = 0;

  dll_setup();
  
  // activate DMA
  MARIA.CHARBASE = 0x80;
  MARIA.P0C1 = 0x8f;
  MARIA.P0C2 = 0x4f;
  MARIA.P0C3 = 0x1f;
  MARIA.P1C1 = 0x34;
  MARIA.P1C2 = 0x28;
  MARIA.P1C3 = 0x1f;
  MARIA.BACKGRND = 0;
  MARIA.CTRL = CTRL_DMA_ON | CTRL_DBLBYTE | CTRL_160AB;

  dll_clear();
  dll_add_string(hello, y+32, 32, DL_WP(8,0));
  for (i=0; i<8; i++) {
    dll_page(0);
    dll_add_sprite(0xa068, i*4, i*33, DL_WP(4,1));
    dll_add_sprite(0xa06c, i*8, i*25, DL_WP(4,1));
    dll_page(1);
    dll_add_sprite(0xa068, i*4, i*32, DL_WP(4,1));
    dll_add_sprite(0xa06c, 128-i*8, i*24, DL_WP(4,1));
  }
  dll_save();

  while (1) {
    // wait for vsync to end
    while ((MARIA.MSTAT & MSTAT_VBLANK) == 0) ;
    dll_set_scroll(y);
    dll_restore_all();
    // first sprite doesn't have time to draw when y < 40
    dll_page(0);
    dll_add_sprite(0xa06c, y, 128, DL_WP(4,1));
    dll_page(1);
    dll_add_sprite(0xa06c, y, 0, DL_WP(4,1));
    // wait for vsync to start
    while ((MARIA.MSTAT & MSTAT_VBLANK) != 0) ;
    y++;
  }
}

