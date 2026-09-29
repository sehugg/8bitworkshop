/*
Wireframe 3D in a tile framebuffer, in the style of X (Argonaut, 1992).

A cube spins in the 144x112 viewport from tilebuf.h. Each frame:

1. rotate the 8 corners around two axes -- 8-bit fixed point, using a
   quarter-square table because the SM83 has no multiply instruction
2. project them with a reciprocal table instead of dividing by Z
3. draw the 12 edges with Bresenham's line algorithm, stepping a VRAM-style
   pointer and bit mask instead of recomputing each pixel's address
4. tb_blit() copies the finished picture to VRAM (and clears the buffer)
*/

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "tilebuf.h"
#include "gb3d.h"

// Bresenham's line, walking a framebuffer pointer and a bit mask.
// Moving right one pixel = shift the mask; every 8 pixels, step 16 bytes
// to the next tile. Moving down one pixel = 2 bytes, except every 8 rows,
// where we jump to the next row of tiles.
void line(uint8_t x0, uint8_t y0, uint8_t x1, uint8_t y1) {
  uint8_t *p;
  uint8_t mask, dx, dy, n, y;
  int16_t err;
  int8_t xdir;
  if (y0 > y1) { // always draw downward
    n = x0; x0 = x1; x1 = n;
    n = y0; y0 = y1; y1 = n;
  }
  dy = y1 - y0;
  if (x1 >= x0) { dx = x1 - x0; xdir = 1; }
  else          { dx = x0 - x1; xdir = -1; }
  p = tb_rowaddr[y0] + ((x0 & 0xf8) << 1);
  mask = tb_bit[x0 & 7];
  y = y0;
  if (dx >= dy) {                 // mostly horizontal
    err = dx >> 1;
    for (n = dx + 1; n; n--) {
      p[0] |= mask; p[1] |= mask; // color 3
      if (xdir > 0) {
        mask >>= 1;
        if (!mask) { mask = 0x80; p += 16; }
      } else {
        mask <<= 1;
        if (!mask) { mask = 0x01; p -= 16; }
      }
      err -= dy;
      if (err < 0) {
        err += dx;
        p += ((++y & 7) == 0) ? (TB_ROWBYTES - 14) : 2;
      }
    }
  } else {                        // mostly vertical
    err = dy >> 1;
    for (n = dy + 1; n; n--) {
      p[0] |= mask; p[1] |= mask;
      p += ((++y & 7) == 0) ? (TB_ROWBYTES - 14) : 2;
      err -= dx;
      if (err < 0) {
        err += dy;
        if (xdir > 0) {
          mask >>= 1;
          if (!mask) { mask = 0x80; p += 16; }
        } else {
          mask <<= 1;
          if (!mask) { mask = 0x01; p -= 16; }
        }
      }
    }
  }
}

void main(void) {
  uint8_t ay = 0, ax = 0, i;
  DISPLAY_OFF;
  BGP_REG = 0xE4;
  gb3d_init();
  tb_init();
  DISPLAY_ON;
  while (1) {
    transform(ay, ax);
    for (i = 0; i < 12; i++) {
      uint8_t a = edges[i][0], b = edges[i][1];
      line(sx[a], sy[a], sx[b], sy[b]);
    }
    tb_blit();   // ~3.5 frames: copy to VRAM and clear the buffer
    ay += 3;
    ax += 2;
  }
}
