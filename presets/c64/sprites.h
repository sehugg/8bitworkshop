#ifndef _SPRITES_H
#define _SPRITES_H

#include "common.h"

typedef struct {
  byte spr_ena;        /* Enable sprites */
  byte spr_hi_x;       /* High bits of X coordinate */
  byte spr_exp_x;      /* Expand sprites in X dir */
  byte spr_exp_y;      /* Expand sprites in Y dir */
  byte spr_bg_prio;    /* Priority to background */
  byte spr_mcolor;     /* Sprite multicolor bits */
  byte spr_mcolor0;    /* Color 0 for multicolor sprites */
  byte spr_mcolor1;    /* Color 1 for multicolor sprites */
  byte spr_color[8];   /* Colors for the sprites */
  struct {
    byte x;              /* X coordinate */
    byte y;              /* Y coordinate */
  } spr_pos[8];
  byte spr_shapes[8];	/* sprite shapes */
} SpriteShadow;

extern SpriteShadow sprshad;

void sprite_update(char* screenram);
void sprite_shape(char* vicbank, byte index, const char* sprite_data);
void sprite_draw(byte i, word x, byte y, byte shape);
void sprite_clear(void);

#endif
