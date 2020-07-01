
/*
This is a demonstration of integrating the C
standard I/O (stdio) functions with the display,
so that standard functions like printf() can be used.
*/

#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <cv.h>
#include <cvu.h>

// overrides value in common.h
#define COLS 40

#include "common.h"
//#link "common.c"
//#link "fonts.s"

void setup_40_column_font() {
  cv_set_screen_mode(CV_SCREENMODE_TEXT);
  cv_set_image_table(IMAGE);
  cv_set_character_pattern_t(PATTERN);
  copy_default_character_set();
}

char cursor_x;	// current cursor column
char cursor_y;	// current cursor row

// clear the screen to ' ' (blank spaces)
void clrscr() {
  cvu_vmemset(IMAGE, ' ', COLS*ROWS);
}

void setup_stdio() {
  cursor_x = 0;
  cursor_y = 0;
  clrscr();
}

// scroll the screen upward, by copying each row
// of VRAM to its previous row.
void scrollup() {
  char buf[COLS];
  char y;
  for (y=0; y<ROWS-1; y++) {
    cvu_vmemtomemcpy(buf, IMAGE + COLS*y + COLS, COLS);
    cvu_memtovmemcpy(IMAGE + COLS*y, buf, COLS);
  }
  cvu_vmemset(IMAGE + COLS*(ROWS-1), ' ', COLS);
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
  // output character to VRAM at cursor position
  cvu_voutb(ch, IMAGE + COLS*cursor_y + cursor_x);
  // move cursor to right, going to next line if neccessary
  cursor_x++;
  if (cursor_x >= COLS) {
    newline();
    cursor_x = 0;
  }
}

#ifdef __MAIN__

// test program
void main() {
  unsigned char byteval = 123;
  signed char charval = 123;
  short shortval = 12345;
  
  setup_40_column_font();
  setup_stdio();
  cv_set_colors(CV_COLOR_LIGHT_GREEN, CV_COLOR_BLACK);
  cv_set_screen_active(true);
  printf("HELLO WORLD!\n");
  while (1) {
    printf("char %d byte %u sh %d\n",
      charval++, byteval++, shortval++);
  }
}

#endif
