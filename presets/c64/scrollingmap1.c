
#include <stdio.h>
#include <conio.h>
#include <c64.h>
#include <cbm_petscii_charmap.h>
#include <string.h>
#include <stdlib.h>
#include <stdint.h>
#include <joystick.h>

//#resource "c64-sid.cfg"
#define CFGFILE c64-sid.cfg

#include "common.h"
//#link "common.c"

#include "scrolling.h"
//#link "scrolling.c"

#include "sprites.h"
//#link "sprites.c"

//#link "level1.ca65"

extern const byte charset_data[];
extern const byte charset_attrib_data[];
extern const byte chartileset_data[];
extern const byte chartileset_tag_data[];
extern const byte* map_row_pointers[];

#define MAP_COLS 28
#define MAP_ROWS 11

static void draw_cell(word ofs, byte x, byte y) {
  sbyte xx = x + origin_x;
  sbyte yy = y + origin_y;
  sbyte col = xx >> 2;
  sbyte row = yy >> 2;
  byte xofs = xx & 3;
  byte yofs = yy & 3;
  char ch;
  char color;
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) {
    ch = 0;
    color = 0;
  } else {
    byte tileindex = map_row_pointers[row][col];
    ch = chartileset_data[xofs + yofs*4 + tileindex*16];
    color = charset_attrib_data[ch];
  }
  hidbuf[ofs] = ch;
  colorbuf[ofs] = color;
}

void scroll_draw_column(byte col) {
  byte y;
  word ofs = col;
  for (y=0; y<ROWS; y++) {
    draw_cell(ofs, col, y);
    ofs += COLS;
  }
}

void scroll_draw_row(byte row) {
  byte x;
  word ofs = row * COLS;
  for (x=0; x<COLS; x++) {
    draw_cell(ofs, x, row);
    ++ofs;
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

int playerx = 0;
int playery = 0;
int camerax = 0;
int cameray = 0;

void update_player() {
  sprite_draw(0, playerx-camerax+172, playery-cameray+140, 255);
}

void camera_follow(byte moving) {
  int dx, dy;
  dx = camerax - playerx;
  dy = cameray - playery;
  if (moving && abs(dx) < 32 && abs(dy) < 32) return;
  dx >>= 4;
  dy >>= 4;
  if (dx) {
    if (dx > 8) dx = 8;
    else if (dx < -8) dx = -8;
    camerax -= dx;
    scroll_horiz(dx);
  }
  if (dy) {
    if (dy > 8) dy = 8;
    else if (dy < -8) dy = -8;
    cameray -= dy;
    scroll_vert(dy);
  }
}

void refresh_world(void) {
  byte i;
  for (i=0; i<25; i++) {
    scroll_draw_row(i);
  }
}

void main(void) {
  
  clrscr();
  
  // setup scrolling library
  scroll_setup();

  // multicolor character mode
  VIC.ctrl2 |= 0x10;
  VIC.bgcolor0 = 6;
  VIC.bgcolor1 = 0;
  VIC.bgcolor2 = 1;
  
  // select character set @ 0x8800
  VIC.addr = 0x12;
  memcpy((char*)0x8800, charset_data, 520);

  // setup sprite library and copy sprite to VIC bank
  sprite_clear();
  sprite_set_shapes(SPRITE1, 255, 1);
  sprshad.spr_color[0] = 13;

  // install the joystick driver
  joy_install (joy_static_stddrv);

  // repaint screen memory w/ the map
  refresh_world();

  // infinite loop
  while (1) {
    static char speed;
    static char joy;
    static bool slowframe = false;
    // get joystick bits
    joy = joy_read(0);
    // speed up scrolling while button pressed
    speed = JOY_BTN_1(joy) ? 3 : 1;
    // if we copied screen memory last frame,
    // double speed of player for this frame
    if (slowframe) speed *= 2;
    // move sprite based on arrow keys
    if (JOY_LEFT(joy)) playerx -= speed;
    if (JOY_RIGHT(joy)) playerx += speed;
    if (JOY_UP(joy)) playery -= speed;
    if (JOY_DOWN(joy)) playery += speed;
    // move the camera?
    camera_follow(joy);
    slowframe = swap_needed;
    // animate sprite in shadow sprite ram
    update_player();
    // wait for vblank
    wait_vblank();
    // then update sprite registers
    sprite_update(visbuf);
    // update scroll registers
    // and swap screens if we must
    scroll_update();
  }
}
