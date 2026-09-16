#ifndef _ATARI8_COMMON_H
#define _ATARI8_COMMON_H

/*
 * common.h - small helper library for cc65 Atari 8-bit programming.
 *
 * cc65 gives us register layouts (<atari.h>), but no high-level support
 * for ANTIC display lists, DLI callbacks, player/missile sprites, or
 * POKEY sound.  This library fills those gaps with plain C and one tiny
 * interrupt trampoline (common_irq.s).
 *
 * It compiles for both the Atari 800 (__ATARI__, <atari.h>) and the
 * Atari 5200 (__ATARI5200__, <atari5200.h>).  Hardware bases come from
 * cc65's GTIA_WRITE / GTIA_READ / POKEY_WRITE / ANTIC macros so the
 * same source produces the right addresses on each target.
 *
 * Typical use:
 *
 *   //#link "common.c"
 *   //#link "common_irq.s"
 *   #include "common.h"
 *
 * See libdemo.c for a complete example.
 */

#if defined(__ATARI5200__)
#include <atari5200.h>
#else
#include <atari.h>
#endif

typedef unsigned char byte;
typedef signed char   sbyte;
typedef unsigned int  word;

/* Make a GTIA color byte from a hue (0-15) and luminance (0-7).
   Same as cc65's _gtia_mkcolor(), repeated here for readability. */
#define A8_COLOR(hue,lum) ((byte)(((hue)<<4)|((lum)<<1)))

/* Atari POKEY channel control bits (set in AUDC1..4). */
#define A8_AUDC_VOLUME_ONLY 0x10   /* direct volume, no tone */
#define A8_AUDC_POLYS_5_17  0x00   /* buzz */
#define A8_AUDC_POLYS_5     0x20   /* square-ish */
#define A8_AUDC_POLYS_5_4   0x40   /* square */
#define A8_AUDC_POLYS_17    0x80   /* noise */
#define A8_AUDC_POLYS_NONE  0xA0   /* pure square wave */
#define A8_AUDC_POLYS_4     0xC0   /* rumble */


/*==========================================================================*/
/* Display list builder (ANTIC)                                             */
/*==========================================================================*/

/* Buffer is a runtime-aligned array; use a8_dlist_reset() before building. */
#define A8_DLIST_MAX 100
extern byte* a8_dlist;          /* pointer to the aligned display list */
extern byte  a8_dlist_len;      /* current length in bytes */
extern byte  a8_dli_count;     /* number of DLI bits emitted so far */

void a8_dlist_reset(void);
void a8_dlist_byte(byte b);
/* Emit n blank scanlines (any count; splits into DL_BLK8 chunks). */
void a8_dlist_blank(byte n);
/* Emit a mode line.  mode is a DL_xxx constant from <_antic.h>
   (e.g. DL_CHR40x8x1).  If data is non-NULL, emit an LMS pointing at it.
   If dli is non-zero, set the DLI flag and return the DLI index
   (0,1,2,...) for use with a8_dli_set(); otherwise return 0xFF. */
byte a8_dlist_line(byte mode, const void* data, byte dli);
/* Terminate with JVB back to the start of the list. */
void a8_dlist_finish(void);
/* Point ANTIC at the list, enable playfield + PMG DMA, wait for vblank. */
void a8_dlist_install(void);
/* Turn off ANTIC DMA (blank screen). */
void a8_dlist_off(void);


/*==========================================================================*/
/* Display List Interrupts (DLI)                                            */
/*==========================================================================*/

/* Registers that a8_dli_set() understands.  Anything else can be written
   from a user callback with a8_dli_hook. */
enum {
  A8_REG_COLBK = 0,
  A8_REG_COLPF0, A8_REG_COLPF1, A8_REG_COLPF2, A8_REG_COLPF3,
  A8_REG_COLPM0, A8_REG_COLPM1, A8_REG_COLPM2, A8_REG_COLPM3,
  A8_REG_PRIOR,
  A8_REG_HPOSP0, A8_REG_HPOSP1, A8_REG_HPOSP2, A8_REG_HPOSP3,
  A8_REG_HPOSM0, A8_REG_HPOSM1, A8_REG_HPOSM2, A8_REG_HPOSM3,
  A8_REG_SIZEP0, A8_REG_SIZEP1, A8_REG_SIZEP2, A8_REG_SIZEP3,
  A8_REG_SIZEM,
  A8_REG_GRAFP0, A8_REG_GRAFP1, A8_REG_GRAFP2, A8_REG_GRAFP3,
  A8_REG_GRAFM,
  A8_REG_VDELAY, A8_REG_GRACTL, A8_REG_HITCLR,
  A8_REG_CHBASE, A8_REG_CHACTL,
  A8_REG_HSCROL, A8_REG_VSCROL, A8_REG_DMACTL,
  A8_REG_COUNT
};

/* How many display-list DLIs we can service, and how many register
   writes each one may perform.  Tune to taste. */
#ifndef A8_DLI_LINES
#define A8_DLI_LINES 16
#endif
#ifndef A8_DLI_WRITES
#define A8_DLI_WRITES 4
#endif

/* The Nth DLI (as returned by a8_dlist_line(...,1)) writes these.
   Entries cycle in step with the frame: the dispatcher wraps at the
   number of DLI bits in the installed list, so bands stay in phase. */
void a8_dli_set(byte line, byte reg, byte val);
void a8_dli_clear(void);

/* Optional per-DLI callback, run before the table writes.  Use it for
   effects the table can't express (register math, band counters, ...).
   Runs with cc65's zero page saved, so normal C code is safe. */
extern void (*a8_dli_hook)(void);

/* Install the NMI trampoline in VDSLST and enable DLI NMIs.
   Call a8_dlist_install() first so the display list has DLI bits. */
void a8_dli_install(void);
void a8_dli_remove(void);

/* The assembler trampoline from common_irq.s. */
extern void a8_dli_stub(void);
/* C dispatcher called by the trampoline. */
void a8_dli_dispatch(void);


/*==========================================================================*/
/* Player/Missile graphics (sprites) - GTIA                                 */
/*==========================================================================*/

#define A8_PMG_DOUBLE 0x00   /* 2 scanlines tall, 128 lines */
#define A8_PMG_SINGLE 0x10   /* 1 scanline tall,  256 lines */

#define A8_PMG_NORMAL 0
#define A8_PMG_DOUBLEW 1
#define A8_PMG_QUADW   3

/* Allocate the (2K-aligned) P/M area and point ANTIC at it.
   mode is A8_PMG_DOUBLE or A8_PMG_SINGLE.  Must be called after
   a8_dlist_install() so that DMACTL's playfield bits are known. */
void a8_pmg_init(byte mode);
void a8_pmg_off(void);
void a8_pmg_clear(void);

/* Player index 0..3.  Missiles are 0..3 as well. */
byte* a8_pmg_player(byte i);
byte* a8_pmg_missile(byte i);
void  a8_pmg_set_x(byte i, byte x);
void  a8_pmg_set_color(byte i, byte c);
void  a8_pmg_set_size(byte i, byte size);
/* Copy a shape into player i at vertical byte offset y. */
void  a8_pmg_set_shape(byte i, const byte* shape, byte len, byte y);
void  a8_pmg_set_missile_x(byte i, byte x);
void  a8_pmg_set_missile_width(byte i, byte size);

/* Collision latches (read and clear). */
byte a8_pmg_hit_pf(byte i);      /* player i hit playfield? */
byte a8_pmg_hit_pl(void);        /* any player-player hit mask */
void a8_pmg_clear_collisions(void);


/*==========================================================================*/
/* POKEY sound                                                              */
/*==========================================================================*/

/* Notes are indexes into a 64-entry table, 0 = C1 ... 45 = A4 ... 63. */
#define A8_NOTE_A4 45
extern const byte a8_pokey_notes[64];

void a8_pokey_init(void);
/* chan 0..3; freq 0..255 (AUDF); ctrl A8_AUDC_xxx; vol 0..15 */
void a8_pokey_sound(byte chan, byte freq, byte ctrl, byte vol);
void a8_pokey_note(byte chan, byte note, byte ctrl, byte vol);
void a8_pokey_stop(byte chan);
void a8_pokey_stop_all(void);

/* A tiny frame-tick sequencer.  A song is a list of {note,ticks}
   pairs; note 0xFF ends it.  Call a8_pokey_tick() once per frame
   (from your main loop or an IRQ).  Tick speed is up to you. */
typedef struct {
  byte note;
  byte ticks;
} A8_Note;

void a8_pokey_play(byte chan, const A8_Note* song, byte ctrl, byte vol);
void a8_pokey_tick(void);

/* Start POKEY timer 1 and call a8_pokey_tick() from an IRQ.
   rate ~= 1 + (clock / (2 * ticks_per_second)); 0 uses a default.
   Requires <6502.h> and the cc65 set_irq() runtime. */
void a8_pokey_start_irq(byte rate);
void a8_pokey_stop_irq(void);


/*==========================================================================*/
/* Colors                                                                   */
/*==========================================================================*/

/* Playfield color n = 0..3, or use a8_set_colbk.  On the 800 this also
   updates the OS shadow so the VBI doesn't overwrite us. */
void a8_set_colpf(byte i, byte c);
void a8_set_colbk(byte c);
void a8_set_colpm(byte i, byte c);


/*==========================================================================*/
/* Input and utility                                                        */
/*==========================================================================*/

/* Console keys: bit0 start, bit1 select, bit2 option (0 = pressed). */
byte a8_console(void);
/* Trigger n (0..3): nonzero when pressed. */
byte a8_trigger(byte n);

#if !defined(__ATARI5200__)
/* Joystick 0/1 direction+fire bits (JOY_xxx_MASK order).  0 if none. */
byte a8_stick(byte n);
#endif

/* Wait for the start of the next frame.  (cc65 provides waitvsync(),
   this is a thin alias so the library reads uniformly.) */
void a8_waitvsync(void);

#endif /* _ATARI8_COMMON_H */
