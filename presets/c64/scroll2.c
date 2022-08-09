
#include "common.h"
//#link "common.c"

byte x = 0;	// x scroll position
byte y = 0;	// y scroll position
byte* scrnbuf[2];	// screen buffer(s)
byte frame = 0;

void main(void) {
  byte* src;
  byte* dst;
  
  clrscr();
  printf("\r\n\r\n\r\n                           Hello World!");
  printf("\r\n\r\n\r\n                  This is how we scroll");
  printf("\r\n\r\n\r\n                     One line at a time");
  printf("\r\n\r\n\r\n           And now we have two buffers");
  printf("\r\n\r\n\r\n                 To copy all the bytes ");
  VIC.ctrl1 = 0x10; // 24 lines
  VIC.ctrl2 = 0x00; // 38 columns
  
  // get screen buffer addresses
  scrnbuf[0] = (byte*) 0x400;
  scrnbuf[1] = (byte*) 0x3c00;
  memcpy(scrnbuf[1], scrnbuf[0], 24*40);
  
  // infinite loop
  while (1) {
    // scroll left
    x--;
    // set scroll registers
    VIC.ctrl1 = VIC.ctrl1 & 0xf8;
    VIC.ctrl1 |= (y & 7);
    VIC.ctrl2 = VIC.ctrl2 & 0xf8;
    VIC.ctrl2 |= (x & 7);
    // calculate frame pointers
    src = scrnbuf[frame&1] + (x&7)*128;
    dst = scrnbuf[frame&1^1] + (x&7)*128;
    // wait for vsync
    waitvsync();
    // scroll hidden buffer
    memcpy(dst, src+1, 128);
    // every 8 pixels, switch farmes
    if ((x & 7) == 0) {
      VIC.addr = (VIC.addr & 0xf) | ((frame & 1) ? 0x10 : 0xf0);
      frame++;
    }
  }
}
