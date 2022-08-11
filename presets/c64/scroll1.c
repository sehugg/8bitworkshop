
#include "common.h"
//#link "common.c"

#include <cbm_petscii_charmap.h>

#define SCROLL_TOP 0
#define SCROLL_ROWS 10

byte scroll_x = 0;	// x scroll position

// return the next character on the right side
// for a given row
char get_char_for_row(byte row) {
  return '0' + row;
}

void draw_right_column() {
  // get the top-right corner address of scroll area
  word addr = SCRNADR(0x400, 39, SCROLL_TOP);
  byte row;
  // draw one character per row
  for (row=0; row<SCROLL_ROWS; row++) {
    POKE(addr, get_char_for_row(row));
    addr += 40;
  }
}

void scroll_one_column_left() {
  // copy several rows of screen memory
  // backwards one byte
  const word start = SCRNADR(0x400, 0, SCROLL_TOP);
  const word nbytes = SCROLL_ROWS*40-1;
  memcpy((byte*)start, (byte*)start+1, nbytes);
  // draw the right column of characters
  draw_right_column();
}

void scroll_one_pixel_left() {
  // scroll left one pixel
  scroll_x -= 1;
  // set scroll register with lower three bits
  VIC.ctrl2 = (VIC.ctrl2 & ~0b111) | (scroll_x & 0b111);
  // move screen memory if the scroll register
  // has just gone past 0 and wrapped to 7
  if ((scroll_x & 0b111) == 0b111) {
    scroll_one_column_left();
  }
}

void main(void) {
  clrscr();
  printf("\n                 Hello Scrolling World!");
  printf("\n\n             We change scroll registers");
  printf("\n\n                 And move screen memory");
  printf("\n\n                 But we don't have time");
  printf("\n\n                 To copy all 25 rows ");
  printf("\n\n                 In a single frame ");
  
  VIC.ctrl1 = 0x10; // 24 lines
  VIC.ctrl2 = 0x00; // 38 columns
  VIC.bordercolor = COLOR_GRAY1;
  
  // infinite loop
  while (1) {
    // wait for vsync
    waitvsync();
    // scroll one pixel to the left
    // and move screen memory every 8 pixels
    scroll_one_pixel_left();
  }
}
