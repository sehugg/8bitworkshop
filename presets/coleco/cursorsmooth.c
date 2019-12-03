
/*
This demo animates two 16 x 16 sprites.
It also uses the collision detection bit.
*/

#include <stdint.h>
#include <stdlib.h>
#include <cv.h>
#include <cvu.h>

// number of sprite patterns
#define NUM_SPRITE_PATTERNS 1

// Sprite bitmap -- can edit with Edit Bitmap button
const uint8_t sprite_data[NUM_SPRITE_PATTERNS][32] = {/*{w:16,h:16,remap:[4,0,1,2,3],brev:1}*/
  {0xE0, 0xC0, 0xA0, 0x11, 0x0B, 0x05, 0x0B, 0x1F, 0x1F, 0x0F, 0x05, 0x0B, 0x11, 0xA0, 0xC0, 0xE0, 0x07, 0x03, 0x05, 0x88, 0xD0, 0xA0, 0xD0, 0xF8, 0xF8, 0xD0, 0xA0, 0xD0, 0x88, 0x05, 0x03, 0x07}
};

const cv_vmemp IMAGE = 0x1800;
const cv_vmemp SPRITES = 0x3c00;
const cv_vmemp SPRITE_PATTERNS = 0x3800;

// Make this variable volatile since it's modified in the NMI handler.
volatile bool vblank;	

// NMI handler routine.
void nmi(void) {
  vblank = true;
}

// Wait for next VBLANK (next frame)
void waitvblank() {
  vblank = false; // reset vblank flag
  while(!vblank); // wait for the NMI handler to set this flag.
}

// Move sprite s with specified controller.
void move_cursor(struct cvu_sprite *s, int controller) {
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

  // M;

  // M;

  // Make sure cursor doesn't leave the screen.
  if(x < 0) x = 0;
  if(x > 239) x = 239;
  if(y < 0) y = 0;
  if(y > 152) y = 152;

  // Update the cursor struct in CPU RAM.
  s->x = x;
  s->y = y;
}

// Set all sprites offscreen.
void set_sprites_offscreen() {
  struct cvu_sprite s;
  s.x = 0;
  s.y = 208; // set offscreen
  s.name = 0;
  s.tag = 0;
  for (int i=0; i<32; i++) {
    cvu_set_sprite(SPRITES, i, &s); // set sprite in Video RAM
  }
}

void setup_vdp() {
  cv_set_color_table(0x3fff);
  cv_set_character_pattern_t(0x1fff);
  cv_set_image_table(IMAGE);
  cv_set_sprite_pattern_table(SPRITE_PATTERNS);
  cv_set_sprite_attribute_table(SPRITES);
  cv_set_screen_mode(CV_SCREENMODE_BITMAP);	// Doesn't really matter much here. We only need a screen mode that supports sprites.
  cvu_vmemset(0, 0, 0x4000); // clear Video RAM
}

void main(void)
{
  struct cvu_sprite s;	// The sprite used for the player cursor.
  struct cvu_sprite s2;	// The sprite used for the target cursor.

  cv_set_screen_active(false);	// Switch screen off.
  setup_vdp();	// Setup VDP tables, erase video RAM

  cv_set_sprite_magnification(false); // no sprite magnification
  cv_set_sprite_big(true);	// 16x16 pixel sprites.

  // Set all sprites offscreen initially.
  // This ensures they won't set the collision bit.
  set_sprites_offscreen();
  
  // Set attributes for sprite 0.
  s.x = 60;
  s.y = 60;
  s.name = 0;	// Use sprite pattern number 0.
  cvu_set_sprite_color(&s, CV_COLOR_WHITE);
  // Set attributes for sprite 1.
  s2.x = 120;
  s2.y = 60;
  s2.name = 0;
  cvu_set_sprite_color(&s2, CV_COLOR_YELLOW);
  // Copy sprite pattern number 0 to graphics memory.
  // Each sprite takes up 16*2 = 32 bytes.
  cvu_memtovmemcpy(SPRITE_PATTERNS,
                   sprite_data,
                   NUM_SPRITE_PATTERNS*32);
  
  // Turn on video display.
  cv_set_screen_active(true);

  // Set NMI handler so we can detect VBLANK.
  cv_set_vint_handler(nmi);
  // Set background color
  cv_set_colors(0, CV_COLOR_BLUE);
  for(;;)
  {
    // Wait for VBLANK (next frame).
    waitvblank();
    // Turn sprite 0 red if there was a collision last frame.
    cvu_set_sprite_color(&s, cv_get_sprite_collission() ? 
                         CV_COLOR_RED : CV_COLOR_WHITE);
    // Move both cursors by their corresponding joystick.
    move_cursor(&s, 0);
    move_cursor(&s2, 1);
    // Update VRAM with new sprite records.
    cvu_set_sprite(SPRITES, 0, &s);
    cvu_set_sprite(SPRITES, 1, &s2);
  }
}
