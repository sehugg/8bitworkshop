
#include "common.h"
//#link "common.c"
 
#include <cbm_screen_charmap.h>

void main(void) {
  unsigned int i;
  
  clrscr();          // clear the screen
  
  POKE(0x400, 'A');  // write to first byte of screen memory
  POKE(0x400, 65);   // character code for 'A'
  POKE(0x400 + 40*24 + 39, 'Z');   // row 24, column 39
  
  // fill with random characters
  for (i=0; i<40*25; i++)
    POKE(0x400 + i, 205 + (rand() & 1));

  // set character set to uppercase + graphics characters
  SET_VIC_BITMAP(0x1000);

  // set color map underlying characters
  for (i=0; i<40*25; i++)
    COLOR_RAM[i] = COLOR_GREEN;

  // infinite loop (avoid "ready" prompt)
  while (1);
}
