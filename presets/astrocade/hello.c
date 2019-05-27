
#include "aclib.h"
//#link "aclib.c"
//#link "acheader.s"

#include <stdlib.h>
#include <string.h>

/*{pal:"astrocade",layout:"astrocade"}*/
const byte palette[8] = {
  0x06, 0x62, 0xF1, 0x04,
  0x07, 0xD4, 0x35, 0x00,
};

void setup_registers() {
  // setup colors
  set_palette(palette);
  // horizontal palette split
  hw_horcb = 12;
  // height of screen
  hw_verbl = VHEIGHT*2;
}

void main() {
  setup_registers();
  clrscr();
  hw_xpand = XPAND_COLORS(0, 2);
  draw_string("Hello, World!", 2, 0);
  // infinite loop
  while (1) {
  }
}
