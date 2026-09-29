/*
A grid raycaster in a tile framebuffer, in the spirit of Faceball 2000
(Xanth Software F/X, 1991) and Wolfenstein 3D.

The world is a 16x16 grid of cells. For each 4-pixel-wide column of the
144x112 viewport we cast one ray from the player through the grid, one
cell boundary at a time (the "DDA" walk), until it hits a wall. The
distance to the wall sets the height of that column's wall slice.

Why this suits the Game Boy:
- only 36 rays per frame, and each ray visits a few cells
- walls are vertical spans centered on the horizon, so every pixel is
  written exactly once -- no sorting, no overdraw, no buffer clear needed
- flat shading: walls facing east/west get one shade, north/south
  another -- the same cheap trick Faceball and Wolfenstein use

Controls: left/right to turn, up/down to move. With no input, the
player slowly turns in place.
*/

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "tilebuf.h"
#include "gb3d.h"

#define NCOLS (TB_W/4)   // 36 rays, 4 pixels wide each

const uint8_t map[16][16] = {
  {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
  {1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1},
  {1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1},
  {1,0,0,1,1,0,0,0,0,0,1,1,0,0,0,1},
  {1,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1},
  {1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1},
  {1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1},
  {1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1},
  {1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1},
  {1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1},
  {1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1},
  {1,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1},
  {1,0,0,1,1,0,0,0,0,0,1,1,0,0,0,1},
  {1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1},
  {1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1},
  {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
};

// player position in 8.8 fixed point (high byte = map cell)
uint16_t px = 0x0880, py = 0x0880;
uint8_t pa = 0;   // facing angle, 256 = full turn

// camera-plane offset for each column, -80..+80 (a ~64 degree view)
int8_t camx[NCOLS];

// inv[r] = 32512 / r: the distance along a ray between two grid lines,
// in 8.8 cells, for a ray whose X (or Y) component is r/127
uint16_t inv[256];

// wall half-height for each distance: htab[d >> 3] = (TB_H/2) / d,
// with d in 8.8 cells -- a table instead of a divide per column
uint8_t htab[512];

// wall slice for each column, computed by cast()
uint8_t wall_h[NCOLS];     // half-height, 0..TB_H/2
uint8_t wall_side[NCOLS];  // 0 = east/west face, 1 = north/south face

// distance to the first grid line = fraction of a cell * ddx.
// ddx is 8.8 and frac is 0..256, so pre-shift both to stay in 16 bits.
uint16_t first_side(uint16_t frac, uint16_t dd) {
  if (dd >= 0x1000) return (dd >> 8) * frac;   // long step: coarser, no overflow
  return ((dd >> 4) * frac) >> 4;
}

void cast(void) {
  int8_t dirx = sin_tab[(uint8_t)(pa + 64)];   // cos(pa)
  int8_t diry = sin_tab[pa];                   // sin(pa)
  uint8_t col;
  for (col = 0; col < NCOLS; col++) {
    // ray direction = view direction + camera plane * camx
    int16_t rx = dirx - (mul8(diry, camx[col]) >> 7);
    int16_t ry = diry + (mul8(dirx, camx[col]) >> 7);
    uint8_t mx = px >> 8, my = py >> 8;
    uint8_t arx = rx < 0 ? -rx : rx, ary = ry < 0 ? -ry : ry;
    uint16_t ddx = arx ? inv[arx] : 0xffff;
    uint16_t ddy = ary ? inv[ary] : 0xffff;
    uint16_t sdx, sdy, dist;
    int8_t stepx, stepy;
    uint8_t side;
    // distance to the first vertical and horizontal grid lines
    if (rx < 0) { stepx = -1; sdx = first_side(px & 0xff, ddx); }
    else        { stepx =  1; sdx = first_side(256 - (px & 0xff), ddx); }
    if (ry < 0) { stepy = -1; sdy = first_side(py & 0xff, ddy); }
    else        { stepy =  1; sdy = first_side(256 - (py & 0xff), ddy); }
    // DDA: step to whichever grid line is nearer, until we hit a wall
    while (1) {
      if (sdx < sdy) { sdx += ddx; mx += stepx; side = 0; }
      else           { sdy += ddy; my += stepy; side = 1; }
      if (map[my][mx]) break;
    }
    // perpendicular distance (no fish-eye) in 8.8 cells
    dist = side ? sdy - ddy : sdx - ddx;
    dist >>= 3;
    wall_h[col] = dist < 512 ? htab[dist] : 0;
    wall_side[col] = side;
  }
}

// ---------------------------------------------------------------------
// drawing
//
// Two 4-pixel columns share each byte, so drawing one column at a time
// means a read-modify-write for every row -- far too slow in C. Instead
// we draw columns in *pairs*, top to bottom, writing whole bytes. Because
// walls are centered on the horizon, each pair splits into at most five
// bands where the byte pattern doesn't change:
//
//   ceiling | taller wall + ceiling | both walls | taller wall + floor | floor
//
// so we compute one pattern per band and blast it down the rows.

uint8_t *g_p;     // current framebuffer byte
uint8_t g_y;      // current row
uint8_t g_n;      // rows to fill
uint8_t ple, phe, plo, pho;  // pattern: even-row lo/hi, odd-row lo/hi

// Write g_n rows of the current pattern, starting at g_p / row g_y.
//
// This is the innermost loop of the renderer (18 pairs x 112 rows =
// 2016 rows per frame), so it's in assembly: about 30 M-cycles per row,
// versus about 120 for the same loop compiled from C.
void fill_rows(void) __naked {
__asm
    ld  a, (_g_n)
    or  a, a
    ret z
    ld  b, a                 ; B = row count
    ld  a, (_g_p)
    ld  l, a
    ld  a, (_g_p+1)
    ld  h, a                 ; HL = framebuffer pointer
    ld  a, (_g_y)
    ld  c, a                 ; C = row number
    ld  a, (_ple)
    ld  d, a
    ld  a, (_phe)
    ld  e, a                 ; DE = even-row pattern
1$:
    bit 0, c
    jr  nz, 2$
    ld  a, d                 ; even row
    ld  (hl+), a
    ld  a, e
    ld  (hl+), a
    jr  3$
2$:
    ld  a, (_plo)            ; odd row
    ld  (hl+), a
    ld  a, (_pho)
    ld  (hl+), a
3$:
    ld  a, c
    inc c
    and a, #7
    cp  a, #7
    jr  nz, 4$
    ; last row of a tile: skip to the next row of tiles
    ; (+288 bytes per tile row, minus the 16 we walked through)
    ld  a, l
    add a, #<(288-16)
    ld  l, a
    ld  a, h
    adc a, #>(288-16)
    ld  h, a
4$:
    dec b
    jr  nz, 1$
    ld  a, l
    ld  (_g_p), a
    ld  a, h
    ld  (_g_p+1), a
    ld  a, c
    ld  (_g_y), a
    ret
__endasm;
}

#define CEIL 0      // shades[] index for ceiling
#define FLOOR 1     // shades[] index for floor
#define WALL_EW 6   // east/west walls
#define WALL_NS 4   // north/south walls

// pattern bytes for a left/right nibble pair of two shades
void pair_pattern(uint8_t sl, uint8_t sr) {
  const Shade* a = &shades[sl];
  const Shade* b = &shades[sr];
  ple = (a->lo0 & 0xf0) | (b->lo0 & 0x0f);
  phe = (a->hi0 & 0xf0) | (b->hi0 & 0x0f);
  plo = (a->lo1 & 0xf0) | (b->lo1 & 0x0f);
  pho = (a->hi1 & 0xf0) | (b->hi1 & 0x0f);
}

void draw_pair(uint8_t pair) {
  uint8_t c = pair << 1;
  uint8_t hl = wall_h[c], hr = wall_h[c+1];
  uint8_t wl = wall_side[c] ? WALL_NS : WALL_EW;
  uint8_t wr = wall_side[c+1] ? WALL_NS : WALL_EW;
  uint8_t hs = hl < hr ? hl : hr;        // shorter wall
  uint8_t ht = hl < hr ? hr : hl;        // taller wall
  g_p = tb_buf + (pair << 4);
  g_y = 0;
  // 1. ceiling over both
  pair_pattern(CEIL, CEIL);
  g_n = TB_H/2 - ht; fill_rows();
  // 2. taller wall beside ceiling
  if (hl > hr) pair_pattern(wl, CEIL); else pair_pattern(CEIL, wr);
  g_n = ht - hs; fill_rows();
  // 3. both walls, across the horizon
  pair_pattern(wl, wr);
  g_n = hs * 2; fill_rows();
  // 4. taller wall beside floor
  if (hl > hr) pair_pattern(wl, FLOOR); else pair_pattern(FLOOR, wr);
  g_n = ht - hs; fill_rows();
  // 5. floor under both
  pair_pattern(FLOOR, FLOOR);
  g_n = TB_H/2 - ht; fill_rows();
}

void render(void) {
  uint8_t pair;
  for (pair = 0; pair < NCOLS/2; pair++) draw_pair(pair);
}

void move(int8_t speed) {
  // move along the facing direction, if the destination cell is open
  uint16_t nx = px + (((int16_t)sin_tab[(uint8_t)(pa + 64)] * speed) >> 5);
  uint16_t ny = py + (((int16_t)sin_tab[pa] * speed) >> 5);
  if (!map[ny >> 8][nx >> 8]) { px = nx; py = ny; }
}

void main(void) {
  uint8_t i;
  uint16_t d;
  DISPLAY_OFF;
  BGP_REG = 0xE4;
  for (i = 1; i != 0; i++) inv[i] = 32512U / i;
  for (d = 0; d < 512; d++) {
    uint16_t h = d ? (TB_H/2 * 32U) / d : 255;  // (TB_H/2) / (d*8/256)
    htab[d] = h > TB_H/2 ? TB_H/2 : h;
  }
  for (i = 0; i < NCOLS; i++) camx[i] = (int8_t)(((int16_t)i * 160) / (NCOLS - 1) - 80);
  tb_init();
  DISPLAY_ON;
  while (1) {
    uint8_t j = joypad();
    if (j & J_LEFT) pa -= 4;
    else if (j & J_RIGHT) pa += 4;
    else if (!j) pa += 2;
    if (j & J_UP) move(4);
    if (j & J_DOWN) move(-4);
    cast();
    render();
    tb_blit();
  }
}
