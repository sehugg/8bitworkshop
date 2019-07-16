
/*
We demonstrate horizontal scrolling of two nametables.
Vertical mirroring is set, so nametables A and B are
to the left and right of each other.

New playfield data is randomly generated and updated
offscreen using the vrambuf module.
Every 32 pixels, we also update the attribute table.
We also use the split() function to create a status bar.
*/

#include "neslib.h"
#include <string.h>

// 0 = horizontal mirroring
// 1 = vertical mirroring
#define NES_MIRRORING 1

// VRAM update buffer
#include "vrambuf.h"
//#link "vrambuf.c"

// link the pattern table into CHR ROM
//#link "chr_generic.s"

// function to write a string into the name table
//   adr = start address in name table
//   str = pointer to string
void put_str(unsigned int adr, const char *str) {
  vram_adr(adr);        // set PPU read/write address
  vram_write(str, strlen(str)); // write bytes to PPU
}

word x_scroll;		// X scroll amount in pixels
byte bldg_height;	// building height in tiles
byte bldg_width;	// building width in tiles
byte bldg_char;		// character to draw
byte bldg_attr;		// attribute table value

#define PLAYROWS 24

// convert from nametable address to attribute table address
word nt2attraddr(word a) {
  return (a & 0x2c00) | 0x3c0 |
    ((a >> 4) & 0x38) | ((a >> 2) & 0x07);
}

// generate new random building data
void new_building() {
  bldg_height = (rand8() & 7) + 2;
  bldg_width = (rand8() & 3) * 4 + 4;
  bldg_char = (rand8() & 15);
  bldg_attr = rand8();
}

// update the nametable offscreen
// called every 8 horizontal pixels
void update_nametable() {
  register word addr;
  // a buffer drawn to the nametable vertically
  char buf[PLAYROWS];
  // divide x_scroll by 8
  // to get nametable X position
  byte x = (x_scroll/8 + 32) & 63;
  if (x < 32)
    addr = NTADR_A(x, 4);
  else
    addr = NTADR_B(x&31, 4);
  // clear empty space
  memset(buf, 0, sizeof(buf));
  // draw a random star
  buf[rand8() & 15] = '.';
  // draw roof
  buf[PLAYROWS-bldg_height-1] = bldg_char & 3;
  // draw rest of building
  memset(buf+PLAYROWS-bldg_height, bldg_char, bldg_height);
  // draw vertical slice in name table
  vrambuf_put(addr | VRAMBUF_VERT, buf, PLAYROWS);
  // every 4 columns, update attribute table
  if ((x & 3) == 1) {
    // compute attribute table address
    // of upper attribute block
    addr = nt2attraddr(addr) + 8*4;
    VRAMBUF_PUT(addr, bldg_attr, 0);
    // put lower attribute block
    addr += 8;
    VRAMBUF_PUT(addr, bldg_attr, 0);
    vrambuf_end();
  }
  // generate new building?
  if (--bldg_width == 0) {
    new_building();
  }
}

// function to scroll window up and down until end
void scroll_demo() {
  // make 1st building
  new_building();
  x_scroll = 0;
  // infinite loop
  while (1) {
    // update nametable every 8 pixels
    if ((x_scroll & 7) == 0) {
      update_nametable();
    }
    // ensure VRAM buffer is cleared
    ppu_wait_nmi();
    vrambuf_clear();
    // split at x_scroll
    split(x_scroll, 0);
    // increment x_scroll
    ++x_scroll;
  }
}

/*{pal:"nes",layout:"nes"}*/
const char PALETTE[32] = { 
  0x03,			// background color

  0x25,0x30,0x27,0x00,	// ladders and pickups
  0x1C,0x20,0x2C,0x00,	// floor blocks
  0x00,0x10,0x20,0x00,
  0x06,0x16,0x26,0x00,

  0x16,0x35,0x24,0x00,	// enemy sprites
  0x00,0x37,0x25,0x00,	// rescue person
  0x0D,0x2D,0x1A,0x00,
  0x0D,0x27,0x2A	// player sprites
};

// main function, run after console reset
void main(void) {
  // set palette colors
  pal_all(PALETTE);

  // write text to name table
  put_str(NTADR_A(7,0), "Nametable A, Line 0");
  put_str(NTADR_A(7,1), "Nametable A, Line 1");
  put_str(NTADR_A(7,2), "Nametable A, Line 2");
  vram_adr(NTADR_A(0,3));
  vram_fill(5, 32);
  put_str(NTADR_A(2,4), "Nametable A, Line 4");
  put_str(NTADR_A(2,15),"Nametable A, Line 15");
  put_str(NTADR_A(2,27),"Nametable A, Line 27");
  put_str(NTADR_B(2,4), "Nametable B, Line 4");
  put_str(NTADR_B(2,15),"Nametable B, Line 15");
  put_str(NTADR_B(2,27),"Nametable B, Line 27");
  
  // set attributes
  vram_adr(0x23c0);
  vram_fill(0x55, 8);
  
  // set sprite 0
  oam_clear();
  oam_spr(1, 30, 0xa0, 0, 0);
  
  // clear vram buffer
  vrambuf_clear();
  set_vram_update(updbuf);
  
  // enable PPU rendering (turn on screen)
  ppu_on_all();

  // scroll window back and forth
  scroll_demo();
}
