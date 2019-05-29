
#ifndef _ACBIOS_H
#define _ACBIOS_H

// FONT DESCRIPTORS

typedef struct {
  byte base_ch;
  byte frame_x;
  byte frame_y;
  byte pattern_x;
  byte pattern_y;
  const byte* chartab;
} FontDescriptor;

const FontDescriptor __at(0x206) FNTSYS;
const FontDescriptor __at(0x20d) FNTSML;

// BIOS COMMANDS

#define STRDIS	0x34

// FUNCTIONS

#define OPT_1x1		0x00
#define OPT_2x2		0x40
#define OPT_4x4		0x80
#define OPT_8x8		0xc0
#define OPT_XOR		0x20
#define OPT_OR		0x10
#define OPT_ON(n)	((n)<<2)
#define OPT_OFF(n)	((n))

void activate_interrupts(void);
void wait_for_vsync(void);

void display_string(byte x, byte y, byte options, const char* str);
void paint_rectangle(byte x, byte y, byte w, byte h, byte colormask);
void write_relative(byte x, byte y, byte magic, const char* pattern);

// QUICK MACROS

#define SYS_SETOUT(verbl,horcb,inmod)\
	__asm__("rst 0x38");\
        __asm__(".db 0x17");\
        __asm__(".db "#verbl);\
        __asm__(".db "#horcb);\
        __asm__(".db "#inmod);\

#endif
