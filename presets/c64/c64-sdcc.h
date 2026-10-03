// Minimal C64 definitions for SDCC's mos6502 backend, which has no c64.h,
// conio.h or joystick.h like cc65 does. Included by common.h under __SDCC.

#ifndef _C64_SDCC_H
#define _C64_SDCC_H

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define PEEK(addr)         (*(volatile uint8_t*)(addr))
#define POKE(addr,val)     (*(volatile uint8_t*)(addr) = (val))

#define COLOR_BLACK      0
#define COLOR_WHITE      1
#define COLOR_RED        2
#define COLOR_CYAN       3
#define COLOR_PURPLE     4
#define COLOR_GREEN      5
#define COLOR_BLUE       6
#define COLOR_YELLOW     7
#define COLOR_ORANGE     8
#define COLOR_BROWN      9
#define COLOR_LIGHTRED   10
#define COLOR_GRAY1      11
#define COLOR_GRAY2      12
#define COLOR_LIGHTGREEN 13
#define COLOR_LIGHTBLUE  14
#define COLOR_GRAY3      15

// VIC-II registers, same field names as cc65's struct __vic2
struct __vic2 {
  struct { uint8_t x, y; } spr_pos[8];
  uint8_t spr_hi_x, ctrl1, rasterline, strobe_x, strobe_y;
  uint8_t spr_ena, ctrl2, spr_exp_y, addr, irr, imr;
  uint8_t spr_bg_prio, spr_mcolor, spr_exp_x, spr_coll, spr_bg_coll;
  uint8_t bordercolor, bgcolor0, bgcolor1, bgcolor2, bgcolor3;
  uint8_t spr_mcolor0, spr_mcolor1;
  uint8_t spr_color[8];
};

// 6526 CIA registers
struct __6526 {
  uint8_t pra, prb, ddra, ddrb, ta_lo, ta_hi, tb_lo, tb_hi;
  uint8_t tod_10, tod_sec, tod_min, tod_hour, sdr, icr, cra, crb;
};

#define VIC  (*(volatile struct __vic2*)0xd000)
#define CIA1 (*(volatile struct __6526*)0xdc00)
#define CIA2 (*(volatile struct __6526*)0xdd00)
#define COLOR_RAM ((volatile uint8_t*)0xd800)

// joystick: bits are active low on CIA1 (port 2 = pra, port 1 = prb)
#define JOY_UP_MASK     0x01
#define JOY_DOWN_MASK   0x02
#define JOY_LEFT_MASK   0x04
#define JOY_RIGHT_MASK  0x08
#define JOY_BTN_1_MASK  0x10
#define JOY_UP(v)       ((v) & JOY_UP_MASK)
#define JOY_DOWN(v)     ((v) & JOY_DOWN_MASK)
#define JOY_LEFT(v)     ((v) & JOY_LEFT_MASK)
#define JOY_RIGHT(v)    ((v) & JOY_RIGHT_MASK)
#define JOY_BTN_1(v)    ((v) & JOY_BTN_1_MASK)
#define joy_install(drv)
#define joy_static_stddrv 0
// (the KERNAL's keyboard scan also drives these ports, so stop it while reading)
static uint8_t joy_read(uint8_t port) {
  uint8_t v;
  __asm__("sei");
  if (port) { CIA1.ddra = 0; v = CIA1.pra; CIA1.ddra = 0xff; }  // joystick 2
  else      { CIA1.ddrb = 0; v = CIA1.prb; }                    // joystick 1
  __asm__("cli");
  return ~v & 0x1f;
}

// conio-like text output straight to screen RAM (screen codes, not PETSCII)
static uint8_t _cx, _cy, _ccolor = COLOR_LIGHTBLUE, _crev;

static void clrscr(void) {
  uint16_t i;
  for (i = 0; i < 1000; i++) POKE(0x400 + i, 32);
  _cx = _cy = 0;
}

static uint8_t _screencode(char c) {
  if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')) return c & 0x1f;
  if (c == '#') return 0xa3;  // the uppercase character set has no plain '#' glyph; use reverse video
  return c;     // digits, punctuation and space match ASCII
}

static void textcolor(uint8_t c) { _ccolor = c; }
static uint8_t revers(uint8_t on) { uint8_t old = _crev; _crev = on ? 0x80 : 0; return old; }

static void cputcxy(uint8_t x, uint8_t y, char c) {
  uint16_t ofs = y * 40 + x;
  POKE(0x400 + ofs, _screencode(c) | _crev);
  POKE(0xd800 + ofs, _ccolor);
}

static void cputsxy(uint8_t x, uint8_t y, const char* s) {
  while (*s) cputcxy(x++, y, *s++);
}

static uint8_t kbhit(void) { return PEEK(0xc6); }  // KERNAL keyboard buffer count

#endif
