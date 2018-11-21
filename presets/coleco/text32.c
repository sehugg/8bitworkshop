
#include <cv.h>
#include <cvu.h>

#define PATTERN		0x0000
#define IMAGE		0x0800
#define COLOR		0x2000
#define SPRITE_PATTERNS 0x3800
#define SPRITES		0x3c00

uintptr_t __at(0x6a) font_bitmap_a;
uintptr_t __at(0x6c) font_bitmap_0;

void setup_32_column_font() {
  cv_set_character_pattern_t(PATTERN);
  cv_set_image_table(IMAGE);
  cv_set_color_table(COLOR);
  cv_set_screen_mode(CV_SCREENMODE_STANDARD);
  cv_set_sprite_pattern_table(SPRITE_PATTERNS);
  cv_set_sprite_attribute_table(SPRITES);
  cvu_vmemset(0, 0, 0x4000);
  cvu_memtovmemcpy(PATTERN, (void *)(font_bitmap_0 - '0'*8), 2048);
  cvu_vmemset(COLOR, 0x36, 8); // set color for chars 0-63
  cvu_vmemset(COLOR+8, 0x06, 32-8); // set chars 63-255
}

void show_text() {
  cvu_vmemset(IMAGE, '.', 40*24);
  cvu_memtovmemcpy(IMAGE + 1, "Hello Professor Falken", 22);
  cv_set_screen_active(true);
}

void main() {
  setup_32_column_font();
  show_text();
  while (1);
}
