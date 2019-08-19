
#include <stdlib.h>
#include <string.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"

volatile uint_fast8_t vint_counter;

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
    cvu_voutb(reverse_bits(*patterns++), dest++ ^ 16); // swap left/right chars
  }
}

void clrscr() {
  cvu_vmemset(IMAGE, 0, COLS*ROWS);
}

word getimageaddr(byte x, byte y) {
  return IMAGE + y*COLS + x;
}

byte getcharxy(byte x, byte y) {
  return cvu_vinb(getimageaddr(x,y));
}

void putcharxy(byte x, byte y, byte attr) {
  cvu_voutb(attr, getimageaddr(x,y));
}

void putstringxy(byte x, byte y, const char* string) {
  while (*string) {
    putcharxy(x++, y, CHAR(*string++));
  }
}

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
  cv_set_screen_mode(CV_SCREENMODE_STANDARD);
  cv_set_image_table(IMAGE);
  cv_set_character_pattern_t(PATTERN);
  cv_set_color_table(COLOR);
  cv_set_sprite_pattern_table(SPRITE_PATTERNS);
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

void copy_default_character_set() {
#ifdef CV_MSX
  static byte __at(0xf91f) CGPNT;
  static byte* __at(0xf920) CGADDR;
  cvu_memtovmemcpy(PATTERN, CGADDR, 256*8);
#else
  cvu_memtovmemcpy(PATTERN, (void *)(font_bitmap_0 - '0'*8), 256*8);
#endif
}
