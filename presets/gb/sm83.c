/*
Assembly language on the SM83.

The same loop -- add up N bytes -- written twice: once in C, and once
by hand as a __naked function. The timer counts how long each version
takes, so we can see what the compiler's version costs.

SDCC passes arguments on the stack (the first at SP+2 once the return
address is pushed), and an 8-bit result comes back in E. A __naked
function gets no prologue or epilogue at all, so the hand-written
version has to end with its own ret.

TAC = 5 makes TIMA tick at 262144 Hz: once every 16 clocks, which is
4 machine cycles. TIMA is only 8 bits wide, so keep the runs short
enough that it can't wrap (256 ticks = 1024 machine cycles).
*/

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

#define COUNT 16

uint8_t sum_c(const uint8_t *p, uint8_t n) {
  uint8_t s = 0;
  while (n--) s += *p++;
  return s;
}

uint8_t sum_asm(const uint8_t *p, uint8_t n) __naked {
  p; n;                // (silences unused-argument warnings)
  __asm
    ldhl sp,#2         ; HL -> first argument
    ld   a,(hl+)
    ld   e,a
    ld   a,(hl+)
    ld   d,a           ; DE = p
    ld   b,(hl)        ; B = n
    ld   h,d
    ld   l,e           ; HL = p
    xor  a,a           ; A = 0
    inc  b             ; enter the loop at the test, so n = 0 works
    jr   2$
1$: add  a,(hl)        ; A += *p
    inc  hl            ; p++
2$: dec  b
    jr   nz,1$
    ld   e,a           ; the result goes in E
    ret
  __endasm;
}

uint8_t buf[COUNT];

// clear the timer, run one call, and return the ticks it took
#define TIME(var, expr) \
  do { TIMA_REG = 0; sink = (expr); var = TIMA_REG; } while (0)

volatile uint8_t sink;

static void put_dec(uint8_t x, uint8_t y, uint16_t v) {
  char s[6];
  uint8_t i = 5;
  s[5] = '\0';
  do { s[--i] = '0' + v % 10; v /= 10; } while (v);
  put_str(x, y, s + i);
}

void main(void) {
  uint8_t i, c0, c1, a0, a1, same;

  DISPLAY_OFF;
  BGP_REG = 0xE4;
  font_init();

  for (i = 0; i < COUNT; i++) buf[i] = i * 3;
  TMA_REG = 0;
  TAC_REG = 0x05;      // enabled, 262144 Hz

  TIME(c0, sum_c(buf, 0));
  TIME(c1, sum_c(buf, COUNT));
  TIME(a0, sum_asm(buf, 0));
  TIME(a1, sum_asm(buf, COUNT));
  same = sum_c(buf, COUNT) == sum_asm(buf, COUNT);

  put_str(2, 1, "C VS ASSEMBLY");
  put_str(1, 4, "SAME ANSWER");
  put_str(14, 4, same ? "YES" : "NO");
  put_str(1, 7, "C ");
  put_str(1, 8, "ASM");
  put_str(6, 6, "TICKS");
  put_dec(7, 7, c1 - c0);
  put_dec(7, 8, a1 - a0);
  put_str(1, 11, "CYCLES PER BYTE");
  // one tick is 4 machine cycles (rounded; TIMA can be off by one tick)
  put_str(1, 12, "C ");
  put_str(1, 13, "ASM");
  put_dec(7, 12, ((uint16_t)(c1 - c0) * 4 + COUNT / 2) / COUNT);
  put_dec(7, 13, ((uint16_t)(a1 - a0) * 4 + COUNT / 2) / COUNT);

  SHOW_BKG;
  DISPLAY_ON;
  while (1) wait_vbl_done();
}
