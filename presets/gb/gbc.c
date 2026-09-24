/*
Color Game Boy demo.

A CGB has 8 background and 8 sprite palettes of 4 colors each, chosen
from a 15-bit RGB palette, plus a double-speed CPU mode. This demo checks
_cpu to see which machine it is running on. On a CGB it:

- animates a background palette entry with set_bkg_palette_entry(),
- toggles between vivid color and the DMG-compatible grayscale palettes
  with cgb_compatibility() (press A),
- switches the CPU between normal and double speed with cpu_slow() and
  cpu_fast() (press START), and shows the difference with a busy-loop
  counter that counts how many iterations fit between two VBlanks.

On a monochrome Game Boy it falls back to the four-shade DMG palettes.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gb/cgb.h"
#include "gbtext.h"

// checkerboard tile (colors 1 and 2)
static const uint8_t checker_tile[] = {
/*;;{w:8,h:8,bpp:1,count:1,brev:1,np:2,pofs:1,sl:2};;*/
  0xCC,0xCC,0x33,0x33,0xCC,0xCC,0x33,0x33,
  0x33,0x33,0xCC,0xCC,0x33,0x33,0xCC,0xCC
/*;;*/
};

// vivid background palette, used for CGB palette 0
palette_color_t colors[4] = {
  RGB_BLACK, RGB_RED, RGB_BLUE, RGB_CYAN
};

volatile uint8_t vbl_flag;
void vbl_handler(void) NONBANKED { vbl_flag++; }

uint8_t cgb_mode;
uint8_t color_mode = 1;
uint8_t fast_mode = 0;

void main(void) {
  uint8_t keys, last_keys = 0;
  uint8_t frame = 0;
  char buf[6];

  cgb_mode = DEVICE_SUPPORTS_COLOR;

  DISPLAY_OFF;
  BGP_REG = OBP0_REG = OBP1_REG = 0xE4;
  font_init();
  set_bkg_data(0, 1, checker_tile);
  fill_bkg_rect(0, 0, 32, 32, 0);

  put_str(1, 0, cgb_mode ? "GAME BOY COLOR" : "GAME BOY");
  put_str(1, 2, "A: PALETTE");
  put_str(1, 3, "START: SPEED");
  put_str(1, 5, "SPEED: NORMAL");
  put_str(1, 7, "WORK: 00000");

  if (cgb_mode)
    set_bkg_palette(0, 1, colors);

  add_VBL(vbl_handler);
  set_interrupts(VBL_IFLAG);

  SHOW_BKG;
  DISPLAY_ON;

  while (1) {
    uint8_t start;
    uint16_t work;
    int8_t b;

    wait_vbl_done();
    keys = joypad();

    // toggle color vs. DMG-compatible grayscale palettes
    if ((keys & J_A) && !(last_keys & J_A)) {
      color_mode = !color_mode;
      if (cgb_mode) {
        if (color_mode)
          set_bkg_palette(0, 1, colors);
        else
          cgb_compatibility();
      }
    }

    // toggle double speed
    if ((keys & J_START) && !(last_keys & J_START)) {
      fast_mode = !fast_mode;
      if (cgb_mode) {
        if (fast_mode) cpu_fast(); else cpu_slow();
      }
      put_str(8, 5, fast_mode ? "DOUBLE" : "NORMAL");
    }
    last_keys = keys;

    // benchmark: count loop iterations between two VBlanks
    start = vbl_flag;
    work = 0;
    while (vbl_flag == start) work++;
    buf[5] = '\0';
    for (b = 4; b >= 0; b--) {
      buf[b] = '0' + (work % 10);
      work /= 10;
    }
    put_str(7, 7, buf);

    // pulse one palette entry slowly (CGB only)
    if (cgb_mode && color_mode && (frame & 7) == 0)
      set_bkg_palette_entry(0, 1, colors[(frame >> 3) & 3]);

    frame++;
  }
}
