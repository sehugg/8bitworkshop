
#include <stdio.h>
#include <conio.h>
#include <c64.h>
#include <cbm_petscii_charmap.h>
#include <string.h>
#include <stdlib.h>

typedef unsigned char byte;
typedef unsigned short word;

void rasterWait(unsigned char line) {
  while (VIC.rasterline < line) ;
}

byte x = 0;	// x scroll position
byte y = 0;	// y scroll position
byte* scrnbuf;	// screen buffer

void main(void) {
  clrscr();
  printf("\r\n                           Hello World!");
  printf("\r\n\r\n                  This is how we scroll");
  printf("\r\n\r\n                     One line at a time");
  printf("\r\n\r\n                 But we don't have time");
  printf("\r\n\r\n                 To copy all the bytes ");
  VIC.ctrl1 = 0x10; // 24 lines
  VIC.ctrl2 = 0x00; // 38 columns
  
  // get screen buffer address
  scrnbuf = (byte*)((VIC.addr << 6) & 0x3c00);
  
  // infinite loop
  while (1) {
    x--;
    // set scroll registers
    VIC.ctrl1 = VIC.ctrl1 & 0xf8;
    VIC.ctrl1 |= (y & 7);
    VIC.ctrl2 = VIC.ctrl2 & 0xf8;
    VIC.ctrl2 |= (x & 7);
    // wait for vsync
    rasterWait(255);
    // every 8 pixels, move screen cells
    if ((x & 7) == 0) {
      memcpy(scrnbuf, scrnbuf+1, 40*8-1);
    }
  }
}
