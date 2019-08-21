
#include "atari7800.h"

void main() {
  byte y1 = 110;
  byte y2 = 10;
  byte i;
  while (1) {
    while ((MARIA.MSTAT & MSTAT_VBLANK) == 0) ;
    while ((MARIA.MSTAT & MSTAT_VBLANK) != 0) ;
    for (i=0; i<y1; i++) {
      WSYNC();
    }
    for (i=0; i<y2; i++) {
      MARIA.BACKGRND = P6532.SWCHA - i;
      WSYNC();
    }
    MARIA.BACKGRND = 0;
  }
}
