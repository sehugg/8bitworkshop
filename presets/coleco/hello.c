
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <cv.h>
#include <cvu.h>

#define COLS 40

#include "common.h"
//#link "common.c"

void setup_40_column_font() {
  cv_set_image_table(IMAGE);
  copy_default_character_set();
  cv_set_character_pattern_t(PATTERN);
  cv_set_screen_mode(CV_SCREENMODE_TEXT);
}

char cursor_x;
char cursor_y;

void clrscr() {
  cvu_vmemset(IMAGE, ' ', COLS*ROWS);
}

void setup_stdio() {
  cursor_x = 0;
  cursor_y = 0;
  clrscr();
}

void scrollup() {
  char buf[COLS];
  char y;
  for (y=0; y<ROWS-1; y++) {
    cvu_vmemtomemcpy(buf, IMAGE + COLS*y + COLS, COLS);
    cvu_memtovmemcpy(IMAGE + COLS*y, buf, COLS);
  }
  cvu_vmemset(IMAGE + COLS*(ROWS-1), ' ', COLS);
}

void newline() {
  if (cursor_y >= ROWS-1) {
    scrollup();
  } else {
    cursor_y++;
  }
}

int putchar(int ch) {
  switch (ch) {
    case '\n':
      newline(); // TODO: scrolling
    case '\r':
      cursor_x = 0;
      return 0;
  }
  cvu_voutb(ch, IMAGE + COLS*cursor_y + cursor_x);
  cursor_x++;
  if (cursor_x >= COLS) {
    newline();
    cursor_x = 0;
  }
}

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
