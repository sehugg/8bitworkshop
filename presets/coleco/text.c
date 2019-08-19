
#include <cv.h>
#include <cvu.h>

#include "common.h"
//#link "common.c"

void setup_text_mode() {
  cv_set_screen_mode(CV_SCREENMODE_TEXT);
  cv_set_image_table(IMAGE);
  cv_set_character_pattern_t(PATTERN);
  cvu_vmemset(0, 0, 0x4000);
  copy_default_character_set();
}

void show_text() {
  cv_set_colors(CV_COLOR_LIGHT_GREEN, CV_COLOR_BLACK);
  cvu_vmemset(IMAGE, '.', 40*24);
  cvu_memtovmemcpy(IMAGE + 1, "Hello Professor Falken", 22);
  cv_set_screen_active(true);
}

void main() {
  setup_text_mode();
  show_text();
  while (1);
}
