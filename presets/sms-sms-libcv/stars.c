/*
This is a demo of an animated starfield, ported to
the Sega VDP's mode 4.

Mode 4 has no hardware scrolling registers, so
scrolling requires rewriting the name/pattern tables.

There is actually only one star in the pattern table,
just a single pixel. We move it vertically between 16
different character tiles (8 * 16 = 128 pixels high).
We then draw vertical stripes of 8 repeating consecutive
characters into the image table.

By randomly offsetting where we begin each stripe, we
create what appears to be a random starfield.

This demo uses an interrupt handler to increment a
counter 60 times per second. We use this counter to
determine the new position of the star pixel when we animate.
*/

#include <cv.h>
#include <cvu.h>

//#link "common.c"
//#link "chr_generic.c"
#include "common.h"

extern const unsigned char CHR_GENERIC[8192];

// the starting character index in the pattern table
#define STAR_BASE_CHAR 0xf0
// 16 tiles * 8 rows = 128 star positions
#define STAR_COUNT (16*8)

// a random offset for every vertical column
const char star_yoffsets[32] = {
  31, 11, 25, 10, 21, 1, 9, 6,
  22, 3, 7, 14, 15, 18, 0, 29,
  30, 5, 16, 28, 20, 12, 24, 17,
  13, 8, 26, 19, 23, 27, 2, 4
};

// returns the tile index for every (x,y) position
byte starfield_get_tile_xy(byte x, byte y) {
  return ((star_yoffsets[x] + y) & 15) + STAR_BASE_CHAR;
}

// each mode-4 tile is 32 bytes: 8 rows of 4 plane bytes.
// the star pixel lives in plane 0 of a given row.
word starfield_addr(byte index) {
  return PATTERN + STAR_BASE_CHAR*32 + index*4;
}

// set up starfield image and pattern table
void starfield_setup() {
  byte x, y;
  // clear star patterns
  cvu_vmemset(PATTERN + STAR_BASE_CHAR*32, 0, 16*32);
  // write starfield image table
  for (x=0; x<32; x++) {
    for (y=0; y<ROWS; y++) {
      putcharxy(x, y, starfield_get_tile_xy(x, y));
    }
  }
}

// call each frame to animate starfield
void starfield_update() {
  static byte oldcounter;
  byte counter = vint_counter;
  byte mask = STAR_COUNT-1; // 128 star positions
  // erase old star, create new star in pattern table
  cvu_voutb(0, starfield_addr(oldcounter & mask));
  cvu_voutb(8, starfield_addr(counter & mask));
  // remember counter value in case we skip a frame
  oldcounter = counter;
}

void setup_graphics() {
  cvu_memtovmemcpy(PATTERN, CHR_GENERIC, sizeof(CHR_GENERIC));
  set_default_palette();
  cv_set_colors(CV_COLOR_BLACK, CV_COLOR_BLACK);
}

void main() {
  vdp_setup();
  setup_graphics();
  // set up default interrupt handler
  cv_set_vint_handler(&vint_handler);
  starfield_setup();
  cv_set_screen_active(true);
  while(1) {
    wait_vsync();
    starfield_update();
  }
}
