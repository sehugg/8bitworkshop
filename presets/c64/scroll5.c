
#include <stdio.h>
#include <conio.h>
#include <c64.h>
#include <cbm_petscii_charmap.h>
#include <string.h>
#include <stdlib.h>
#include <stdint.h>
#include <joystick.h>

#include "common.h"
//#link "common.c"

#include "scrolling.h"
//#link "scrolling.c"

#include "sprites.h"
//#link "sprites.c"

static void draw_cell(byte x, byte y) {
  byte xx = x + origin_x;
  byte yy = y + origin_y;
  byte ch = xx ^ yy;
  word ofs = x+y*COLS;
  hidbuf[ofs] = ch; // character
  colorbuf[ofs] = ch; // color
}

void scroll_draw_column(byte col) {
  byte y;
  for (y=0; y<ROWS; y++) {
    draw_cell(col, y);
  }
}

void scroll_draw_row(byte row) {
  byte x;
  for (x=0; x<COLS; x++) {
    draw_cell(x, row);
  }
}

/*{w:24,h:21,bpp:1,brev:1}*/
const char SPRITE1[3*21] = {
  0x00,0x7F,0x00,0x01,0xFF,0xC0,0x03,0xFF,0xE0,
  0x03,0xE7,0xE0,0x07,0xD9,0xF0,0x07,0xDF,0xF0,
  0x07,0xD9,0xF0,0x03,0xE7,0xE0,0x03,0xFF,0xE0,
  0x03,0xFF,0xE0,0x02,0xFF,0xA0,0x01,0x7F,0x40,
  0x01,0x3E,0x40,0x00,0x9C,0x80,0x00,0x9C,0x80,
  0x00,0x49,0x00,0x00,0x49,0x00,0x00,0x3E,0x00,
  0x00,0x3E,0x00,0x00,0x3E,0x00,0x00,0x1C,0x00
};

void main(void) {
  byte n = 0;
  
  clrscr();
  printf("\r\n\r\n\r\n                           Hello World!");
  printf("\r\n\r\n\r\n                  This is how we scroll");
  printf("\r\n\r\n\r\n               But color RAM can't move");
  printf("\r\n\r\n\r\n        So we have to use a temp buffer");
  printf("\r\n\r\n\r\n               And copy it just in time");

  // setup scrolling library
  scroll_setup();

  // setup sprite library and copy sprite to VIC bank
  sprite_clear();
  sprite_shape(hidbuf, 32, SPRITE1);

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
    // animate sprite in shadow sprite ram
    sprite_draw(0, n++, 70, 32);
    // wait for vblank
    wait_vblank();
    // update scroll registers
    // and swap screens if we must
    scroll_update();
    // then update sprite registers
    sprite_update(visbuf);
  }
}
