
// this example code unpacks a RLE'd nametable into the VRAM
// you can create the source data using NES Screen Tool

#include "neslib.h"

extern const byte climbr_title_pal[16];
extern const byte climbr_title_rle[];

// link the pattern table into CHR ROM
//#link "chr_generic.s"

// link title screen palette and RLE nametable
//#link "climbr_title.s"


void fade_in() {
  byte vb;
  for (vb=0; vb<=4; vb++) {
    // set virtual bright vaule
    pal_bright(vb);
    // wait for 4/60 sec
    ppu_wait_frame();
    ppu_wait_frame();
    ppu_wait_frame();
    ppu_wait_frame();
  }
}

void show_title_screen(const byte* pal, const byte* rle) {
  // disable rendering
  ppu_off();
  // set palette, virtual bright to 0 (total black)
  pal_bg(pal);
  pal_bright(0);
  // unpack nametable into the VRAM
  vram_adr(0x2000);
  vram_unrle(rle);
  // enable rendering
  ppu_on_all();
  // fade in from black
  fade_in();
}

void main(void)
{
  show_title_screen(climbr_title_pal, climbr_title_rle);
  while(1);//do nothing, infinite loop
}
 