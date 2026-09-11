/*
Scrolling demo for Game Boy.
The background tile map is 32x32 tiles (256x256 pixels) and
wraps around, so the scroll registers can move anywhere in it.
We put text at the top, middle and bottom rows and scroll the
view up and down through the whole map.

Ported from presets/nes/scroll.c, using GBDK (gb/gb.h).
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

// scroll the window up and down until the end
void scroll_demo(void) {
  int y = 0;   // y scroll position
  int dy = 1;  // y scroll direction
  // infinite loop
  while (1) {
    // wait for next frame
    wait_vbl_done();
    // update y variable
    y += dy;
    // change direction when hitting either edge of scroll area
    if (y >= 255) dy = -1;
    if (y == 0) dy = 1;
    // set the Y scroll register
    SCY_REG = y;
  }
}

// main function, run after console reset
void main(void) {
  DISPLAY_OFF;
  // background palette: color 0 = white, 1 = light, 2 = dark, 3 = black
  BGP_REG = 0xE4;

  font_init();

  // write text to the tile map
  put_str(2, 0,  "Tile map row 0");
  put_str(2, 15, "Tile map row 15");
  put_str(2, 29, "Tile map row 29");

  // enable rendering
  SHOW_BKG;
  DISPLAY_ON;

  // scroll the view back and forth
  scroll_demo();
}
