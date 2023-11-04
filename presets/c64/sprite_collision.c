
#include "common.h"
//#link "common.c"

#include "sprites.h"
//#link "sprites.c"

/*{w:12,h:21,bpp:2,brev:1}*/
const char SPRITEMC[3*21] = {
  0x00,0xAA,0x80,0x02,0xAA,0xA0,0x0A,0xAA,0xA8,
  0x0A,0xAE,0xA8,0x0A,0xBB,0xA8,0x0A,0xBA,0xA8,
  0x0A,0xBB,0xA8,0x0A,0xAE,0xA8,0x0A,0xAA,0xA8,
  0x09,0xAA,0x98,0x08,0x6A,0x48,0x08,0x1D,0x08,
  0x02,0x0C,0x20,0x02,0x0C,0x20,0x02,0x0C,0x20,
  0x00,0x8C,0x80,0x00,0x8C,0x80,0x00,0x55,0x40,
  0x00,0x77,0x40,0x00,0x5D,0x40,0x00,0x15,0x00
};

#define SPRITE_SHAPE 192

// X/Y position arrays
int xpos[8];		// fixed point 9.7
int ypos[8];		// fixed point 8.8
// X/Y velocity arrays
int xvel[8];
int yvel[8];

void init_sprites(void) {
  byte i;
  // setup sprite positions
  for (i=0; i<8; i++) {
    xpos[i] = ((i & 3) * 0x2000) - 0x3000;
    ypos[i] = (i * 0x1000) - 0x3000;
    sprshad.spr_color[i] = i | 8;
  }
}

void move_sprites(void) {
  byte i;
  for (i=0; i<8; i++) {
    //VIC.bordercolor = i;
    sprite_draw(i,
      (xpos[i] >> 7) + 172,
      (ypos[i] >> 8) + 145, 
      SPRITE_SHAPE);
    // update position
    xpos[i] += xvel[i];
    ypos[i] += yvel[i];
  }
}

void update_sprites(void) {
  byte i;
  for (i=0; i<8; i++) {
    // update velocity
    xvel[i] -= xpos[i] >> 12;
    yvel[i] -= ypos[i] >> 12;
  }
}

void collide_sprites(byte spr_coll) {
  byte i;
  byte mask = 1;
  // exit if no collisions
  if (!spr_coll) return;
  // iterate all sprites that have their flag set
  for (i=0; i<8; i++, mask<<=1) {
    //VIC.bordercolor = i;
    if (spr_coll & mask) {
      // find the first sprite that intersects
      byte j = sprite_get_closest_collision(i, spr_coll);
      // returns 0..7 if a sprite was found
      if (j < 8) {
        xvel[i] = (xpos[i] - xpos[j]) >> 4;
        yvel[i] = (ypos[i] - ypos[j]) >> 4;
      }
    }
  }
}

void iterate_game(void) {
  byte spr_coll;
  
  // wait for vblank
  waitvsync();
  // grab and reset sprite-sprite collision flags
  spr_coll = VIC.spr_coll;
  // then update sprite registers from shadow RAM
  sprite_update(DEFAULT_SCREEN);
  // draw sprites into shadow ram
  move_sprites();
  // and update velocity and position
  update_sprites();
  // if any flags are set in the collision register,
  // process sprite collisions
  collide_sprites(spr_coll);
}

int main(void) {
  
  clrscr();
  VIC.bordercolor = 0;

  // setup sprite library and copy sprite to VIC bank
  sprite_clear();
  sprite_set_shapes(SPRITEMC, SPRITE_SHAPE, 1);
  
  // set colors
  sprshad.spr_mcolor = 0xff;
  VIC.spr_mcolor0 = 4;
  VIC.spr_mcolor1 = 7;

  // set sprite initial positions
  init_sprites();
  
  // game loop
  while (1) {
    iterate_game();
  }
  return 0;
}

