
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

// main function, run after console reset
void main(void) {
  // set palette colors
  pal_col(1,0x04);
  pal_col(2,0x20);
  pal_col(3,0x30);

  // write text to name table
  put_str(NTADR_A(2,2),"HELLO, WORLD!");
  put_str(NTADR_A(2,4),"THIS CODE PRINTS SOME TEXT");
  put_str(NTADR_A(2,5),"USING ASCII-ENCODED CHARACTER");
  put_str(NTADR_A(2,6),"SET WITH CAPITAL LETTERS ONLY");

  // enable PPU rendering (turn on screen)
  ppu_on_all();

  // infinite loop
  while (1) ;
}
