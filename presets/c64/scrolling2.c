  
#include <string.h>

#include "scrolling.h"

#define VICBANK 0x8000
#define BUFFER_A (byte*) 0x8000
#define BUFFER_B (byte*) 0x8400

sbyte scroll_fine_x;
sbyte scroll_fine_y;
byte origin_x;
byte origin_y;
byte* hidbuf;
byte* visbuf;
byte colorbuf[COLS*ROWS];
int pixofs_x;
int pixofs_y;
sbyte fine_correct_x;
sbyte fine_correct_y;

byte scroll_dir;
byte scroll_seq;

//

static void wait_offscreen(void) {
  while (VIC.rasterline < 250 && VIC.rasterline > 40) ;
}

void scroll_swap(void) {
  byte* tmp;
  // swap hidden and visible buffers
  tmp = hidbuf;
  hidbuf = visbuf;
  visbuf = tmp;
  // set VIC bank address
  wait_offscreen();
  VIC.addr = (VIC.addr & 0xf) | (((word)visbuf >> 8) << 2);
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

void scroll_start(byte dir) {
  if (scroll_seq == 0 && dir) {
    scroll_dir = dir;
    scroll_seq = 8;
    // correct sprites b/c our fine offset is one pixel
    // off depending on last scroll direction
    if (dir & SCROLL_LEFT) fine_correct_x = 1;
    else if (dir & SCROLL_RIGHT) fine_correct_x = 0;
    if (dir & SCROLL_UP) fine_correct_y = 1;
    else if (dir & SCROLL_DOWN) fine_correct_y = 0;
  }
}

void scroll_step_move_buffer(char* src, char* dst) {
  word size = COLS*ROWS;
  if (scroll_dir & SCROLL_LEFT) {
    ++src;
    --size;
  }
  if (scroll_dir & SCROLL_RIGHT) {
    ++dst;
    --size;
  }
  if (scroll_dir & SCROLL_UP) {
    src += COLS;
    size -= COLS;
  }
  if (scroll_dir & SCROLL_DOWN) {
    dst += COLS;
    size -= COLS;
  }
  memmove(dst, src, size);
}

void scroll_step_draw_cells() {
  if (scroll_dir & SCROLL_UP) ++origin_y;
  if (scroll_dir & SCROLL_DOWN) --origin_y;
  if (scroll_dir & SCROLL_LEFT) {
    ++origin_x;
    scroll_draw_column(COLS-1);
  }
  if (scroll_dir & SCROLL_RIGHT) {
    --origin_x;
    scroll_draw_column(0);
  }
  if (scroll_dir & SCROLL_UP) {
    scroll_draw_row(ROWS-1);
  }
  if (scroll_dir & SCROLL_DOWN) {
    scroll_draw_row(0);
  }
}

void scroll_step_move_sprites() {
  // copy sprites from visible to hidden buffer
  memcpy(hidbuf + 0x3f8, visbuf + 0x3f8, 8);
}

void scroll_update_pixofs() {
  // fine scroll starts at 8-5 = 32107 or 12-8 = 45670
  if (scroll_dir & SCROLL_LEFT) {
    pixofs_x -= 1;
    scroll_fine_x = (scroll_seq - 5) & 7;
  }
  if (scroll_dir & SCROLL_RIGHT) {
    pixofs_x += 1;
    scroll_fine_x = (12 - scroll_seq) & 7;
  }
  if (scroll_dir & SCROLL_UP) {
    pixofs_y -= 1;
    scroll_fine_y = (scroll_seq - 5) & 7;
  }
  if (scroll_dir & SCROLL_DOWN) {
    pixofs_y += 1;
    scroll_fine_y = (12 - scroll_seq) & 7;
  }
}

void scroll_offset_sprites(byte delta) {
  byte dx = 0;
  byte dy = 0;
  // fine scroll starts at 8-5 = 32107 or 12-8 = 45670
  if (scroll_dir & SCROLL_LEFT) {
    dx = -delta;
  }
  if (scroll_dir & SCROLL_RIGHT) {
    dx = delta;
  }
  if (scroll_dir & SCROLL_UP) {
    dy = -delta;
  }
  if (scroll_dir & SCROLL_DOWN) {
    dy = delta;
  }
  VIC.spr_pos[0].x += dx;
  VIC.spr_pos[1].x += dx;
  VIC.spr_pos[0].y += dy;
  VIC.spr_pos[1].y += dy;
}

void scroll_update_scroll_regs() {
  wait_offscreen();
  VIC.ctrl1 = (VIC.ctrl1 & 0xf8) | scroll_fine_y;
  VIC.ctrl2 = (VIC.ctrl2 & 0xf8) | scroll_fine_x;
}

void scroll_next_step(void) {
  switch (--scroll_seq) {
    case 7:
      scroll_step_move_buffer(visbuf, hidbuf);
      break;
    case 6:
      scroll_step_move_buffer(colorbuf, colorbuf);
      break;
    case 5:
      scroll_step_draw_cells();
      break;
    case 4:
      scroll_step_move_sprites();
      break;
    case 3:
      scroll_swap();
      copy_color_ram_fast();
      break;
  }
}

void scroll_update(void) {
  if (scroll_seq) {
    scroll_update_pixofs();
    scroll_update_scroll_regs();
    scroll_offset_sprites(1);
    scroll_next_step();
  }
}

void scroll_finish(void) {
  while (scroll_seq) {
    scroll_update_pixofs();
    if (scroll_seq == 4) { scroll_offset_sprites(8); }
    scroll_next_step();
  }
}

void scroll_setup(void) {
  origin_x = origin_y = 0;
  pixofs_x = pixofs_y = 0;
  scroll_fine_x = scroll_fine_y = 3;
  scroll_dir = 0;
  scroll_seq = 0;

  // setup screen buffer addresses
  hidbuf = BUFFER_A;
  visbuf = BUFFER_B;

  memset(BUFFER_A, 0, 0x800);
  memset(colorbuf, 0, sizeof(colorbuf));

  SET_VIC_BANK(VICBANK);

  // set up 24 line / 38 column mode to hide edges
  VIC.ctrl1 &= ~0x08; // 24 lines
  VIC.ctrl2 &= ~0x08; // 38 columns
}

void scroll_refresh(void) {
  byte i;
  for (i=0; i<25; i++) {
    scroll_draw_row(i);
  }
  scroll_swap();
  copy_color_ram_fast();
  copy_to_hidden_buffer_fast();
  scroll_dir = 0;
  scroll_seq = 0;
  scroll_fine_x = scroll_fine_y = 3;
}
