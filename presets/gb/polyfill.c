/*
Filled, dithered polygons in a tile framebuffer, in the style of
Race Drivin' (Argonaut, 1993).

The same spinning cube as wireframe.c, but solid:

1. back-face culling: a face whose corners appear clockwise on screen is
   facing away, so it is skipped -- on a convex object that is all the
   hidden-surface removal we need
2. each visible face is scan-converted into a table of left/right X
   coordinates, one pair per pixel row
3. each row is filled a *byte* at a time: a masked partial byte at each
   end, and plain writes for the 8-pixel runs in between
4. shading: 4 gray levels plus checkerboard dithers between neighbors
   give 7 shades; the more a face points at the viewer, the lighter it is
*/

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "tilebuf.h"
#include "gb3d.h"

// the six faces, corners listed in the same winding order
const uint8_t faces[6][4] = {
  {0,1,2,3}, {5,4,7,6}, {4,0,3,7}, {1,5,6,2}, {4,5,1,0}, {3,2,6,7},
};

// ---------------------------------------------------------------------
// scan conversion

uint8_t xleft[TB_H], xright[TB_H];
uint8_t ytop, ybot;

// Walk one edge with an integer error term (no divide), recording the
// X at every row into both the left and right tables: the smaller X
// ends up in xleft[], the larger in xright[].
void edge(uint8_t x0, uint8_t y0, uint8_t x1, uint8_t y1) {
  uint8_t dx, dy, y, x;
  int8_t xdir;
  int16_t err;
  if (y0 > y1) {
    y = x0; x0 = x1; x1 = y;
    y = y0; y0 = y1; y1 = y;
  }
  if (y0 < ytop) ytop = y0;
  if (y1 > ybot) ybot = y1;
  dy = y1 - y0;
  if (x1 >= x0) { dx = x1 - x0; xdir = 1; }
  else          { dx = x0 - x1; xdir = -1; }
  x = x0;
  err = dy >> 1;
  for (y = y0; ; y++) {
    if (x < xleft[y]) xleft[y] = x;
    if (x > xright[y]) xright[y] = x;
    if (y == y1) break;
    // advance X until the error term says it's time for the next row
    err -= dx;
    while (err < 0) {
      err += dy;
      x += xdir;
      if (x < xleft[y]) xleft[y] = x;
      if (x > xright[y]) xright[y] = x;
    }
  }
}

void fill_face(const uint8_t* f, const Shade* s) {
  uint8_t y;
  ytop = TB_H - 1; ybot = 0;
  for (y = 0; y < TB_H; y++) { xleft[y] = 255; xright[y] = 0; }
  edge(sx[f[0]], sy[f[0]], sx[f[1]], sy[f[1]]);
  edge(sx[f[1]], sy[f[1]], sx[f[2]], sy[f[2]]);
  edge(sx[f[2]], sy[f[2]], sx[f[3]], sy[f[3]]);
  edge(sx[f[3]], sy[f[3]], sx[f[0]], sy[f[0]]);
  for (y = ytop; y <= ybot; y++) {
    span(y, xleft[y], xright[y], s);
  }
}

// Twice the signed screen area of triangle (a,b,c): positive when the
// corners run counter-clockwise, i.e. the face points toward us. Its
// size also says how squarely the face points at us, which makes a
// free light source "behind the camera".
int16_t facing(const uint8_t* f) {
  int16_t ax = sx[f[1]] - sx[f[0]], ay = sy[f[1]] - sy[f[0]];
  int16_t bx = sx[f[2]] - sx[f[0]], by = sy[f[2]] - sy[f[0]];
  return ax * by - ay * bx;
}

void main(void) {
  uint8_t ay = 0, ax = 0, i, y;
  DISPLAY_OFF;
  BGP_REG = 0xE4;
  gb3d_init();
  tb_init();
  DISPLAY_ON;
  while (1) {
    // ground: dithered lower half, like a road-racer horizon
    for (y = TB_H/2 + 20; y < TB_H; y++) span(y, 0, TB_W - 1, &shades[1]);
    transform(ay, ax);
    for (i = 0; i < 6; i++) {
      int16_t area = facing(faces[i]);
      if (area > 0) {
        // bigger area = facing us more squarely = lighter shade
        // (faces use shades 3..6 so they never match the ground's shade 1)
        int16_t d = area / 600;
        uint8_t shade = (d >= 3) ? 3 : 6 - d;
        fill_face(faces[i], &shades[shade]);
      }
    }
    tb_blit();
    ay += 3;
    ax += 2;
  }
}
