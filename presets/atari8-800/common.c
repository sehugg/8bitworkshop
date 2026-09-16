/*
 * common.c - helper library for cc65 Atari 8-bit programming.
 * See common.h for the interface and libdemo.c for an example.
 *
 * Link it with:
 *   //#link "common.c"
 *   //#link "common_irq.s"
 */

#include <6502.h>
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

/* Extra room lets us page-align the list at runtime (cc65 has no
   aligned attribute).  ANTIC lists are happiest on a page boundary. */
static byte a8_dlist_store[A8_DLIST_MAX + 0x100 + 4];
byte* a8_dlist;
byte  a8_dlist_len;
byte  a8_dli_count;
static byte a8_dli_lines = 1;    /* DLI bits in the installed list */
static byte a8_dmactl_val = 0x22;   /* playfield normal + DMA fetch */

static void a8_set_dmactl(byte v) {
  a8_dmactl_val = v;
  A8_SDMCTL = v;
  ANTIC.dmactl = v;
}

void a8_dlist_reset(void) {
  a8_dlist = (byte*)(((word)a8_dlist_store + 0xff) & 0xff00);
  a8_dlist_len = 0;
  a8_dli_count = 0;
  a8_dli_lines = 1;
  a8_dli_clear();
}

void a8_dlist_byte(byte b) {
  if (a8_dlist_len < A8_DLIST_MAX)
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


/*==========================================================================*/
/* DLI                                                                      */
/*==========================================================================*/

/* reg,val pairs terminated by A8_DLI_NONE in the reg slot */
static byte a8_dli_tab[A8_DLI_LINES][A8_DLI_WRITES * 2];
static byte a8_dli_line;
void (*a8_dli_hook)(void);

static volatile byte* const a8_dli_regs[A8_REG_COUNT] = {
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
  byte i, j;
  for (i = 0; i < A8_DLI_LINES; i++)
    for (j = 0; j < A8_DLI_WRITES; j++)
      a8_dli_tab[i][j * 2] = 0xff;
  a8_dli_line = 0;
}

void a8_dli_set(byte line, byte reg, byte val) {
  byte j;
  if (line >= A8_DLI_LINES || reg >= A8_REG_COUNT) return;
  for (j = 0; j < A8_DLI_WRITES; j++) {
    if (a8_dli_tab[line][j * 2] == 0xff) {
      a8_dli_tab[line][j * 2] = reg;
      a8_dli_tab[line][j * 2 + 1] = val;
      return;
    }
  }
}

/* Called from a8_dli_stub() (common_irq.s) on every DLI, with cc65's
   zero page saved.  Reads NMIST to clear the DLI latch, runs the optional
   hook, then applies the table entry for this DLI. */
void a8_dli_dispatch(void) {
  byte i;
  byte* w;
  (void)ANTIC.nmist;
  if (a8_dli_hook) a8_dli_hook();
  if (a8_dli_line >= a8_dli_lines) a8_dli_line = 0;
  w = &a8_dli_tab[a8_dli_line][0];
  for (i = 0; i < A8_DLI_WRITES; i++) {
    byte r = w[0];
    if (r == 0xff) break;
    *a8_dli_regs[r] = w[1];
    w += 2;
  }
  if (++a8_dli_line >= a8_dli_lines) a8_dli_line = 0;
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
/* Player/Missile graphics                                                  */
/*==========================================================================*/

/* Need 2K for a single-line P/M area, plus up to 2K of alignment slack. */
static byte a8_pmg_store[0x800 + 0x7ff];
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
  a8_pmg_base = (byte*)(((word)a8_pmg_store + 0x7ff) & 0xf800);
  a8_pmg_clear();
  GTIA_WRITE.gractl = 0;                       /* disable while we set up */
  ANTIC.pmbase = (byte)((word)a8_pmg_base >> 8);
  a8_dmactl_val = (a8_dmactl_val & ~0x1c) | 0x0c | (mode & 0x10);
  a8_set_dmactl(a8_dmactl_val);
  GTIA_WRITE.gractl = GRACTL_PLAYERS | GRACTL_MISSLES;
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

/* AUDF values for the 15 kHz clock, notes C1 (0) .. C6 (60+) .. up.
   MIDI 24 + index; index 45 = A4. */
const byte a8_pokey_notes[64] = {
  239, 226, 213, 201, 190, 179, 169, 159,
  150, 142, 134, 126, 119, 112, 106, 100,
   94,  89,  84,  79,  75,  70,  66,  63,
   59,  56,  52,  49,  47,  44,  41,  39,
   37,  35,  33,  31,  29,  27,  26,  24,
   23,  21,  20,  19,  18,  17,  16,  15,
   14,  13,  12,  12,  11,  10,  10,   9,
    8,   8,   7,   7,   7,   6,   6,   5
};

static const A8_Note* a8_seq_song[4];
static byte a8_seq_ticks[4];
static byte a8_seq_ctrl[4];
static byte a8_seq_vol[4];
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

void a8_pokey_note(byte chan, byte note, byte ctrl, byte vol) {
  a8_pokey_sound(chan, a8_pokey_notes[note & 0x3f], ctrl, vol);
}

void a8_pokey_stop(byte chan) {
  ((byte*)&POKEY_WRITE.audc1)[chan << 1] = 0;
}

void a8_pokey_stop_all(void) {
  byte i;
  for (i = 0; i < 4; i++) a8_pokey_stop(i);
}

void a8_pokey_play(byte chan, const A8_Note* song, byte ctrl, byte vol) {
  a8_seq_song[chan] = song;
  a8_seq_ticks[chan] = 1;
  a8_seq_ctrl[chan] = ctrl;
  a8_seq_vol[chan] = vol;
}

void a8_pokey_tick(void) {
  byte i;
  for (i = 0; i < 4; i++) {
    const A8_Note* s = a8_seq_song[i];
    if (!s) continue;
    if (a8_seq_ticks[i] == 0) {
      byte note = s->note;
      if (note == 0xff) {
        a8_seq_song[i] = 0;
        a8_pokey_stop(i);
        continue;
      }
      a8_pokey_note(i, note, a8_seq_ctrl[i], a8_seq_vol[i]);
      a8_seq_ticks[i] = s->ticks;
      a8_seq_song[i] = s + 1;
    }
    a8_seq_ticks[i]--;
  }
}

/* POKEY timer 1 IRQ handler.  Timer 1 shares channel 1, so leave that
   channel silent (and unused) when the IRQ tick is running. */
static byte a8_pokey_irq(void) {
  if (!(POKEY_READ.irqst & IRQEN_TIMER_1)) {
    a8_pokey_tick();
    return IRQ_HANDLED;
  }
  return IRQ_NOT_HANDLED;
}

void a8_pokey_start_irq(byte rate) {
  set_irq(a8_pokey_irq, a8_irq_stack, sizeof(a8_irq_stack));
  POKEY_WRITE.audf1 = rate;
  POKEY_WRITE.audc1 = 0;
  POKEY_WRITE.irqen = IRQEN_TIMER_1;
  POKEY_WRITE.stimer = 0x01;
}

void a8_pokey_stop_irq(void) {
  POKEY_WRITE.irqen = 0;
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
