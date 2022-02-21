
/*
On the NES, you can't write to video RAM while the PPU
is active, so you have to do it during the vertical blank.
We have a module (vrambuf) which fills up a buffer with video
data, then NESLib writes it to VRAM during the NMI interrupt.
*/

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
    // if buffer is full this will wait for next frame
    vrambuf_put(NTADR_A(2,y%30), str, 32);
    // update y variable
    y += dy;
    // change direction when hitting either edge of scroll area
    if (y >= 479) dy = -1;
    if (y == 0) dy = 1;
    // set scroll (shadow) registers
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
  
  // clear vram buffer
  vrambuf_clear();
  
  // set NMI handler
  set_vram_update(updbuf);

  // enable PPU rendering (turn on screen)
  ppu_on_all();

  // scroll window back and forth
  scroll_demo();
}
