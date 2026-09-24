/*
The Game Boy window layer as a status bar.

The window is a second tile map that the PPU draws on top of the
background. Unlike the background it does not scroll; instead WX_REG and
WY_REG set where its top-left corner appears, so it makes a natural HUD.

This demo builds a status bar with init_win() and fill_win_rect(), stamps
a row of icons with set_win_submap(), then slides the whole bar in from
the left with scroll_win() while the background scrolls behind it.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include <string.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

#define TILE_BLOCK  0
#define TILE_STRIPE 1
#define TILE_CHECK  2

// solid, diagonal-stripe and checkerboard 2bpp tiles
static const uint8_t block_tile[] = {
/*;;{w:8,h:8,bpp:1,count:1,brev:1,np:2,pofs:1,sl:2};;*/
  0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00
/*;;*/
};
static const uint8_t stripe_tile[] = {
/*;;{w:8,h:8,bpp:1,count:1,brev:1,np:2,pofs:1,sl:2};;*/
  0xF0,0xE1,0xC3,0x87,0x0F,0x1E,0x3C,0x78,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00
/*;;*/
};
static const uint8_t checker_tile[] = {
/*;;{w:8,h:8,bpp:1,count:1,brev:1,np:2,pofs:1,sl:2};;*/
  0xCC,0xCC,0x33,0x33,0xCC,0xCC,0x33,0x33,
  0x33,0x33,0xCC,0xCC,0x33,0x33,0xCC,0xCC
/*;;*/
};

// one row of alternating icons for set_win_submap()
static const uint8_t icon_map[] = { TILE_CHECK, TILE_BLOCK, TILE_CHECK, TILE_BLOCK,
                                    TILE_CHECK, TILE_BLOCK, TILE_CHECK, TILE_BLOCK };

// write a string into the window tile map
static void put_win_str(uint8_t x, uint8_t y, const char* s) {
  set_win_tiles(x, y, strlen(s), 1, (uint8_t*)s);
}

void main(void) {
  int8_t win_x = 0;
  uint8_t scroll = 0;

  DISPLAY_OFF;
  BGP_REG = OBP0_REG = OBP1_REG = 0xE4;

  // put the window map at 0x9C00, separate from the background map.
  // set LCDC before loading tiles: GBDK picks the tile-data region
  // (0x8000 or 0x9000) from the LCDC bit in effect at the call.
  LCDC_REG = LCDCF_OFF | LCDCF_WIN9C00 | LCDCF_BG8000 | LCDCF_BGON | LCDCF_WINON;

  // load the font plus our three pattern tiles
  font_init();
  set_bkg_data(TILE_BLOCK, 1, block_tile);
  set_bkg_data(TILE_STRIPE, 1, stripe_tile);
  set_bkg_data(TILE_CHECK, 1, checker_tile);

  // background: stripes, so the scrolling is easy to see
  fill_bkg_rect(0, 0, 32, 32, TILE_STRIPE);

  // build the status bar (2 rows tall)
  init_win(TILE_BLOCK);                    // clear the whole window map
  fill_win_rect(0, 0, 20, 2, TILE_BLOCK);  // solid 20x2 bar
  set_win_submap(12, 0, 8, 1, icon_map, 8);// icon row from a submap
  put_win_str(1, 0, "STATUS BAR");
  put_win_str(1, 1, "SCORE 000000");

  // anchor the bar to the bottom two rows, hidden off the left edge
  // (the window always extends from WY down to the bottom of the screen)
  move_win(0, 128);

  DISPLAY_ON;

  while (1) {
    wait_vbl_done();

    // WX=7 puts the window's left edge at screen x=0
    if (win_x < 7) {
      scroll_win(1, 0);
      win_x++;
    }

    // scroll the background
    scroll++;
    SCX_REG = scroll;
    SCY_REG = scroll >> 1;
  }
}
