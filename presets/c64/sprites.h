#ifndef _SPRITES_H
#define _SPRITES_H

#include "common.h"

typedef struct SpriteShadow {
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

/* sprite shadow buffer */
extern SpriteShadow sprshad;

/* set one or more sprite patterns from a byte array */
void sprite_set_shapes(const void* sprite_data, 
                       byte index, 
                       byte count);
/* clear all sprites from shadow buffer */
void sprite_clear();
/* draw a sprite into shadow buffer */
void sprite_draw(byte index, word x, byte y, byte shape);
/* update sprite registers */
void sprite_update(byte* screenmem);

/* get the closest sprite collision
   given the set of collision flags */
byte sprite_get_closest_collision(byte index, byte spr_coll);

// bit lookup table
extern const byte BITS[8];

#endif
