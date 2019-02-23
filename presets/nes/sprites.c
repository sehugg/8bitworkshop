
#include <stdlib.h>
#include <string.h>

// include NESLIB header
#include "neslib.h"

// include CC65 NES Header (PPU)
#include <nes.h>

// link the pattern table into CHR ROM
//#link "chr_generic.s"


const char PALETTE[32] = {
  0x03,			// background color

  0x11,0x30,0x27, 0,	// ladders and pickups
  0x1c,0x20,0x2c, 0,	// floor blocks
  0x00,0x10,0x20, 0,
  0x06,0x16,0x26, 0,

  0x16,0x35,0x24, 0,	// enemy sprites
  0x00,0x37,0x25, 0,	// rescue person
  0x0d,0x2d,0x3a, 0,
  0x0d,0x27,0x2a	// player sprites
};

// setup PPU and tables
void setup_graphics() {
  // clear sprites
  oam_clear();
  // set palette colors
  pal_all(PALETTE);
  // turn on PPU
  ppu_on_all();
}

// number of actors
#define NUM_ACTORS 64

// actor x/y positions
char actor_x[NUM_ACTORS];
char actor_y[NUM_ACTORS];
// actor x/y deltas per frame
char actor_dx[NUM_ACTORS];
char actor_dy[NUM_ACTORS];

// main program
void main() {
  char i;
  char oam_id;
  
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
    // start with OAMid/sprite 0
    oam_id = 0;
    // draw and move all actors
    for (i=0; i<NUM_ACTORS; i++) {
      oam_id = oam_spr(actor_x[i], actor_y[i], i, i, oam_id);
      actor_x[i] += actor_dx[i];
      actor_y[i] += actor_dy[i];
    }
    // hide rest of sprites
    // if we haven't wrapped oam_id around to 0
    if (oam_id!=0) oam_hide_rest(oam_id);
    // wait for next frame
    ppu_wait_frame();
  }
}
