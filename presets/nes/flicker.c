
/*
If you have more objects than will fit into the 64 hardware
sprites, you can omit some of the sprites each frame.
We also use oam_meta_spr_pal() to change the color of each
metasprite.
*/

#include <stdlib.h>
#include <string.h>

// include NESLIB header
#include "neslib.h"

// include CC65 NES Header (PPU)
#include <nes.h>

// link the pattern table into CHR ROM
//#link "chr_generic.s"

///// METASPRITES

#define TILE 0xd8
#define ATTR 0x0

// define a 2x2 metasprite
const unsigned char metasprite[]={
        0,      0,      TILE+0,   ATTR, 
        0,      8,      TILE+1,   ATTR, 
        8,      0,      TILE+2,   ATTR, 
        8,      8,      TILE+3,   ATTR, 
        128};

/*{pal:"nes",layout:"nes"}*/
const char PALETTE[32] = { 
  0x03,			// screen color

  0x11,0x30,0x27,0x0,	// background palette 0
  0x1c,0x20,0x2c,0x0,	// background palette 1
  0x00,0x10,0x20,0x0,	// background palette 2
  0x06,0x16,0x26,0x0,	// background palette 3

  0x16,0x35,0x24,0x0,	// sprite palette 0
  0x00,0x37,0x25,0x0,	// sprite palette 1
  0x0d,0x2d,0x3a,0x0,	// sprite palette 2
  0x0d,0x27,0x2a	// sprite palette 3
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

// number of actors (4 h/w sprites each)
#define NUM_ACTORS 24

// actor x/y positions
byte actor_x[NUM_ACTORS];
byte actor_y[NUM_ACTORS];
// actor x/y deltas per frame (signed)
sbyte actor_dx[NUM_ACTORS];
sbyte actor_dy[NUM_ACTORS];

// main program
void main() {
  byte i;	// actor index
  
  // setup PPU
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
    oam_off = 0;
    // draw and move all actors
    // (note we don't reset i each loop iteration)
    while (oam_off < 256-4*4) {
      // advance and wrap around actor array
      if (++i >= NUM_ACTORS)
        i -= NUM_ACTORS;
      // draw and move actor
      oam_meta_spr_pal(
        actor_x[i] += actor_dx[i],	// add x+dx and pass param
        actor_y[i] += actor_dy[i],	// add y+dy and pass param
        i&3,				// palette color
        metasprite);			// metasprites
    }
    // hide rest of sprites
    oam_hide_rest(oam_off);
    // wait for next NMI
    // we don't want to skip frames b/c it makes flicker worse
    ppu_wait_nmi();
  }
}
