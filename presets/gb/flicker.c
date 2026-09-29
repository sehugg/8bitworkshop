/*
Flicker, on purpose: transparency and sprite cycling.

1. Transparency. The Game Boy has no blending hardware, but the original
   DMG screen is slow: a pixel takes several frames to fully change. So a
   sprite shown on every *other* frame (30 Hz) doesn't blink -- it
   smears into a half-tone ghost over the background. Chikyu Kaiho Gun
   ZAS (T&E Soft, 1992) used this for see-through clouds and effects,
   and Link's Awakening DX (1998) for see-through portraits. On a fast
   modern screen or an emulator without frame blending, it just flickers.

2. Sprite cycling. The PPU draws at most 10 sprites per scanline: the
   first 10 in OAM order whose rows overlap it. Here 16 balls share one
   row, so 6 would simply vanish. Rotating which ball goes in which OAM
   slot every frame spreads the loss around: every ball is visible
   10 frames out of 16, and the eye sees them all, flickering.
*/

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"

/*{w:8,h:8,bpp:1,count:5,brev:1,np:2,pofs:1,sl:2}*/
const uint8_t sprite_tiles[] = {
  // 0: ball
  0x3C,0x3C, 0x42,0x7E, 0x81,0xFF, 0x85,0xFB, 0x85,0xFB, 0x81,0xFF, 0x42,0x7E, 0x3C,0x3C,
  // 1-4: 16-by-16 ghost, solid color 3 (the flicker makes it look gray)
  0x07,0x07, 0x1F,0x1F, 0x3F,0x3F, 0x7F,0x7F, 0x73,0x73, 0xF3,0xF3, 0xFF,0xFF, 0xFF,0xFF,
  0xE0,0xE0, 0xF8,0xF8, 0xFC,0xFC, 0xFE,0xFE, 0xCE,0xCE, 0xCF,0xCF, 0xFF,0xFF, 0xFF,0xFF,
  0xFF,0xFF, 0xFF,0xFF, 0xFF,0xFF, 0xFF,0xFF, 0xFF,0xFF, 0xFF,0xFF, 0xDB,0xDB, 0x89,0x89,
  0xFF,0xFF, 0xFF,0xFF, 0xFF,0xFF, 0xFF,0xFF, 0xFF,0xFF, 0xFF,0xFF, 0xDB,0xDB, 0x91,0x91,
};

// background: a checkerboard, so the ghost's transparency is visible
/*{w:8,h:8,bpp:1,count:2,brev:1,np:2,pofs:1,sl:2}*/
const uint8_t bg_tiles[] = {
  0xFF,0x00, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00,
  0x00,0xFF, 0x00,0xFF, 0x00,0xFF, 0x00,0xFF, 0x00,0xFF, 0x00,0xFF, 0x00,0xFF, 0x00,0xFF,
};

#define NBALLS 16
#define GHOST_OAM 36     // OAM slots 36..39 for the ghost

uint8_t ball_x[NBALLS];

void main(void) {
  uint8_t i, x, y, frame = 0, rot = 0;
  uint8_t row[32];
  uint8_t gx = 40;
  int8_t gdx = 1;

  DISPLAY_OFF;
  BGP_REG = 0xE4;
  OBP0_REG = 0xE4;
  set_bkg_data(0, 2, bg_tiles);
  for (y = 0; y < 18; y++) {
    for (x = 0; x < 32; x++) row[x] = ((x >> 1) ^ (y >> 1)) & 1;
    set_bkg_tiles(0, y, 32, 1, row);
  }
  set_sprite_data(0, 5, sprite_tiles);
  for (i = 0; i < NBALLS; i++) {
    ball_x[i] = 12 + i * 9;   // 16 balls across 144 pixels
    set_sprite_tile(i, 0);
  }
  set_sprite_tile(GHOST_OAM+0, 1);
  set_sprite_tile(GHOST_OAM+1, 2);
  set_sprite_tile(GHOST_OAM+2, 3);
  set_sprite_tile(GHOST_OAM+3, 4);
  SHOW_BKG;
  SHOW_SPRITES;
  DISPLAY_ON;

  while (1) {
    wait_vbl_done();
    frame++;

    // --- sprite cycling: ball (i + rot) goes in OAM slot i ---
    rot = (rot + 7) & (NBALLS - 1);  // step by 7: coprime with 16, so
                                     // every ball gets every slot
    for (i = 0; i < NBALLS; i++) {
      uint8_t b = (i + rot) & (NBALLS - 1);
      move_sprite(i, ball_x[b], 40);
      if (++ball_x[b] >= 12 + 144) ball_x[b] = 12;  // wrap on screen
    }

    // --- 30 Hz ghost: visible on even frames only ---
    gx += gdx;
    if (gx < 16 || gx > 150) gdx = -gdx;
    if (frame & 1) {
      // hide by moving off the top of the screen (Y = 0)
      for (i = 0; i < 4; i++) move_sprite(GHOST_OAM + i, 0, 0);
    } else {
      move_sprite(GHOST_OAM+0, gx,     96);
      move_sprite(GHOST_OAM+1, gx + 8, 96);
      move_sprite(GHOST_OAM+2, gx,     104);
      move_sprite(GHOST_OAM+3, gx + 8, 104);
    }
  }
}
