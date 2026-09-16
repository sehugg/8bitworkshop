/*
 * libdemo.c - demonstration of the atari8 common library.
 *
 * Shows off:
 *   - a display list built in RAM with four DLI color bands
 *   - a player/missile sprite that bounces across the screen
 *   - a POKEY melody driven from the main loop
 *
 * Build steps (the IDE adds these when you open this file):
 *   //#link "common.c"
 *   //#link "common_irq.s"
 */

//#link "common.c"
//#link "common_irq.s"

#include "common.h"

/* 24 rows x 40 columns of text screen codes. */
static byte screen[24][40];

/* Player 0 shape: a small ball. */
static const byte ball[8] = {
  0x18, 0x3c, 0x7e, 0xff, 0xff, 0x7e, 0x3c, 0x18
};

/* Simple four-note loop; note 0xff ends the song. */
static const A8_Note melody[] = {
  { A8_NOTE_A4, 6 }, { A8_NOTE_A4 + 4, 6 }, { A8_NOTE_A4 + 7, 6 },
  { A8_NOTE_A4 + 4, 6 }, { A8_NOTE_A4 + 2, 6 }, { A8_NOTE_A4 + 5, 12 },
  { 0xff, 0 }
};

static void fill_screen(void) {
  byte y, x;
  for (y = 0; y < 24; y++)
    for (x = 0; x < 40; x++)
      screen[y][x] = (byte)(0x20 + ((x + y) & 0x0f));
}

static void build_display(void) {
  byte i, d;
  a8_dlist_reset();
  a8_dlist_blank(24);
  /* First text line carries the LMS pointer and the first DLI band. */
  d = a8_dlist_line(DL_CHR40x8x1, screen, 1);
  a8_dli_set(d, A8_REG_COLBK, A8_COLOR(HUE_GREY, 0));
  a8_dli_set(d, A8_REG_COLPF2, A8_COLOR(HUE_GREY, 6));
  for (i = 1; i < 24; i++) {
    byte on = (byte)(i == 6 || i == 12 || i == 18);
    d = a8_dlist_line(DL_CHR40x8x1, 0, on);
    if (on) {
      byte band = (byte)(i / 6);
      a8_dli_set(d, A8_REG_COLBK, (byte)(A8_COLOR(band * 4, 1)));
      a8_dli_set(d, A8_REG_COLPF2, (byte)(A8_COLOR(band * 4 + 2, 6)));
    }
  }
  a8_dlist_finish();
}

void main(void) {
  byte x = 128;
  byte dx = 2;

  fill_screen();
  build_display();

  /* Character set page (E000 on the 800, F800 on the 5200). */
#if defined(__ATARI5200__)
  ANTIC.chbase = 0xf8;
#else
  ANTIC.chbase = 0xe0;
#endif

  a8_dlist_install();
  a8_dli_install();

  a8_pmg_init(A8_PMG_DOUBLE);
  a8_pmg_set_x(0, x);
  a8_pmg_set_color(0, A8_COLOR(HUE_GREY, 0x0f));
  a8_pmg_set_size(0, A8_PMG_NORMAL);
  a8_pmg_set_shape(0, ball, sizeof(ball), 0x30);

  a8_pokey_init();
  a8_pokey_play(0, melody, A8_AUDC_POLYS_5_4, 10);

  while (1) {
    a8_waitvsync();
    a8_pokey_tick();

    x += dx;
    if (x < 48) { x = 48; dx = 2; }
    if (x > 208) { x = 208; dx = (byte)-2; }
    a8_pmg_set_x(0, x);

    /* Fire button flips the priority; console keys re-trigger the song. */
    if (a8_trigger(0)) a8_pmg_set_color(0, A8_COLOR(HUE_YELLOW, 0x0f));
    else a8_pmg_set_color(0, A8_COLOR(HUE_GREY, 0x0f));
    if (a8_console() & 0x08) a8_pokey_play(0, melody, A8_AUDC_POLYS_5_4, 10);
  }
}
