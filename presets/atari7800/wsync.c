
#include "atari7800.h"

void main() {
  byte y1 = 110;	// Y start of bar
  byte y2 = 10;		// height of bar
  byte i;
  while (1) {
    // wait for end of frame / start of vblank
    while ((MARIA.MSTAT & MSTAT_VBLANK) == 0) ;
    // wait for end of vblank / start of frame
    while ((MARIA.MSTAT & MSTAT_VBLANK) != 0) ;
    // skip scanlines until at top of bar
    for (i=0; i<y1; i++) {
      WSYNC();
    }
    // set the background color on each scanline
    for (i=0; i<y2; i++) {
      MARIA.BACKGRND = P6532.SWCHA - i;
      WSYNC();
    }
    // clear the background after the final scanline
    MARIA.BACKGRND = 0;
    // move bar slowly downward
    y1++;
  }
}
