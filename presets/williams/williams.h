
#ifndef _WILLIAMS_H
#define _WILLIAMS_H

typedef unsigned char byte;
typedef unsigned char bool;
typedef signed char sbyte;
typedef unsigned short word;

enum { false=0, true=1 };

byte* palette = 0xc000;
byte* nvram = 0xcc00;

#define input0 (*(byte*)0xc804)
#define input1 (*(byte*)0xc806)
#define input2 (*(byte*)0xc80c)
#define sound_pia (*(byte*)0xc80c)
#define rom_select *((byte*)0xc900)
#define video_counter *((byte*)0xcb00)
#define watchdog0x39 *((byte*)0xcbff)

#define WATCHDOG (watchdog0x39 = 0x39)

// switch flags

#define UP1 (input0 & 0x1)
#define DOWN1 (input0 & 0x2)
#define LEFT1 (input0 & 0x4)
#define RIGHT1 (input0 & 0x8)
#define START1 (input0 & 0x10)
#define START2 (input0 & 0x20)
#define UP2 (input0 & 0x40)
#define DOWN2 (input0 & 0x80)
#define LEFT2 (input1 & 0x1)
#define RIGHT2 (input1 & 0x2)
#define AUTOUP (input2 & 0x1)
#define ADVANCE (input2 & 0x2)
#define COIN2 (input2 & 0x4)
#define HIGHSCORERESET (input2 & 0x8)
#define COIN1 (input2 & 0x10)
#define COIN3 (input2 & 0x20)
#define TILTSWITCH (input2 & 0x40)
#define SOUNDACK (input2 & 0x80)

// blitter flags
#define SRCSCREEN 0x1
#define DSTSCREEN 0x2
#define ESYNC 0x4
#define FGONLY 0x8
#define SOLID 0x10
#define RSHIFT 0x20
#define EVENONLY 0x40
#define ODDONLY 0x80

struct {
  byte flags;
  byte solid;
  word sstart;
  word dstart;
  byte width;
  byte height;
} *_blitter = 0xca00;

#define blitter (*_blitter)

struct {
  byte mem[152][256];
} *_vid = 0x0;

#define vidmem (_vid->mem)

#define BLIT_OP(_x,_y,_w,_h,_src,_color,_flags) do {\
  blitter.width = (_w)^4; \
  blitter.height = (_h)^4; \
  blitter.sstart = (word)(_src); \
  blitter.dstart = ((word)(_x)<<8)+(_y); \
  blitter.solid = (_color); \
  blitter.flags = (_flags); \
  } while (0)

#define BLIT_SOLID(x, y, w, h, color) \
  BLIT_OP(x, y, w, h, 0, color, DSTSCREEN|SOLID)


// x1: 0-151
// y1: 0-255
void blit_solid(byte x1, byte y1, byte w, byte h, byte color);

void blit_copy(byte x1, byte y1, byte w, byte h, const byte* data);

void blit_copy_solid(byte x1, byte y1, byte w, byte h, const byte* data, byte solid);

void blit_sprite(const byte* data, byte x, byte y);

void blit_sprite_solid(const byte* data, byte x, byte y, byte color);

void unblit_sprite_rect(const byte* data, byte x, byte y);

void blit_sprite_strided(const byte* data, byte x, byte y, byte stride);

void unblit_sprite_strided(const byte* data, byte x, byte y, byte stride);

// x1: 0-303
// y1: 0-255
void draw_pixel(word xx, byte y, byte color);

void draw_solid(word x, byte y, byte w, byte h, byte color);

void draw_vline(word x, byte y, byte h, byte color);

void draw_copy_solid(word x, byte y, byte w, byte h, const byte* data, byte solid);

// BCD
asm word bcd_add(word a, word b);

#endif
