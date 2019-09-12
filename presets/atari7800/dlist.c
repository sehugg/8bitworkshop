
#include "atari7800.h"

#include <string.h>

//#link "chr_font.s"

//#link "generic8x16.s"

#define SLOTHEIGHT 16
#define DOUBLEBUFFER

#ifdef DOUBLEBUFFER
#define NUMSLOTS 32
#define SLOTSIZE 32
byte slot0 = 0;
#else
#define NUMSLOTS 16
#define SLOTSIZE 64
const byte slot0 = 0;
#endif


byte DL[NUMSLOTS][SLOTSIZE];
byte DL_len[NUMSLOTS];
DLLEntry DLL[NUMSLOTS];

void dll_clear() {
  byte i;
  for (i=slot0; i<slot0+16; i++) {
    DL[i][1] = 0;
    DL_len[i] = 0;
  }
}

#ifdef DOUBLEBUFFER
void dll_swap() {
  slot0 ^= 16;
  if (!slot0) {
    MARIA.DPPH = (word)(DLL+16)>>8;
    MARIA.DPPL = (byte)(DLL+16);
  } else {
    MARIA.DPPH = (word)DLL>>8;
    MARIA.DPPL = (byte)DLL;
  }
}
#endif

void* dll_alloc(byte slot, byte len) {
  byte dlofs;
  slot &= NUMSLOTS-1;
  dlofs = DL_len[slot];
  DL_len[slot] += len;
  DL[slot][dlofs+len+1] = 0;
  return &DL[slot][dlofs];
}

void dll_add_sprite(word addr, byte x, byte y, byte wpal) {
  byte slot = (y >> 4) | slot0;
  register DL4Entry* dl = (DL4Entry*) dll_alloc(slot, 4);
  dl->data_lo = (byte)addr;
  dl->data_hi = (byte)(addr>>8) + (y & 15);
  dl->xpos = x;
  dl->width_pal = wpal;
  if (y & 15) {
    DL4Entry* dl2 = (DL4Entry*) dll_alloc(slot+1, 4);
    *dl2 = *dl;
    dl2->data_hi -= SLOTHEIGHT;
  }
}

void dll_add_string(const char* str, byte x, byte y, byte wpal) {
  byte slot = (y >> 4) | slot0;
  register DL5Entry* dl = (DL5Entry*) dll_alloc(slot, 5);
  dl->data_lo = (byte)str;
  dl->data_hi = (word)str>>8;
  dl->flags = DL5_INDIRECT;
  dl->width_pal = wpal;
  dl->xpos = x;
}

void dll_setup() {
  byte i;
  byte* dlptr = &DL[0][0];
  register DLLEntry *dll = &DLL[0];
  for (i=0; i<NUMSLOTS; i++) {
    dll->offset_flags = DLL_H16 | (SLOTHEIGHT-1);
    dll->dl_hi = (word)dlptr>>8;
    dll->dl_lo = (byte)dlptr;
    dlptr += sizeof(DL[0]);
    dll++;
  }
  dll_clear();
#ifdef DOUBLEBUFFER
  dll_swap();
  dll_clear();
#endif
}

char* hello = "\2\4\6\0\220\222\102";

void main() {
  byte i;
  byte y = 0;

  dll_setup();
  
  // activate DMA
  MARIA.CHARBASE = 0x80;
  MARIA.DPPH = (word)DLL>>8;
  MARIA.DPPL = (byte)DLL;
  MARIA.CTRL = CTRL_DMA_ON | CTRL_DBLBYTE | CTRL_160AB;
  MARIA.P0C1 = 0x8f;
  MARIA.P0C2 = 0x4f;
  MARIA.P0C3 = 0x1f;
  MARIA.P1C1 = 0x34;
  MARIA.P1C2 = 0x28;
  MARIA.P1C3 = 0x1f;
  MARIA.BACKGRND = 0;

  while (1) {
    while ((MARIA.MSTAT & MSTAT_VBLANK) == 0) ;
    dll_swap();
    dll_clear();
    dll_add_string(hello, y+32, 32, DL_WP(8,0));
    for (i=0; i<8; i++) {
      dll_add_sprite(0xa068, i*4, i*16+y, DL_WP(4,1));
      dll_add_sprite(0xa06c, i*8+y, i*16, DL_WP(4,1));
    }
    while ((MARIA.MSTAT & MSTAT_VBLANK) != 0) ;
    y++;
  }
}
