
/*
This demo draws pixels and lines in Mode 2.
Note that when lines of two different colors overlap,
they create "clashing" effects.
*/

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"

void setup_mode2() {
  cvu_vmemset(0, 0, 0x4000);
  cv_set_screen_mode(CV_SCREENMODE_BITMAP); // mode 2
  cv_set_image_table(IMAGE);
  cv_set_character_pattern_t(PATTERN|0x1fff); // AND mask
  cv_set_color_table(COLOR|0x1fff); // AND mask
  cv_set_sprite_attribute_table(0x2800);
  {
    byte i=0;
    do {
      cvu_voutb(i, IMAGE+i);
      cvu_voutb(i, IMAGE+0x100+i);
      cvu_voutb(i, IMAGE+0x200+i);
    } while (++i);
  }
}

void set_pixel(byte x, byte y, byte color) {
  word ofs = (x/8)*8 + (y/8)*256 + (y&7);
  byte b = cvu_vinb(PATTERN + ofs);
  if (y >= 192) return;
  if (color>1) {
    b |= 128 >> (x&7);
    cvu_voutb(b, PATTERN + ofs);
    cvu_voutb(color<<4, COLOR + ofs);
  } else {
    b &= ~(128 >> (x&7));
    cvu_voutb(b, PATTERN + ofs);
  }
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
  setup_mode2();
  cv_set_screen_active(true);
  while(1) {
    draw_line(rand()&0xff, rand()&0xbf, rand()&0xff, rand()&0xbf, rand()&15);
  }
}

#endif
