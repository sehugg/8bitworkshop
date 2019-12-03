
/*
This demo sets up two DLLs (Display List Lists) of
16 slots each. By adjusting the address and fine offset
of the first DL entry, the screen can scroll vertically
across the two DLLs. It can only wrap from the first 16
to the second 16 slots.

Note that this scheme can be used also for double-buffering.
By swapping between the two DLLs each frame, one DLL can
be written while the other is displayed.
*/

#include "atari7800.h"

#include <string.h>

//#link "chr_font.s"
//#link "generic8x16.s"

#define DLL_FLAGS DLL_H16
#define SLOTHEIGHT 16
#define SLOTSIZE 32
#define DOUBLEBUFFER
#define DLSAVE

#ifdef DOUBLEBUFFER
#define NUMSLOTS 32
byte slot0 = 0;
#else
#define NUMSLOTS 16
const byte slot0 = 0;
#endif


DLLEntry DLL[NUMSLOTS];

byte DL[NUMSLOTS][SLOTSIZE];
byte DL_len[NUMSLOTS];

#ifdef DLSAVE
byte DL_save[NUMSLOTS];
#endif

void dll_set_addr(const void* dpp) {
  MARIA.DPPH = (word)dpp>>8;
  MARIA.DPPL = (byte)dpp;
}

void dll_clear() {
  byte i;
  for (i=slot0; i<slot0+16; i++) {
    DL_len[i] = 0;
    DL[i][1] = 0;
  }
}

#ifdef DLSAVE
void dll_save() {
  memcpy(DL_save, DL_len, sizeof(DL_save));
}

void dll_restore() {
  byte i;
  memcpy(DL_len, DL_save, sizeof(DL_save));
  for (i=0; i<NUMSLOTS; i++) {
    DL[i][DL_len[i]+1] = 0;
  }
}
#endif

#ifdef DOUBLEBUFFER
void dll_swap() {
  slot0 ^= 16;
  if (!slot0) {
    dll_set_addr(DLL+16);
  } else {
    dll_set_addr(DLL);
  }
}
#endif

void dll_set_scroll(byte y) {
  static byte oldslot = 0;
  byte slot = y / SLOTHEIGHT;
  byte offset = 15 - (y & 15);
  DLL[oldslot].offset_flags = DLL_FLAGS | (SLOTHEIGHT-1);
  DLL[slot].offset_flags = DLL_FLAGS | offset;
  dll_set_addr(DLL + slot);
  oldslot = slot;
}

void* dll_alloc(byte slot, byte len) {
  byte dlofs;
  slot &= NUMSLOTS-1;
  dlofs = DL_len[slot];
  DL_len[slot] += len;
  DL[slot][dlofs+len+1] = 0;
  return &DL[slot][dlofs];
}

void dll_add_sprite(word addr, byte x, byte y, byte wpal) {
  byte slot = (y / SLOTHEIGHT) | slot0;
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
  byte slot = (y / SLOTHEIGHT) | slot0;
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
    dll->offset_flags = DLL_FLAGS | (SLOTHEIGHT-1);
    dll->dl_hi = (word)dlptr>>8;
    dll->dl_lo = (byte)dlptr;
    dlptr += sizeof(DL[0]);
    dll++;
  }
  dll_clear();
#ifdef DOUBLEBUFFER
  dll_swap();
  dll_clear();
  dll_swap();
#endif
#ifdef DLSAVE
  memset(DL_save, 0, sizeof(DL_save));
#endif
}

// __MAIN__

char* hello = "\2\4\6\0\220\222\102";

void main() {
  byte i;
  byte y = 0;

  dll_setup();
  
  // activate DMA
  MARIA.CHARBASE = 0x80;
  MARIA.P0C1 = 0x8f;
  MARIA.P0C2 = 0x4f;
  MARIA.P0C3 = 0x1f;
  MARIA.P1C1 = 0x34;
  MARIA.P1C2 = 0x28;
  MARIA.P1C3 = 0x1f;
  MARIA.BACKGRND = 0;
  dll_set_addr(DLL);
  MARIA.CTRL = CTRL_DMA_ON | CTRL_DBLBYTE | CTRL_160AB;

  dll_clear();
  dll_add_string(hello, y+32, 32, DL_WP(8,0));
  for (i=0; i<8; i++) {
    slot0 = 0;
    dll_add_sprite(0xa068, i*4, i*33, DL_WP(4,1));
    dll_add_sprite(0xa06c, i*8, i*25, DL_WP(4,1));
    slot0 = 16;
    dll_add_sprite(0xa068, i*4, i*32, DL_WP(4,1));
    dll_add_sprite(0xa06c, 128-i*8, i*24, DL_WP(4,1));
  }
  dll_save();

  while (1) {
    while ((MARIA.MSTAT & MSTAT_VBLANK) == 0) ;
    dll_set_scroll(y);
    dll_restore();
    dll_add_sprite(0xa06c, y, y, DL_WP(4,1));
    while ((MARIA.MSTAT & MSTAT_VBLANK) != 0) ;
    y++;
  }
}

