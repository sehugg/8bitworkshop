
//#resource "astrocade.inc"
#include "aclib.h"
//#link "aclib.s"
#include "acbios.h"
#include "acextra.h"
//#link "acextra.c"
//#link "hdr_autostart.s"

#include <stdlib.h>
#include <string.h>

#pragma opt_code_speed

void draw_line(int x0, int y0, int x1, int y1, byte color) {
  int dx = abs(x1-x0);
  int sx = x0<x1 ? 1 : -1;
  int dy = abs(y1-y0);
  int sy = y0<y1 ? 1 : -1;
  int err = (dx>dy ? dx : -dy)>>1;
  int e2;
  for(;;) {
    pixel(x0, y0, color, M_XOR);
    if (x0==x1 && y0==y1) break;
    e2 = err;
    if (e2 > -dx) { err -= dy; x0 += sx; }
    if (e2 < dy) { err += dx; y0 += sy; }
  }
}

/*{pal:"astrocade",layout:"astrocade"}*/
const byte palette[8] = {
  0x06, 0x62, 0xF1, 0x04,
  0x07, 0xD4, 0x35, 0x00,
};

void main() {
  set_palette(palette);
  SYS_SETOUT(89*2, 20, 0);
  SYS_FILL(0x4000, 89*40, 0);
  hw_xpand = XPAND_COLORS(0, 2);
  draw_string(2, 80, 0, "Hello, Lines!");
  draw_line(0, 0, 159, 95, 1);
  // infinite loop
  srand(1);
  while(1) {
    draw_line(rand()%159, rand()%79, rand()%159, rand()%79, rand()&3);
  }
}
