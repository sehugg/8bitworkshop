
#include "neslib.h"
#include <string.h>
#include <stdio.h>

// VRAM buffer module
#include "vrambuf.h"
//#link "vrambuf.c"

// link the pattern table into CHR ROM
//#link "chr_generic.s"

// function to scroll window up and down until end
void scroll_demo() {
  int x = 0;   // x scroll position
  int y = 0;   // y scroll position
  int dy = 1;  // y scroll direction
  // 32-character array for string-building
  char str[32];
  // clear string array
  memset(str, 0, sizeof(str));
  // infinite loop
  while (1) {
    // write message to string array
    sprintf(str, "%6x %6d", y, y);
    // write string array into VRAM buffer
    putbytes(NTADR_A(2,y%30), str, 32);
    // wait for next frame
    // and flush VRAM buffer
    cflushnow();
    // set scroll (shadow) registers
    scroll(x, y);
    // update y variable
    y += dy;
    // change direction when hitting either edge of scroll area
    if (y >= 479) dy = -1;
    if (y == 0) dy = 1;
  }
}

// main function, run after console reset
void main(void) {
  // set palette colors
  pal_col(1,0x04);
  pal_col(2,0x20);
  pal_col(3,0x30);
  
  // clear vram buffer
  cclearbuf();
  
  // set NMI handler
  set_vram_update(updbuf);

  // enable PPU rendering (turn on screen)
  ppu_on_all();

  // scroll window back and forth
  scroll_demo();
}
