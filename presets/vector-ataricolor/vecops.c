
#include <string.h>
#include "vecops.h"

word dvgwrofs; // write offset for DVG buffer

#define dvgram ((word*)0x2000)

void dvgclear(void) {
  memset(dvgram, 0x20, 0x800); // HALTs
}

void dvgreset(void) {
  dvgwrofs = 0;
}

void dvgstart(void) {
  asm("sta $8840"); // strobe DVGSTART
}

void dvgwrite(word w) {
  dvgram[dvgwrofs] = w;
  ++dvgwrofs;
}

void VCTR(int dx, int dy, byte bright) {
  dvgwrite((dy & 0x1fff));
  dvgwrite(((bright & 7) << 13) | (dx & 0x1fff));
}

void SVEC(signed char dx, signed char dy, byte bright) {
  dvgwrite(0x4000 | (dx & 0x1f) | ((bright&7)<<5) | ((dy & 0x1f)<<8));
}

void JSRL(word offset) {
  dvgwrite(0xa000 | offset);
}

void JMPL(word offset) {
  dvgwrite(0xe000 | offset);
}

void RTSL(void) {
  dvgwrite(0xc000);
}

void CNTR(void) {
  dvgwrite(0x8000);
}

void HALT(void) {
  dvgwrite(0x2000);
}

void STAT(byte rgb, byte intens) {
  dvgwrite(0x6000 | ((intens & 0xf)<<4) | (rgb & 7));
}

void STAT_sparkle(byte intens) {
  dvgwrite(0x6800 | ((intens & 0xf)<<4));
}

void SCAL(word scale) {
  dvgwrite(0x7000 | scale);
}

void JSRPTR(const word* dvgrom) {
  JSRL(((word)dvgrom - 0x2000) >> 1);
}
