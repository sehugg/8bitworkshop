#include <stdlib.h>
#include <string.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"

/* Unified common code for libcv platforms.
   Differences are selected by the CV_CV / CV_MSX / CV_SMS defines
   (set by the platform) plus CV_MODE4 for SMS/GG mode-4 builds.
   Keep this file identical across those preset directories. */

volatile uint_fast8_t vint_counter;

#if defined(CV_MODE4)
// current name-table attribute (palette/flip/priority) used for text output
byte text_attr = 0;

// default mode-4 palette: entries 0-15 are the background (tile) palette,
// entries 16-31 are the sprite palette. CHR_GENERIC glyphs use colors 0-3.
#if defined(__PLATFORM_SMS_GG_LIBCV__)
/*{pal:444,n:32}*/
const unsigned short DEFAULT_PALETTE[32] = {
  0x000, 0x00F, 0x0F0, 0x0FF, 0xF00, 0xF0F, 0xFF0, 0xFFF,
  0x555, 0x55F, 0xFA5, 0x5AF, 0xAA0, 0xAFA, 0xFAF, 0xAFF,
  0x000, 0x00F, 0x0F0, 0x0FF, 0xF00, 0xF0F, 0xFF0, 0xFFF,
  0x555, 0x55F, 0xFA5, 0x5AF, 0xAA0, 0xAFA, 0xFAF, 0xAFF
};
#else
/*{pal:222,n:32}*/
const unsigned char DEFAULT_PALETTE[32] = {
  0x00, 0x03, 0x0C, 0x0F, 0x30, 0x33, 0x3C, 0x3F,
  0x15, 0x17, 0x39, 0x1B, 0x28, 0x2E, 0x3B, 0x2F,
  0x00, 0x03, 0x0C, 0x0F, 0x30, 0x33, 0x3C, 0x3F,
  0x15, 0x17, 0x39, 0x1B, 0x28, 0x2E, 0x3B, 0x2F,
};
#endif

void set_default_palette() {
  cvu_memtocmemcpy(0xc000, DEFAULT_PALETTE, sizeof(DEFAULT_PALETTE));
}
#endif

void vint_handler(void) {
  vint_counter++;
}

const unsigned char reverse_lookup[16] = {
0x0, 0x8, 0x4, 0xc, 0x2, 0xa, 0x6, 0xe, 0x1, 0x9, 0x5, 0xd, 0x3, 0xb, 0x7, 0xf, };

byte reverse_bits(byte n) {
  return (reverse_lookup[n&0b1111] << 4) | reverse_lookup[n>>4];
}

void flip_sprite_patterns(word dest, const byte* patterns, word len) {
  word i;
  for (i=0; i<len; i++) {
#if defined(CV_MODE4)
    cvu_voutb(reverse_bits(*patterns++), dest++);
#else
    cvu_voutb(reverse_bits(*patterns++), dest++ ^ 16); // swap left/right chars
#endif
  }
}

void clrscr() {
  cvu_vmemset(IMAGE, 0, ROWSTRIDE*ROWS);
}

word getimageaddr(byte x, byte y) {
#if defined(CV_MODE4)
  // mode 4: two bytes per cell (tile + attribute)
  return IMAGE + y*ROWSTRIDE + x*2;
#else
  return IMAGE + y*ROWSTRIDE + x;
#endif
}

byte getcharxy(byte x, byte y) {
  return cvu_vinb(getimageaddr(x,y));
}

void putcharxy(byte x, byte y, byte attr) {
#if defined(CV_MODE4)
  cv_vmemp addr = getimageaddr(x,y);
  cvu_voutb(attr, addr);
  cvu_voutb(text_attr, addr+1);
#else
  cvu_voutb(attr, getimageaddr(x,y));
#endif
}

void putstringxy(byte x, byte y, const char* string) {
  while (*string) {
    putcharxy(x++, y, CHAR(*string++));
  }
}

#if defined(CV_MODE4)
// mode 4 uses the same putcharxy()/putstringxy()/getcharxy() API as other modes.
#endif

void delay(byte i) {
  while (i--) {
    wait_vsync();
  }
}

byte rndint(byte a, byte b) {
  return ((byte)rand() % (b-a+1)) + a;
}

void memset_safe(void* _dest, char ch, word size) {
  byte* dest = _dest;
  while (size--) {
    *dest++ = ch;
  }
}

char in_rect(byte x, byte y, byte x0, byte y0, byte w, byte h) {
  return ((byte)(x-x0) < w && (byte)(y-y0) < h); // unsigned
}

void draw_bcd_word(byte x, byte y, word bcd) {
  byte j;
  x += 3;
  for (j=0; j<4; j++) {
    putcharxy(x, y, CHAR('0'+(bcd&0xf)));
    x--;
    bcd >>= 4;
  }
}

// add two 16-bit BCD values
word bcd_add(word a, word b) __naked {
  a; b; // to avoid warning
__asm
 	push	ix
 	ld	ix,#0
	add	ix,sp
 	ld	a,4 (ix)
 	add	a, 6 (ix)
	daa
	ld	c,a
 	ld	a,5 (ix)
 	adc	a, 7 (ix)
	daa
 	ld	b,a
 	ld	l, c
 	ld	h, b
	pop	ix
 	ret
__endasm;
}

void vdp_setup() {
  cv_set_screen_active(false);
#if defined(CV_MODE4)
  cv_set_screen_mode(CV_SCREENMODE_4_224);
  cv_set_character_pattern_t(PATTERN | 0x3000);
  cv_set_image_table(IMAGE | 0x400);
#else
  cv_set_screen_mode(CV_SCREENMODE_STANDARD);
  cv_set_image_table(IMAGE);
  cv_set_character_pattern_t(PATTERN);
  cv_set_color_table(COLOR);
  cv_set_sprite_pattern_table(SPRITE_PATTERNS);
  // load the default font and set a visible default color (white on black).
  // the MSX startup code does this for us, but the ColecoVision and
  // SG-1000 leave VRAM zeroed -- without this, putstringxy() output is
  // invisible (blank pattern table) and the color table is transparent.
  copy_default_character_set();
  cvu_vmemset(COLOR, 0xf1, 32);
#endif
  cvu_vmemset(SPRITES, 0xff, 0x400);
  cv_set_sprite_attribute_table(SPRITES);
  cv_set_sprite_big(true);
}

void set_shifted_pattern(const byte* src, word dest, byte shift) {
  byte y;
  for (y=0; y<8; y++) {
    byte a = src[y+8];
    byte b = src[y];
    cvu_voutb(a>>shift, dest);
    cvu_voutb(b>>shift | a<<(8-shift), dest+8);
    cvu_voutb(b<<(8-shift), dest+16);
    dest++;
  }
}

#if !defined(CV_MODE4)
void copy_default_character_set() {
#ifdef CV_MSX
  static byte __at(0xf91f) CGPNT;
  static byte* __at(0xf920) CGADDR;
  cvu_memtovmemcpy(PATTERN, CGADDR, 256*8);
#else
  cvu_memtovmemcpy(PATTERN, (void *)(font_bitmap_0 - '0'*8), 256*8);
#endif
}
#endif
