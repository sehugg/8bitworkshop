
#include <string.h>
#include "a8lib.h"

extern byte a8_dmactl_val;
extern void a8_set_dmactl(byte val);

/*==========================================================================*/
/* Player/Missile graphics                                                  */
/*==========================================================================*/

/* Need 2K for a single-line P/M area, plus up to 2K of alignment slack. */
#ifdef __CC65__
#if defined(__ATARI5200__)
static byte* a8_pmg_base = (byte*)0x1800;
#else
static byte* a8_pmg_base = (byte*)0x9800;
#endif
#else
byte a8_pmg_base[0x800];
#pragma align(a8_pmg_base, 0x800)
#endif
static byte  a8_pmg_mode;

byte* a8_pmg_player(byte i) {
  if (a8_pmg_mode == A8_PMG_SINGLE)
    return a8_pmg_base + 0x400 + ((word)i << 8);
  return a8_pmg_base + 0x200 + ((word)i << 7);
}

byte* a8_pmg_missile(byte i) {
  (void)i;   /* the four missiles share one 128-byte region */
  return a8_pmg_base + ((a8_pmg_mode == A8_PMG_SINGLE) ? 0x300 : 0x180);
}

void a8_pmg_clear(void) {
  memset(a8_pmg_base, 0, 0x800);
}

void a8_pmg_init(byte mode) {
  word i;
  a8_pmg_mode = mode;
  a8_pmg_clear();
  GTIA_WRITE.gractl = 0;                       /* disable while we set up */
  ANTIC.pmbase = (byte)((word)a8_pmg_base >> 8);
  a8_dmactl_val = (a8_dmactl_val & ~0x1c) | 0x0c | (mode & 0x10);
  a8_set_dmactl(a8_dmactl_val);
  GTIA_WRITE.gractl = GRACTL_PLAYERS | GRACTL_MISSLES;
  GTIA_WRITE.prior = PRIOR_P03_PF03;
  for (i = 0; i < 4; i++)
    a8_pmg_set_color(i, (byte)(0x10 + i * 0x20));
}

void a8_pmg_off(void) {
  GTIA_WRITE.gractl = 0;
  a8_dmactl_val &= ~0x1c;
  a8_set_dmactl(a8_dmactl_val);
}

void a8_pmg_set_x(byte i, byte x) {
  ((byte*)&GTIA_WRITE.hposp0)[i] = x;
}

void a8_pmg_set_color(byte i, byte c) {
  ((byte*)&GTIA_WRITE.colpm0)[i] = c;
  A8_SHDW_PM[i] = c;
}

void a8_pmg_set_size(byte i, byte size) {
  ((byte*)&GTIA_WRITE.sizep0)[i] = size;
}

void a8_pmg_set_shape(byte i, const byte* shape, byte len, byte y) {
  byte* p = a8_pmg_player(i) + y;
  while (len--) *p++ = *shape++;
}

void a8_pmg_set_missile_x(byte i, byte x) {
  ((byte*)&GTIA_WRITE.hposm0)[i] = x;
}

void a8_pmg_set_missile_width(byte i, byte size) {
  GTIA_WRITE.sizem = (byte)((GTIA_WRITE.sizem & ~(3 << (i * 2)))
                            | ((size & 3) << (i * 2)));
}

byte a8_pmg_hit_pf(byte i) {
  return ((byte*)&GTIA_READ.p0pf)[i];
}

byte a8_pmg_hit_pl(void) {
  byte i, m = 0;
  for (i = 0; i < 4; i++) m |= ((byte*)&GTIA_READ.p0pl)[i];
  return m;
}

void a8_pmg_clear_collisions(void) {
  GTIA_WRITE.hitclr = 0;
}

static byte pmg_sizem;

void a8_pmg_5th_enable(byte on) {
  if (on) {
    GTIA_WRITE.prior |= PRIOR_5TH_PLAYER;
    GTIA_WRITE.gractl |= GRACTL_MISSLES;
    GTIA_WRITE.sizem = 0;   /* every missile 2 px wide, so they tile */
  } else {
    GTIA_WRITE.prior &= (byte)~PRIOR_5TH_PLAYER;
  }
  pmg_sizem = 0;
}

/*
    0: 8 color clocks (1 per pixel)
    1: 16 color clocks (2 per pixel)
    3: 32 color clocks (4 per pixel)
*/
void a8_pmg_5th_size(byte size) {
  size &= 3;
  pmg_sizem = size;
  size |= size << 2;
  size |= size << 4;
  GTIA_WRITE.sizem = size;
}

static const byte pmg_size_tab[4] = { 2, 4, 2, 8 };

void a8_pmg_5th_x(byte x) {
  byte* m = (byte*)&GTIA_WRITE.hposm0;
  byte inc = pmg_size_tab[pmg_sizem];
  m[0] = x;
  x += inc;
  m[1] = x;
  x += inc;
  m[2] = x;
  x += inc;
  m[3] = x;
}

void a8_pmg_5th_shape(const byte* shape, byte len, byte y) {
  byte* p = a8_pmg_missile(0) + y;
  while (len--) {
    /* GRAFM packs two bits per missile, M0 in bits 1:0, and each missile
       shifts its pair out MSB first, so the leftmost pixel is bit 1.  Swap
       the bit pairs to accept the usual player order (bit 7 = leftmost). */
    byte s = *shape++;
    *p++ = (byte)(((s >> 6) & 0x03)
                | ((s >> 2) & 0x0c)
                | ((s << 2) & 0x30)
                | ((s << 6) & 0xc0));
  }
}


