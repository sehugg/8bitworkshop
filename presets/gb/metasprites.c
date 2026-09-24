/*
Metasprites combine several hardware sprites to make a larger
sprite. Our demo uses 4 hardware sprites in a 2x2 pattern,
forming 16x16 pixel sprites. Actors alternate between the normal
draw, a horizontal flip and a vertical flip.

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
const metasprite_t metasprite[] = {
  METASPR_ITEM(0, 0, 0, 0),
  METASPR_ITEM(0, 8, 1, 0),
  METASPR_ITEM(8, -8, 2, 0),
  METASPR_ITEM(0, 8, 3, 0),
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

const int8_t deltas[4] = { -2, -1, 1, 2 };

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
  srand(0);
  for (i=0; i<NUM_ACTORS; i++) {
    actor_x[i] = rand() + i * 8;
    actor_y[i] = rand() + i * 8;
    actor_dx[i] = deltas[rand() & 3];
    actor_dy[i] = deltas[rand() & 3];
  }

  // loop forever
  while (1) {
    uint8_t base = 0;	// first free sprite ID
    // draw and move all actors, flipping some of them
    for (i=0; i<NUM_ACTORS; i++) {
      if (i < 4)
        base += move_metasprite(metasprite, 0x41, base,
                                actor_x[i], actor_y[i]);
      else if (i < 7)
        base += move_metasprite_hflip(metasprite, 0x41, base,
                                      actor_x[i], actor_y[i]);
      else
        base += move_metasprite_vflip(metasprite, 0x41, base,
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
