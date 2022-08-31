
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
byte copy_needed;

//

void scroll_swap() {
  byte* tmp;
  // swap hidden and visible buffers
  tmp = hidbuf;
  hidbuf = visbuf;
  visbuf = tmp;
  // set VIC bank address
  SET_VIC_SCREEN((word)visbuf);
}

void copy_color_ram_slow() {
  memcpy(COLOR_RAM, colorbuf, COLS*ROWS);
}

void copy_color_ram_fast() {
  // fast copy loop for upper 1/2 of color ram
  asm("ldy #0");
  asm("@loop:");
  asm("lda %v,y", colorbuf);
  asm("sta $d800,y");
  asm("lda %v + $100,y", colorbuf);
  asm("sta $d900,y");
  asm("iny");
  asm("bne @loop");
  // second loop for lower 1/2 of color ram
  asm("@loop2:");
  asm("lda %v + $200,y", colorbuf);
  asm("sta $da00,y");
  asm("lda %v + $300,y", colorbuf);
  asm("sta $db00,y");
  asm("@skip: iny");
  asm("bne @loop2");
}

void copy_to_hidden_buffer_slow() {
  memcpy(hidbuf, visbuf, COLS*ROWS);
}

void copy_to_hidden_buffer_fast() {
  // self-modifying code
  asm("ldy %v+1", visbuf);
  asm("sty @loop+2+6*0");
  asm("iny");
  asm("sty @loop+2+6*1");
  asm("iny");
  asm("sty @loop+2+6*2");
  asm("iny");
  asm("sty @skip-1-3");
  asm("ldy %v+1", hidbuf);
  asm("sty @loop+5+6*0");
  asm("iny");
  asm("sty @loop+5+6*1");
  asm("iny");
  asm("sty @loop+5+6*2");
  asm("iny");
  asm("sty @skip-1");
  // fast copy loop
  asm("ldy #0");
  asm("@loop:");
  asm("lda $8000,y");
  asm("sta $8000,y");
  asm("lda $8100,y");
  asm("sta $8100,y");
  asm("lda $8200,y");
  asm("sta $8200,y");
  asm("cpy #$e8");
  asm("bcs @skip");
  asm("lda $8300,y");
  asm("sta $8300,y");
  asm("@skip: iny");
  asm("bne @loop");
}

void copy_if_needed() {
  if (copy_needed) {
    copy_to_hidden_buffer_fast();
    copy_needed = false;
  }
}

void scroll_update() {
  SET_SCROLL_X(scroll_fine_x);
  SET_SCROLL_Y(scroll_fine_y);
  if (swap_needed) {
    scroll_swap();
    copy_color_ram_fast();
    swap_needed = false;
    copy_needed = true;
  } else {
    copy_if_needed();
  }
}

static void scroll_left() {
  copy_if_needed();
  memmove(hidbuf, hidbuf+1, COLS*ROWS-1);
  memmove(colorbuf, colorbuf+1, COLS*ROWS-1);
  ++origin_x;
  scroll_draw_column(COLS-1);
  swap_needed = true;
}

static void scroll_up() {
  copy_if_needed();
  memmove(hidbuf, hidbuf+COLS, COLS*(ROWS-1));
  memmove(colorbuf, colorbuf+COLS, COLS*(ROWS-1));
  ++origin_y;
  scroll_draw_row(ROWS-1);
  swap_needed = true;
}

static void scroll_right() {
  copy_if_needed();
  memmove(hidbuf+1, hidbuf, COLS*ROWS-1);
  memmove(colorbuf+1, colorbuf, COLS*ROWS-1);
  --origin_x;
  scroll_draw_column(0);
  swap_needed = true;
}

static void scroll_down() {
  copy_if_needed();
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

void scroll_xy(sbyte delta_x, sbyte delta_y) {
  if (delta_x) scroll_horiz(delta_x);
  if (delta_y) scroll_vert(delta_y);
}

void scroll_setup() {
  scroll_fine_x = scroll_fine_y = 0;
  origin_x = origin_y = 0;
  swap_needed = true;
  copy_needed = true;

  // setup screen buffer addresses
  hidbuf = (byte*) 0x8000;
  visbuf = (byte*) 0x8400;
  
  // copy existing screen contents to hidden buffer
  memcpy(hidbuf, (byte*)0x400, COLS*ROWS);
  // copy also to hidden buffer
  memcpy(visbuf, hidbuf, COLS*ROWS);
  
  // set VIC bank ($8000-$BFFF)
  // https://www.c64-wiki.com/wiki/VIC_bank
  SET_VIC_BANK(0x8000);

  // set up 24 line / 38 column mode to hide edges
  VIC.ctrl1 &= ~0x08; // 24 lines
  VIC.ctrl2 &= ~0x08; // 38 columns
}

