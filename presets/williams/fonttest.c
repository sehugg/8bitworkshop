
#include "williams.h"
//#link "williams.c"

#include "font.h"
//#link "font.c"

// 256x304x4bpp video memory

int main(void) {
  byte i;
  rom_select = 1;
  blit_solid(0, 0, 152, 255, 0x00);
  for (i=0; i<16; i++)
    palette[i] = (byte)(i*7);
  for (i=0; i<152; i++) {
    vidmem[0][i] = 16;
    vidmem[i][2] = 32;
    draw_pixel(i, i, 0x77);
    draw_pixel(i+1, i, 0x33);
  }
  while (1) {
    for (i=0; i<16; i++) {
      watchdog0x39 = 0x39;
      draw_string("Hello World, this proportional font is the jam!!",
                20, i*17+8, i+i*16);
    }
  }
  return 0;
}
