
#include "common.h"

#define MAX_MSPRITES 28

extern byte msprite_order[MAX_MSPRITES];
extern byte msprite_x_lo[MAX_MSPRITES];
extern byte msprite_x_hi[MAX_MSPRITES];
extern byte msprite_y[MAX_MSPRITES];
extern byte msprite_color[MAX_MSPRITES];
extern byte msprite_shape[MAX_MSPRITES];
//extern byte msprite_flags[MAX_MSPRITES];
extern byte msprite_xvel_lo[MAX_MSPRITES];
extern byte msprite_xvel_hi[MAX_MSPRITES];
extern byte msprite_yvel_lo[MAX_MSPRITES];
extern byte msprite_yvel_hi[MAX_MSPRITES];

extern byte msprite_last_y;

void __fastcall__ msprite_render_init();
void __fastcall__ msprite_render_section();
void __fastcall__ msprite_sort();
void __fastcall__ msprite_add_velocity(byte numsprites);

