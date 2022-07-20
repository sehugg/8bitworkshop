#ifndef _SPRITES_H
#define _SPRITES_H

#include "common.h"

#define DEFAULT_SCREEN ((void*)0x400)

typedef struct {
  struct {
    byte x;              /* X coordinate */
    byte y;              /* Y coordinate */
  } spr_pos[8];
  byte spr_hi_x;       /* High bits of X coordinate */
  byte spr_ena;        /* Enable sprites */
  byte spr_exp_y;      /* Expand sprites in Y dir */
  byte spr_bg_prio;    /* Priority to background */
  byte spr_mcolor;     /* Sprite multicolor bits */
  byte spr_exp_x;      /* Expand sprites in X dir */
  byte spr_color[8];   /* Colors for the sprites */
  byte spr_shapes[8];	/* sprite shapes */
} SpriteShadow;

extern SpriteShadow sprshad;

void sprite_clear(void);
void sprite_update(char* screenmem);
void sprite_shape(char* vicbank, byte index, const char* sprite_data);
void sprite_draw(byte i, word x, byte y, byte shape);
byte sprite_get_closest_collision(byte i, byte spr_coll);

#endif
