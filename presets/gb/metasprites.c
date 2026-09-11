/*
Metasprites combine several hardware sprites to make a larger
sprite. Our demo uses 4 hardware sprites in a 2x2 pattern,
forming 16x16 pixel sprites.

Ported from presets/nes/metasprites.c, using GBDK (gb/metasprites.h).
The Game Boy OAM holds 40 sprites, so 10 actors of 4 sprites each
fit on screen (the NES fits 16).
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include <stdlib.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gb/metasprites.h"
#include "gbtext.h"

///// METASPRITES

// a 2x2 metasprite made from four font tiles
#define TILE 0x21
const metasprite_t metasprite[] = {
  METASPR_ITEM(0, 0, TILE+0, 0),
  METASPR_ITEM(0, 8, TILE+1, 0),
  METASPR_ITEM(8, 0, TILE+2, 0),
  METASPR_ITEM(8, 8, TILE+3, 0),
  METASPR_TERM
};

// number of actors (4 h/w sprites each; 10 * 4 = 40 sprites)
#define NUM_ACTORS 10

// actor x/y positions
uint8_t actor_x[NUM_ACTORS];
uint8_t actor_y[NUM_ACTORS];
// actor x/y deltas per frame (signed)
int8_t actor_dx[NUM_ACTORS];
int8_t actor_dy[NUM_ACTORS];

// setup LCD and tile data
void setup_graphics(void) {
  DISPLAY_OFF;
  BGP_REG = OBP0_REG = OBP1_REG = 0xE4;
  LCDC_REG |= LCDCF_BG8000;
  font_init();
  SHOW_BKG;
  SHOW_SPRITES;
  DISPLAY_ON;
}

// main program
void main(void) {
  uint8_t i;	// actor index

  // initialize PPU
  setup_graphics();

  // initialize actors with random values
  for (i=0; i<NUM_ACTORS; i++) {
    actor_x[i] = rand();
    actor_y[i] = rand();
    actor_dx[i] = (rand() & 7) - 3;
    actor_dy[i] = (rand() & 7) - 3;
  }

  // loop forever
  while (1) {
    uint8_t base = 0;	// first free sprite ID
    // draw and move all actors
    for (i=0; i<NUM_ACTORS; i++) {
      base += move_metasprite(metasprite, FONT_TILE_BASE, base,
                              actor_x[i], actor_y[i]);
      actor_x[i] += actor_dx[i];
      actor_y[i] += actor_dy[i];
    }
    // hide rest of sprites
    hide_sprites_range(base, 40);
    // wait for next frame
    wait_vbl_done();
  }
}
