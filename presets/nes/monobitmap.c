
/*
Creates a monochrome frame buffer in video RAM.
We map the pattern tables to CHR RAM, using the UxROM (2) mapper.
By cleverly setting up palettes, and using a split-screen
CHR bank switch, we split the screen into four different regions
that display their own pixels.
*/

#include "neslib.h"
#include "nes.h"
#include <stdlib.h>

#define NES_MAPPER 2		// UxROM mapper
#define NES_CHR_BANKS 0		// CHR RAM

bool ppu_is_on = false;

// simple 6502 delay loop (5 cycles per loop)
#define DELAYLOOP(n) \
  __asm__("ldy #%b", n); \
  __asm__("@1: dey"); \
  __asm__("bne @1");

// call every frame to split screen
void monobitmap_split() {
  // split screen at line 128
  split(0,0);
  DELAYLOOP(15); // delay until end of line
  PPU.control = PPU.control ^ 0x10; // bg bank 1
}

// set a pixel at (x,y) color 1=set, 0=clear
void monobitmap_set_pixel(byte x, byte y, byte color) {
  byte b;
  // compute pattern table address
  word a = (x/8)*16 | ((y&63)/8)*(16*32) | (y&7);
  if (y & 64) a |= 8;
  if (y & 128) a |= 0x1000;
  // if PPU is active, wait for next frame
  if (ppu_is_on) {
    ppu_wait_nmi();
  }
  // read old byte
  vram_adr(a);
  vram_read(&b, 1);
  if (color) {
    b |= 128 >> (x&7); // set pixel
  } else {
    b &= ~(128 >> (x&7)); // clear pixel
  }
  // write new byte
  vram_adr(a);
  vram_put(b);
  // if PPU is active, reset PPU addr and split screen
  if (ppu_is_on) {
    vram_adr(0);
    monobitmap_split();
  }
}

// draw a line from (x0,y0) to (x1,y1)
void monobitmap_draw_line(int x0, int y0, int x1, int y1, byte color) {
  int dx = abs(x1-x0);
  int sx = x0<x1 ? 1 : -1;
  int dy = abs(y1-y0);
  int sy = y0<y1 ? 1 : -1;
  int err = (dx>dy ? dx : -dy)>>1;
  int e2;
  for(;;) {
    monobitmap_set_pixel(x0, y0, color);
    if (x0==x1 && y0==y1) break;
    e2 = err;
    if (e2 > -dx) { err -= dy; x0 += sx; }
    if (e2 < dy) { err += dx; y0 += sy; }
  }
}

// write values 0..255 to nametable
void monobitmap_put_256inc() {
  word i;
  for (i=0; i<256; i++)
    vram_put(i);
}

// sets up attribute table
void monobitmap_put_attrib() {
  vram_fill(0x00, 0x10); // first palette
  vram_fill(0x55, 0x10); // second palette
}

// clears pattern table
void monobitmap_clear() {
  vram_adr(0x0);
  vram_fill(0x0, 0x2000);
}

// sets up PPU for monochrome bitmap
void monobitmap_setup() {
  monobitmap_clear();
  // setup nametable A and B
  vram_adr(NAMETABLE_A);
  monobitmap_put_256inc();
  monobitmap_put_256inc();
  monobitmap_put_256inc();
  monobitmap_put_256inc();
  vram_adr(NAMETABLE_A + 0x3c0);
  monobitmap_put_attrib();
  monobitmap_put_attrib();
  bank_bg(0);
  // setup sprite 0
  bank_spr(1);
  oam_clear();
  oam_size(0);
  oam_spr(247, 125, 255, 0, 0);
  // draw a pixel for it to collide with
  monobitmap_set_pixel(247, 126, 1);
  // make sprite 255 = white line
  vram_adr(0x1ff0);
  vram_fill(0xff, 0x1);
}

/*{pal:"nes",layout:"nes"}*/
const byte MONOBMP_PALETTE[16] = {
  0x03,
  0x30, 0x03, 0x30,  0x00,
  0x03, 0x30, 0x30,  0x00,
  0x30, 0x03, 0x30,  0x00,
  0x03, 0x30, 0x30
};

// demo function, draws a bunch of lines
void monobitmap_demo() {
  byte i;
  static const byte x1 = 16;
  static const byte y1 = 16;
  static const byte x2 = 240;
  static const byte y2 = 208;
  for (i=x1; i<=x2; i++) {
    monobitmap_set_pixel(i,y1,1);
    monobitmap_set_pixel(i,y2,1);
  }
  for (i=y1; i<=y2; i++) {
    monobitmap_set_pixel(x1,i,1);
    monobitmap_set_pixel(x2,i,1);
  }
  for (i=x1; i<x2; i+=16) {
    monobitmap_draw_line(x1,y1,i,y2,1);
  }
  for (i=y1; i<=y2; i+=16) {
    monobitmap_draw_line(x1,y1,x2,i,1);
  }
}

void main(void)
{
  // setup and draw some lines
  monobitmap_setup();
  pal_bg(MONOBMP_PALETTE);
  monobitmap_demo();
  ppu_on_all();
  // wait for key press
  while (!pad_trigger(0)) {
    ppu_wait_nmi();
    monobitmap_split();
  }
  // set up again
  ppu_off();
  monobitmap_setup();
  ppu_on_all();
  // realtime display where 1 pixel per frame
  ppu_is_on = true;
  monobitmap_demo();
  while(1) {
    ppu_wait_nmi();
    monobitmap_split();
  }
}
