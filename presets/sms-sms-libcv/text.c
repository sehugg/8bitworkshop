/*
This is a demonstration of the Sega VDP's mode 4
(tile-based) text mode. The name table stores two
bytes per cell: a tile number and an attribute byte
(palette, flip, priority).
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
  // black backdrop
  cv_set_colors(CV_COLOR_BLACK, CV_COLOR_BLACK);
}

void show_text() {
  // clear the name table (tile + attribute bytes)
  clrscr();
  // draw message at row 0, column 1
  putstringxy(1, 0, "Greetings Professor Falken");
  // turn on display
  cv_set_screen_active(true);
}

void main() {
  vdp_setup();
  setup_graphics();
  show_text();
  while (1); // infinite loop
}
