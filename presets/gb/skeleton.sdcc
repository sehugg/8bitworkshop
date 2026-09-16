/*
Hello world for Game Boy.
Set the BG palette, write a message to the tile map,
then turn on the LCD.

Ported from presets/nes/hello.c, using GBDK (gb/gb.h).
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

// main function, run after console reset
void main(void) {

  // GB can only write VRAM while the LCD is off
  DISPLAY_OFF;

  // background palette: color 0 = white, 1 = light, 2 = dark, 3 = black
  BGP_REG = 0xE4;
  OBP0_REG = OBP1_REG = 0xE4;

  // copy the 8x8 font into BG tile data
  font_init();

  // write text to the tile map (tile index == ASCII code)
  put_str(2, 2, "HELLO, WORLD!");

  // enable the background layer, then the LCD
  SHOW_BKG;
  DISPLAY_ON;

  // infinite loop
  while (1) {
    wait_vbl_done();
  }
}
