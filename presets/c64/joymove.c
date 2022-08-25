
#include "common.h"

/*{w:24,h:21,bpp:1,brev:1,count:1}*/
const char SPRITE_DATA[64] = {
 0x0f,0xff,0x80,0x17,0xff,0x40,0x2b,0xfe,
 0xa0,0x7f,0xff,0xf0,0xff,0xc0,0x3f,0xe0,
 0x3f,0xc0,0x17,0xbe,0xc0,0x2d,0x7f,0xf0,
 0x2b,0x7f,0xf8,0x2a,0xff,0xf8,0x15,0xf6,
 0x00,0x3f,0xf8,0x00,0xfd,0xfc,0x00,0xfd,
 0xff,0x00,0xfe,0xff,0x80,0xff,0x7f,0xc0,
 0xff,0xff,0xc0,0xff,0xff,0xc0,0x0a,0xa8,
 0x00,0x0f,0xf8,0x00,0x0f,0xff,0x80,0x03,
};

void main(void) {
  // variables
  int x = 172;	// sprite X position (16-bit)
  byte y = 145; // sprite Y position (8-bit)
  byte bgcoll;	// sprite background collision flags
  byte joy;	// joystick flags

  // copy sprite pattern to RAM address 0x3800
  memcpy((char*)0x3800, SPRITE_DATA, sizeof(SPRITE_DATA));
  // set sprite #0 shape entry (224)
  POKE(0x400 + 0x3f8 + 0, 0x3800 / 64);
  // set position and color
  VIC.spr_pos[0].x = 172;
  VIC.spr_pos[0].y = 145;
  VIC.spr_color[0] = COLOR_GREEN;
  // enable sprite #0
  VIC.spr_ena = 0b00000001;
  
  // install the joystick driver
  joy_install (joy_static_stddrv);
  
  // loop forever
  while (1) {
    // get joystick bits
    joy = joy_read(0);
    // move sprite based on joystick
    if (JOY_LEFT(joy)) { x -= 1; }   // move left 1 pixel
    if (JOY_RIGHT(joy)) { x += 1; }  // move right 1 pixel
    if (JOY_UP(joy)) { y -= 1; }     // move up 1 pixel
    if (JOY_DOWN(joy)) { y += 1; }   // move down 1 pixel
    // wait for end of frame
    waitvsync();
    // set sprite registers based on position
    VIC.spr_pos[0].x = x;
    VIC.spr_pos[0].y = y;
    // set X coordinate high bit
    VIC.spr_hi_x = (x & 0x100) ? 1 : 0;
    // grab and reset collision flags
    bgcoll = VIC.spr_bg_coll;
    // change color when we collide with background
    VIC.spr_color[0] = (bgcoll & 1) ?
      COLOR_LIGHTRED : COLOR_CYAN;
  }
}
