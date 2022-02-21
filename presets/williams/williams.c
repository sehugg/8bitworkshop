
#include "williams.h"

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
  blitter.flags = DSTSCREEN|FGONLY|SOLID;
}

void draw_sprite(const byte* data, byte x, byte y) {
  blitter.width = data[0]^4;
  blitter.height = data[1]^4;
  blitter.sstart = (word)(data+2);
  blitter.dstart = ((word)x<<8)+y; // swapped
  blitter.solid = 0;
  blitter.flags = DSTSCREEN|FGONLY;
}

void blit_pixel(word xx, byte y, byte color) {
  blitter.width = 1^4;
  blitter.height = 1^4;
  blitter.dstart = (((xx>>1)&0xff)<<8)+y; // swapped
  blitter.solid = color;
  blitter.flags = (xx&1) ? SOLID|ODDONLY : SOLID|EVENONLY;
}

void draw_sprite_solid(const byte* data, byte x, byte y, byte color) {
  blitter.width = data[0]^4;
  blitter.height = data[1]^4;
  blitter.sstart = (word)(data+2);
  blitter.dstart = ((word)x<<8)+y; // swapped
  blitter.solid = color;
  blitter.flags = DSTSCREEN|FGONLY|SOLID;
}

void erase_sprite_rect(const byte* data, byte x, byte y) {
  blitter.width = data[0]^4;
  blitter.height = data[1]^4;
  blitter.dstart = ((word)x<<8)+y; // swapped
  blitter.solid = 0;
  blitter.flags = DSTSCREEN|SOLID;
}

void draw_sprite_strided(const byte* data, byte x, byte y, byte stride) {
  const byte* src = data+2;
  byte height = data[1]^4;
  byte width = data[0]^4;
  while (height--) {
    blit_copy(x, y, width, 1, src);
    y += stride;
    src += width;
  }
}
