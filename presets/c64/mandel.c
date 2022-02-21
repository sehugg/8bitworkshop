
/*****************************************************************************\
** mandelbrot sample program for cc65.                                       **
**                                                                           **
** (w) 2002 by groepaz/hitmen, TGI support by Stefan Haubenthal              **
\*****************************************************************************/
#include <stdlib.h>
#include <time.h>
#include <conio.h>
#include <c64.h>
#include <cc65.h>

#include "common.h"

//#link "multilines.c"

void setup_bitmap_multi();
void set_pixel(byte x, byte y, byte color);

/* Graphics definitions */
#define SCREEN_X        160
#define SCREEN_Y        192
#define MAXCOL          16

#define maxiterations   16
#define fpshift         (10)
#define tofp(_x)        ((_x)<<fpshift)
#define fromfp(_x)      ((_x)>>fpshift)
#define fpabs(_x)       (abs(_x))

#define mulfp(_a,_b)    ((((signed long)_a)*(_b))>>fpshift)
#define divfp(_a,_b)    ((((signed long)_a)<<fpshift)/(_b))

const byte COLORS[MAXCOL] = {
  0, 11, 12, 15, 1,
  2, 9, 4, 8, 10, 7,
  6, 14, 3,
  5, 13,
};

void mandelbrot (signed short x1, signed short y1, signed short x2,
                 signed short y2)
{
    unsigned char count;
    signed short r, r1, i;
    signed short xs, ys, xx, yy;
    signed short x, y;
    byte color;

    /* Calc stepwidth */
    xs = ((x2 - x1) / (SCREEN_X));
    ys = ((y2 - y1) / (SCREEN_Y));

    yy = y1;
    for (y = 3; y < (SCREEN_Y); y++) {
        yy += ys;
        xx = x1;
        for (x = 0; x < (SCREEN_X); x++) {
            xx += xs;
            /* Do iterations */
            r = 0;
            i = 0;
            for (count = 0; (count < maxiterations) &&
                 (fpabs (r) < tofp (2)) && (fpabs (i) < tofp (2));
                 ++count) {
                r1 = (mulfp (r, r) - mulfp (i, i)) + xx;
                /* i = (mulfp(mulfp(r,i),tofp(2)))+yy; */
                i = (((signed long) r * i) >> (fpshift - 1)) + yy;
                r = r1;
            }
            if (count == maxiterations) {
              color = (0);
            } else {
              color = COLORS[count % MAXCOL];
            }
            /* Set pixel */
            set_pixel(x, y, color);
        }
    }
}

int main (void)
{  
    setup_bitmap_multi();
    VIC.bgcolor0 = 0x00;

    /* Calc mandelbrot set */
    mandelbrot (tofp (-2), tofp (-2), tofp (2), tofp (2));

    /* Fetch the character from the keyboard buffer and discard it */
    cgetc ();

    /* Done */
    return EXIT_SUCCESS;
}
