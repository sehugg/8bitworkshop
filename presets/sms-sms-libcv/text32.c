/*
Demonstration of mode 4 text with per-character colors.

In mode 4 the name table stores a tile number and an
attribute byte for every cell. The low bit of the
attribute selects one of the two 16-color palettes.
*/

#include <cv.h>
#include <cvu.h>

#include "common.h"
//#link "common.c"
//#link "chr_generic.c"

extern const unsigned char CHR_GENERIC[8192];

void setup_graphics() {
  // copy the font/tileset into the character pattern table
  cvu_memtovmemcpy(PATTERN, CHR_GENERIC, sizeof(CHR_GENERIC));
  // load the default mode-4 palette
  set_default_palette();
  cv_set_colors(CV_COLOR_BLACK, CV_COLOR_BLACK);
}

void show_text() {
  byte x, y;
  // fill the name table with characters
  for (y=0; y<ROWS; y++) {
    // set a different text attribute per line
    text_attr = y+5;
    for (x=0; x<COLS; x++) {
      putcharxy(x, y, 'L');
    }
  }
  // draw the message at row 0, column 1
  putstringxy(1, 0, "Greetings Professor Falken");
  // turn on display
  cv_set_screen_active(true);
}

void main() {
  vdp_setup();
  setup_graphics();
  show_text();
  while (1);
}
