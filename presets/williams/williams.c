
#include "williams.h"

// bias sprites by +4 pixels
#define XBIAS 2

// x1: 0-151
// y1: 0-255

void blit_solid(byte x1, byte y1, byte w, byte h, byte color) {
  blitter.width = w^4;
  blitter.height = h^4;
  blitter.dstart = ((word)x1<<8)+y1; // swapped
  blitter.solid = color;
  blitter.flags = DSTSCREEN|SOLID;
}

void blit_copy(byte x1, byte y1, byte w, byte h, const byte* data) {
  blitter.width = w^4;
  blitter.height = h^4;
  blitter.sstart = (word)data;
  blitter.dstart = ((word)x1<<8)+y1; // swapped
  blitter.solid = 0;
  blitter.flags = DSTSCREEN|FGONLY;
}

void blit_copy_solid(byte x1, byte y1, byte w, byte h, const byte* data, byte solid) {
  blitter.width = w^4;
  blitter.height = h^4;
  blitter.sstart = (word)data;
  blitter.dstart = ((word)x1<<8)+y1; // swapped
  blitter.solid = solid;
  if (solid)
    blitter.flags = DSTSCREEN|FGONLY|SOLID;
  else
    blitter.flags = DSTSCREEN;
}

void blit_sprite(const byte* data, byte x, byte y) {
  blitter.width = data[0]^4;
  blitter.height = data[1]^4;
  blitter.sstart = (word)(data+2);
  blitter.dstart = ((word)(x+XBIAS)<<8)+y; // swapped
  blitter.solid = 0;
  blitter.flags = DSTSCREEN|FGONLY;
}

void blit_sprite_solid(const byte* data, byte x, byte y, byte color) {
  blitter.width = data[0]^4;
  blitter.height = data[1]^4;
  blitter.sstart = (word)(data+2);
  blitter.dstart = ((word)(x+XBIAS)<<8)+y; // swapped
  blitter.solid = color;
  blitter.flags = DSTSCREEN|FGONLY|SOLID;
}

void unblit_sprite_rect(const byte* data, byte x, byte y) {
  blitter.width = data[0]^4;
  blitter.height = data[1]^4;
  blitter.dstart = ((word)(x+XBIAS)<<8)+y; // swapped
  blitter.solid = 0;
  blitter.flags = DSTSCREEN|SOLID;
}

void blit_sprite_strided(const byte* data, byte x, byte y, byte stride) {
  const byte* src = data+2;
  byte height = data[1]^4;
  byte width = data[0]^4;
  while (height--) {
    blit_copy(x, y, width, 1, src);
    y += stride;
    src += width;
  }
}

void unblit_sprite_strided(const byte* data, byte x, byte y, byte stride) {
  byte height = data[1]^4;
  byte width = data[0]^4;
  while (height--) {
    blit_solid(x, y, width, 1, 0);
    y += stride;
  }
}

void blit_vline(word x1, byte y1, byte h, byte color) {
  blitter.width = 1^4;
  blitter.height = h^4;
  blitter.dstart = ((word)x1<<8)+y1; // swapped
  blitter.solid = color;
  blitter.flags = (x1&1) ? DSTSCREEN|SOLID|ODDONLY : DSTSCREEN|SOLID|EVENONLY;
}

// x: 0-303

void draw_solid(word xx, byte y, byte w, byte h, byte color) {
  blitter.width = w^4;
  blitter.height = h^4;
  blitter.dstart = ((xx<<7)&0xff00)+y; // swapped
  blitter.solid = color;
  blitter.flags = (xx&1) ? DSTSCREEN|SOLID|RSHIFT : DSTSCREEN|SOLID;
}

void draw_vline(word xx, byte y, byte h, byte color) {
  blitter.width = 1^4;
  blitter.height = h^4;
  blitter.dstart = ((xx<<7)&0xff00)+y; // swapped
  blitter.solid = color;
  blitter.flags = (xx&1) ? DSTSCREEN|SOLID|ODDONLY : DSTSCREEN|SOLID|EVENONLY;
}

void draw_copy_solid(word xx, byte y, byte w, byte h, const byte* data, byte solid) {
  blitter.width = w^4;
  blitter.height = h^4;
  blitter.solid = solid;
  blitter.sstart = data;
  blitter.dstart = ((xx<<7)&0xff00)+y; // swapped
  if (solid)
    blitter.flags = (xx&1) ? DSTSCREEN|FGONLY|SOLID|RSHIFT : DSTSCREEN|FGONLY|SOLID;
  else
    blitter.flags = (xx&1) ? DSTSCREEN|RSHIFT : DSTSCREEN;
}

void draw_pixel(word xx, byte y, byte color) {
  blitter.width = 1^4;
  blitter.height = 1^4;
  blitter.dstart = (((xx>>1)&0xff)<<8)+y; // swapped
  blitter.solid = color;
  blitter.flags = (xx&1) ? SOLID|ODDONLY : SOLID|EVENONLY;
}


// BCD

asm word bcd_add(word a, word b) {
  asm {
    lda 3,s
    adda 5,s
    daa
    exg b,a
    lda 2,s
    adca 4,s
    daa
  }
}

