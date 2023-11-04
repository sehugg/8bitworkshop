
#include <string.h>
#include "sprites.h"

SpriteShadow sprshad;

void sprite_clear(void) {
  memset(&sprshad, 0, sizeof(sprshad));
}

void sprite_update(byte* screenmem) {
  memcpy(screenmem + 0x3f8, sprshad.spr_shapes, 8);
  memcpy((void*)VIC.spr_pos, sprshad.spr_pos, 16);
  memcpy((void*)VIC.spr_color, sprshad.spr_color, 8);
  VIC.spr_ena = sprshad.spr_ena;
  VIC.spr_hi_x = sprshad.spr_hi_x;
  VIC.spr_exp_x = sprshad.spr_exp_x;
  VIC.spr_exp_y = sprshad.spr_exp_y;
  VIC.spr_bg_prio = sprshad.spr_bg_prio;
  VIC.spr_mcolor = sprshad.spr_mcolor;
}

void sprite_set_shapes(const void* sprite_data,
                       byte index,
                       byte count) 
{
  memcpy(get_vic_bank_start() + index * 64, 
         sprite_data, 
         64 * count);
}

const byte BITS[8] = {
  0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80
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

byte sprite_get_closest_collision(byte i, byte spr_coll) {
  byte j;
  byte jmask = 1;
  byte dx,dy;
  if (spr_coll & BITS[i]) {
    spr_coll ^= BITS[i];
    for (j=0; j<8; j++, jmask<<=1) {
      if (spr_coll & jmask) {
        // TODO?
        dx = sprshad.spr_pos[i].x - sprshad.spr_pos[j].x + 24;
        if (dx < 48) {
          dy = sprshad.spr_pos[i].y - sprshad.spr_pos[j].y + 21;
          if (dy < 42) {
            return j;
          }
        }
      }
    }
  }
  return 0xff;
}
