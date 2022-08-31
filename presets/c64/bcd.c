
#include "common.h"

word bcd_add(word a, word b) {
  asm("sed");
  a += b;
  asm("cld");
  return a;
}

void draw_bcd_word(word address, word bcd) {
  byte i;
  address += 4;
  for (i=0; i<4; i++) {
    POKE(address, (bcd & 0b1111) + '0');
    address--;
    bcd >>= 4;
  }
}

