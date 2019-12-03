
/*
This is a demo of an animated starfield.
The TMS9918 has no scrolling registers, so scrolling
requires rewriting the pattern table on each frame.

There is actually only one star in the pattern table,
just a single pixel. We move it vertically between 16
different character tiles (8 * 16 = 128 pixels high).
We then draw vertical stripes of 8 repeating consecutive
characters into the image table.

By randomly offsetting where we begin each stripe, we
create what appears to be a random starfield.
(If you look closely, you'll see there's exactly two
stars for every 8-pixel-wide vertical column.)

This demo uses an interrupt handler to increment a
counter 60 times per second. We use this counter to
determine the new position of the star pixel when we animate.
*/

#include <cv.h>
#include <cvu.h>

//#link "common.c"
#include "common.h"

// the starting character index in the pattern table
char starfield_base_char = 240;

// a random offset for every vertical column
const char star_yoffsets[32] = {
  31, 11, 25, 10, 21, 1, 9, 6,
  22, 3, 7, 14, 15, 18, 0, 29,
  30, 5, 16, 28, 20, 12, 24, 17,
  13, 8, 26, 19, 23, 27, 2, 4
};

// returns the tile index for every (x,y) position
byte starfield_get_tile_xy(byte x, byte y) {
  return ((star_yoffsets[x] + y) & 15) + starfield_base_char;
}

// set up starfield image and pattern table
void starfield_setup() {
  // clear star patterns
  cvu_vmemset(PATTERN+starfield_base_char*8, 0, 16*8);
  // write starfield image table
  for (byte x=0; x<32; x++) {
    for (byte y=0; y<28; y++) {
      putcharxy(x, y, starfield_get_tile_xy(x, y));
    }
    // set value in color table for each character
    cvu_voutb(COLOR_FG(CV_COLOR_WHITE),
              COLOR+((starfield_base_char+x)>>3));
  }
}

// call each frame to animate starfield
void starfield_update() {
  static byte oldcounter;
  const byte mask = 0x7f; // 128 star bytes
  // interrupt counter increments every frame
  // use this value to determine new star position
  byte counter = vint_counter;
  // base address in pattern table
  word base = PATTERN + starfield_base_char * 8;
  // erase old star, create new star in pattern table
  cvu_voutb(0, base + (oldcounter & mask));
  cvu_voutb(8, base + (counter & mask));
  // make sure we remember counter value to erase
  // in case we skip a frame
  oldcounter = counter;
}

#ifdef __MAIN__

void main() {
  vdp_setup();
  // set up default interrupt handler
  cv_set_vint_handler(&vint_handler);
  starfield_setup();
  cv_set_screen_active(true);
  while(1) {
    wait_vsync();
    starfield_update();
  }
}

#endif
