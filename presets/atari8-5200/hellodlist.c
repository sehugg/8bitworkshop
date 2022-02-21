/*
This example demonstrates setting up a ANTIC display list in C.
We have two lines of text on the top, two lines on the bottom,
and a bitmap in the middle.
*/
#include <peekpoke.h>  
#include <atari5200.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// shadow registers for the 5200
#define POKMSK (*(unsigned char*)0x00) // Mask for Pokey IRQ enable
#define RTCLOK (*(unsigned char*)0x01) // 60 hz. clock
#define CRITIC (*(unsigned char*)0x03) // critical section
#define ATRACT (*(unsigned char*)0x04) // attract mode
#define SDLIST (*(unsigned int*) 0x05) // Display list start shadow
#define SDMCTL (*(unsigned char*)0x07) // Antic DMA control shadow
#define PCOLOR ((unsigned char[4])0x08) // COLPM[0-3] shadow
#define COLORS ((unsigned char[5])0x0c) // COLOR[0-4] shadow
#define PADDLS ((unsigned char[8])0x11) // POT[0-7] shadow

// screen RAM structure definition
typedef struct ScreenMemoryDef {
  char topStatusLine[2][40];
  char bottomStatusLine[4][40];
  char bitmap[80][40];
} ScreenMemoryDef;

// screen RAM variable
ScreenMemoryDef screen;

// display list definition
const void displayList = {
    DL_BLK8, // 8 blank scanlines
    DL_BLK8, // 8 blank scanlines
    // top status line (2 lines)
    DL_LMS(DL_CHR40x8x1), //Load Memory Scan (next two bytes must be the LSB/MSB of the data to load)
    screen.topStatusLine, // address of frame buffer
    DL_CHR40x10x1, // second line of text
    // 80x2 lines of 160x2x4 bitmap
    DL_LMS(DL_MAP160x2x4), // first line of bitmap
    screen.bitmap, // bitmap address
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4, DL_MAP160x2x4,
    // bottom status line (4 lines)
    DL_LMS(DL_CHR40x8x1), //Load Memory Scan (next two bytes must be the LSB/MSB of the data to load)
    screen.bottomStatusLine,
    DL_CHR40x8x1, DL_CHR40x8x1, DL_CHR40x8x1, // next 3 lines of text
    // wait for vertical blank
    DL_JVB,
    // restart display list
    DL_JMP,
    &displayList
};

void main(void) {
  unsigned int i;
 
  SDMCTL = 0;                           // turn off ANTIC
  SDLIST = (unsigned int) &displayList; // set display list
  SDMCTL = 0x22;                        // turn on ANTIC
  
  // set screen memory
  for(i=0; i<40; ++i) {
    screen.topStatusLine[0][i] = i;
    screen.topStatusLine[1][i] = i>>1;
    screen.bottomStatusLine[0][i] = i;
    screen.bottomStatusLine[1][i] = i>>1;
    screen.bottomStatusLine[2][i] = i<<1;
    screen.bottomStatusLine[3][i] = i<<2;
  }
  memset(screen.bitmap, 0x13, sizeof(screen.bitmap));
  // infinite loop 
  while(1) {
  }
}
