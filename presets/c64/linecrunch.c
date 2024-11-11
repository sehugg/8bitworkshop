
#include "common.h"
//#link "common.c"

#include "rasterirq.h"
//#link "rasterirq.s"

#include "bcd.h"
//#link "bcd.c"

extern const unsigned char sinustable[0x100];
//#link "sinustable.c"

///// VARIABLES

byte frame = 0;
byte scroll_y = 0;
byte target_line = 0;

///// FUNCTIONS

void line_crunch() {
  // load scroll y
  asm("lda %v", scroll_y);
  asm("and #7");
  asm("ora #$18");
  asm("tax");
  // get current raster line
  asm("lda $d012");
  // wait for next raster line
  asm("@loop:");
  asm("cmp $d012");
  asm("beq @loop");
  // set y scroll (ctrl1)
  asm("stx $d011");
}

void display_list(void) {
  
  // set initial YSCROLL
  VIC.ctrl1 = 0x18 | (scroll_y & 7);
  
  // do line crunch?
  if (scroll_y < 24) {
    // wait for target line
    target_line = 47 + (scroll_y & 7);
    while (VIC.rasterline != target_line) { }
    // increment YSCROLL
    scroll_y++;
    line_crunch();
    // do additional line crunches?
    if (scroll_y < 17) {
      scroll_y++;
      line_crunch();
      if (scroll_y < 10) {
        scroll_y++;
        line_crunch();
      }
    }
  }
  
  VIC.bgcolor[0] = COLOR_CYAN;
  VIC.bordercolor = COLOR_BLUE;
  
  DLIST_RESTART(40);
}

void main() {
  int i;
  
  clrscr();
  
  memset(COLOR_RAM, COLOR_BLUE, 1000);

  for (i=0; i<40*25; i++)
    POKE(0x400 + i, 205 + (rand() & 1));
  for (i=40*25; i<1024; i++)
    POKE(0x400 + i, i);
  for (i=0; i<1024; i+=40)
    POKE(0x400 + i, 122);

  SET_VIC_BITMAP(0x1000);

  DLIST_SETUP(display_list);
  
  // game loop, repeat forever
  while (1) {    
    // wait for end of frame
    waitvsync();

    // animate and set scroll_y
    frame += 4;
    scroll_y = sinustable[frame] >> 3;
  }
}
