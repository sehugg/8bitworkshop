
/*
Test of the LZ4 decompression library
with a hires graphics image.
*/

// CC65 config, reserves space for the HGR1 screen buffer
#define CFGFILE apple2-hgr.cfg

#pragma data-name(push,"HGR")
// this segment is required, but we leave it empty
// since we're going to decompress the image here
#pragma data-name(pop)

#include <stdlib.h>
#include <stdio.h>
#include <ctype.h>
#include <conio.h>
#include <string.h>
#include <apple2.h>
#include <peekpoke.h>
#include <lz4.h>

// STROBE = write any value to an I/O address
#define STROBE(addr)       __asm__ ("sta %w", addr)

// start address of the two hi-res graphics regions
#define HGR1	0x2000
#define HGR2	0x4000

// the LZ4 compressed data
const unsigned char BITMAP_DATA_LZ4[] = {
  #embed "parrot-apple2.hires.lz4"
};


// clear screen and set graphics mode
void clear_hgr1() {
  memset((char*)HGR1, 0, 0x2000); // clear page 1
  STROBE(0xc052); // turn off mixed-mode
  STROBE(0xc054); // page 1
  STROBE(0xc057); // hi-res
  STROBE(0xc050); // set graphics mode
}

int main (void)
{
  // set hgr1 mode and clear
  clear_hgr1();
  // skip the header (usually 11 bytes)
  decompress_lz4(BITMAP_DATA_LZ4+11, (char*)HGR1, 0x2000);
  // wait for a key
  cgetc();
  return EXIT_SUCCESS;
}
