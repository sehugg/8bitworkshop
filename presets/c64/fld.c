
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
byte target_y;

byte fld_offsets[25];

///// FUNCTIONS

void line_crunch() {
  // load scroll y
  asm("lda %v", target_y);
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

static byte target_line = 0;
static byte row;
static byte offset;

void display_list(void) {
  
  VIC.bgcolor[0] = COLOR_CYAN;
  VIC.bordercolor = COLOR_BLUE;
  
  // set initial YSCROLL
  SET_SCROLL_Y(fld_offsets[0]);
  
  // set first target scanline
  target_line = 48 + (fld_offsets[0] & 7);
  
  // each row has its own FLD gap
  for (row=1; row<25; row++) {
    // get this row's gap distance
    offset = fld_offsets[row];
    // fire IRQ 3 lines before target
    target_y = target_line - 3;
    DLIST_NEXT(target_y);
    // change Y scroll to avoid badline
    line_crunch();
    // set Y scroll for new badline
    target_y = target_line + offset;
    line_crunch();
    // set target line for next IRQ
    target_line += 8 + offset;
    VIC.bgcolor[0] = row;
    // exit loop if integer overflow
    if (target_line < 48) break;
  }
    
  DLIST_RESTART(30);
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

    // set FLD offsets via sinus table
    for (i=0; i<25; i++) {
      fld_offsets[i] = sinustable[frame + i*8] >> 5;
    }
  }
}
