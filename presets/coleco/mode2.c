
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <cv.h>
#include <cvu.h>

#define PATTERN ((const cv_vmemp)0x0)
#define COLOR ((const cv_vmemp)0x2000)
#define IMAGE ((const cv_vmemp)0x1800)

#define COLS 32
#define ROWS 24

uintptr_t __at(0x6a) font_bitmap_a;
uintptr_t __at(0x6c) font_bitmap_0;

void setup_32_column_font() {
  cvu_vmemset(0, 0, 0x4000);
  cv_set_image_table(IMAGE);
  cvu_memtovmemcpy(PATTERN, (void *)(font_bitmap_0 - '0'*8), 0x800);
  cvu_memtovmemcpy(PATTERN+0x800, (void *)(font_bitmap_0 - '0'*2), 0x800);
  cvu_memtovmemcpy(PATTERN+0x1000, (void *)(font_bitmap_0 - '0'*0), 0x800);
  cv_set_character_pattern_t(PATTERN|0x1fff); // AND mask
  cv_set_screen_mode(CV_SCREENMODE_BITMAP); // mode 2
  cv_set_color_table(0x2000|0x1fff); // AND mask
  {
    int i;
    for (i=0; i<0x800; i++)
      cvu_voutb((i&15)|0x2, COLOR+i);
    for (i=0x800; i<0x1000; i++)
      cvu_voutb(((i&15)|0x2)<<4, COLOR+i);
  }
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
