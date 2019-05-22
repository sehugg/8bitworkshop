
/*
Scrolling demo.
We've selected horizontal mirroring as the default, so
nametables A and C are stacked on top of each other.
The vertical scroll area is 480 pixels high; note how
the nametables wrap around.
*/

#include "neslib.h"
#include <string.h>

// link the pattern table into CHR ROM
//#link "chr_generic.s"

// function to write a string into the name table
//   adr = start address in name table
//   str = pointer to string
void put_str(unsigned int adr, const char *str) {
  vram_adr(adr);        // set PPU read/write address
  vram_write(str, strlen(str)); // write bytes to PPU
}

// function to scroll window up and down until end
void scroll_demo() {
  int x = 0;   // x scroll position
  int y = 0;   // y scroll position
  int dy = 1;  // y scroll direction
  // infinite loop
  while (1) {
    // wait for next frame
    ppu_wait_frame();
    // update y variable
    y += dy;
    // change direction when hitting either edge of scroll area
    if (y >= 479) dy = -1;
    if (y == 0) dy = 1;
    // set scroll register
    scroll(x, y);
  }
}

// main function, run after console reset
void main(void) {
  // set palette colors
  pal_col(0,0x02);	// set screen to dark blue
  pal_col(1,0x14);	// pink
  pal_col(2,0x20);	// grey
  pal_col(3,0x30);	// white

  // write text to name table
  put_str(NTADR_A(2,0), "Nametable A, Line 0");
  put_str(NTADR_A(2,15), "Nametable A, Line 15");
  put_str(NTADR_A(2,29),"Nametable A, Line 29");
  put_str(NTADR_C(2,0), "Nametable C, Line 0");
  put_str(NTADR_C(2,15), "Nametable C, Line 15");
  put_str(NTADR_C(2,29),"Nametable C, Line 29");

  // enable PPU rendering (turn on screen)
  ppu_on_all();

  // scroll window back and forth
  scroll_demo();
}
