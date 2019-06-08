
//#resource "astrocade.inc"
#include "aclib.h"
//#link "aclib.s"
#include "acbios.h"
//#link "acbios.s"
#include "acfast.h"
//#link "acfast.s"
//#link "hdr_autostart.s"

#include <stdlib.h>
#include <string.h>

#pragma opt_code_speed

/*{pal:"astrocade",layout:"astrocade"}*/
const byte palette[8] = {
  0x77, 0xBC, 0x35, 0x01,
  0x07, 0xF2, 0x64, 0x01,
};

const byte SPRITE[] = {
  2,8,
  /*{w:8,h:8,bpp:2,brev:1}*/
  0x01,0x40, 0x06,0x90, 0x15,0x54, 0x47,0x51,
  0x45,0xD1, 0x05,0x50, 0x04,0x10, 0x3C,0x3C,
};

#define MAX_SPRITES 8

typedef struct {
  byte x;		// x coordinate
  byte y;		// y coordinate
  byte lastmagic;	// last magic byte used
  byte* lastdest;	// last destination address
  const byte* pattern;	// pattern definition
  byte _unused;
} Actor;

Actor actors[MAX_SPRITES];

void erase_actor(Actor* actor) {
  hw_magic = actor->lastmagic;
  fast_sprite_8(actor->pattern, actor->lastdest);
}

void draw_actor(Actor* actor) {
  byte op = M_XOR;
  byte x = actor->x;
  byte y = actor->y;
  actor->lastdest = &vmagic[y][x>>2];// destination address
  actor->lastmagic = M_SHIFT(x) | op;   // set magic register
  erase_actor(actor);
}

void main(void) {
  byte i;
  // setup palette
  set_palette(palette);
  // set screen height
  // set horizontal color split (position / 4)
  // set interrupt status
  SYS_SETOUT(89*2, 0, 0);
  // clear screen
  SYS_FILL(0x4000, 89*40, 0);
  // infinite loop
  activate_interrupts();
  // fill array
  for (i=0; i<MAX_SPRITES; i++) {
    actors[i].x = rand() & 0x7f;
    actors[i].y = (i*8) & 0x3f;
    actors[i].pattern = SPRITE;
    draw_actor(&actors[i]);
  }
  while (1) {
    fast_vsync();
    hw_col0r = 0x2;
    for (i=0; i<MAX_SPRITES; i++) {
      Actor* a = &actors[i];
      erase_actor(a);
      draw_actor(a);
      a->x++;
    }
    hw_col0r = 0x1;
  }
}
