
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

#include "cv.h"
#include "cvu.h"

#define PATTERN ((const cv_vmemp)0x0)
#define COLOR ((const cv_vmemp)0x2000)
#define IMAGE ((const cv_vmemp)0x1800)

#define COLS 32
#define ROWS 24

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;

void setup_mode2() {
  cvu_vmemset(0, 0, 0x4000);
  cv_set_screen_mode(CV_SCREENMODE_BITMAP); // mode 2
  cv_set_image_table(IMAGE);
  cv_set_character_pattern_t(PATTERN|0x1fff); // AND mask
  cv_set_color_table(COLOR|0xfff); // AND mask
  cv_set_sprite_attribute_table(0x2800);
  {
    byte i=0;
    do {
      cvu_voutb(i, IMAGE+i);
      cvu_voutb(i, IMAGE+0x100+i);
      cvu_voutb(i, IMAGE+0x200+i);
    } while (++i);
  }
}

void set_pixel(byte x, byte y, byte color) {
  word ofs = (x/8)*8 + (y/8)*256 + (y&7);
  byte b = cvu_vinb(PATTERN + ofs);
  if (y >= 192) return;
  if (color>1) {
    b |= 128 >> (x&7);
    cvu_voutb(b, PATTERN + ofs);
    cvu_voutb(color<<4, COLOR + ofs);
  } else {
    b &= ~(128 >> (x&7));
    cvu_voutb(b, PATTERN + ofs);
  }
}

void draw_line(int x0, int y0, int x1, int y1, byte color)
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
  setup_mode2();
  cv_set_screen_active(true);
  while(1)
  draw_line(rand()&0xff, rand()&0xff, rand()&0xff, rand()&0xff, rand()&15);
  /*
  set_pixel(0, 0, 2);
  set_pixel(1, 0, 2);
  set_pixel(0, 1, 2);
  set_pixel(2, 2, 2);
  set_pixel(3, 3, 2);
  set_pixel(0, 7, 4);
  set_pixel(7, 7, 4);
  set_pixel(8, 7, 4);
  set_pixel(0, 8, 4);
  draw_line(20,0,210,150,2);
  while(1);
  */
}
