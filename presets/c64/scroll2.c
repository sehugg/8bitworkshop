
#include "common.h"
//#link "common.c"

#include <cbm_petscii_charmap.h>

#define BUFFER_0 0x400
#define BUFFER_1 0x3c00

byte scroll_x = 0;  // x scroll position
byte* scrnbuf[2];   // screen buffer(s)
byte visbuf;	    // which buffer is visible? 0 or 1

void scroll_one_pixel_left() {
  byte* src;
  byte* dst;
  // scroll left
  scroll_x--;
  // set scroll registers
  SET_SCROLL_X(scroll_x);
  // calculate frame pointers
  // source = visible buffer
  src = scrnbuf[visbuf] + (scroll_x & 7) * 128;
  // destination = hidden buffer
  dst = scrnbuf[visbuf ^ 1] + (scroll_x & 7) * 128;
  // wait for vsync
  waitvsync();
  // scroll hidden buffer
  memcpy(dst, src+1, 128);
  // every 8 pixels, switch visible and hidden buffers
  // and set VIC to point to other buffer
  if ((scroll_x & 7) == 0) {
    visbuf ^= 1;
    SET_VIC_SCREEN(visbuf ? BUFFER_1 : BUFFER_0);
  }
}

void main(void) {  
  clrscr();
  printf("\n\n\n                Hello Scrolling World!");
  printf("\n\n\n            We scroll in one direction");
  printf("\n\n\n           And now we have two buffers");
  printf("\n\n\n            And copy hidden -> visible");
  printf("\n\n\n         128 bytes (of 1024) per frame");

  VIC.ctrl1 = 0x10; // 24 lines
  VIC.ctrl2 = 0x00; // 38 columns
  VIC.bordercolor = COLOR_GRAY1;

  // get screen buffer addresses
  scrnbuf[0] = (byte*) BUFFER_0;
  scrnbuf[1] = (byte*) BUFFER_1;
  
  // infinite loop
  while (1) {
    scroll_one_pixel_left();
  }
}
