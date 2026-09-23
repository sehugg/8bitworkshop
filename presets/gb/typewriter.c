/*
Typewriter text demo for Game Boy.
Ported from GBDK's examples/cross-platform/text_typewriter.

Instead of building each string into a buffer and calling set_bkg_tiles(),
this writes one tile at a time straight into VRAM:

- get_bkg_xy_addr() returns the VRAM address of a map cell
- set_vram_byte() stores a tile number there
- fill_bkg_rect() clears the tile map first
- set_native_tile_data() loads the font tile patterns

A short pause between characters gives the typewriter effect.

The font is the 8x8 text font from gbtext.h. Its tile numbers equal
ASCII codes, so the characters can go straight into the map.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

#define SCREEN_W 20U
#define SCREEN_H 18U
#define FRAMES_PER_CHAR 2U

void draw_text(const char* text, uint8_t delay_frames) {
  uint8_t x = 0;          // current column
  uint8_t y = 0;          // current row
  uint8_t f;
  uint16_t i = 0;
  uint8_t* vram = get_bkg_xy_addr(0, 0);

  while (text[i] != '\0') {
    // write a tile and advance the VRAM address
    set_vram_byte(vram, text[i]);
    vram++;
    x++;
    if (x >= SCREEN_W) {
      // wrap to the start of the next row
      x = 0;
      y++;
      vram = get_bkg_xy_addr(0, y);
    }
    i++;
    for (f = 0; f < delay_frames; f++) {
      wait_vbl_done();
    }
  }
}

void main(void) {
  DISPLAY_OFF;
  BGP_REG = 0xE4;

  // load the font tile patterns (tile number == ASCII code)
  set_native_tile_data(FONT_TILE_BASE, FONT_NUM_TILES, font_tiles);
  // clear the tile map
  fill_bkg_rect(0, 0, SCREEN_W, SCREEN_H, 0);

  SHOW_BKG;
  DISPLAY_ON;

  draw_text("This is a way to draw text on the screen in GBDK. The code will automatically jump to a new line, when it reaches the end of the row.", FRAMES_PER_CHAR);

  while (1) {
    wait_vbl_done();
  }
}
