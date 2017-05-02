
#include <stdlib.h>
#include <string.h>

#include "cv.h"
#include "cvu.h"

#define PATTERN ((const cv_vmemp)0x0000)
#define COLOR ((const cv_vmemp)0x2000)
#define IMAGE ((const cv_vmemp)0x1c00)

uintptr_t __at(0x6a) font_bitmap_a;
uintptr_t __at(0x6c) font_bitmap_0;

void setup_40_column_font() {
  cv_set_image_table(IMAGE);
  cvu_memtovmemcpy(0x1800, (void *)(font_bitmap_0 - 0x30*8), 2048);
  cv_set_character_pattern_t(0x1800);
  cv_set_screen_mode(CV_SCREENMODE_TEXT);
}

void main(void) {
  setup_40_column_font();
  cv_set_colors(CV_COLOR_LIGHT_GREEN, CV_COLOR_BLACK);
  cvu_vmemset(IMAGE, '.', 960);
  cvu_memtovmemcpy(IMAGE + 1, "Hello Professor Falken", 22);
  cv_set_screen_active(true);
  while (1);
}
