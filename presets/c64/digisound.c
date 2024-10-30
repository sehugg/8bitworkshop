
#include <conio.h>
#include <stdio.h>
#include <stdlib.h>
#include <peekpoke.h>
#include <string.h>
#include <c64.h>
#include <cbm_petscii_charmap.h>

#include "sidmacros.h"
#include "common.h"
//#link "common.c"

void digi_setup(void) {
    SID.v1.sr  = 0xFF;  // Voice 1 Sustain/Release 
    SID.v2.sr  = 0xFF;  // Voice 2 Sustain/Release
    SID.v3.sr  = 0xFF;  // Voice 3 Sustain/Release    
    SID.v1.ctrl = 0x49;  // Voice 1 Control Register
    SID.v2.ctrl = 0x49;  // Voice 2 Control Register
    SID.v3.ctrl = 0x49;  // Voice 3 Control Register
}

void cia2_wait() {
  byte timer = CIA2.ta_lo;
  while (CIA2.ta_lo < timer) ;
}

void digi_play(const char* snd, unsigned int len) {
  unsigned int i;   // loop counter
  VIC.ctrl1 = 0;    // disable video
  asm("sei");       // disable interrupts
  // setup CIA #2 timer
  CIA2.cra = 0x00;        // stop timer A
  CIA2.ta_lo = IS_PAL() ? 123 : 128; // set lower timer value
  CIA2.ta_hi = 0;         // set upper timer value
  CIA2.cra = 0x11;        // start timer, continuous mode
  // loop through all samples
  for (i = 0; i < len; i++) {
    // wait for timer to reset
    cia2_wait();
    // send upper 4-bit sample
    SID.amp = snd[i] >> 4;
    // wait for timer to reset
    cia2_wait();
    // send lower 4-bit sample
    SID.amp = snd[i] & 15;
    // make a video effect
    VIC.bordercolor = i;
  }
  asm("cli");       // enable interrupts
  VIC.ctrl1 = 0x1b; // enable video
  CIA2.cra = 0x00;  // stop timer A
  VIC.bordercolor = COLOR_BLUE;
}

#ifdef __MAIN__

const char digisound[] = {
  #embed "springchicken-b4.raw"
};

void main(void) {
  clrscr();
  digi_setup();
  while (1) {
    digi_play(digisound, sizeof(digisound));
    printf("\nPress ENTER to restart digi...\n");
    getchar();
  }
}

#endif
