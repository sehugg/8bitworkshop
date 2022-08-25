
#include "common.h"
//#link "common.c"

#include "mcbitmap.h"

void setup_bitmap_multi() {
  VIC.ctrl1 = 0x38;
  VIC.ctrl2 = 0x18;
  SET_VIC_BANK(MCB_BITMAP);
  SET_VIC_BITMAP(MCB_BITMAP);
  SET_VIC_SCREEN(MCB_COLORS);
  memset((void*)MCB_BITMAP, 0, 0x2000);
  memset((void*)MCB_COLORS, 0, 0x800);
  memset(COLOR_RAM, 0, 40*25);
}

const byte PIXMASK[4] = { ~0xc0, ~0x30, ~0x0c, ~0x03 };
const byte PIXSHIFT[4] = { 6, 4, 2, 0 };

byte is_pixel(byte x, byte y) {
  word ofs = ((x>>2)*8 + (y>>3)*320) | (y&7) | MCB_BITMAP;
  byte pixvalue;
  ENABLE_HIMEM();
  pixvalue = PEEK(ofs);
  DISABLE_HIMEM();
  return pixvalue & ~PIXMASK[x & 3];;
}

void set_pixel(byte x, byte y, byte color) {
  word ofs,b,cram,sram;
  byte ccol,scol,used;
  byte val;
  
  if (x >= 160 || y >= 192) return;

  color &= 0xf;
  // equal to background color? (value 0)
  if (color == VIC.bgcolor0) {
    val = 0;
  } else {
    // calculate character (and color RAM) offset
    cram = ((x>>2) + (y>>3)*40);
    sram = cram | MCB_COLORS;
    cram |= 0xd800;
    // read color ram, screen memory, and used bits
    ENABLE_HIMEM();
    ccol = PEEK(cram);
    scol = PEEK(sram);
    used = PEEK(sram | 0x400);
    DISABLE_HIMEM();
    // unused in lower nibble of screen RAM? (value 2)
    if (color == (scol & 0xf) || !(used & 0x10)) {
      val = 2;
      scol = (scol & 0xf0) | color;
      used |= 0x10;
      POKE(sram, scol);
    // unused in upper nibble of screen RAM? (value 1)
    } else if (color == (scol >> 4) || !(used & 0x20)) {
      val = 1;
      scol = (scol & 0xf) | (color << 4);
      used |= 0x20;
      POKE(sram, scol);
    // all other colors in use, use color RAM
    } else {
      val = 3;
      used |= 0x40;
      ccol = color;
      POKE(cram, ccol);
    }
    // write to unused bit
    POKE(sram | 0x400, used);
  }
  
  ofs = ((x>>2)*8 + (y>>3)*320) | (y&7) | MCB_BITMAP;
  x &= 3;
  ENABLE_HIMEM();
  b = PEEK(ofs) & PIXMASK[x];
  DISABLE_HIMEM();
  if (val) {
    b |= val << PIXSHIFT[x];
  }
  POKE(ofs, b);
}

void draw_line(int x0, int y0, int x1, int y1, byte color) {
  int dx = abs(x1-x0);
  int sx = x0<x1 ? 1 : -1;
  int dy = abs(y1-y0);
  int sy = y0<y1 ? 1 : -1;
  int err = (dx>dy ? dx : -dy)>>1;
  int e2;
  for(;;) {
    set_pixel(x0, y0, color);
    if (x0==x1 && y0==y1) break;
    e2 = err;
    if (e2 > -dx) { err -= dy; x0 += sx; }
    if (e2 < dy) { err += dx; y0 += sy; }
  }
}

// support recursion
#pragma static-locals(push,off)
byte flood_fill(byte x, byte y, byte color) {
  register byte x1 = x;
  register byte x2;
  register byte i;
  // find left edge
  while (!is_pixel(x1, y))
    --x1;
  // exit if (x,y) is on a boundary
  if (x1 == x)
    return 1;
  ++x1;
  // find right edge
  x2 = x+1;
  while (!is_pixel(x2, y))
    ++x2;
  // fill scanline  
  for (i=x1; i<x2; i++) {
    set_pixel(i, y, color);
  }
  // fill above and below scanline
  for (i=x1; i<x2; ) {
    i += flood_fill(i, y-1, color);
  }
  for (i=x1; i<x2; ) {
    i += flood_fill(i, y+1, color);
  }
  return (x2-x1);
}
#pragma static-locals(pop)

#ifdef __MAIN__

word urand() {
  return rand();
}

void main() {
  setup_bitmap_multi();
  draw_line(80, 10, 100, 100, 1);
  draw_line(80, 10, 40, 80, 1);
  draw_line(100, 100, 40, 80, 1);
  draw_line(50, 0, 80, 60, 1);
  draw_line(100, 0, 80, 60, 1);
  flood_fill(80, 80, 2);
  while(1) {
    draw_line(urand()%160, urand()%192, urand()%160, urand()%192, rand()&15);
  }
}

#endif
