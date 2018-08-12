
#include <stdlib.h>
#include <string.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"

volatile bool vint;
volatile uint_fast8_t vint_counter;

void vint_handler(void)
{
  vint = true;
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

char cursor_x;
char cursor_y;

void clrscr() {
  cvu_vmemset(IMAGE, 0, COLS*ROWS);
}

byte getchar(byte x, byte y) {
  return cvu_vinb(IMAGE + y*COLS + x);
}

void putchar(byte x, byte y, byte attr) {
  cvu_voutb(attr, IMAGE + y*COLS + x);
}

void putstring(byte x, byte y, const char* string) {
  while (*string) {
    putchar(x++, y, CHAR(*string++));
  }
}

void wait_vsync() {
  vint = false;
  while (!vint) ;
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
    putchar(x, y, CHAR('0'+(bcd&0xf)));
    x--;
    bcd >>= 4;
  }
}

// add two 16-bit BCD values
word bcd_add(word a, word b) {
  a; b; // to avoid warning
__asm
        ld      hl,#4
        add     hl,sp
        ld      iy,#2
        add     iy,sp
        ld      a,0 (iy)
        add     a, (hl)
        daa
        ld      c,a
        ld      a,1 (iy)
        inc     hl
        adc     a, (hl)
        daa
        ld      b,a
        ld      l, c
        ld      h, b
__endasm;
}

