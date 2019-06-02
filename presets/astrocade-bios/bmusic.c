
#pragma opt_code_speed

#include "bios.h"

extern byte* MUZPC;   // music PC
extern byte* MUZSP;   // music SP
extern byte PVOLAB;  // channels A and B volume
extern byte PVOLMC;  // channel C volume and noise mask
extern byte VOICES;  // voices mmask
extern byte DURAT;   // note duration

__sfr __at(0x10) hw_tonmo;
__sfr __at(0x11) hw_tonea;
__sfr __at(0x12) hw_toneb;
__sfr __at(0x13) hw_tonec;
__sfr __at(0x14) hw_vibra;
__sfr __at(0x15) hw_volc;
__sfr __at(0x16) hw_volab;
__sfr __at(0x17) hw_voln;
__sfr __at(0x18) hw_sndbx;

extern void portOut(word portVal) __z88dk_fastcall;

static byte NEXT(void) {
  return *MUZPC++;
}

static void PUSH(byte b) {
  *++MUZSP = b;
}

static byte POP() {
  return *MUZSP--;
}

static byte DECTOP() {
  return --(*MUZSP);
}

void music_update(void) {
  byte op = NEXT();
  if (op < 0x80) {
    DURAT = op;
    op = VOICES;
    if (op & 0x01) hw_voln = NEXT();
    if (op & 0x02) hw_vibra = NEXT();
    if (op & 0x04 && (hw_tonec = *MUZPC)) {
      hw_volc = PVOLMC;
    }
    if (op & 0x08) MUZPC++;
    if (op & 0x10) {
      if (!(hw_toneb = *MUZPC))
        op ^= 0x10;
    }
    if (op & 0x20) MUZPC++;
    if (op & 0x40) {
      if (!(hw_tonea = *MUZPC))
        op ^= 0x40;
    }
    if (op & 0x80) MUZPC++;
    hw_volab = 
      ((op & 0x40) ? (PVOLAB & 0x0f) : 0) |
      ((op & 0x10) ? (PVOLAB & 0xf0) : 0);
  } else if (op < 0x88) {
    portOut( NEXT() | ((op-0x70)<<8) );
  } else if (op == 0x88) {
    for (byte i=0; i<8; i++) {
      portOut( NEXT() | (0x17-i) );
    }
  } else switch (op & 0xf0) {
    case 0x90:
      VOICES = NEXT();
      break;
    case 0xa0:
      PUSH(op - 0x9f);
      break;
    case 0xb0:
      PVOLAB = NEXT();
      PVOLMC = NEXT();
      break;
    case 0xc0:
      if (DECTOP()) {
        MUZPC = (byte*)*(word*)MUZPC;
      } else {
        MUZPC += 2;
        POP();
      }
      break;
    case 0xd0:
      MUZPC += op & 0xf;
      break;
    case 0xe0:
      // REST
      if (op == 0xe1) {
        hw_volab = hw_volc = 0;
        DURAT = *MUZPC++;
      } else {
        // TODO: legatto/stacatto
      }
      break;
    case 0xf0:
      hw_volab = hw_volc = 0;
      VOICES = 0;
      break;
  }
}

