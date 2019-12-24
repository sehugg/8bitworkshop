/*
Demonstrates the 64x48 multicolor mode.
This mode is a little tricky to implement,
but each pixel can have its own color with no
clashing effects.
*/

#include <stdlib.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"

void multicolor_fullscreen_image_table(word ofs) {
  byte x,y;
  for (y=0; y<48; y++) {
    for (x=0; x<32; x++) {
      cvu_voutb(x + (y>>2)*32, ofs++);
    }
  }
}

void setup_multicolor() {
  cvu_vmemset(0, 0, 0x4000);
  cv_set_image_table(IMAGE);
  cv_set_character_pattern_t(PATTERN);
  cv_set_screen_mode(CV_SCREENMODE_MULTICOLOR); // mode 3
  multicolor_fullscreen_image_table(IMAGE);
}

typedef void SetPixelFunc(byte x, byte y, byte color);

void set_pixel(byte x, byte y, byte color) {
  word pg = (x>>1)*8 + (y & 7) + (y & ~7)*32 + PATTERN;
  byte b = cvu_vinb(pg);
  if (x&1)
    b = color | (b & 0xf0);
  else
    b = (color<<4) | (b & 0xf);
  cvu_voutb(b, pg);
}

void set_two_pixels(byte x, byte y, byte leftcolor, byte rightcolor) {
  word pg = (x>>1)*8 + (y & 7) + (y & ~7)*32 + PATTERN;
  byte b = rightcolor | (leftcolor << 4);
  cvu_voutb(b, pg);
}

void draw_line(int x0, int y0, int x1, int y1, byte color) {
  int dx = abs(x1-x0);
  int sx = x0<x1 ? 1 : -1;
  int dy = abs(y1-y0);
  int sy = y0<y1 ? 1 : -1;
  int err = (dx>dy ? dx : -dy)>>1;
  int e2;
  for(;;) {
    set_pixel(x0, y0, color);
    if (x0==x1 && y0==y1) break;
    e2 = err;
    if (e2 > -dx) { err -= dy; x0 += sx; }
    if (e2 < dy) { err += dx; y0 += sy; }
  }
}

#ifdef __MAIN__

void main() {
  setup_multicolor();
  cv_set_screen_active(true);
  while(1) {
    draw_line(rand()%64, rand()%48, rand()%64, rand()%48, rand()&15);
  }
  while (1);
}

#endif
