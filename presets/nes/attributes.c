
#include "neslib.h"
#include <string.h>
#include <stdlib.h>

// link the pattern table into PRG ROM
// we'll write it into CHR RAM on startup

//#link "jroatch.c"
extern unsigned char jroatch_chr[0x1000];
#define PATTERN_TABLE jroatch_chr

// palette for balls, there are four sets for different ball colors
const unsigned char bg_palette[16]={/*{pal:"nes",n:4,sets:4}*/
  0x0f,0x17,0x27,0x37,
  0x0f,0x11,0x21,0x31,
  0x0f,0x15,0x25,0x35,
  0x0f,0x19,0x29,0x39
};

// convert nametable address to attribute address
unsigned int nt2attraddr(unsigned int a) {
  return (a & 0x2c00) | 0x3c0 | (a & 0x0C00) |
    ((a >> 4) & 0x38) | ((a >> 2) & 0x07);
}

#define ATTRADR_A(x,y)	 	(NAMETABLE_A|0x3c0|((((y)>>2)<<3)|((x)>>2)))

void put_pixel(unsigned char px, unsigned char py, char color) {
  int ntaddr, attraddr;
  char oldch, newch;
  char oldattr, newattr;
  // check bounds
  if (px >= 32*2 || py >= 30*2)
    return;
  // compute nametable address
  ntaddr = NTADR_A(px>>1, py>>1);
  // compute attribute address
  attraddr = nt2attraddr(ntaddr);
  //attraddr = ATTRADR_A(px>>1, py>>1);
  // compute new character mask
  newch = 0x80 | (px & 3) | ((py & 3) << 2);
  // compute new attribute mask
  newattr = color;
  if (px & 4) newattr <<= 2;
  if (py & 4) newattr <<= 4;
  // wait for vsync
  ppu_wait_frame();
  // read old character
  vram_adr(ntaddr);
  vram_read(&oldch, 1);
  vram_adr(attraddr);
  vram_read(&oldattr, 1);
  // write new character
  vram_adr(ntaddr);
  vram_put(oldch | newch);
  // write new attribute entry
  vram_adr(attraddr);
  vram_put(oldattr | newattr);
}

void color_demo(void) {
  while (1) {
    char x = rand() & 0x3f;
    char y = rand() & 0x3f;
    put_pixel(x, y, 2);
    // reset scroll position
    vram_adr(0);
  }
}

// draw letters
void color_demo1(void) {
  char ch;
  unsigned int ntaddr,attraddr;
  while (1) {
    ch = rand8();
    // use rand() for betterness
    ntaddr = 0x2000 | (rand() & 0x1ff);
    attraddr = nt2attraddr(ntaddr);
    ppu_wait_frame();
    // put character into attrib table
    vram_adr(attraddr);
    vram_put(0x55);
    // put character into name table
    vram_adr(ntaddr);
    vram_inc(rand8() & 1);
    vram_put(ch);
    vram_put(ch);
    // reset scroll position
    vram_adr(0);
  }
}

// main function, run after console reset
void main(void) {
  // copy pattern table to PRG RAM
  vram_adr(0x0);
  vram_write((unsigned char*)PATTERN_TABLE, sizeof(PATTERN_TABLE));

  // clear name tables
  vram_adr(0x2000);
  vram_fill(0, 0x800);

  // set palette colors
  pal_bg(bg_palette);

  // enable PPU rendering (turn on screen)
  ppu_on_all();

  // infinite loop
  color_demo();
}
