
#ifndef _ACLIB_H
#define _ACLIB_H

// convenient type definitions

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;
typedef enum { false, true } bool;

/// registers

__sfr __at(0x00) hw_col0r;	// palette 0
__sfr __at(0x01) hw_col1r;
__sfr __at(0x02) hw_col2r;
__sfr __at(0x03) hw_col3r;
__sfr __at(0x04) hw_col0l;
__sfr __at(0x05) hw_col1l;
__sfr __at(0x06) hw_col2l;
__sfr __at(0x07) hw_col3l;	// palette 7
__sfr __at(0x08) hw_concm;	// consumer/commercial mode
__sfr __at(0x09) hw_horcb;	// horiz color boundary
__sfr __at(0x0a) hw_verbl;	// vertical blanking line * 2
__sfr __at(0x0b) hw_colbx;	// palette transfer
__sfr __at(0x0c) hw_magic;	// magic register
__sfr __at(0x0d) hw_infbk;	// interrupt feedback
__sfr __at(0x0e) hw_inmod;	// interrupt enable, mode
__sfr __at(0x0f) hw_inlin;	// interrupt line
__sfr __at(0x19) hw_xpand;	// expander register

__sfr __at(0x08) hw_intst;	// intercept test feedback

__sfr __at(0x10) hw_p1ctrl;	// player 1 controls
__sfr __at(0x11) hw_p2ctrl;	// player 2 controls
__sfr __at(0x12) hw_p3ctrl;	// player 3 controls
__sfr __at(0x13) hw_p4ctrl;	// player 4 controls
__sfr __at(0x14) hw_keypad0;	// keypad column
__sfr __at(0x15) hw_keypad1;	// keypad column
__sfr __at(0x16) hw_keypad2;	// keypad column
__sfr __at(0x17) hw_keypad3;	// keypad column
__sfr __at(0x1c) hw_p1pot;	// player 1 paddle
__sfr __at(0x1d) hw_p2pot;	// player 1 paddle
__sfr __at(0x1e) hw_p3pot;	// player 1 paddle
__sfr __at(0x1f) hw_p4pot;	// player 1 paddle

__sfr __at(0x10) hw_tonmo;	// tone master oscillator
__sfr __at(0x11) hw_tonea;
__sfr __at(0x12) hw_toneb;
__sfr __at(0x13) hw_tonec;
__sfr __at(0x14) hw_vibra;
__sfr __at(0x15) hw_volc;
__sfr __at(0x16) hw_volab;
__sfr __at(0x17) hw_voln;
__sfr __at(0x18) hw_sndbx;

// magic register flags

#define M_SHIFT0	0x00
#define M_SHIFT1	0x01
#define M_SHIFT2	0x02
#define M_SHIFT3	0x03
#define M_ROTATE	0x04
#define M_XPAND		0x08
#define M_MOVE		0x00
#define M_OR		0x10
#define M_XOR		0x20
#define M_FLOP		0x40

#define M_SHIFT(x)	((x)&3)

// xpand register

#define XPAND_COLORS(off,on) (((off)&3) | (((on)&3)<<2))

// collision detection

#define RESET_COLLISION()	(hw_intst)
#define WAS_COLLISION()		((hw_intst & 0xf0)!=0)

// controller flags

#define JOY_UP		0x1
#define JOY_DOWN	0x2
#define JOY_LEFT	0x4
#define JOY_RIGHT	0x8
#define JOY_TRIGGER	0x10

// constants

#define VTOTAL 102	// number of total scanlines
#define VHEIGHT 89	// number of scanlines in use
#define VBWIDTH 40	// number of bytes per scanline
#define PIXWIDTH 160	// 4 pixels per byte

// magic register active area
byte __at (0x0000) vmagic[VTOTAL][VBWIDTH];
// regular frame buffer RAM
byte __at (0x4000) vidmem[VTOTAL][VBWIDTH];

byte __at(0xfff) WASTER; // to soak up shifter residue


/// GRAPHICS FUNCTIONS

void set_palette(byte palette[8]) __z88dk_fastcall; // palette in reverse order

#define SET_PALETTE(palette)\
__asm__("ld hl,#"#palette);\
__asm__("ld bc,#0x80b");\
__asm__("otir");\

#define SET_RIGHT_PALETTE(palette)\
__asm__("ld hl,#"#palette);\
__asm__("ld bc,#0x40b");\
__asm__("otir");\

/// SOUND FUNCTIONS

void set_sound_registers(byte regs[8]) __z88dk_fastcall; // in reverse too

/// INTERRUPTS

typedef void (*t_interrupt_handler)(void) __interrupt;

void set_interrupt_vector(t_interrupt_handler*ih) __z88dk_fastcall;

#define CHANGE_INTERRUPT_VECTOR(ihp)\
__asm__("ld hl,#"#ihp);\
__asm__("ld a,l");\
__asm__("out (0x0D),a");\
__asm__("ld a,h");\
__asm__("ld i,a");\

#endif
