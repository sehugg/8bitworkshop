
#include "common.h"
//#link "common.c"

#include "scrolling.h"
//#link "scrolling.c"

#include "sprites.h"
//#link "sprites.c"

#include <cbm_petscii_charmap.h>

static void draw_cell(word ofs, byte x, byte y) {
  byte xx = x + origin_x;
  byte yy = y + origin_y;
  byte ch = xx ^ yy;
  hidbuf[ofs] = ch; // character
  colorbuf[ofs] = ch; // color
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
  sprite_draw(0, playerx-camerax+160, playery-cameray+140, 192);
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
  }
  if (dy) {
    if (dy > 8) dy = 8;
    else if (dy < -8) dy = -8;
    cameray -= dy;
  }
  scroll_xy(dx, dy);
}

void main(void) {
  
  clrscr();
  printf("\r\n\r\n\r\n                           Hello World!");
  printf("\r\n\r\n\r\n               Use the joystick to move");
  printf("\r\n\r\n\r\n             And the camera will follow");

  // setup scrolling library
  scroll_setup();
  VIC.bordercolor = 12;

  // setup sprite library and copy sprite to VIC bank
  sprite_clear();
  sprite_set_shapes(SPRITE1, 192, 1);
  sprshad.spr_color[0] = 13;

  // install the joystick driver
  joy_install (joy_static_stddrv);

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
    // wait for end of frame
    waitvsync();
    // then update sprite registers
    sprite_update(visbuf);
    // update scroll registers
    // and swap screens if we must
    scroll_update();
  }
}
