/*
Interrupts on Game Boy.

Three interrupts matter in most games: the VBlank at ~60 Hz, the
programmable timer, and the LCD status line (see raster.c). GBDK installs
a VBlank handler by default; add_VBL()/add_TIM() append your own handler
to an interrupt's chain, and remove_*() takes it back out.

This demo counts VBlanks and timer overflows in two handlers. The timer
runs at 65536 Hz, so with TMA=0 it overflows about 256 times a second,
much faster than the VBlank. Press START to remove both handlers, then
press it again to add them back.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

// interrupt counters (volatile: written by the handlers)
volatile uint8_t vbl_count;
volatile uint16_t tim_count;
uint8_t handlers_installed = 1;

// VBlank handler: called once per frame
void vbl_handler(void) NONBANKED {
  vbl_count++;
}

// timer handler: called when TIMA_REG overflows
void tim_handler(void) NONBANKED {
  tim_count++;
}

// write a zero-padded 5-digit decimal number to the tile map
static void put_u16(uint8_t x, uint8_t y, uint16_t v) {
  char buf[6];
  int8_t i;
  buf[5] = '\0';
  for (i = 4; i >= 0; i--) {
    buf[i] = '0' + (v % 10);
    v /= 10;
  }
  put_str(x, y, buf);
}

void main(void) {
  uint8_t keys, last_keys = 0;

  DISPLAY_OFF;
  BGP_REG = OBP0_REG = OBP1_REG = 0xE4;
  font_init();

  put_str(4, 0,  "INTERRUPTS");
  put_str(2, 3,  "VBLANK");
  put_str(2, 4,  "00000");
  put_str(2, 7,  "TIMER");
  put_str(2, 8,  "00000");
  put_str(2, 12, "START: PAUSE");

  // timer overflows every 256 ticks at 65536 Hz
  TMA_REG = 0x00;
  TAC_REG = 0x06;

  // install our handlers and enable their interrupts
  add_VBL(vbl_handler);
  add_TIM(tim_handler);
  set_interrupts(VBL_IFLAG | TIM_IFLAG);

  SHOW_BKG;
  DISPLAY_ON;

  while (1) {
    uint16_t t;
    wait_vbl_done();

    // edge-detect START to add/remove the handlers
    keys = joypad();
    if ((keys & J_START) && !(last_keys & J_START)) {
      handlers_installed = !handlers_installed;
      if (handlers_installed) {
        add_VBL(vbl_handler);
        add_TIM(tim_handler);
        put_str(2, 12, "START: PAUSE");
      } else {
        remove_VBL(vbl_handler);
        remove_TIM(tim_handler);
        put_str(2, 12, "START: GO");
      }
    }
    last_keys = keys;

    // read the 16-bit timer count without a torn read
    CRITICAL { t = tim_count; }
    put_u16(2, 4, vbl_count);
    put_u16(2, 8, t);
  }
}
