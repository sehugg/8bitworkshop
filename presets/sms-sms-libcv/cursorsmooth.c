/*
This demo animates two 16 x 16 sprites.
It also uses the collision detection bit.

Ported to the Sega VDP's mode 4: each 8x16 sprite is
built from two 8x8 pattern tiles, and a 16x16 cursor is
two sprites side by side (a "metasprite").
*/

#include <stdint.h>
#include <stdlib.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"
//#link "common.c"
//#link "chr_generic.c"

extern const unsigned char CHR_GENERIC[8192];

// tile number of the cursor's top-left 8x8 tile
#define SPR_CURSOR 0x80
// inverted cursor used to show collision (SPR_CURSOR+4)
#define SPR_CURSOR_HIT (SPR_CURSOR+4)

// 16x16 monochrome cursor (a crosshair), 2 bytes per row
static const uint8_t cursor_mono[16*2] = {
  0x00, 0x00,
  0x01, 0x80,
  0x01, 0x80,
  0x01, 0x80,
  0x01, 0x80,
  0x01, 0x80,
  0x01, 0x80,
  0xff, 0xff,
  0xff, 0xff,
  0x01, 0x80,
  0x01, 0x80,
  0x01, 0x80,
  0x01, 0x80,
  0x01, 0x80,
  0x01, 0x80,
  0x00, 0x00,
};

// Expand a 16x16 mono bitmap into four mode-4 8x8 tiles
// (top-left, bottom-left, top-right, bottom-right).
// Each tile is 8 rows of 4 plane bytes; we use plane 0
// so the sprites are drawn in color 1 of the sprite palette.
void expand_cursor(word dest, byte invert) {
  byte r;
  for (r=0; r<16; r++) {
    byte left  = cursor_mono[r*2];
    byte right = cursor_mono[r*2+1];
    byte half = r >> 3;			// 0 = top half, 1 = bottom half
    word a = dest + half*32 + (r & 7)*4;
    if (invert) { left = ~left; right = ~right; }
    cvu_voutb(left, a);
    cvu_voutb(0, a+1);
    cvu_voutb(0, a+2);
    cvu_voutb(0, a+3);
    cvu_voutb(right, a+2*32);
    cvu_voutb(0, a+2*32+1);
    cvu_voutb(0, a+2*32+2);
    cvu_voutb(0, a+2*32+3);
  }
}

void setup_graphics() {
  cvu_memtovmemcpy(PATTERN, CHR_GENERIC, sizeof(CHR_GENERIC));
  set_default_palette();
  // build the normal and inverted cursor sprites
  expand_cursor(PATTERN + SPR_CURSOR*32, 0);
  expand_cursor(PATTERN + SPR_CURSOR_HIT*32, 1);
}

// Set all sprites offscreen.
void set_sprites_offscreen() {
  struct cvu_sprite4 s;
  byte i;
  s.x = 0;
  s.y = 240; // set offscreen
  s.name = 0;
  for (i=0; i<64; i++) {
    cvu_set_sprite4(SPRITES, i, &s);
  }
}

// Move a cursor with the specified controller.
// The struct stores the top-left corner of the 16x16 cursor.
void move_cursor(struct cvu_sprite4 *s, int controller) {
  int x, y;
  struct cv_controller_state cs;

  // Read the game controller state.
  cv_get_controller_state(&cs, controller);

  // Copy the sprite X and Y coordinates to local variables.
  x = s->x;
  y = s->y;

  // Move one pixel in the direction the joystick is pointed.
  if (cs.joystick & CV_RIGHT) x++;
  if (cs.joystick & CV_LEFT) x--;
  if (cs.joystick & CV_DOWN) y++;
  if (cs.joystick & CV_UP) y--;

  // Make sure cursor doesn't leave the screen.
  if (x < 0) x = 0;
  if (x > 231) x = 231;
  if (y < 0) y = 0;
  if (y > 151) y = 151;

  // Update the cursor struct in CPU RAM.
  s->x = x;
  s->y = y;
}

// Write a 16x16 cursor as two 8x16 sprites.
void draw_cursor(byte index, struct cvu_sprite4 *s) {
  struct cvu_sprite4 right;
  right.y = s->y;
  right.x = s->x + 8;
  right.name = s->name + 2;
  cvu_set_sprite4(SPRITES, index, s);
  cvu_set_sprite4(SPRITES, index+1, &right);
}

void main(void) {
  struct cvu_sprite4 s;		// The sprite used for the player cursor.
  struct cvu_sprite4 s2;	// The sprite used for the target cursor.
  byte name;

  vdp_setup();
  setup_graphics();

  cv_set_sprite_magnification(false); // no sprite magnification
  cv_set_sprite_big(true);	// 8x16 pixel sprites.

  // Set all sprites offscreen initially.
  // This ensures they won't set the collision bit.
  set_sprites_offscreen();

  // Set attributes for cursor 0.
  s.x = 60;
  s.y = 60;
  s.name = SPR_CURSOR;
  // Set attributes for cursor 1.
  s2.x = 120;
  s2.y = 60;
  s2.name = SPR_CURSOR;

  // Turn on video display.
  cv_set_screen_active(true);

  for(;;)
  {
    // Wait for VBLANK (next frame).
    wait_vsync();
    // Use the inverted cursor if there was a collision last frame.
    name = cv_get_sprite_collission() ? SPR_CURSOR_HIT : SPR_CURSOR;
    // Move both cursors by their corresponding joystick.
    move_cursor(&s, 0);
    move_cursor(&s2, 1);
    s.name = name;
    s2.name = name;
    // Update VRAM with new sprite records.
    draw_cursor(0, &s);
    draw_cursor(2, &s2);
  }
}
