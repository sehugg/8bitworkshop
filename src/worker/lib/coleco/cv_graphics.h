#ifndef CV_GRAPHICS_H
#define CV_GRAPHICS_H 1

#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>

/*
  These are the functions for controlling the graphics chip.
  While a function marked as not reentrant is called no other
  such function from this file may be called at the same time.
*/

typedef uint16_t cv_vmemp; // 14-Bit video memory address type
#ifdef CV_SMS
typedef uint8_t cv_cmemp; // 5-bit color memory address type
#endif

/*
  Activate / deactivate screen
	
  This function is not reentrant!
*/
extern void cv_set_screen_active(bool status);

/*
  Get screen status
*/
extern bool cv_get_screen_active(void);

/*
  Enable / disable external video source.
	
  This function is not reentrant!
*/
extern void cv_set_external_video(bool status);

/*
  Get external video source enabled.
*/
extern bool cv_get_external_video(void);

// TMS99xxA and Sega Master System screen modes
enum cv_screenmode {
	CV_SCREENMODE_STANDARD = 0x00,              // Standard screen modes
	CV_SCREENMODE_TEXT = 0x10,
	CV_SCREENMODE_MULTICOLOR = 0x08,
	CV_SCREENMODE_BITMAP = 0x02,
	CV_SCREENMODE_BITMAP_TEXT = 0x12,           // Usefull undocumented screen modes
	CV_SCREENMODE_BITMAP_MULTICOLOR = 0x0a,
	CV_SCREENMODE_TEXT_MULTICOLOR = 0x18,       // Useless undocumented screen modes
	CV_SCREENMODE_BITMAP_TEXT_MULTICOLOR = 0x1a,
	CV_SCREENMODE_4 = 0x06,                     // Sega Master System 315-5124 mode
	CV_SCREENMODE_4_224 = 0x16,                 // Sega Master System 315-5246 modes
	CV_SCREENMODE_4_240 = 0x0e,
};

/*
  Set screen mode.

  This function is not reentrant!
*/
extern void cv_set_screen_mode(enum cv_screenmode mode);

/*
  Get screen mode.
*/
extern enum cv_screenmode cv_get_screen_mode(void);

// TMS99xxA colors
enum cv_color {
  CV_COLOR_TRANSPARENT = 0x0,
  CV_COLOR_BLACK = 0x1,
  CV_COLOR_GREEN = 0x2,
  CV_COLOR_LIGHT_GREEN = 0x3,
  CV_COLOR_BLUE = 0x4,
  CV_COLOR_LIGHT_BLUE = 0x5,
  CV_COLOR_DARK_RED = 0x6,
  CV_COLOR_CYAN = 0x7,
  CV_COLOR_RED = 0x8,
  CV_COLOR_LIGHT_RED = 0x9,
  CV_COLOR_YELLOW = 0xa,
  CV_COLOR_LIGHT_YELLOW = 0xb,
  CV_COLOR_DARK_GREEN = 0xc,
  CV_COLOR_MAGENTA = 0xd,
  CV_COLOR_GRAY = 0xe,
  CV_COLOR_WHITE = 0xf
};

/*
  Set colors. The foreground color is the text color in text mode,
  in other modes it is unused.
  The background color is used in all modes for the backdrop plane
  (screen outside display area) and as the color that appears under
  transparent characters. In text mode it is used for character
  background. If the background color is the to cv_transparent,
  the external video source is used as background image.
*/
extern void cv_set_colors(enum cv_color foreground, enum cv_color background);

/*
  Set the location of the screen image table.
  Must be a multiple of 0x400. Valid range: [0; 15360].
  When the screenmode is CV_SCREENMODE4 on the Sega 315-5124,
  the location is a multible of 0x800, and the bit 0x400 is and mask to the location.
  This masking functionality is undocumented. To use only the documented
  graphics chip functionality always set bit 0x400.
*/
extern void cv_set_image_table(cv_vmemp loc);

/*
  Set the location of the color table. Must be a multiple of 0x40.
  Valid range: [0; 16320]. 
  When the screen mode ist CV_SCREENMODE_BITMAP,
  CV_SCREENMODE_BITMAP_TEXT or CV_SCREENMODE_BITMAP_MULTICOLOR
  this has a different meaning: The location of the color pattern table is
  either 0 or 8192. The bits 4096 downto 128 are an and mask to the location.
  This masking functionality is undocumented. To use only the documented
  graphics chip functionality always set bits 4096 downto 128.
*/
void cv_set_color_table(cv_vmemp loc);

/*
  Set the location of the character pattern table. Must be a multiple
  of 0x800. Valid range: [0; 14336].
  When the screen mode ist CV_SCREENMODE_BITMAP,
  CV_SCREENMODE_BITMAP_TEXT or CV_SCREENMODE_BITMAP_MULTICOLOR
  this has a different meaning: The location of the character pattern table is
  either 0 or 8192. Unless you add 4096 to the location the first third of the table
  is used for the last third of the screen. Unless you add 2048 to the location the
  first third of the table is used for the middle part of the screen.
  Thus the bits 4096 and 2048 are and and mask to the highest bits of the
  address. This masking functionality is undocumented. To use only the
  documented graphics chip functionality always set bits 4096 and 2048.
*/
// sdcc doesn't accept long function names.
extern void cv_set_character_pattern_t(cv_vmemp loc);

/*
  Set the location of the sprite pattern table.
  Must be a multiple of 0x800. Valid range: [0; 14336].
  When the screenmode is CV_SCREENMODE4 the location is a multiple of 0x2000.
  For the Sega 315-5124 and CV_SCREENMODE4, bits 0x800 and 0x1000 are
  used as and mask. This masking functionality is undocumented. To use only the documented
  graphics chip functionality always set bits 0x1000 downto 0x800.
*/
extern void cv_set_sprite_pattern_table(cv_vmemp loc);

/*
  Set the location of the sprite attribute table.
  Must be a multiple of 0x80. Valid range: [0; 16256].
*/
extern void cv_set_sprite_attribute_table(cv_vmemp loc);

/*
  Set sprite size; When active, sprites are 16x16 pixels instead of 8x8.
	
  This function is not reentrant!
*/
extern void cv_set_sprite_big(bool status);

/*
  Get sprite size.
*/
extern bool cv_get_sprite_big(void);

/*
  Set sprite magnification. When active, all sprites are displayed twice as big.
	
  This function is not reentrant!
*/
extern void cv_set_sprite_magnification(bool status);

/*
  Get sprite magnification.
*/
extern bool cv_get_sprite_magnification(void);

/*
  Get sprite collission.
*/
extern bool cv_get_sprite_collission(void);

/*
  Get invalid sprite. Returns true if there was an invalid sprite.
  If sprite is not 0 it will point to the number of the invalid sprite.
*/
extern bool cv_get_sprite_invalid(uint8_t *sprite);

extern void cv_set_write_vram_address(cv_vmemp address) __preserves_regs(b, c, d, e);

extern void cv_set_read_vram_address(cv_vmemp address) __preserves_regs(b, c, d, e);

#ifdef CV_SMS
extern void cv_set_write_cram_address(cv_cmemp address) __preserves_regs(b, c, d, e);
#endif

extern void cv_memtovmemcpy_slow(const void *src, size_t n);

extern void cv_memtovmemcpy_fast(const void *src, size_t n);

extern void cv_vmemtomemcpy_slow(void *dest, size_t n);

extern void cv_vmemtomemcpy_fast(void *dest, size_t n);

extern void cv_vmemset_slow(int c, size_t n) __preserves_regs(iyl, iyh);

extern void cv_vmemset_fast(int c, size_t n) __preserves_regs(iyl, iyh);

static volatile __sfr __at 0xbe cv_graphics_port;

inline void cv_voutb(const uint8_t value)
{
__asm
	cp	a, (hl)
	cp	a, (hl)
	nop
__endasm;
	cv_graphics_port = value;
}

inline uint8_t cv_vinb(void)
{
__asm
	cp	a, (hl)
	cp	a, (hl)
	nop
__endasm;
	return(cv_graphics_port);
}

#ifdef CV_SMS
void cv_set_left_column_blank(bool status);

void cv_set_sprite_shift(bool status);

enum cv_scroll_inhibit {
  CV_HORIZONTAL_SCROLL_INHIBIT = 0x40,	// Do not scroll top 2 rows
  CV_VERTICAL_SCROLL_INHIBIT = 0x80,	// Do not scroll right 8 columns
};

void cv_set_scroll_inhibit(enum cv_scroll_inhibit inhibit);

void cv_set_hscroll(uint8_t offset);

void cv_set_vscroll(uint8_t offset);
#endif

#endif

