
#include <string.h>

#include "scrolling.h"

sbyte scroll_fine_x;
sbyte scroll_fine_y;
byte origin_x;
byte origin_y;
byte* hidbuf;
byte* visbuf;
byte colorbuf[COLS*ROWS];
byte swap_needed;

//

void scroll_swap(void) {
  byte* tmp;
  // set VIC bank address
  VIC.addr = (VIC.addr & 0xf) | (((word)hidbuf >> 8) << 2);
  // swap hidden and visible buffers
  tmp = hidbuf;
  hidbuf = visbuf;
  visbuf = tmp;
}

void scroll_copy(void) {
  // copy temp buf to color ram
  memcpy(COLOR_RAM, colorbuf, COLS*ROWS);
  // copy visible buffer to hidden buffer
  memcpy(hidbuf, visbuf, COLS*ROWS);
}

void scroll_update(void) {
  VIC.ctrl1 = (VIC.ctrl1 & 0xf8) | scroll_fine_y;
  VIC.ctrl2 = (VIC.ctrl2 & 0xf8) | scroll_fine_x;
  if (swap_needed) {
    scroll_swap();
    scroll_copy();
    swap_needed = 0;
  }
}

void scroll_left(void) {
  memcpy(hidbuf, hidbuf+1, COLS*ROWS-1);
  memcpy(colorbuf, colorbuf+1, COLS*ROWS-1);
  ++origin_x;
  scroll_draw_column(COLS-1);
  swap_needed = true;
}

void scroll_up(void) {
  memcpy(hidbuf, hidbuf+COLS, COLS*(ROWS-1));
  memcpy(colorbuf, colorbuf+COLS, COLS*(ROWS-1));
  ++origin_y;
  scroll_draw_row(ROWS-1);
  swap_needed = true;
}

void scroll_right(void) {
  memmove(hidbuf+1, hidbuf, COLS*ROWS-1);
  memmove(colorbuf+1, colorbuf, COLS*ROWS-1);
  --origin_x;
  scroll_draw_column(0);
  swap_needed = true;
}

void scroll_down(void) {
  memmove(hidbuf+COLS, hidbuf, COLS*(ROWS-1));
  memmove(colorbuf+COLS, colorbuf, COLS*(ROWS-1));
  --origin_y;
  scroll_draw_row(0);
  swap_needed = true;
}

void scroll_horiz(sbyte delta_x) {
  scroll_fine_x += delta_x;
  while (scroll_fine_x < 0) {
    scroll_fine_x += 8;
    scroll_left();
  }
  while (scroll_fine_x >= 8) {
    scroll_fine_x -= 8;
    scroll_right();
  }
}

void scroll_vert(sbyte delta_y) {
  scroll_fine_y += delta_y;
  while (scroll_fine_y < 0) {
    scroll_fine_y += 8;
    scroll_up();
  }
  while (scroll_fine_y >= 8) {
    scroll_fine_y -= 8;
    scroll_down();
  }
}

void scroll_setup(void) {
  scroll_fine_x = scroll_fine_y = 0;
  origin_x = origin_y = 0x80;
  swap_needed = true;

  // get screen buffer addresses
  hidbuf = (byte*) 0x8000;
  visbuf = (byte*) 0x8400;
  // copy existing text to screen 0
  memcpy(hidbuf, (byte*)0x400, COLS*ROWS);
  // copy screen 1 to screen 0
  memcpy(visbuf, hidbuf, COLS*ROWS);
  
  // set VIC bank ($4000-$7FFF)
  // https://www.c64-wiki.com/wiki/VIC_bank
  CIA2.pra = 0x01;
  
  VIC.ctrl1 &= ~0x08; // 24 lines
  VIC.ctrl2 &= ~0x08; // 38 columns
}

