/*
 * scrolldemo.c - smooth scrolling with the atari8 common library.
 *
 * A pattern taller and wider than the screen sits in memory, and each
 * frame a8_scroll_set() moves the display list's LMS pointers by whole
 * mode lines and whole bytes, then loads VSCROL and HSCROL with the
 * fine offsets.
 *
 * Change MODE to any ANTIC mode except 3.  a8_scroll_mode() looks up the
 * stride (bytes per mode line) and fine-scroll granularity for it, and
 * the display list gets as many lines as fit in 192 scanlines.
 *
 * ANTIC can't read across a 4K boundary with one LMS, so tall bitmaps
 * (modes C-F) are split into bands.  Each band has its own LMS and its
 * own 4K page of free RAM ($4000-$7FFF) holding the band's lines plus
 * PAD scanlines of overlap below, so it can scroll without leaving the page.
 */

//#tooldef ld cfgfile=atari.cfg
//#symbol ld __RESERVED_MEMORY__=0x900

//#link "a8lib.c"
//#link "a8lib_scroll.c"

#include <string.h>
#include "a8lib.h"

#define MODE     DL_MAP160x2x4   /* try DL_CHR40x8x4, DL_MAP320x1x1, ... */
#define SCANLINES 192            /* visible scanlines */
#define PAD      32              /* vertical travel, in scanlines */
#define XMAX     15              /* horizontal travel, in color clocks */

#define PAGE_SIZE 0x1000         /* ANTIC's address counter wraps here */
#define MAX_BANDS 4
#define BAND_BUF(b) ((byte*)(0x4000 + (word)(b) * PAGE_SIZE))

static byte stride;              /* bytes per mode line */
static byte lines;               /* scrolling mode lines on screen */
static byte band_lines;          /* mode lines per LMS band */
static byte pad_lines;           /* extra mode lines to scroll into */

/* One template per diagonal phase; the pattern repeats every 4 phases. */
static byte row_tmpl[4][48];

static void make_templates(void) {
  static const byte colors[4] = { 0x00, 0x55, 0xaa, 0xff };
  byte k, c, v;
  for (c = 0; c < stride; c++) {
    /* color changes every 16 color clocks across the line */
    v = (byte)(((word)c << a8_scroll_x_shift) >> 4);
    for (k = 0; k < 4; k++)
      row_tmpl[k][c] = colors[(v + k) & 3];
  }
}

/* Fill a band's buffer with world lines [first, first+count). */
static void fill_band(byte* p, byte first, byte count) {
  byte h = a8_mode_height[MODE & 15];
  word scan = (word)first * h;
  while (count--) {
    /* and every 8 scanlines down the screen */
    memcpy(p, row_tmpl[(scan >> 3) & 3], stride);
    p += stride;
    scan += h;
  }
}

static void build_display(void) {
  byte i, left = 0;
  byte* buf = BAND_BUF(0);
  byte top;
  const byte mode = DL_HSCROL(MODE);
  byte h = a8_mode_height[MODE & 15];

  lines = SCANLINES / h;
  pad_lines = (PAD >> a8_scroll_y_shift) + 1;
  /* each band's buffer must fit in one 4K page */
  band_lines = PAGE_SIZE / stride - pad_lines - 1;
  if (band_lines > lines) band_lines = lines;
  /* too many bands?  shrink the window */
  if (lines > band_lines * MAX_BANDS) lines = band_lines * MAX_BANDS;

  a8_scroll_reset();
  a8_dlist_reset();
  top = 24 + (SCANLINES - lines * h) / 2;
  a8_dlist_blank(top);
  /* One extra line without DL_VSCROL ends the VSCROL region. */
  for (i = 0; i <= lines; i++) {
    byte m = (i < lines) ? DL_VSCROL(mode) : mode;
    if (left == 0) {
      /* start a new band */
      fill_band(buf, i, band_lines + pad_lines + 1);
      a8_scroll_line(m, buf, 0);
      buf += PAGE_SIZE;
      left = band_lines;
    } else {
      a8_dlist_line(m, 0, 0);
    }
    left--;
  }
  a8_dlist_finish();
}

void main(void) {
  byte x = 0, y = 0;
  sbyte dx = 1, dy = 1;

  stride = a8_scroll_mode(MODE);
  make_templates();
  build_display();

  a8_dlist_install();
  a8_set_colpf(0, A8_COLOR(3, 5));
  a8_set_colpf(1, A8_COLOR(12, 6));
  a8_set_colpf(2, A8_COLOR(8, 4));
  a8_set_colbk(A8_COLOR(0, 1));

  while (1) {
    a8_waitvsync();
    a8_scroll_set(x, y, stride);

    x += dx;
    if (x == XMAX || x == 0) dx = -dx;
    y += dy;
    if (y == PAD || y == 0) dy = -dy;
  }
}
