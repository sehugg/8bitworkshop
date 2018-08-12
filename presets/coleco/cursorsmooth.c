
#include <stdint.h>
#include <stdlib.h>
#include <cv.h>
#include <cvu.h>

const uint8_t sprite[0x1][0x20] = {/*{w:16,h:16,remap:[4,0,1,2,3],brev:1}*/
  {0xE0, 0xC0, 0xA0, 0x10, 0x0A, 0x04, 0x0B, 0x03, 0x03, 0x0B, 0x04, 0x0A, 0x10, 0xA0, 0xC0, 0xE0, 0x07, 0x03, 0x05, 0x08, 0x50, 0x20, 0xD0, 0xC0, 0xC0, 0xD0, 0x20, 0x50, 0x08, 0x05, 0x03, 0x07}
};

/* VRAM map
   0x0000 - 0x17ff character pattern table
   0x1800 - 0x1aff image table
   0x2000 - 0x37ff color table
   0x3800 - 0x3bff sprite pattern table
   0x3c00 - 0x3fff sprite attribute table
*/

const cv_vmemp IMAGE = 0x1800;
const cv_vmemp SPRITES = 0x3c00;
const cv_vmemp SPRITE_PATTERNS = 0x3800;

volatile bool step;	// Has to be volatile since it's modified in the NMI handler.

void move_cursor(struct cvu_sprite *s)
{
  int x, y;
  struct cv_controller_state cs;

  cv_get_controller_state(&cs, 0);	// Read the controller.

  x = cvu_get_sprite_x(s);
  y = cvu_get_sprite_y(s);

  if(cs.joystick & CV_RIGHT)	// Move cursor to the right by one pixel.
    x++;
  else if(cs.joystick & CV_LEFT)	// Move the cursor to the left by one pixel.
    x--;
  if(cs.joystick & CV_DOWN)	// Move the cursor down by one pixel.
    y++;
  else if(cs.joystick & CV_UP)	// Move the cursor up by one pixel.
    y--;

  // Move cursor by how much the wheels on the super action controllers or the ball in the roller controller indicate.
  x += cvu_get_spinner(0);
  y += cvu_get_spinner(1);

  // Limit to area.
  if(x > 239)
    x = 239;
  else if(x < 0)
    x = 0;
  if(y > 152)
    y = 152;
  else if(y < 0)
    y = 0;

  cvu_set_sprite_xy(s, x, y);
}

void nmi(void)
{
	step = true;
  cv_set_colors(0, CV_COLOR_YELLOW);
}

void waitvblank() {
  step = false;
  while(!step);	// Wait until the NMI handler sets step to true.
  cv_set_colors(0, CV_COLOR_RED);
}

void shuffle_sprites(struct cvu_sprite* s) {
  int i;
  for (i=1; i<32; i++) {
    s->x = i*16;
    s->y = i*8;
    cvu_set_sprite(SPRITES, i, s);	// Update the cursor on the screen.
  }
}

void main(void)
{
  struct cvu_sprite s;	// The sprite used for the player cursor.
  struct cvu_sprite s2;	// The sprite used for the target cursor.

  cv_set_screen_active(false);	// Switch screen off.

  cv_set_color_table(0x3fff);
  cv_set_character_pattern_t(0x1fff);
  cv_set_image_table(IMAGE);
  cv_set_sprite_pattern_table(SPRITE_PATTERNS);
  cv_set_sprite_attribute_table(SPRITES);
  cv_set_screen_mode(CV_SCREENMODE_BITMAP);	// Doesn't really matter much here. We only need a screen mode that supports sprites.
  cvu_vmemset(0, 0, 0x4000);

  cv_set_sprite_magnification(false);
  cv_set_sprite_big(true);	// 16x16 pixel sprites.

  cvu_set_sprite_x(&s, 60);	// Set initial cursor position.
  cvu_set_sprite_y(&s, 60);	// Set initial cursor position.
  cvu_set_sprite_color(&s, CV_COLOR_WHITE);
  cvu_set_sprite_color(&s2, CV_COLOR_GREEN);
  s.name = 0;	// Use sprite pattern number 0.
  s2.name = 0;
  cvu_memtovmemcpy(SPRITE_PATTERNS, sprite, 0x20);	// Copy sprite pattern number 0 to graphics memory.
  
  cv_set_screen_active(true);	// Switch screen on.

  shuffle_sprites(&s2);
  
  cv_set_vint_handler(nmi);
  for(;;)
  {
    cv_set_colors(0, 0);
    waitvblank();
    cv_set_colors(0, CV_COLOR_LIGHT_GREEN);
    cvu_set_sprite_color(&s, cv_get_sprite_collission() ? 
                         CV_COLOR_RED : CV_COLOR_WHITE);
    move_cursor(&s);
    cvu_set_sprite(SPRITES, 0, &s);	// Update the cursor on the screen.
  }
}
