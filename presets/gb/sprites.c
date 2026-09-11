/*
Sprite demo for Game Boy.
Animate all 40 hardware sprites (the Game Boy OAM holds 40,
where the NES has 64).

Ported from presets/nes/sprites.c, using GBDK (gb/gb.h).
The font tiles loaded for the background live at 0x8000, which
is the same tile data the objects use, so we can point the
sprites at them too.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include <stdlib.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

// number of actors
#define NUM_ACTORS 40		// 40 sprites (Game Boy maximum)

// actor x/y positions
uint8_t actor_x[NUM_ACTORS];	// horizontal coordinates
uint8_t actor_y[NUM_ACTORS];	// vertical coordinates

// actor x/y deltas per frame (signed)
int8_t actor_dx[NUM_ACTORS];	// horizontal velocity
int8_t actor_dy[NUM_ACTORS];	// vertical velocity

// setup LCD and tile data
void setup_graphics(void) {
  DISPLAY_OFF;
  // 4-shade palettes (index 0 is transparent for objects)
  BGP_REG = OBP0_REG = OBP1_REG = 0xE4;
  // use 0x8000 for BG tile data so background and objects
  // share the same font tiles
  LCDC_REG |= LCDCF_BG8000;
  // load the font tiles at 0x8000 (shared by BG and objects)
  font_init();
  SHOW_BKG;
  SHOW_SPRITES;
  DISPLAY_ON;
}

// main program
void main(void) {
  uint8_t i;	// actor index

  // initialize actors with random values
  for (i=0; i<NUM_ACTORS; i++) {
    actor_x[i] = rand();
    actor_y[i] = rand();
    actor_dx[i] = (rand() & 7) - 3;
    actor_dy[i] = (rand() & 7) - 3;
  }

  setup_graphics();

  // loop forever
  while (1) {
    // draw and move all actors
    for (i=0; i<NUM_ACTORS; i++) {
      set_sprite_tile(i, FONT_TILE_BASE + i);
      move_sprite(i, actor_x[i], actor_y[i]);
      actor_x[i] += actor_dx[i];
      actor_y[i] += actor_dy[i];
    }
    // wait for next frame
    wait_vbl_done();
  }
}
