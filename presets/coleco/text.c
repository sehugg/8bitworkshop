
/*
This is a demonstration of the TMS9928A's
40 x 24 monochrome text mode.
*/

#include <cv.h>
#include <cvu.h>

#include "common.h"
//#link "common.c"
//#link "fonts.s"

void setup_text_mode() {
  // set screen mode to text
  cv_set_screen_mode(CV_SCREENMODE_TEXT);
  // set image table address, which defines grid of characters
  cv_set_image_table(IMAGE);
  // set pattern table address, which defines character graphics
  cv_set_character_pattern_t(PATTERN);
  // clear VRAM to all zeroes
  cvu_vmemset(0, 0, 0x4000);
  // copy default character set from ROM to VRAM
  copy_default_character_set();
}

void show_text() {
  // set background and foreground colors
  cv_set_colors(CV_COLOR_LIGHT_GREEN, CV_COLOR_BLACK);
  // fill image table with '.' characters
  cvu_vmemset(IMAGE, '.', 40*24);
  // draw message at row 0, column 1
  cvu_memtovmemcpy(IMAGE + 1, "Greetings Professor Falken", 26);
  // turn on display
  cv_set_screen_active(true);
}

void main() {
  setup_text_mode();
  show_text();
  while (1); // infinite loop
}
