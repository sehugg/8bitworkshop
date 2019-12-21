// ported from
// https://odensskjegg.home.blog/2018/12/29/recreating-the-commodore-64-user-guide-code-samples-in-cc65-part-three-sprites/

#include <stdio.h>
#include <stdlib.h>
#include <conio.h>
#include <peekpoke.h>
#include <c64.h>

/*{w:24,h:21,bpp:1,brev:1}*/
const char sprite[3*21] = {
  0x00,0x7F,0x00,0x01,0xFF,0xC0,0x03,0xFF,0xE0,
  0x03,0xE7,0xE0,0x07,0xD9,0xF0,0x07,0xDF,0xF0,
  0x07,0xD9,0xF0,0x03,0xE7,0xE0,0x03,0xFF,0xE0,
  0x03,0xFF,0xE0,0x02,0xFF,0xA0,0x01,0x7F,0x40,
  0x01,0x3E,0x40,0x00,0x9C,0x80,0x00,0x9C,0x80,
  0x00,0x49,0x00,0x00,0x49,0x00,0x00,0x3E,0x00,
  0x00,0x3E,0x00,0x00,0x3E,0x00,0x00,0x1C,0x00
};

// Pre-calculated sinus values
const char yValues[] = {
  32, 35, 38, 41, 44, 47, 49, 52, 
  54, 56, 58, 60, 61, 62, 63, 63, 
  64, 63, 63, 62, 61, 60, 58, 56, 
  54, 52, 49, 47, 44, 41, 38, 35, 
  32, 28, 25, 22, 19, 16, 14, 11, 
  9, 7, 5, 3, 2, 1, 0, 0, 
  0, 0, 0, 1, 2, 3, 5, 7, 
  9, 11, 14, 16, 19, 22, 25, 28
};

// Raster wait with line argument
void rasterWait(unsigned char line) {
  while (VIC.rasterline < line) ;
}

int main (void)
{
  unsigned char n, t;
  int rx, x;
  char sx, msb;
  
  VIC.bgcolor0 = 3;
  __asm__("SEI"); // clear interrupts to avoid glitching

  for (n = 0 ; n < sizeof(sprite) ; n++) {
    POKE(832 + n, sprite[n]);
  }
  VIC.spr_ena = 255;
  for (t = 0 ; t < 8 ; t++) {
    POKE(2040 + t, 13); // Set sprite x data from 13th block for all sprites
  }
  do {
    for (x = 0 ; x < 550; x++) { 
      msb = 0; // MSB of X coordinates
      // Wait until raster hits position 250 before drawing upper sprites
      rasterWait(250);
      // Set border color, which indicates the raster position
      VIC.bordercolor = 1;
      rx = x;
      for (t = 0 ; t < 8 ; t++) {
        rx -= 24;
        if (rx >= 0 && rx < 366) {
          // Usually I would calculate the sprite X coordinate using
          // the expression sx = rx % 256, but bitwise operation is
          // significant faster
          sx = rx & 255; 
          if (rx > 255) {
            // Set MSB of x coordinate for sprite if x position > 255
            msb |= 1 << t; 
          }
          VIC.spr_pos[t].x = sx;
          // Y position is an indirect Sinus function of X, using array
          // index for retrieving the Y value
          VIC.spr_pos[t].y = yValues[sx & 63] + 40;
        } else {
          VIC.spr_pos[t].x = 0;
        }
      }
      VIC.spr_hi_x = msb; // Set MSB of x coordinate
      // Wait until raster hits position 135 before drawing lower sprites
      rasterWait(135);
      VIC.bordercolor = 2; // Set border color
      for (t = 0 ; t < 8 ; t++) {
        // Add 128 to current sprite Y position
        VIC.spr_pos[t].y += 128;
      }
    }
  } while (1);
  return EXIT_SUCCESS;	
}
