
#ifndef _ACLIB_H
#define _ACLIB_H

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;

/// HARDWARE

__sfr __at(0x00) hw_col0r;	// palette 0
__sfr __at(0x01) hw_col1r;
__sfr __at(0x02) hw_col2r;
__sfr __at(0x03) hw_col3r;
__sfr __at(0x04) hw_col0l;
__sfr __at(0x05) hw_col1l;
__sfr __at(0x06) hw_col2l;
__sfr __at(0x07) hw_col3l;	// palette 7

__sfr __at(0x09) hw_horcb;	// horiz color boundary
__sfr __at(0x0a) hw_verbl;	// vertical blanking line * 2
__sfr __at(0x0c) hw_magic;	// magic register
__sfr __at(0x19) hw_xpand;	// expander register

__sfr __at(0x08) hw_intst;	// intercept test feedback

__sfr __at(0x10) hw_p1ctrl;	// player controls
__sfr __at(0x11) hw_p2ctrl;	// player controls
__sfr __at(0x12) hw_p3ctrl;	// player controls
__sfr __at(0x13) hw_p4ctrl;	// player controls

#define M_SHIFT0	0x00
#define M_SHIFT1	0x01
#define M_SHIFT2	0x02
#define M_SHIFT3	0x03
#define M_XPAND		0x08
#define M_MOVE		0x00
#define M_OR		0x10
#define M_XOR		0x20
#define M_FLOP		0x40
#define M_SHIFT(x)	((x)&3)
#define XPAND_COLORS(off,on) (((off)&3) | (((on)&3)<<2))

#define VHEIGHT 89	// number of scanlines
#define VBWIDTH 40	// number of bytes per scanline
#define PIXWIDTH 160	// 4 pixels per byte

byte __at (0x0000) vmagic[VHEIGHT][VBWIDTH];
byte __at (0x4000) vidmem[VHEIGHT][VBWIDTH];

#define LOCHAR 32
#define HICHAR 127
#define FONT_BWIDTH 1
#define FONT_HEIGHT 8

/// GRAPHICS FUNCTIONS

void clrscr();
void vline(byte x, byte y1, byte y2, byte col, byte op);
void pixel(byte x, byte y, byte col, byte op);
void render_sprite(const byte* src, byte x, byte y, byte op);
void erase_sprite(const byte* src, byte x, byte y);
void draw_char(byte ch, byte x, byte y, byte op);
void draw_string(const char* str, byte x, byte y);
void draw_bcd_word(word bcd, byte x, byte y, byte op);
word bcd_add(word a, word b);

#endif
