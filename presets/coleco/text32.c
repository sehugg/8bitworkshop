
#include <stdio.h>

#include "cv.h"
#include "cvu.h"

#define PATTERN	0x0000
#define IMAGE	0x1c00
#define COLOR	0x2000

#define COLS 32
#define ROWS 24

uintptr_t __at(0x6a) font_bitmap_a;
uintptr_t __at(0x6c) font_bitmap_0;

void setup_32_column_font() {
  cv_set_character_pattern_t(PATTERN);
  cv_set_image_table(IMAGE);
  cv_set_color_table(COLOR);
  cv_set_screen_mode(CV_SCREENMODE_STANDARD);
  cvu_memtovmemcpy(PATTERN, (void *)(font_bitmap_0 - '0'*8), 2048);
  cvu_vmemset(COLOR, 0x36, 8); // set color for chars 0-63
  cvu_vmemset(COLOR+8, 0x06, 32-8); // set chars 63-255
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
  
  setup_32_column_font();
  setup_stdio();
  cv_set_screen_active(true);
  printf("HELLO WORLD!\n");
  while (1) {
    printf("char %d byte %u sh %d\n",
      charval++, byteval++, shortval++);
  }
}
