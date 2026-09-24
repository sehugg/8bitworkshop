/*
Joypad input on Game Boy.

waitpad() blocks until the chosen buttons are held, and waitpadup() waits
for them to be released again -- handy for title screens. For gameplay
you poll joypad() once per frame and compare against the previous frame
to find edges: a button that is down now but was up before has just been
pressed.

This demo waits for START, then moves a sprite with the d-pad while
counting A and B presses with edge detection.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

// an 8x8 ball sprite (2bpp)
static const uint8_t ball_tile[] = {
/*;;{w:8,h:8,bpp:1,count:1,brev:1,np:2,pofs:1,sl:2};;*/
  0x3C,0x3C,0x42,0x7E,0x99,0xFF,0xA9,0xFF,
  0x89,0xFF,0x89,0xFF,0x42,0x7E,0x3C,0x3C
/*;;*/
};

uint8_t a_count, b_count;

// write a zero-padded 3-digit decimal number
static void put_u8(uint8_t x, uint8_t y, uint8_t v) {
  char buf[4];
  buf[3] = '\0';
  buf[2] = '0' + (v % 10);
  buf[1] = '0' + (v / 10) % 10;
  buf[0] = '0' + (v / 100) % 10;
  put_str(x, y, buf);
}

void main(void) {
  uint8_t keys, last_keys;
  uint8_t x = 80, y = 72;

  DISPLAY_OFF;
  BGP_REG = OBP0_REG = OBP1_REG = 0xE4;

  font_init();
  set_sprite_data(0, 1, ball_tile);
  set_sprite_tile(0, 0);

  put_str(4, 6, "PRESS START");

  SHOW_BKG;
  SHOW_SPRITES;
  DISPLAY_ON;

  // block until START is pressed, then wait for it to be released
  waitpad(J_START);
  waitpadup();

  // replace the title message with the HUD
  fill_bkg_rect(4, 6, 11, 1, ' ');
  put_str(1, 0, "D-PAD: MOVE");
  put_str(1, 1, "A:000  B:000");
  a_count = b_count = 0;

  move_sprite(0, x, y);

  last_keys = 0;

  while (1) {
    uint8_t pressed;

    wait_vbl_done();
    keys = joypad();

    // a button "just pressed" is down now and was up last frame
    pressed = keys & ~last_keys;
    if (pressed & J_A) {
      a_count++;
      put_u8(3, 1, a_count);
    }
    if (pressed & J_B) {
      b_count++;
      put_u8(11, 1, b_count);
    }

    // dpad is read as held keys, so movement repeats while held
    if (keys & J_LEFT)  x--;
    if (keys & J_RIGHT) x++;
    if (keys & J_UP)    y--;
    if (keys & J_DOWN)  y++;

    // keep the sprite on screen
    if (x < 8)   x = 8;
    if (x > 152) x = 152;
    if (y < 16)  y = 16;
    if (y > 136) y = 136;

    move_sprite(0, x, y);
    last_keys = keys;
  }
}
