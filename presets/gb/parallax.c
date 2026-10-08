/*
Parallax scrolling with one background layer.

The Game Boy has one scrolling background (plus the non-scrolling-ish
Window), so there is no second "far" layer to scroll at a different
speed. Games fake one in two ways, and this demo does both:

1. Raster splits. The screen is cut into horizontal bands. An LY==LYC
   interrupt fires just before each band starts and rewrites SCX, so
   each band scrolls at its own speed: clouds at 1/8, mountains at 1/4,
   trees at 1/2, the ground at full speed.

2. Tile animation. The water band at the bottom never scrolls (SCX = 0
   there), but its one tile's pixels are rotated a bit each frame, so the
   whole band appears to move. This works anywhere -- even in the middle
   of a band scrolling at another speed -- because every copy of a tile
   on screen changes at once. The cost: the rotated tile can't be used
   anywhere else.

Chikyu Kaiho Gun ZAS (T&E Soft, 1992) and Shantae (WayForward, 2002) are
both known for parallax on this hardware; this demo shows the general
technique, not their code.
*/

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"

// ---------------------------------------------------------------------
// tiles: each row is two bytes, low bit-plane then high bit-plane

#define T_SKY    0
#define T_CLOUDL 1
#define T_CLOUD  2
#define T_CLOUDR 3
#define T_MTNL   4
#define T_MTNR   5
#define T_MTN    6
#define T_TREE   7
#define T_TRUNK  8
#define T_GRASS  9
#define T_DIRT   10
#define T_WATER  11

/*{w:8,h:8,bpp:1,count:12,brev:1,np:2,pofs:1,sl:2}*/
const uint8_t tiles[] = {
  // T_SKY: color 0
  0x00,0x00, 0x00,0x00, 0x00,0x00, 0x00,0x00, 0x00,0x00, 0x00,0x00, 0x00,0x00, 0x00,0x00,
  // T_CLOUDL
  0x00,0x00, 0x07,0x00, 0x1F,0x00, 0x3F,0x00, 0x7F,0x00, 0xFF,0x00, 0x7F,0x00, 0x00,0x00,
  // T_CLOUD
  0x3C,0x00, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00, 0x00,0x00,
  // T_CLOUDR
  0x00,0x00, 0xE0,0x00, 0xF8,0x00, 0xFC,0x00, 0xFE,0x00, 0xFF,0x00, 0xFE,0x00, 0x00,0x00,
  // T_MTNL: '/' edge, color 2 below
  0x00,0x01, 0x00,0x03, 0x00,0x07, 0x00,0x0F, 0x00,0x1F, 0x00,0x3F, 0x00,0x7F, 0x00,0xFF,
  // T_MTNR: '\' edge
  0x00,0x80, 0x00,0xC0, 0x00,0xE0, 0x00,0xF0, 0x00,0xF8, 0x00,0xFC, 0x00,0xFE, 0x00,0xFF,
  // T_MTN: solid color 2, a little snow-line texture
  0x00,0xFF, 0x00,0xFF, 0x22,0xFF, 0x00,0xFF, 0x00,0xFF, 0x88,0xFF, 0x00,0xFF, 0x00,0xFF,
  // T_TREE: round top, color 3
  0x3C,0x3C, 0x7E,0x7E, 0xFF,0xFF, 0xFF,0xFF, 0xFF,0xFF, 0xFF,0xFF, 0x7E,0x7E, 0x3C,0x3C,
  // T_TRUNK
  0x18,0x18, 0x18,0x18, 0x18,0x18, 0x18,0x18, 0x18,0x18, 0x18,0x18, 0x3C,0x3C, 0xFF,0xFF,
  // T_GRASS: color 1 with blades of color 3
  0x00,0x00, 0x44,0x44, 0xEE,0xEE, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00, 0xFF,0x00,
  // T_DIRT: color 2 with color 3 pebbles
  0x00,0xFF, 0x40,0xFF, 0x00,0xFF, 0x04,0xFF, 0x00,0xFF, 0x20,0xFF, 0x00,0xFF, 0x02,0xFF,
  // T_WATER: waves (animated by rotating each row's bits)
  0x00,0xFF, 0x00,0xFF, 0xC3,0x3C, 0xFF,0x00, 0x00,0xFF, 0x00,0xFF, 0x3C,0xC3, 0xFF,0x00,
};

// ---------------------------------------------------------------------
// the map: an 8-tile-wide pattern repeated across all 32 columns, so the
// 256-pixel background wraps seamlessly as SCX rolls over

const uint8_t pattern[18][8] = {
  { T_SKY,T_SKY,T_SKY,T_SKY,T_SKY,T_SKY,T_SKY,T_SKY },
  { T_SKY,T_CLOUDL,T_CLOUD,T_CLOUDR,T_SKY,T_SKY,T_SKY,T_SKY },
  { T_SKY,T_SKY,T_SKY,T_SKY,T_SKY,T_CLOUDL,T_CLOUDR,T_SKY },
  { T_SKY,T_SKY,T_SKY,T_SKY,T_SKY,T_SKY,T_SKY,T_SKY },
  { T_SKY,T_SKY,T_SKY,T_MTNL,T_MTNR,T_SKY,T_SKY,T_SKY },
  { T_SKY,T_SKY,T_MTNL,T_MTN,T_MTN,T_MTNR,T_SKY,T_SKY },
  { T_SKY,T_MTNL,T_MTN,T_MTN,T_MTN,T_MTN,T_MTNR,T_SKY },
  { T_MTNL,T_MTN,T_MTN,T_MTN,T_MTN,T_MTN,T_MTN,T_MTNR },
  { T_SKY,T_TREE,T_SKY,T_SKY,T_TREE,T_SKY,T_TREE,T_SKY },
  { T_SKY,T_TRUNK,T_SKY,T_SKY,T_TRUNK,T_SKY,T_TRUNK,T_SKY },
  { T_GRASS,T_GRASS,T_GRASS,T_GRASS,T_GRASS,T_GRASS,T_GRASS,T_GRASS },
  { T_DIRT,T_DIRT,T_DIRT,T_DIRT,T_DIRT,T_DIRT,T_DIRT,T_DIRT },
  { T_TREE,T_SKY,T_SKY,T_TREE,T_SKY,T_SKY,T_SKY,T_SKY },
  { T_TRUNK,T_SKY,T_SKY,T_TRUNK,T_SKY,T_SKY,T_SKY,T_SKY },
  { T_GRASS,T_GRASS,T_GRASS,T_GRASS,T_GRASS,T_GRASS,T_GRASS,T_GRASS },
  { T_DIRT,T_DIRT,T_DIRT,T_DIRT,T_DIRT,T_DIRT,T_DIRT,T_DIRT },
  { T_WATER,T_WATER,T_WATER,T_WATER,T_WATER,T_WATER,T_WATER,T_WATER },
  { T_WATER,T_WATER,T_WATER,T_WATER,T_WATER,T_WATER,T_WATER,T_WATER },
};

// ---------------------------------------------------------------------
// raster bands

#define NBANDS 5
// LYC value for each band: the line *before* the band starts, so the
// handler has time to wait for HBlank and write SCX before it's drawn
const uint8_t band_lyc[NBANDS] = { 0, 31, 63, 95, 127 };
uint8_t band_scx[NBANDS];      // SCX for each band, set by main()
volatile uint8_t band;         // band the raster is in

void vbl_isr(void) {
  // top of the frame: band 0 and arm the first split
  band = 0;
  SCX_REG = band_scx[0];
  LYC_REG = band_lyc[1];
}

void lcd_isr(void) {
  // we're at the start of the line before the next band; wait for
  // HBlank so the change doesn't land in the middle of a visible line
  while (STAT_REG & 3) ;
  band++;
  SCX_REG = band_scx[band];
  // arm the next split, or park LYC below the screen
  LYC_REG = (band < NBANDS-1) ? band_lyc[band+1] : 200;
}

void main(void) {
  uint8_t x, y, i;
  uint16_t pos = 0;
  uint8_t water[16];

  DISPLAY_OFF;
  BGP_REG = 0xE4;
  set_bkg_data(0, sizeof(tiles)/16, tiles);
  for (y = 0; y < 18; y++) {
    for (x = 0; x < 32; x += 8) {
      set_bkg_tiles(x, y, 8, 1, pattern[y]);
    }
  }
  for (i = 0; i < 16; i++) water[i] = tiles[T_WATER*16 + i];

  STAT_REG = STATF_LYC;
  LYC_REG = band_lyc[1];
  disable_interrupts();
  add_VBL(vbl_isr);
  add_LCD(lcd_isr);
  enable_interrupts();
  set_interrupts(VBL_IFLAG | LCD_IFLAG);
  SHOW_BKG;
  DISPLAY_ON;

  while (1) {
    wait_vbl_done();
    // 1. new scroll positions for next frame
    pos++;
    band_scx[0] = pos >> 3;   // clouds
    band_scx[1] = pos >> 2;   // mountains
    band_scx[2] = pos >> 1;   // far trees
    band_scx[3] = pos;        // near ground
    band_scx[4] = 0;          // water: fixed, animated below
    // 2. animate the water tile: rotate every row one pixel left
    //    (every other frame, so it moves at half speed)
    if (pos & 1) {
      for (i = 0; i < 16; i++) {
        uint8_t b = water[i];
        water[i] = (b << 1) | (b >> 7);
      }
      set_bkg_data(T_WATER, 1, water);
    }
  }
}
