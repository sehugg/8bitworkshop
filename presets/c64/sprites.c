
#include <string.h>
#include "sprites.h"

SpriteShadow sprshad;

void sprite_update(char* vicbank) {
  memcpy(vicbank + 0x3f8, sprshad.spr_shapes, 8);
  VIC.spr_ena = sprshad.spr_ena;
  VIC.spr_hi_x = sprshad.spr_hi_x;
  memcpy(VIC.spr_pos, sprshad.spr_pos, 16);
  memcpy(VIC.spr_color, sprshad.spr_color, 8);
  VIC.spr_exp_x = sprshad.spr_exp_x;
  VIC.spr_exp_y = sprshad.spr_exp_y;
  VIC.spr_bg_prio = sprshad.spr_bg_prio;
  VIC.spr_mcolor = sprshad.spr_mcolor;
  VIC.spr_mcolor0 = sprshad.spr_mcolor0;
  VIC.spr_mcolor1 = sprshad.spr_mcolor1;
}

void sprite_shape(char* vicbank, byte index, const char* sprite_data) {
  memcpy(vicbank + index*64, sprite_data, 64);
}

const byte BITS[8] = {
  0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80,
};

void sprite_draw(byte i, word x, byte y, byte shape) {
  byte mask = BITS[i]; // 1 << i;
  sprshad.spr_ena |= mask;
  if (x >> 8)
    sprshad.spr_hi_x |= mask;
  else
    sprshad.spr_hi_x &= ~mask;
  sprshad.spr_pos[i].x = x;
  sprshad.spr_pos[i].y = y;
  sprshad.spr_shapes[i] = shape;
}

void sprite_clear(void) {
  sprshad.spr_ena = 0;
}

