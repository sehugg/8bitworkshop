#ifndef CVU_GRAPHICS_H
#define CVU_GRAPHICS_H 1

#include <stdint.h>

#include "cv_graphics.h"

#ifdef CV_SMS
/*
  Copy n bytes of data from RAM at src to CRAM at dest.

  This function is not reentrant!

  The speed of this function depends on the active video mode
  and if the screen is active.
*/
extern void cvu_memtocmemcpy(cv_cmemp dest, const void * src, size_t n);
#endif

/*
  Copy n bytes of data from RAM at src to VRAM at dest.

  This function is not reentrant!

  The speed of this function depends on the active video mode
  and if the screen is active.
*/
extern void cvu_memtovmemcpy(cv_vmemp dest, const void * src, size_t n);

/*
  Copy n bytes of data from VRAM at src to RAM at dest.

  This function is not reentrant!

  The speed of this function depends on the active video mode
  and if the screen is active.
*/
extern void cvu_vmemtomemcpy(void *dest, cv_vmemp src, size_t n);

/*
  Set n bytes of VRAM at dest to c.

  This function is not reentrant!

  The speed of this function depends on the active video mode
  and if the screen is active.
*/
extern void cvu_vmemset(cv_vmemp dest, int c, size_t n);

/*
	Write an octet to graphics memory at dest.
	
	This function is not reentrant!
*/
extern void cvu_voutb(const uint8_t value, const cv_vmemp dest);

/*
	Read an octet from graphics memory at src.
	
	This function is not reentrant!
*/
extern uint8_t cvu_vinb(const cv_vmemp src);

struct cvu_sprite
{
	uint8_t y;
	uint8_t x;
	uint8_t name;
	uint8_t tag;
};
#ifdef CV_SMS
struct cvu_sprite4
{
	uint8_t y;
	uint8_t x;
	uint8_t name;
};
#endif

// Write sprite to display memory. Use the location of the sprite table as base. number should be in [0, 31].
inline void cvu_set_sprite(const cv_vmemp base, uint_fast8_t number, const struct cvu_sprite *sprite)
{
	cv_set_write_vram_address((base) + (number) * 0x4);
	cv_memtovmemcpy_slow((sprite), 4);
}

// Write sprite to display memory (in mode 4). Use the location of the sprite table as base. number should be in [0, 63].
#ifdef CV_SMS
inline void cvu_set_sprite4(const cv_vmemp base, uint_fast8_t number, const struct cvu_sprite4 *sprite)
{
	cvu_voutb(sprite->y, base + number);
	cv_set_write_vram_address(base + 0x80 + number * 2);
	cv_voutb(sprite->x);
	cv_voutb(sprite->name);
}
#endif

// Todo: is cvu_get_sprite needed?

// Set the x coordinate of the sprite's upper left corner. x will be clamped to [-32, 255]
extern void cvu_set_sprite_x(struct cvu_sprite *sprite, int x) __preserves_regs(d, e);

extern int cvu_get_sprite_x(const struct cvu_sprite *sprite) __preserves_regs(b, c, d, e);

// Set the y coordinate of the sprite's upper left corner. y will be clamped to [-32, 207]
extern void cvu_set_sprite_y(struct cvu_sprite *sprite, int y) __preserves_regs(d, e);

extern int cvu_get_sprite_y(const struct cvu_sprite *sprite) __preserves_regs(d, e);

// Set them both at once.
extern void cvu_set_sprite_xy(struct cvu_sprite *sprite, int x, int y);

// Set the sprite's color.
inline void cvu_set_sprite_color(struct cvu_sprite *sprite, enum cv_color color)
{
	sprite->tag = (sprite->tag & 0x80) | color;
}

extern enum cv_color cvu_get_sprite_color(struct cvu_sprite *sprite);

#endif

