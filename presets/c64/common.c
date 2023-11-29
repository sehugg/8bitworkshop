
#include "common.h"

void raster_wait(byte line) {
  while (VIC.rasterline < line) ;
}

void wait_vblank(void) {
  raster_wait(250);
}

static byte VIC_BANK_PAGE[4] = {
  0xc0, 0x80, 0x40, 0x00
};

char* get_vic_bank_start() {
  return (char*)(VIC_BANK_PAGE[CIA2.pra & 3] << 8);
}

char* get_screen_memory() {
  return ((VIC.addr & 0xf0) << 6) + get_vic_bank_start();
}

#ifdef __CC65__
char __fastcall__ poll_keyboard() {
  asm("jmp $f142");
  return __A__;
}
#endif

void set_raster_irq(char scanline) {
  // deactivate CIA interrupts (keyboard, etc)
  CIA1.icr = 0x7f;
  // set raster line for interrupt
  VIC.ctrl1 &= 0x7f; // clear raster line bit 8
  VIC.rasterline = scanline;
  // activate VIC raster interrupts
  VIC.imr = 1;
}

