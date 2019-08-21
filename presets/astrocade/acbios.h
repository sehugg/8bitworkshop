
#ifndef _ACBIOS_H
#define _ACBIOS_H

#include "aclib.h"

// FONT DESCRIPTORS

typedef struct {
  byte base_ch;
  byte frame_x;
  byte frame_y;
  byte pattern_x;
  byte pattern_y;
  const byte* chartab;
} FontDescriptor;

const FontDescriptor __at(0x206) FNTSYS; // system font
const FontDescriptor __at(0x20d) FNTSML; // small font
const byte __at(0x214) ALKEYS[4]; // "all keys" keyboard mask

// SENTRY

typedef enum {
  SNUL,
  SCT0,SCT1,SCT2,SCT3,SCT4,SCT5,SCT6,SCT7,
  SF0,SF1,SF2,SF3,SF4,SF5,SF6,SF7,
  SSEC,
  SKYU,SKYD,
  ST0,SJ0,ST1,SJ1,ST2,SJ2,ST3,SJ3,
  SP0,SP1,SP2,SP3
} SENTRYCode;

typedef struct {
  byte code;
  word address;
} DOITEntry;

#define DOIT_END	0xff

// PATTERNS

typedef struct {
  sbyte xofs, yofs;
  byte xsize, ysize;
  byte pattern[0];
} RelativeBlock;

typedef struct {
  byte xsize, ysize;
  byte pattern[0];
} PatternBlock;

// FUNCTIONS

#define OPT_1x1		0x00
#define OPT_2x2		0x40
#define OPT_4x4		0x80
#define OPT_8x8		0xc0
#define OPT_XOR		0x20
#define OPT_OR		0x10
#define OPT_ON(n)	((n)<<2)
#define OPT_OFF(n)	((n))

#define DISBCD_SML	0x40
#define DISBCD_NOZERO	0x80

void activate_interrupts(void);
void sleep(byte frames) __z88dk_fastcall;
void fast_vsync(void);

void display_string(byte x, byte y, byte options, const char* str);
void paint_rectangle(byte x, byte y, byte w, byte h, byte colormask);
void blank_area(byte wb, byte h, byte data, byte* video);

void write_relative(byte x, byte y, byte magic, const byte* pattern);
void write_pattern(byte x, byte y, byte magic, const byte* pattern);

void display_bcd_number(byte x, byte y, byte options, const byte* number, byte extopt);
void bcdn_add(byte* dest, byte size, const byte* n);
void bcdn_sub(byte* dest, byte size, const byte* n);
byte ranged_random(byte n) __z88dk_fastcall;
byte keycode_to_ascii(byte n) __z88dk_fastcall;

word sense_transition(const byte keypad_mask[4]) __z88dk_fastcall;
void respond_to_input(const DOITEntry* doit_table, byte a);
void respond_to_input_b(const DOITEntry* doit_table, byte b);

void begin_music(const byte* stack, byte voices, const byte* musicdata);
void end_music(void);

// QUICK MACROS

#define SYS_ACTINT()\
	__asm__("rst 0x38");\
        __asm__(".db 0x0f");\

#define SYS_PAWS(frames)\
	__asm__("rst 0x38");\
        __asm__(".db 0x51");\
        __asm__(".db "#frames);\

#define SYS_SETOUT(verbl,horcb,inmod)\
	__asm__("rst 0x38");\
        __asm__(".db 0x17");\
        __asm__(".db "#verbl);\
        __asm__(".db "#horcb);\
        __asm__(".db "#inmod);\

#define SYS_FILL(dest,count,val)\
	__asm__("rst 0x38");\
        __asm__(".db 0x1b");\
        __asm__(".dw "#dest);\
        __asm__(".dw "#count);\
        __asm__(".db "#val);\

#define SYS_MOVE(dest,src,count)\
	__asm__("rst 0x38");\
        __asm__(".db 0x5f");\
        __asm__(".dw "#dest);\
        __asm__(".dw "#count);\
        __asm__(".dw "#src);\

#define SYS_RECTAN(x,y,width,height,color)\
	__asm__("rst 0x38");\
        __asm__(".db 0x1d");\
        __asm__(".db "#x);\
        __asm__(".db "#y);\
        __asm__(".db "#width);\
        __asm__(".db "#height);\
        __asm__(".db "#color);\

#define SYS_BMUSIC(stack,voices,musicdata)\
	__asm__("rst 0x38");\
        __asm__(".db 0x13");\
        __asm__(".dw "#stack);\
        __asm__(".db "#voices);\
        __asm__(".dw "#musicdata);\

#define SYS_EMUSIC()\
	__asm__("rst 0x38");\
        __asm__(".db 0x15");\

#define RESET_TIMEOUT() \
	__asm__("ld a,#0xff");\
        __asm__("ld (0x4FEC),a");

#endif
