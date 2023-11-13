
// ported from
// https://odensskjegg.home.blog/2018/12/29/recreating-the-commodore-64-user-guide-code-samples-in-cc65-part-three-sprites/

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
const char yValues[64] = {
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

const char LUT[8] = { 0x1, 0x2, 0x4, 0x8, 0x10, 0x20, 0x40, 0x80 };

int main (void)
{
  unsigned char n, t;
  int rx, x;
  unsigned char msb;
  
  VIC.bgcolor0 = COLOR_CYAN; // set background color
  __asm__("SEI"); // clear interrupts to avoid glitching

  // Set 13th sprite bitmap
  for (n = 0 ; n < sizeof(sprite) ; n++) {
    POKE(832 + n, sprite[n]);
  }
  // enable all sprites
  VIC.spr_ena = 255;
  // Set all sprite pointers to 13th sprite
  for (t = 0 ; t < 8 ; t++) {
    POKE(2040 + t, 13); 
  }
  // loop forever
  while(1) {
    for (x = 0 ; x < 550; x++) { 
      // MSB of each sprite's X coordinate (i.e. if X >= 256)
      msb = 0; 
      // Wait until raster hits position 250 before drawing upper sprites
      rasterWait(250);
      // Set border color, which indicates the raster position
      VIC.bordercolor = COLOR_RED;
      rx = x;
      // iterate over all 8 sprites
      for (t = 0 ; t < 8 ; t++) {
        VIC.bordercolor = t;
        rx -= 24;
        if (rx >= 0 && rx < 366) {
          // Set MSB of x coordinate for sprite if x position > 255
          if (rx >= 256) {
            msb |= LUT[t]; // look up 1 << t
          }
          VIC.spr_pos[t].x = rx;
          // Y position is an indirect Sinus function of X, using array
          // index for retrieving the Y value
          VIC.spr_pos[t].y = yValues[rx & 63] + 40;
        } else {
          VIC.spr_pos[t].x = 0;
        }
      }
      // Set MSB of x coordinate
      VIC.spr_hi_x = msb; 
      // Wait until raster hits position 135 before drawing lower sprites
      VIC.bordercolor = COLOR_BLUE;
      rasterWait(135);
      VIC.bordercolor = COLOR_RED;
      // Add 128 to current sprite Y positions
      for (t = 0 ; t < 8 ; t++) {
        VIC.spr_pos[t].y += 128;
      }
    }
  }
  return 0;	
}

