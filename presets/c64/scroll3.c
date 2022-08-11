
#include "common.h"
//#link "common.c"

#include <cbm_petscii_charmap.h>

sbyte scroll_fine_x = 0;
sbyte scroll_fine_y = 0;
byte* scrnbuf[2];	// screen buffer(s)
byte hidbuf = 0;

void scroll_update_regs() {
  SET_SCROLL_X(scroll_fine_x);
  SET_SCROLL_Y(scroll_fine_y);
}

void scroll_swap() {
  // swap hidden and visible buffers
  hidbuf ^= 1;
  // wait for vblank and update registers
  waitvsync();
  scroll_update_regs();
  SET_VIC_SCREEN(hidbuf ? 0x8000 : 0x8400);
}

void scroll_left() {
  memcpy(scrnbuf[hidbuf], scrnbuf[hidbuf^1]+1, COLS*ROWS-1);
  scroll_swap();
}

void scroll_right() {
  memcpy(scrnbuf[hidbuf]+1, scrnbuf[hidbuf^1], COLS*ROWS-1);
  scroll_swap();
}

void scroll_up() {
  memcpy(scrnbuf[hidbuf], scrnbuf[hidbuf^1]+COLS, COLS*(ROWS-1));
  scroll_swap();
}

void scroll_down() {
  memcpy(scrnbuf[hidbuf]+COLS, scrnbuf[hidbuf^1], COLS*(ROWS-1));
  scroll_swap();
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

void scroll_setup() {
  // get screen buffer addresses
  scrnbuf[0] = (byte*) 0x8000;
  scrnbuf[1] = (byte*) 0x8400;
  
  // copy existing text to screen 0
  memcpy(scrnbuf[0], (byte*)0x400, COLS*ROWS);
  // copy screen 1 to screen 0
  memcpy(scrnbuf[1], scrnbuf[0], COLS*ROWS);
  
  // set VIC bank
  // https://www.c64-wiki.com/wiki/VIC_bank
  SET_VIC_BANK(0x8000);

  VIC.ctrl1 &= ~0x08; // 24 lines
  VIC.ctrl2 &= ~0x08; // 38 columns  
}

void main(void) {

  clrscr();
  printf("\n\n\n                           Hello World!");
  printf("\n\n\n                  This is how we scroll");
  printf("\n\n\n            And now we have two buffers");
  printf("\n\n\n            And can go in any direction");
  printf("\n\n\n             But we are not incremental");
  printf("\n\n\n   And have to pause to scroll and copy");
  
  scroll_setup();
  VIC.bordercolor = COLOR_GRAY1;

  // install the joystick driver
  joy_install (joy_static_stddrv);

  // infinite loop
  while (1) {
    // get joystick bits
    char joy = joy_read(0);
    // move sprite based on arrow keys
    if (JOY_LEFT(joy)) scroll_horiz(-1);
    if (JOY_UP(joy)) scroll_vert(-1);
    if (JOY_RIGHT(joy)) scroll_horiz(1);
    if (JOY_DOWN(joy)) scroll_vert(1);
    // update regs
    waitvsync();
    scroll_update_regs();
  }
}
