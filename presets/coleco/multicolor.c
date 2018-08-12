
#include <stdlib.h>
#include <string.h>
#include <cv.h>
#include <cvu.h>

#define PATTERN ((const cv_vmemp)0x0000)
#define IMAGE ((const cv_vmemp)0x1800)

#define COLS 64
#define ROWS 48

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;

uintptr_t __at(0x6a) font_bitmap_a;
uintptr_t __at(0x6c) font_bitmap_0;

void setup_multicolor() {
  cvu_vmemset(0, 0, 0x4000);
  cv_set_image_table(IMAGE);
  cv_set_character_pattern_t(PATTERN);
  cv_set_screen_mode(CV_SCREENMODE_MULTICOLOR); // mode 3
  // set image table
  {
    byte x,y;
    word ofs = IMAGE;
    for (y=0; y<ROWS; y++) {
      for (x=0; x<COLS/2; x++) {
        cvu_voutb(x + (y>>2)*COLS/2, ofs++);
      }
    }
  }
}

static word next_pg[4] = { 0, 0, 0, 0 };

void set_pixel(byte x, byte y, byte color) {
  word pg = (x>>1) * 8 + (y & 7) + (y & ~7)*32;
  byte b = cvu_vinb(pg);
  b |= (x & 1) ? color : color<<4;
  cvu_voutb(b, PATTERN + pg);
}

void draw_line(sbyte x0, sbyte y0, sbyte x1, sbyte y1, byte color)
{
    int dx, dy, p, x, y;
    dx=x1-x0;
    dy=y1-y0;
    x=x0;
    y=y0;
    p=2*dy-dx;
    while(x<x1)
    {
        if(p>=0)
        {
            set_pixel(x,y,color);
            y=y+1;
            p=p+2*dy-2*dx;
        }
        else
        {
            set_pixel(x,y,color);
            p=p+2*dy;
        }
        x=x+1;
    }
}
 
void main() {
  setup_multicolor();
  set_pixel(0, 0, 4);
  set_pixel(1, 0, 4);
  set_pixel(COLS-1, 0, 4);
  set_pixel(0, 1, 6);
  set_pixel(0, 2, 6);
  set_pixel(0, 3, 6);
  set_pixel(1, 4, 4);
  set_pixel(2, 6, 5);
  set_pixel(4, 7, 5);
  set_pixel(7, 7, 5);
  set_pixel(8, 8, 5);
  draw_line(0, 0, COLS-1, ROWS-1, 2);
  cv_set_screen_active(true);
  while (1);
}
