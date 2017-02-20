#include <string.h>

typedef unsigned char byte;
typedef unsigned short word;

__sfr __at (0x40) palette;

byte __at (0xe000) cellram[32][32];
byte __at (0xe800) tileram[256][8];

void main();

void start() {
__asm
  	LD    SP,#0xE800 ; set up stack pointer
        DI		 ; disable interrupts
__endasm;
	main();
}

#if start != 0x0
#error start() function must be at address 0x0!
#endif

void main() {
  byte x,y;
  palette = 1;
  memset(tileram, 0xfe, sizeof(tileram));
  for (y=0; y<32; y++) {
    for (x=0; x<32; x++) {
      cellram[x][y] = y*8;
    }
  }
  while (1) ;
}
