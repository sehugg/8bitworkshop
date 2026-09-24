/*
VRAM and OAM access windows on Game Boy.

The CPU shares VRAM and OAM with the LCD controller. While the LCD is
off, both are freely accessible. While it is on, the CPU can only touch
them during VBlank -- writes at other times are ignored or corrupt the
display.

This demo exercises the low-level access helpers:
- vmemset() fills a VRAM range while the LCD is off, clearing the map.
- vmemcpy() and vmemset() copy a moving bar into the tile map, once per
  VBlank.
- hide_sprite() hides the objects outside a moving four-sprite window.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

#define TILE_BAR 0x01U   // custom tile (font lives at 0x20 and up)

// solid bar tile
static const uint8_t bar_tile[] = {
/*;;{w:8,h:8,bpp:1,count:1,brev:1,np:2,pofs:1,sl:2};;*/
  0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00
/*;;*/
};

// one full row of bar tiles, copied with vmemcpy()
static const uint8_t bar_row[32] = {
  TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,
  TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,
  TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,
  TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR,TILE_BAR
};

// an 8x8 ball sprite (2bpp)
static const uint8_t ball_tile[] = {
/*;;{w:8,h:8,bpp:1,count:1,brev:1,np:2,pofs:1,sl:2};;*/
  0x3C,0x3C,0x42,0x7E,0x99,0xFF,0xA9,0xFF,
  0x89,0xFF,0x89,0xFF,0x42,0x7E,0x3C,0x3C
/*;;*/
};

void main(void) {
  uint8_t i;
  uint8_t bar_y = 3, bar_dy = 1;
  uint8_t spot = 0, spot_dx = 1;

  DISPLAY_OFF;
  BGP_REG = OBP0_REG = OBP1_REG = 0xE4;

  font_init();
  set_bkg_data(TILE_BAR, 1, bar_tile);
  set_sprite_data(0, 1, ball_tile);
  for (i = 0; i < 8; i++) {
    set_sprite_tile(i, 0);
    hide_sprite(i);
  }

  // LCD is off: fill the whole background map at once.
  // (0x20 is the space tile loaded by font_init.)
  vmemset(_SCRN0, 0x20, 32 * 32);
  put_str(1, 0, "VRAM / OAM WINDOW");

  SHOW_BKG;
  SHOW_SPRITES;
  DISPLAY_ON;

  while (1) {
    wait_vbl_done();

    // erase the old bar and draw the new one -- only safe in VBlank
    vmemset(_SCRN0 + bar_y * 32, 0x20, 32);
    bar_y += bar_dy;
    if (bar_y <= 2 || bar_y >= 16) bar_dy = -bar_dy;
    vmemcpy(_SCRN0 + bar_y * 32, (uint8_t*)bar_row, 32);

    // show four sprites and hide the rest
    for (i = 0; i < 8; i++) {
      if (i >= spot && i < spot + 4)
        move_sprite(i, 16 + i * 16, 136);
      else
        hide_sprite(i);
    }
    spot += spot_dx;
    if (spot == 0 || spot == 4) spot_dx = -spot_dx;
  }
}
