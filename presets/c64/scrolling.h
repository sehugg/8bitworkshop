#ifndef _SCROLLING_H
#define _SCROLLING_H

#include "common.h"

// drawable screen area (only shows 38 x 24)
#define COLS 40
#define ROWS 25

extern sbyte scroll_fine_x;	// X fine scroll (pixels)
extern sbyte scroll_fine_y;	// Y fine scroll (pixels)
extern byte origin_x;		// X scroll origin (columns)
extern byte origin_y;		// Y scroll origin (rows)
extern byte* hidbuf;		// hidden screen buffer(s)
extern byte* visbuf;		// visible screen buffer(s)
extern byte colorbuf[COLS*ROWS]; // color RAM buffer
extern byte swap_needed;	// TRUE if scroll_update() swaps

// call this at start of program
void scroll_setup(void);

// scroll in X or Y directions
void scroll_xy(sbyte delta_x, sbyte delta_y);
void scroll_horiz(sbyte delta_x);
void scroll_vert(sbyte delta_y);

// call this right after vblank
void scroll_update(void);

// caller must implement these two
void scroll_draw_column(byte col);
void scroll_draw_row(byte row);


/* incremental scrolling library */
extern int pixofs_x;		// X scroll pixel offset
extern int pixofs_y;		// Y scroll pixel offset
extern sbyte fine_correct_x;
extern sbyte fine_correct_y;

void scroll_start(byte dir);
void scroll_finish(void);
void scroll_refresh(void);

#define SCROLL_LEFT 1
#define SCROLL_RIGHT 2
#define SCROLL_UP 4
#define SCROLL_DOWN 8


#endif
