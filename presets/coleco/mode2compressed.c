

#include <stdlib.h>

#include <cv.h>
#include <cvu.h>

#define PATTERN	0x0000	// $0000 - $17ff
#define IMAGE	0x1800	// $1800 - $1aff
#define SPRITES	0x1b00	// not used
#define COLOR	0x2000	// $2000 - $37ff

/* link in MODE 2 bitmap data */

//#link "lzg.c"

//#link "sailboat-lzg.s"

extern const unsigned char msx_bitmap_lzg[];

void lzg_decode_vram(const char* src, unsigned int dest, unsigned int count);

void setup_mode2() {
  cvu_vmemset(0, 0, 0x4000);
  cv_set_screen_mode(CV_SCREENMODE_BITMAP); // mode 2
  cv_set_image_table(IMAGE);
  cv_set_character_pattern_t(PATTERN|0x1fff); // AND mask
  cv_set_color_table(COLOR|0x1fff); // AND mask
  cv_set_sprite_attribute_table(SPRITES);
}

void main() {
  cv_set_screen_active(false);
  setup_mode2();
  lzg_decode_vram(msx_bitmap_lzg, PATTERN, 0x3800);
  cv_set_screen_active(true);
  while (1) {
    //cv_set_character_pattern_t(PATTERN|rand()); // AND mask
    //cv_set_color_table(COLOR|rand()); // AND mask
  }
}
