/*
Hello world for the ZX Spectrum.

Prints a greeting with the ROM's 8x8 character set, then
animates the ink colors of the letters and the border.

The Spectrum keeps the bitmap ($4000-$57FF) and the color
attributes ($5800-$5AFF) in separate blocks: one attribute
byte holds ink, paper, bright and flash for a whole 8x8
character cell. So we can paint the message by writing the
font to the bitmap and the colors to the attribute table.
*/

#include <string.h>
#include "bios.h"
//#link "bios.c"

typedef unsigned char byte;
typedef unsigned short word;

#define VHEIGHT 192
#define VWIDTH  256

__sfr __at (0xfe) portfe;	// border color / speaker port

// attribute table: 24 rows x 32 columns
byte __at(0x5800) vidattrs[24][32];

const char MSG1[] = "HELLO, WORLD!";
const char MSG2[] = "ZX SPECTRUM 48K";

// bitmap address of scanline y (0..191), in the ZX's famously
// scrambled screen layout: third of a row, then scanline, then column
byte* scanline(byte y) {
  word a = 0x4000;
  a |= (word)(y & 0xc0) << 5;	// row of 8 lines (0x0000/0x0800)
  a |= (word)(y & 0x07) << 8;	// line within the row of 8
  a |= (word)(y & 0x38) << 2;	// row of 64 lines (0x0000/0x0020)
  return (byte*)a;
}

// draw one character at column 0..31, row 0..23
void draw_char(char ch, byte col, byte row) {
  byte i;
  const byte* src = &font8x8[(ch - LOCHAR)][0];
  byte* dest = scanline(row << 3) + col;
  for (i=0; i<8; i++) {
    *dest = *src++;		// one font byte per scanline
    dest += 256;		// next scanline is 256 bytes down
  }
}

void draw_string(const char* str, byte col, byte row) {
  do {
    byte ch = *str++;
    if (!ch) break;
    draw_char(ch, col++, row);
  } while (1);
}

void clrscr() {
  memset(scanline(0), 0, 0x1800);	// clear bitmap
  memset(vidattrs, 0, 0x300);		// black on black
}

// give each letter a bright rainbow ink color, cycling over time
void colorize(byte phase) {
  byte i;
  for (i=0; MSG1[i]; i++)
    vidattrs[11][9+i] = 0x40 | ((i + phase) & 7);
  for (i=0; MSG2[i]; i++)
    vidattrs[13][8+i] = 0x40 | ((i - phase) & 7);
}

void main() {
  byte phase = 0;
  // crt0 leaves interrupts disabled; enable them so HALT waits for a frame
  __asm
    ei
  __endasm;
  clrscr();
  portfe = 1; // border color
  draw_string(MSG1, 9, 11);
  draw_string(MSG2, 8, 13);
  while (1) {
    colorize(phase++);
    __asm
      halt			// wait for the 50 Hz frame interrupt
    __endasm;
  }
}
