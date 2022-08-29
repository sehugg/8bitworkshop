
#include <cv.h>
#include <cvu.h>

// SMS doesn't have a BIOS
// so we have to link in a pattern table

#ifdef CV_SMS
//#link "fonts.s"
extern uintptr_t font_bitmap_a[];
extern uintptr_t font_bitmap_0[];
#endif

// HALT waits for a 60 Hz interrupt
#define wait_vsync() __asm__("halt")

// VRAM table addresses
#define PATTERN		0x0000	// 256*8 = 2048 bytes
#define IMAGE		0x2000	// 32*24 = 768 bytes
#define COLOR		0x0b00	// 32 bytes
#define SPRITE_PATTERNS 0x3800	// 32*32 = 1024 bytes
#define SPRITES		0x3c00	// 4*32 = 128 bytes

#ifdef __PLATFORM_SMS_GG_LIBCV__
/*{pal:444,n:32}*/
const short PALETTE[32] = {
  0x2221, 0x4441, 0x6661, 0x8888, 0xaaaa, 0xcccc, 0xeeee, 0xffff,
  0x2222, 0x4444, 0x6666, 0x8888, 0xaaaa, 0xcccc, 0xeeee, 0xffff,
  0x2222, 0x4444, 0x6666, 0x8888, 0xaaaa, 0xcccc, 0xeeee, 0xffff,
  0x2222, 0x4444, 0x6666, 0x8888, 0xaaaa, 0xcccc, 0xeeee, 0xffff,
};
#else
/*{pal:222,n:32}*/
const char PALETTE[32] = {
  0x10, 0x03, 0x0B, 0x0F, 0x13, 0x17, 0x1B, 0x1F,
  0x22, 0x28, 0x2A, 0x2E, 0x30, 0x37, 0x3B, 0x3F,
  0x10, 0x03, 0x0B, 0x0F, 0x13, 0x17, 0x1B, 0x1F,
  0x22, 0x28, 0x2A, 0x2E, 0x30, 0x37, 0x3B, 0x3F,
};
#endif

/*{w:8,h:8,bpp:1,count:2,brev:1,np:4,pofs:1,sl:4}*/
const char PATTERNS[64] = {
  0x7C, 0x1C, 0x64, 0x64,
  0xFE, 0x7E, 0xFE, 0xFE,
  0xD6, 0x7E, 0xD6, 0xD6,
  0xFE, 0x7E, 0xFE, 0xFE,
  0x66, 0xE6, 0xE6, 0xE6,
  0xBC, 0xBC, 0xBC, 0x3C,
  0x18, 0x18, 0x3E, 0x18,
  0x7F, 0x18, 0x67, 0x18,

  0x7D, 0x3C, 0x02, 0x3C,
  0x7D, 0x3C, 0x9A, 0x3C,
  0x7C, 0x3C, 0x83, 0x3C,
  0x7E, 0x3C, 0x81, 0x3C,
  0x3E, 0x3E, 0x00, 0x00,
  0x36, 0x36, 0x00, 0x00,
  0x36, 0x36, 0x00, 0x00,
  0x00, 0x77, 0x77, 0x77,
};

// convert a mono bitmap to 4-plane
// just copy each byte 4 times
void expand_monobitmap(const char* src, int count) {
  while (count--) {
    char b = *src++;
    cv_voutb(b);
    cv_voutb(b);
    cv_voutb(b);
    cv_voutb(b);
  }
}

// set up mode 4 graphics
void setup_graphics() {
  cv_set_screen_mode(CV_SCREENMODE_4);
  // set up tables
  cv_set_character_pattern_t(PATTERN | 0x3000); // mask for mode 4
  cv_set_image_table(IMAGE | 0x400); // mask for mode 4
  cv_set_sprite_attribute_table(SPRITES);
  cv_set_write_vram_address(PATTERN + '0'*32);
  // convert mono bitmap font to 4-plane in VRAM
  expand_monobitmap(font_bitmap_0, (128-48)*8);
  // copy sprites to pattern table VRAM
  cvu_memtovmemcpy(PATTERN+32, PATTERNS, sizeof(PATTERNS));
  // copy palettes to VRAM
  cvu_memtocmemcpy(0xc000, PALETTE, sizeof(PALETTE));
}

// image table has two bytes per cell (name + attribute)
void show_text() {
  cvu_vmemset(IMAGE, 0, 32*28);
  cvu_memtovmemcpy(IMAGE, "H e l l o   W o r l d \1 ", 12*2);
}

void main() {
  char i=0;
  struct cvu_sprite4 sprite;
  // set up mode 4 and draw initial text
  setup_graphics();
  show_text();
  // turn on screen
  cv_set_screen_active(true);
  // loop (once per frame)
  while (1) {
    wait_vsync();
    i++;
    // scroll background in two directions
    cv_set_hscroll(i);
    cv_set_vscroll(i);
    // move sprite across screen
    sprite.y = i;
    sprite.x = i;
    sprite.name = 1;
    cvu_set_sprite4(SPRITES, 0, &sprite);
    sprite.y += 8;
    sprite.name++;
    cvu_set_sprite4(SPRITES, 1, &sprite);
  }
}
