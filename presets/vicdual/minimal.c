
#include <string.h>

typedef unsigned char byte;
typedef unsigned short word;

__sfr __at (0x40) palette;

byte __at (0xe000) cellram[32][32];
byte __at (0xe800) tileram[256][8];

void main();

// start routine @ 0x0
void start() {
__asm
  	LD    SP,#0xE800 ; set up stack pointer
        DI		 ; disable interrupts
__endasm;
	main();
}

void main() {
  byte x,y;
  
  palette = 1;
  memset(tileram, 0xfe, sizeof(tileram));
  memset(cellram, 0, sizeof(tileram));
  for (y=0; y<32; y++) {
    for (x=0; x<32; x++) {
      cellram[x][y] = (y<<3);
    }
  }
  while (1) ;
}
