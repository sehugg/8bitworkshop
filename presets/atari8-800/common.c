/*
 * common.c - helper library for cc65 Atari 8-bit programming.
 * See common.h for the interface and libdemo.c for an example.
 *
 * Link it with:
 *   //#link "common.c"
 *   //#link "common_irq.s"
 */

#include <6502.h>
#include <string.h>
#include "common.h"

/* Target-specific display-list / NMI vector locations.  The 5200 BIOS
   keeps its page-2 vectors in a more compact layout than the 800 OS. */
#if defined(__ATARI5200__)
#define A8_VDSLST_ADDR 0x0206
#define A8_SDLSTL_ADDR 0x0005
#define A8_SDLSTH_ADDR 0x0006
#define A8_SDMCTL_ADDR 0x0007
#define A8_CHBASE_VAL  0xf8
#else
#define A8_VDSLST_ADDR 0x0200
#define A8_CHBASE_VAL  0xe0
#endif

#define A8_VDSLST (*(void(**)(void))A8_VDSLST_ADDR)

/* OS shadow registers.  The 800's vertical-blank routine copies these to
   the hardware every frame, so anything we change mid-frame has to be
   written here too or it gets stomped.  The 5200's BIOS uses the same
   zero-page slots (cc65's 5200 conio uses them as well). */
#if defined(__ATARI5200__)
#define A8_SHDW_PM ((byte*)0x0008)
#define A8_SHDW_PF ((byte*)0x000c)
#define A8_SHDW_BK (*(byte*)0x0010)
#define A8_SDMCTL  (*(byte*)0x0007)
#else
#define A8_SHDW_PM (&OS.pcolr0)
#define A8_SHDW_PF (&OS.color0)
#define A8_SHDW_BK (OS.color4)
#define A8_SDMCTL  (OS.sdmctl)
#endif


/*==========================================================================*/
/* Display list builder                                                     */
/*==========================================================================*/

/* Make sure this array doesn't cross a 1K boundary */
/* we really should use a custom .cfg file with the align attribute */
/* but let's just put it here and maybe no one will notice */
#if defined(__ATARI5200__)
static byte* a8_dlist_store = (byte*)0x1700;
#else
static byte* a8_dlist_store = (byte*)0x9700;
#endif

byte* a8_dlist;
byte  a8_dlist_len;
byte  a8_dli_count;
byte a8_dli_lines = 1;    /* DLI bits in the installed list */
byte a8_dmactl_val = 0x22;   /* playfield normal + DMA fetch */

static void a8_set_dmactl(byte v) {
  a8_dmactl_val = v;
  A8_SDMCTL = v;
  ANTIC.dmactl = v;
}

void a8_dlist_reset(void) {
  a8_dlist = a8_dlist_store;
  a8_dlist_len = 0;
  a8_dli_count = 0;
  a8_dli_lines = 1;
  a8_dli_clear();
  a8_scroll_reset();
}

void a8_dlist_byte(byte b) {
  a8_dlist[a8_dlist_len++] = b;
}

void a8_dlist_blank(byte n) {
  if (n < 1) n = 1;
  while (n > 8) {
    a8_dlist_byte(0x70);   /* DL_BLK8 */
    n -= 8;
  }
  a8_dlist_byte((byte)((n - 1) << 4));
}

byte a8_dlist_line(byte mode, const void* data, byte dli) {
  byte idx = 0xff;
  if (dli) {
    mode = DL_DLI(mode);
    idx = a8_dli_count;
    if (a8_dli_count < 0xff) a8_dli_count++;
  }
  if (data) mode = DL_LMS(mode);
  a8_dlist_byte(mode);
  if (data) {
    word a = (word)data;
    a8_dlist_byte((byte)(a & 0xff));
    a8_dlist_byte((byte)(a >> 8));
  }
  return idx;
}

void a8_dlist_finish(void) {
  word a = (word)a8_dlist;
  a8_dlist_byte(DL_JVB);
  a8_dlist_byte((byte)(a & 0xff));
  a8_dlist_byte((byte)(a >> 8));
  /* One DLI fires per frame for each flagged line, so wrapping the
     dispatch index at this count keeps it in phase without a VBI hook. */
  a8_dli_lines = a8_dli_count ? a8_dli_count : 1;
}

void a8_dlist_install(void) {
  word a = (word)a8_dlist;
#if defined(__ATARI5200__)
  *(byte*)A8_SDLSTL_ADDR = (byte)(a & 0xff);
  *(byte*)A8_SDLSTH_ADDR = (byte)(a >> 8);
#else
  OS.sdlstl = (byte)(a & 0xff);
  OS.sdlsth = (byte)(a >> 8);
#endif
  ANTIC.dlistl = (byte)(a & 0xff);
  ANTIC.dlisth = (byte)(a >> 8);
  a8_set_dmactl(0x22);
  a8_waitvsync();
}

void a8_dlist_off(void) {
  a8_set_dmactl(0x00);
}

void a8_set_playfield_width(byte w) {
  a8_set_dmactl((byte)((a8_dmactl_val & ~0x03) | (w & 0x03)));
}


/*==========================================================================*/
/* DLI                                                                      */
/*==========================================================================*/

/* reg,val pairs terminated by A8_DLI_NONE in the reg slot */
byte a8_dli_tab[A8_DLI_LINES][A8_DLI_WRITES * 2];
byte a8_dli_line;
void (*a8_dli_hook)(void);

volatile byte* const a8_dli_regs[A8_REG_COUNT] = {
  &GTIA_WRITE.colbk,
  &GTIA_WRITE.colpf0, &GTIA_WRITE.colpf1, &GTIA_WRITE.colpf2, &GTIA_WRITE.colpf3,
  &GTIA_WRITE.colpm0, &GTIA_WRITE.colpm1, &GTIA_WRITE.colpm2, &GTIA_WRITE.colpm3,
  &GTIA_WRITE.prior,
  &GTIA_WRITE.hposp0, &GTIA_WRITE.hposp1, &GTIA_WRITE.hposp2, &GTIA_WRITE.hposp3,
  &GTIA_WRITE.hposm0, &GTIA_WRITE.hposm1, &GTIA_WRITE.hposm2, &GTIA_WRITE.hposm3,
  &GTIA_WRITE.sizep0, &GTIA_WRITE.sizep1, &GTIA_WRITE.sizep2, &GTIA_WRITE.sizep3,
  &GTIA_WRITE.sizem,
  &GTIA_WRITE.grafp0, &GTIA_WRITE.grafp1, &GTIA_WRITE.grafp2, &GTIA_WRITE.grafp3,
  &GTIA_WRITE.grafm,
  &GTIA_WRITE.vdelay, &GTIA_WRITE.gractl, &GTIA_WRITE.hitclr,
  &ANTIC.chbase, &ANTIC.chactl,
  &ANTIC.hscrol, &ANTIC.vscrol, &ANTIC.dmactl
};

void a8_dli_clear(void) {
  memset(a8_dli_tab, 0xff, sizeof(a8_dli_tab));
  a8_dli_line = 0;
}

void a8_dli_set(byte line, byte reg, byte val) {
  byte j;
  byte* dli_line = a8_dli_tab[line];
  if (line >= A8_DLI_LINES || reg >= A8_REG_COUNT) return;
  for (j = 0; j < A8_DLI_WRITES; j++) {
    if (*dli_line == 0xff) {
      dli_line[0] = reg;
      dli_line[1] = val;
      return;
    }
    dli_line += 2;
  }
}

void a8_dli_install(void) {
  a8_dli_line = 0;
  A8_VDSLST = a8_dli_stub;
  ANTIC.nmien = NMIEN_VBI | NMIEN_DLI;
}

void a8_dli_remove(void) {
  ANTIC.nmien = NMIEN_VBI;
}


/*==========================================================================*/
/* Scrolling                                                                */
/*==========================================================================*/

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


/*==========================================================================*/
/* Player/Missile graphics                                                  */
/*==========================================================================*/

/* Need 2K for a single-line P/M area, plus up to 2K of alignment slack. */
#if defined(__ATARI5200__)
static byte* a8_pmg_store = (byte*)0x1800;
#else
static byte* a8_pmg_store = (byte*)0x9800;
#endif
static byte* a8_pmg_base;
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
  byte* p = a8_pmg_base;
  word n;
  for (n = 0; n < 0x800; n++) p[n] = 0;
}

void a8_pmg_init(byte mode) {
  word i;
  a8_pmg_mode = mode;
  a8_pmg_base = a8_pmg_store;
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


/*==========================================================================*/
/* POKEY                                                                    */
/*==========================================================================*/

static byte a8_irq_stack[128];

void a8_pokey_init(void) {
  POKEY_WRITE.skctl = SKCTL_KEYBOARD_DEBOUNCE | SKCTL_KEYBOARD_SCANNING;
  POKEY_WRITE.audctl = AUDCTL_CLOCKBASE_15HZ;
  a8_pokey_stop_all();
}

void a8_pokey_sound(byte chan, byte freq, byte ctrl, byte vol) {
  byte* p = (byte*)&POKEY_WRITE.audf1 + (word)(chan << 1);
  p[0] = freq;
  p[1] = (byte)(ctrl | (vol & 0x0f));
}

void a8_pokey_stop(byte chan) {
  ((byte*)&POKEY_WRITE.audc1)[chan << 1] = 0;
}

void a8_pokey_stop_all(void) {
  byte i;
  for (i = 0; i < 4; i++) a8_pokey_stop(i);
}

/* called from set_irq() */
unsigned char a8_pokey_music_update() {
  music_tick();
  music_duty();
  return IRQ_NOT_HANDLED;
}

void a8_pokey_music_init(void) {
  set_irq(a8_pokey_music_update, a8_irq_stack, sizeof(a8_irq_stack));
}

void a8_pokey_music_done(void) {
  reset_irq();
}

/*==========================================================================*/
/* Colors                                                                   */
/*==========================================================================*/

void a8_set_colpf(byte i, byte c) {
  if (i > 3) i = 3;
  ((byte*)&GTIA_WRITE.colpf0)[i] = c;
  A8_SHDW_PF[i] = c;
}

void a8_set_colbk(byte c) {
  GTIA_WRITE.colbk = c;
  A8_SHDW_BK = c;
}

void a8_set_colpm(byte i, byte c) {
  if (i > 3) i = 3;
  ((byte*)&GTIA_WRITE.colpm0)[i] = c;
  A8_SHDW_PM[i] = c;
}


/*==========================================================================*/
/* Input and utility                                                        */
/*==========================================================================*/

byte a8_console(void) {
  return GTIA_READ.consol;
}

byte a8_trigger(byte n) {
  return (byte)(((byte*)&GTIA_READ.trig0)[n] & 1 ? 0 : 1);
}

#if !defined(__ATARI5200__)
byte a8_stick(byte n) {
  byte v = n ? PIA.portb : PIA.porta;
  return (byte)((~v) & 0x1f);
}
#endif

void a8_waitvsync(void) {
#if defined(__ATARI5200__)
  volatile byte* rtc = (volatile byte*)0x0002;  /* RTCLOK+1 */
#else
  volatile byte* rtc = &OS.rtclok[2];           /* frame counter */
#endif
  byte t = *rtc;
  while (*rtc == t) ;
}
