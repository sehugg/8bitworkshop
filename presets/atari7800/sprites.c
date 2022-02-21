
/*
This demo sets up two DLLs (Display List Lists) of
16 slots each.

By swapping between the two DLLs each frame, one DLL can
be written while the other is displayed.
*/

#include "atari7800.h"
#include <string.h>
#include <stdlib.h>

#include "dll.h"
//#link "dll.c"

//#link "chr_font.s"
//#link "generic8x16.s"

#define NUMSPRITES 16
byte xpos[NUMSPRITES];
byte ypos[NUMSPRITES];

char* hello = "\2\4\6\0\220\222\102";

// draw a text string randomly into the background
void draw_background() {
  byte x = rand();
  byte y = rand();
  if (dll_bytesleft(y/SLOTHEIGHT) > 20) {
    dll_add_string(hello, x, y, DL_WP(7,0));
    dll_swap();
    dll_copy();
    dll_save();
  }
}

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

  // set background sprites and save to buffer
  dll_clear();
  draw_background();
  
  // set up sprite positions randomly
  for (i=0; i<NUMSPRITES; i++) {
    xpos[i] = rand();
    ypos[i] = rand();
  }

  // frame loop
  while (1) {
    // wait for vsync to end
    while ((MARIA.MSTAT & MSTAT_VBLANK) == 0) ;
    // swap buffers and restore background
    dll_swap();
    dll_restore();
    // draw new background sprite?
    // after 32 bytes, the display slots fill up
    if ((rand() & 255) == 0) {
      draw_background();
    }
    // draw forgeground sprites
    for (i=0; i<NUMSPRITES; i++) {
      dll_add_sprite(0xa06c, xpos[i], ypos[i], DL_WP(4,1));
      xpos[i] += rand() & 3;
      ypos[i] += rand() & 3;
    }
    // wait for vsync to start
    while ((MARIA.MSTAT & MSTAT_VBLANK) != 0) ;
    y++;
  }
}

