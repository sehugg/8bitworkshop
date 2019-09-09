
#include "atari7800.h"

#include <string.h>

byte DL[16][64];

DLLEntry DLL[16];

//#link "chr_font.s"

char* hello = "\2\4\6\0\220\222\102";

void setup_dll() {
  byte i;
  // set up DLL
  byte* dlptr = &DL[0][0];
  DLLEntry *dll = &DLL[0];
  for (i=0; i<16; i++) {
    dll->offset_flags = DLL_H16 | (16-1);
    dll->dl_hi = (word)dlptr>>8;
    dll->dl_lo = (byte)dlptr;
    dlptr += sizeof(DL[0]);
    dll++;
  }
  memset(DL, 0, sizeof(DL));
}

void main() {

  setup_dll();
  
  // set up display list
  {
    DL5Entry dl5;
    dl5.data_hi = (word)hello>>8;
    dl5.data_lo = (word)hello;
    dl5.flags = DL5_INDIRECT;
    dl5.width_pal = 32-8;
    dl5.xpos = 32;
    memcpy(DL[2], &dl5, sizeof(dl5));
  }

  // activate DMA
  MARIA.CHARBASE = 0x80;
  MARIA.DPPH = (word)DLL>>8;
  MARIA.DPPL = (byte)DLL;
  MARIA.CTRL = CTRL_DMA_ON | CTRL_DBLBYTE | CTRL_160AB;
  MARIA.P0C1 = 0x2f;
  MARIA.P0C2 = 0x1f;
  MARIA.P0C3 = 0xf;

  while (1) {
    while ((MARIA.MSTAT & MSTAT_VBLANK) == 0) ;
    while ((MARIA.MSTAT & MSTAT_VBLANK) != 0) ;
    MARIA.BACKGRND = 0;
    DL[2][4]++;
  }
}
