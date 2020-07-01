
/*
Demonstration of "standard" mode, which is 32 x 24
characters. Each cell can have its own background and
foreground color, determined by the character in its
place. The color table contains 32 bytes, each byte
controlling the colors of a range of 8 characters.
For example, the first byte determines colors for
characters 0-7, the second byte for 8-15, etc.
*/

#include <cv.h>
#include <cvu.h>

#include "common.h"
//#link "common.c"
//#link "fonts.s"

void setup_32_column_font() {
  cv_set_screen_mode(CV_SCREENMODE_STANDARD);
  cv_set_character_pattern_t(PATTERN);
  cv_set_image_table(IMAGE);
  cv_set_color_table(COLOR);
  cv_set_sprite_pattern_table(SPRITE_PATTERNS);
  cv_set_sprite_attribute_table(SPRITES);
  cvu_vmemset(0, 0, 0x4000);
  copy_default_character_set();
  cvu_vmemset(COLOR, 0x36, 8); // set color for chars 0-63
  cvu_vmemset(COLOR+8, 0x06, 32-8); // set chars 63-255
}

void show_text() {
  cvu_vmemset(IMAGE, '.', 32*24);
  cvu_memtovmemcpy(IMAGE + 1, "Greetings Professor Falken", 26);
  cv_set_screen_active(true);
}

void main() {
  char i=0;
  setup_32_column_font();
  show_text();
  while (1) {
    /*
    cvu_vmemset(COLOR+8, i++, 4); // animate color for chars 64-95
    */
  }
}
