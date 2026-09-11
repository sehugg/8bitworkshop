
/*
Drawing primitives demo for Game Boy.
Uses the GBDK pixel plotting library (gb/drawing.h) to draw
characters, circles, boxes, and lines in the various draw
modes (SOLID, XOR) and foreground/background colors.

No font data is included in this file. The characters drawn by
gprintf()/gotogxy() use the 256-character IBM fixed-width font
(font_ibm_fixed) compiled into the GBDK drawing library, which
is linked in automatically via gb.lib.

The last section scrolls the whole screen by replotting every
pixel one row up at a time. This is slow, since each call to
plot_point() reads and writes a byte of pixel memory.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"
#include <stdint.h>
#include <string.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gb/drawing.h"

// draw a starburst of lines radiating from (x,y)
void linetest(uint8_t x, uint8_t y, uint8_t w) {
    color(DKGREY,WHITE,SOLID);
	for (int i = -w; i <= w; i++) line(x,y,x+i,y-w);
	for (int i = -w; i <= w; i++) line(x,y,x+w,y+i);
	for (int i = -w; i <= w; i++) line(x,y,x+i,y+w);
	for (int i = -w; i <= w; i++) line(x,y,x-w,y+i);
}

void main(void)
{
    uint8_t  a,b,c,d,e;  // loop counters and color indices
    c=0;  // character code to draw, starting at 0
    /* Draw many characters on the screen with different fg and bg colours */
    for (a=0; a<=15; a++) {
	for (b=0; b<=15; b++) {
	    gotogxy(b,a);
	    d=a/4;
	    e=b/4;
	    if (d==e) {
		d=3-e;
	    }
	    color(d,e,SOLID);
	    gprintf("%c",c++);
	}
    }

    /* Draw two circles, a line, and two boxes in different drawing modes */
    color(LTGREY,WHITE,SOLID);
    circle(140,20,15,M_FILL);
    color(BLACK,WHITE,SOLID);
    circle(140,20,10,M_NOFILL);
    color(DKGREY,WHITE,XOR);
    circle(120,40,30,M_FILL);
    line(0,0,159,143);
    color(BLACK,LTGREY,SOLID);
    box(0,130,40,143,M_NOFILL);
    box(50,130,90,143,M_FILL);

    // draw lines fanning out from a point
    linetest(130, 100, 20);

    /* Scroll the screen using the hardest method imaginable :) */
    for (c=0; c<=143; c++) {
	for (b=0; b<=142; b++) {
	    for (a=0; a<=159; a++) {
		color(getpix(a,b+1),WHITE,SOLID);
		plot_point(a,b);
	    }
	    color(WHITE,WHITE,SOLID);
	}
	line(0,143,159,143);
    }
}
