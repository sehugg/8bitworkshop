
#include "a8lib.h"

/*==========================================================================*/
/* Scrolling                                                                */
/*==========================================================================*/

extern byte* a8_dlist;

static byte* a8_scroll_lmsp[A8_SCROLL_MAX];
static const byte* a8_scroll_base[A8_SCROLL_MAX];
static byte a8_scroll_count;
byte a8_scroll_x_shift = 4;
byte a8_scroll_x_mask = 15;
byte a8_scroll_y_shift = 3;
byte a8_scroll_y_mask = 7;

/* Indexed by ANTIC mode: scanlines per line, bytes per HSCROL line, and
   log2 of color clocks per byte. */
const byte a8_mode_height[16] = { 0,0, 8,10, 8,16, 8,16, 8, 4, 4, 2, 1, 2, 1, 1 };
static const byte a8_mode_stride[16] = { 0,0, 48,48,48,48,24,24,12,12,24,24,24,48,48,48 };
static const byte a8_mode_xshift[16] = { 0,0, 2, 2, 2, 2, 3, 3, 4, 4, 3, 3, 3, 2, 2, 2 };

byte a8_scroll_mode(byte mode) {
  byte h;
  mode &= 15;
  a8_scroll_x_shift = a8_mode_xshift[mode];
  a8_scroll_x_mask = (byte)((1 << a8_scroll_x_shift) - 1);
  h = a8_mode_height[mode];
  a8_scroll_y_shift = 0;
  while (h > 1) { h >>= 1; a8_scroll_y_shift++; }
  a8_scroll_y_mask = (byte)((1 << a8_scroll_y_shift) - 1);
  return a8_mode_stride[mode];
}

void a8_scroll_reset(void) {
  a8_scroll_count = 0;
}

byte a8_scroll_line(byte mode, const void* base, byte dli) {
  byte idx = a8_dlist_line(mode, base, dli);
  a8_scroll_add(base, &a8_dlist[a8_dlist_len - 2]);
  return idx;
}

void a8_scroll_add(const void* base, byte* lms) {
  if (a8_scroll_count >= A8_SCROLL_MAX) return;
  a8_scroll_lmsp[a8_scroll_count] = lms;
  a8_scroll_base[a8_scroll_count] = (const byte*)base;
  a8_scroll_count++;
}

void a8_scroll_move(word byteoff, byte xfine) {
  byte i;
  for (i = 0; i < a8_scroll_count; i++) {
    word a = (word)a8_scroll_base[i] + byteoff;
    a8_scroll_lmsp[i][0] = (byte)a;
    a8_scroll_lmsp[i][1] = (byte)(a >> 8);
  }
  /* HSCROL delays the picture, so count down as the LMS counts up */
  ANTIC.hscrol = xfine ^ a8_scroll_x_mask;
}

void a8_scroll_set(byte x, byte y, byte stride) {
  word off = (word)(y >> a8_scroll_y_shift) * stride + (x >> a8_scroll_x_shift);
  a8_scroll_move(off, (byte)(x & a8_scroll_x_mask));
  ANTIC.vscrol = y & a8_scroll_y_mask;
}


