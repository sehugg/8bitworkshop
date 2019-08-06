
#include <cv.h>
#include <cvu.h>

#ifdef CV_SMS
//#link "fonts.s"
extern uintptr_t font_bitmap_a[];
extern uintptr_t font_bitmap_0[];
#endif

#define wait_vsync() __asm__("halt")

#define PATTERN		0x0000	// 256*8 = 2048 bytes
#define IMAGE		0x2000	// 32*24 = 768 bytes
#define COLOR		0x0b00	// 32 bytes
#define SPRITE_PATTERNS 0x3800	// 32*32 = 1024 bytes
#define SPRITES		0x3c00	// 4*32 = 128 bytes

/*{pal:222,n:16}*/
const char PALETTE0[16] = {
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x0D,
};

/*{pal:222,n:16}*/
const char PALETTE1[16] = {
  0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x3F,
};

/*{w:8,h:8,bpp:1,count:2,brev:1,np:4,pofs:1,sl:4}*/
const char PATTERNS[64] = {
  0x00, 0x00, 0x00, 0x00,
  0x3C, 0x3C, 0x3C, 0x3C,
  0x56, 0x7E, 0x56, 0x56,
  0x7E, 0x7E, 0x7E, 0x7E,
  0x62, 0x62, 0x62, 0x62,
  0x3C, 0x3C, 0x3C, 0x3C,
  0x18, 0x3E, 0x18, 0x3E,
  0x18, 0x7F, 0x00, 0x7F,

  0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF,
  0x55, 0x66, 0x77, 0xFF,
  0xC0, 0xC0, 0xC0, 0xC0,
  0x05, 0x06, 0x07, 0x08,
  0x00, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xFF,
};

void expand_monobitmap(const char* src, int count) {
  while (count--) {
    char b = *src++;
    cv_voutb(b);
    cv_voutb(b);
    cv_voutb(b);
    cv_voutb(b);
  }
}

void setup_graphics() {
  cv_set_screen_mode(CV_SCREENMODE_4);
  cv_set_character_pattern_t(PATTERN | 0x3000);
  cv_set_image_table(IMAGE | 0x400);
  cv_set_sprite_attribute_table(SPRITES);
  /*
  cvu_vmemset(0, 0, 0x4000);
  cv_set_colors(0x2, 0x5);
  cv_set_color_table(COLOR | 0xfff);
  cv_set_sprite_pattern_table(SPRITE_PATTERNS | 0x1800);
  */
  cv_set_write_vram_address(PATTERN + '0'*32);
  expand_monobitmap(font_bitmap_0, (128-48)*8);
  cvu_memtovmemcpy(PATTERN+32, PATTERNS, 32);
  cvu_memtocmemcpy(0xc000, PALETTE0, 16);
  cvu_memtocmemcpy(0xc010, PALETTE1, 16);
}

void show_text() {
  cvu_vmemset(IMAGE, 0, 32*28);
  cvu_memtovmemcpy(IMAGE, "H e l l o   P r o f e s s o r   F a l k e n ", 22*2);
  cv_voutb(0x01);
  cv_voutb(0x00);
}

void main() {
  char i=0;
  struct cvu_sprite4 sprite;
  setup_graphics();
  show_text();
  cv_set_screen_active(true);
  while (1) {
    wait_vsync();
    i++;
    cv_set_hscroll(i);
    cv_set_vscroll(i);
    sprite.y = i;
    sprite.x = i;
    sprite.name = 1;
    cvu_set_sprite4(SPRITES, 0, &sprite);
  }
}
