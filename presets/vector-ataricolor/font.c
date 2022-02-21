
#include <string.h>

#include "vecops.h"
//#link "vecops.c"

#include "vecfont.h"
//#link "vecfont.c"

////

static int frame = 0;

void main(void) {
  int r = 512;
  dvgclear();
  dvgwrofs = 0x200;
  draw_string("HELLO, WORLD!", 0);
  RTSL();
  while (1) {
    dvgreset();
    CNTR();
    SCAL(0x7f);
    STAT(RED, 0);
    VCTR(r, r, 1);
    VCTR(-r*2, 0, 3);
    VCTR(0, -r*2, 5);
    VCTR(r*2, 0, 7);
    VCTR(0, r*2, 7);
    CNTR();
    STAT(GREEN, 0);
    VCTR(100, -100, 0);
    JSRL(0x200);
    HALT();
    dvgstart();
    frame++;
  }
}
