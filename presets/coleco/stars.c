
#include <cv.h>
#include <cvu.h>

#include "common.h"

char starfield_base_char = 240;

const char star_yoffsets[32] = {
  31, 11, 25, 10, 21, 1, 9, 6,
  22, 3, 7, 14, 15, 18, 0, 29,
  30, 5, 16, 28, 20, 12, 24, 17,
  13, 8, 26, 19, 23, 27, 2, 4
};

byte starfield_get_tile_xy(byte x, byte y) {
  return ((star_yoffsets[x] + y) & 15) + starfield_base_char;
}

void starfield_setup() {
  // clear star patterns
  cvu_vmemset(PATTERN+starfield_base_char*8, 0, 16*8);
  for (byte x=0; x<32; x++) {
    for (byte y=0; y<28; y++) {
      putcharxy(x, y, starfield_get_tile_xy(x, y));
    }
    cvu_voutb(COLOR_FG(CV_COLOR_WHITE),
              COLOR+((starfield_base_char+x)>>3));
  }
}

void starfield_update() {
  static byte oldcounter;
  const byte mask = 0x7f; // 128 star bytes
  byte counter = vint_counter;
  word base = PATTERN + starfield_base_char * 8;
  // erase old star, create new star in pattern table
  cvu_voutb(0, base + (oldcounter & mask));
  cvu_voutb(8, base + (counter & mask));
  oldcounter = counter;
}

#ifdef __MAIN__

//#link "common.c"

void main() {
  vdp_setup();
  cv_set_vint_handler(&vint_handler);
  starfield_setup();
  cv_set_screen_active(true);
  while(1) {
    wait_vsync();
    starfield_update();
  }
}

#endif
