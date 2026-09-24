/*
STAT/LYC raster effects on Game Boy.

The LCD status (STAT) interrupt can fire when the raster reaches a
programmed scanline, that is when LY_REG == LYC_REG. From inside the
handler we can point LYC at a new line and write SCX_REG, changing the
scroll register in the middle of a frame -- an effect the tile engine
cannot do by itself.

This demo waves the background left and right. The handler runs once every
eight scanlines, sets SCX_REG from a sine table, then arms LYC for the
next interrupt. The table phase advances every two frames, so the wave travels
across the screen.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

// 32-step wave, +/- 20 pixels
static const int8_t wave[32] = {
   0,   6,  12,  16,  19,  20,  19,  16,
  12,   6,   0,  -6, -12, -16, -19, -20,
 -19, -16, -12,  -6,   0,   6,  12,  16,
  19,  20,  19,  16,  12,   6,   0,  -6
};

// diagonal stripe tile so the per-line offset is easy to see
static const uint8_t stripe_tile[] = {
/*;;{w:8,h:8,bpp:1,count:1,brev:1,np:2,pofs:1,sl:2};;*/
  0xF0,0xE1,0xC3,0x87,0x0F,0x1E,0x3C,0x78,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00
/*;;*/
};

volatile uint8_t phase;

// LCD handler: called once per 8 visible scanlines (LY == LYC)
void lcd_handler(void) NONBANKED {
  uint8_t ly = LY_REG;
  if (ly < 143) {
    // offset this line and arm the interrupt for the next one
    SCX_REG = 248 + (int8_t)wave[(ly + phase) & 31];
    LYC_REG = ly + 8;
  } else {
    // last line: reset so the next frame starts at the top
    SCX_REG = 128;
    LYC_REG = 0;
  }
}

void main(void) {
  DISPLAY_OFF;
  BGP_REG = OBP0_REG = OBP1_REG = 0xE4;

  font_init();
  set_bkg_data(0, 1, stripe_tile);
  fill_bkg_rect(0, 0, 32, 32, 0);
  put_str(2, 6, "GAME BOY RASTER");
  put_str(2, 8, "LYC WAVE");

  // enable the LY==LYC interrupt and install the handler
  LYC_REG = 0;
  STAT_REG = STATF_LYC;
  add_LCD(lcd_handler);
  set_interrupts(VBL_IFLAG | LCD_IFLAG);

  SHOW_BKG;
  DISPLAY_ON;

  while (1) {
    wait_vbl_done();
    wait_vbl_done();
    phase++;
  }
}
