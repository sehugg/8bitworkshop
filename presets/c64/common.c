
#include "common.h"

void raster_wait(unsigned char line) {
  while (VIC.rasterline < line) ;
}

void wait_vblank(void) {
  raster_wait(255);
}
