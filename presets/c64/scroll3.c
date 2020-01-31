
#include <stdio.h>
#include <conio.h>
#include <c64.h>
#include <cbm_petscii_charmap.h>
#include <string.h>
#include <stdlib.h>
#include <stdint.h>
#include <joystick.h>

typedef uint8_t byte;
typedef uint16_t word;
typedef int8_t sbyte;

#define COLS 40
#define ROWS 25

void raster_wait(unsigned char line) {
  while (VIC.rasterline < line) ;
}

void wait_vblank() {
  raster_wait(255); // TODO
}

sbyte scroll_fine_x = 0;
sbyte scroll_fine_y = 0;
byte curbuf = 0;
byte* scrnbuf[2];	// screen buffer(s)

void scroll_update_regs() {
  VIC.ctrl1 = (VIC.ctrl1 & 0xf8) | scroll_fine_y;
  VIC.ctrl2 = (VIC.ctrl2 & 0xf8) | scroll_fine_x;
}

void scroll_swap() {
  // swap hidden and visible buffers
  curbuf ^= 1;
  // wait for vblank and update registers
  wait_vblank();
  scroll_update_regs();
  VIC.addr = (VIC.addr & 0xf) | (curbuf ? 0x00 : 0x10);
  // copy visible buffer to hidden buffer
  memcpy(scrnbuf[curbuf], scrnbuf[curbuf^1], COLS*ROWS);
}

void scroll_left() {
  memcpy(scrnbuf[curbuf], scrnbuf[curbuf^1]+1, COLS*ROWS-1);
  scroll_swap();
}

void scroll_right() {
  memcpy(scrnbuf[curbuf]+1, scrnbuf[curbuf^1], COLS*ROWS-1);
  scroll_swap();
}

void scroll_up() {
  memcpy(scrnbuf[curbuf], scrnbuf[curbuf^1]+COLS, COLS*(ROWS-1));
  scroll_swap();
}

void scroll_down() {
  memcpy(scrnbuf[curbuf]+COLS, scrnbuf[curbuf^1], COLS*(ROWS-1));
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
  
  // set VIC bank ($4000-$7FFF)
  // https://www.c64-wiki.com/wiki/VIC_bank
  CIA2.pra = 0x01;
  
  VIC.ctrl1 = 0x10; // 24 lines
  VIC.ctrl2 = 0x00; // 38 columns
}

void main(void) {

  clrscr();
  printf("\r\n\r\n\r\n                           Hello World!");
  printf("\r\n\r\n\r\n                  This is how we scroll");
  printf("\r\n\r\n\r\n                     One line at a time");
  printf("\r\n\r\n\r\n           And now we have two buffers");
  printf("\r\n\r\n\r\n                 To copy all the bytes ");
  
  scroll_setup();

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
    wait_vblank();
    scroll_update_regs();
  }
}
