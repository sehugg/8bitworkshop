
#include "dll.h"
#include <string.h>

DLLEntry DLL[NUMSLOTS];		// display list list
byte DL[NUMSLOTS][SLOTSIZE];	// display list slots
byte DL_len[NUMSLOTS];		// current bytes in each slot
#ifdef DLSAVE
byte DL_save[NUMSLOTS];		// save lengths of each slot
#endif

byte slot0 = 0;			// current page offset

// set display list list address registers
void dll_set_addr(const void* dpp) {
  MARIA.DPPH = (word)dpp>>8;
  MARIA.DPPL = (byte)dpp;
}

// clear the current page
void dll_clear() {
  byte i;
  for (i=slot0; i<slot0+SLOTSPERPAGE; i++) {
    DL_len[i] = 0;
    DL[i][1] = 0;
  }
}

#ifdef DLSAVE
// save display list lengths of each slot
void dll_save() {
  memcpy(DL_save, DL_len, sizeof(DL_save));
}

// restore display list lengths of current page
void dll_restore() {
  byte i;
  for (i=slot0; i<slot0+SLOTSPERPAGE; i++) {
    DL_len[i] = DL_save[i]; // set slot length
    DL[i][DL_len[i]+1] = 0; // set end marker
  }
}

// restore all slots
void dll_restore_all() {
  slot0 ^= SLOTSPERPAGE;
  dll_restore();
  slot0 ^= SLOTSPERPAGE;
  dll_restore();
}
#endif

#ifdef DOUBLEBUFFER
// swap between pages
void dll_swap() {
  slot0 ^= SLOTSPERPAGE;
  if (!slot0) {
    dll_set_addr(DLL+SLOTSPERPAGE);
  } else {
    dll_set_addr(DLL);
  }
}

// copy offscreen page to current page
void dll_copy() {
  memcpy(&DL[slot0], &DL[slot0 ^ SLOTSPERPAGE], SLOTSIZE*SLOTSPERPAGE);
  memcpy(&DL_len[slot0], &DL_len[slot0 ^ SLOTSPERPAGE], SLOTSPERPAGE);
}
#endif

// set scroll position
void dll_set_scroll(byte y) {
  static byte oldslot = 0;
  byte slot = y / SLOTHEIGHT;
  byte offset = 15 - (y & 15);
  DLL[oldslot].offset_flags = DLL_FLAGS | (SLOTHEIGHT-1);
  DLL[slot].offset_flags = DLL_FLAGS | offset;
  dll_set_addr(DLL + slot);
  oldslot = slot;
}

// allocate a given # of bytes in a slot
sbyte dll_bytesleft(byte slot) {
  slot &= NUMSLOTS-1;
  return SLOTSIZE - DL_len[slot];
}

// allocate a given # of bytes in a slot
void* dll_alloc(byte slot, byte len) {
  byte dlofs;
  register byte* dl;
  slot &= NUMSLOTS-1;
  dl = DL[slot];
  dlofs = DL_len[slot];
  DL_len[slot] += len;
  dl[dlofs+len+1] = 0;
  return &dl[dlofs];
}

// add a sprite to currently selected page
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

// add a string to currently selected page
// strings are aligned to top of slot
void dll_add_string(register const char* str, byte x, byte y, byte wpal) {
  byte slot = (y / SLOTHEIGHT) | slot0;
  register DL5Entry* dl = (DL5Entry*) dll_alloc(slot, 5);
  dl->data_lo = (byte)str;
  dl->data_hi = (word)str>>8;
  dl->flags = DL5_INDIRECT;
  dl->width_pal = wpal;
  dl->xpos = x;
}

// set up display lists
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
#else
  dll_set_addr(DLL);
#endif
#ifdef DLSAVE
  memset(DL_save, 0, sizeof(DL_save));
#endif
}
