/*
This is a demonstration of integrating the C
standard I/O (stdio) functions with the display,
so that standard functions like printf() can be used.

It has been ported to the Sega VDP's mode 4 text mode.
*/

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"
//#link "common.c"
//#link "chr_generic.c"

extern const unsigned char CHR_GENERIC[8192];

char cursor_x;	// current cursor column
char cursor_y;	// current cursor row

void setup_graphics() {
  // copy the font/tileset into the character pattern table
  cvu_memtovmemcpy(PATTERN, CHR_GENERIC, sizeof(CHR_GENERIC));
  // load the default mode-4 palette
  set_default_palette();
  cv_set_colors(CV_COLOR_BLACK, CV_COLOR_BLACK);
}

void setup_stdio() {
  cursor_x = 0;
  cursor_y = 0;
  clrscr();
}

// scroll the screen upward, by copying each row
// of VRAM to its previous row.
void scrollup() {
  char buf[ROWSTRIDE];
  char y;
  for (y=0; y<ROWS-1; y++) {
    cvu_vmemtomemcpy(buf, IMAGE + ROWSTRIDE*(y+1), ROWSTRIDE);
    cvu_memtovmemcpy(IMAGE + ROWSTRIDE*y, buf, ROWSTRIDE);
  }
  cvu_vmemset(IMAGE + ROWSTRIDE*(ROWS-1), 0, ROWSTRIDE);
}

// move cursor to next line, scrolling when it hits the bottom.
void newline() {
  if (cursor_y >= ROWS-1) {
    scrollup();
  } else {
    cursor_y++;
  }
}

// write a character to the screen.
int putchar(int ch) {
  switch (ch) {
    case '\n':
      newline();	// move cursor to next line
    case '\r':
      cursor_x = 0;	// move cursor to start of line
      return 0;
  }
  // output character (tile) + attribute to the name table
  putcharxy(cursor_x, cursor_y, ch);
  // move cursor to right, going to next line if necessary
  cursor_x++;
  if (cursor_x >= COLS) {
    newline();
    cursor_x = 0;
  }
  return ch;
}

void main() {
  unsigned char byteval = 123;
  signed char charval = 123;
  short shortval = 12345;

  vdp_setup();
  setup_graphics();
  setup_stdio();
  cv_set_screen_active(true);
  printf("HELLO WORLD!\n");
  while (1) {
    printf("char %d byte %u sh %d\n",
      charval++, byteval++, shortval++);
  }
}
