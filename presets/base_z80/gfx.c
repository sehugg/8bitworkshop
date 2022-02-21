#include <string.h>

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;

byte __at (0x2400) vidmem[224][32]; // 256x224x1 video memory

void clrscr() {
  memset(vidmem, 0, sizeof(vidmem));
}

void xor_pixel(byte x, byte y) {
  byte* dest = &vidmem[x][y>>3];
  *dest ^= 0x1 << (y&7);
}

byte xor_sprite(const byte* src, byte x, byte y) {
  byte i,j;
  byte result = 0;
  byte* dest = &vidmem[x][y];
  byte w = *src++;
  byte h = *src++;
  for (j=0; j<h; j++) {
    for (i=0; i<w; i++) {
      result |= (*dest++ ^= *src++);
    }
    dest += 32-w;
  }
  return result;
}
