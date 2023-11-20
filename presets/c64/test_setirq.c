
#include <conio.h>
#include <stdio.h>
#include <stdlib.h>
#include <peekpoke.h>
#include <string.h>
#include <c64.h>
#include <cbm_petscii_charmap.h>

#include "common.h"
//#link "common.c"

#include <6502.h>
#include <setjmp.h>

char interrupt_handler() {
  // only needed if CIA interupts are still active
  if (!(VIC.irr & VIC_IRR_IRST)) return IRQ_NOT_HANDLED;
  // change colors so we can see where the IRQ fired
  VIC.bgcolor0++;
  VIC.bordercolor++;
  // reading VIC.rasterline returns the current line
  // setting it changes the line where the IRQ fires
  if (VIC.rasterline >= 245) {
    VIC.rasterline = 40;
  } else {
    VIC.rasterline = 245;
  }
  // acknowledge VIC raster interrupt (bit 0)
  VIC.irr = 1;
  // change colors back to where they were
  VIC.bgcolor0--;
  VIC.bordercolor--;
  return IRQ_HANDLED;
}

void set_frame_irq(char scanline) {
  // deactivate CIA interrupts (keyboard, etc)
  CIA1.icr = 0x7f;
  // set raster line for interrupt
  VIC.ctrl1 &= 0x7f; // clear raster line bit 8
  VIC.rasterline = scanline;
  // activate VIC raster interrupts
  VIC.imr = 1;
}

void main(void) {
  clrscr();
  printf("\nHello World!\n");
  
  // set interrupt routine
  set_irq(interrupt_handler, (void*)0x9f00, 0x100);
  
  // disable CIA interrupt, activate VIC interrupt
  set_frame_irq(255);

  while (1) {
    printf("%d ", VIC.rasterline);
  }
}
