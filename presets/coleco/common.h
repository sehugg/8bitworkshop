
#ifndef _CV_COMMON_H
#define _CV_COMMON_H

/* Unified common header for libcv platforms.
   The build defines one of: CV_CV (ColecoVision), CV_MSX, CV_SMS (SG-1000/SMS/Game Gear).
   CV_MODE4 is defined for SMS/GG mode-4 builds (2 bytes per tile, 32x28).
   Keep this file identical across the coleco, msx-libcv, sms-sg1000-libcv,
   sms-sms-libcv and sms-gg-libcv preset directories. */

#if defined(CV_MODE4)
/* VRAM map (mode 4)
   0x0000 - 0x3fff character pattern table
   0x3000 - 0x36ff image table
   0x3c00 - 0x3fff sprite attribute table */
#define PATTERN		((const cv_vmemp)0x0000)
#define IMAGE		((const cv_vmemp)0x3000)
#define SPRITES		((const cv_vmemp)0x3c00)
#else
/* VRAM map
   0x0000 - 0x17ff character pattern table
   0x1800 - 0x1aff image table
   0x2000 - 0x37ff color table
   0x3800 - 0x3bff sprite pattern table
   0x3c00 - 0x3fff sprite attribute table */
#define PATTERN		((const cv_vmemp)0x0000)
#define IMAGE		((const cv_vmemp)0x1800)
#define COLOR		((const cv_vmemp)0x2000)
#define SPRITE_PATTERNS ((const cv_vmemp)0x3800)
#define SPRITES		((const cv_vmemp)0x3c00)
#endif

#ifndef COLS
#define COLS 32
#endif

#ifndef ROWS
#if defined(CV_MODE4)
#define ROWS 28
#else
#define ROWS 24
#endif
#endif

/* bytes per row in the name table (mode 4 has a color byte per tile) */
#if defined(CV_MODE4)
#define ROWSTRIDE (COLS*2)
#else
#define ROWSTRIDE COLS
#endif

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;

#ifdef CV_CV
uintptr_t __at(0x6a) font_bitmap_a;
uintptr_t __at(0x6c) font_bitmap_0;
#endif

#ifdef CV_SMS
extern char font_bitmap_a[];
extern char font_bitmap_0[];
#endif

#define COLOR_FGBG(fg,bg) (((fg)<<4)|(bg))
#define COLOR_FG(fg) (((fg)<<4))

#ifndef LOCHAR
#if defined(CV_MODE4)
#define LOCHAR 0x20
#else
#define LOCHAR 0x0
#endif
#endif

#define CHAR(ch) (ch-LOCHAR)

#define wait_vsync() __asm__("halt")

extern volatile uint_fast8_t vint_counter;

extern void vint_handler(void);
extern byte reverse_bits(byte n);
extern void flip_sprite_patterns(word dest, const byte* patterns, word len);

extern char cursor_x;
extern char cursor_y;

extern void clrscr();

extern word getimageaddr(byte x, byte y);
extern byte getcharxy(byte x, byte y);
extern void putcharxy(byte x, byte y, byte attr);
extern void putstringxy(byte x, byte y, const char* string);
#if defined(CV_MODE4)
// mode 4 aliases (same functions, shorter names)
extern byte getchar(byte x, byte y);
extern void putchar(byte x, byte y, byte attr);
extern void putstring(byte x, byte y, const char* string);
#endif
extern void delay(byte i);
extern byte rndint(byte a, byte b);

extern void memset_safe(void* _dest, char ch, word size);
extern char in_rect(byte x, byte y, byte x0, byte y0, byte w, byte h);
// print 4-digit BCD value
extern void draw_bcd_word(byte x, byte y, word bcd);
// add two 16-bit BCD values
extern word bcd_add(word a, word b);

extern void vdp_setup();
extern void set_shifted_pattern(const byte* src, word dest, byte shift);

#if !defined(CV_MODE4)
extern void copy_default_character_set();
#endif

#endif
