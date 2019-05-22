
/*
Demo of split screen effect.
We position sprite 0 at the desired scanline, and when it
collides with the background, a flag in the PPU is set.
The split() function waits for this flag, then changes the
X scroll register in the PPU.
*/

#include "neslib.h"
#include <string.h>

// vertical mirroring (horizontal scroling)
#define NES_MIRRORING 1

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
  int dx = 1;  // x scroll direction
  // infinite loop
  while (1) {
    // set scroll register
    // waits for NMI, which means no frame-skip?
    split(x, 0);
    // update x variable
    x += dx;
    // change direction when hitting either edge of scroll area
    if (x >= 479) dx = -1;
    if (x == 0) dx = 1;
  }
}

// main function, run after console reset
void main(void) {
  // set palette colors
  pal_col(0,0x00);
  pal_col(1,0x04);
  pal_col(2,0x20);
  pal_col(3,0x30);
  pal_col(5,0x14);
  pal_col(6,0x24);
  pal_col(7,0x34);

  // write text to name table
  put_str(NTADR_A(7,0), "Nametable A, Line 0");
  put_str(NTADR_A(7,1), "Nametable A, Line 1");
  put_str(NTADR_A(7,2), "Nametable A, Line 2");
  vram_adr(NTADR_A(0,3));
  vram_fill(5, 32);
  put_str(NTADR_A(2,4), "Nametable A, Line 4");
  put_str(NTADR_A(2,15),"Nametable A, Line 15");
  put_str(NTADR_A(2,27),"Nametable A, Line 27");
  put_str(NTADR_B(2,4), "Nametable B, Line 4");
  put_str(NTADR_B(2,15),"Nametable B, Line 15");
  put_str(NTADR_B(2,27),"Nametable B, Line 27");
  
  // set attributes
  vram_adr(0x23c0);
  vram_fill(0x55, 8);
  
  // set sprite 0
  oam_clear();
  oam_spr(1, 30, 0xa0, 0, 0);

  // enable PPU rendering (turn on screen)
  ppu_on_all();

  // scroll window back and forth
  scroll_demo();
}
