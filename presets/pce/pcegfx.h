/*
 * Minimal PC Engine tile/sprite SDK for 8bitworkshop (cc65).
 *
 * Replaces conio for real VDC graphics: 256x224 BG, 16-color tiles,
 * hardware sprites via a RAM SATB shadow + VRAM copy.
 *
 * Link with:
 *   //#link "pcegfx.c"
 *   //#link "pcegfx_tia.s"
 *
 * Do not include <conio.h> — conio's constructor reconfigures the VDC
 * for text mode and will fight this library.
 *
 * Hot path: after pce_wait_vsync(), do BAT/SATB updates immediately.
 * pce_satb_update* only copies into VRAM; DCR auto-DMA feeds the VDC.
 */
#ifndef PCEGFX_H
#define PCEGFX_H

#include <pce.h>

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;

/* Default VRAM layout used by this SDK */
#define PCE_BAT_ADDR    0x0000
#define PCE_TILE_BASE   0x100        /* first BG tile index (VRAM 0x1000) */
#define PCE_SPR_BASE    0x200        /* first sprite pattern (VRAM 0x4000; <<5) */
#define PCE_SATB_ADDR   0x7F00

/* 16x16 sprite patterns are spaced by 2 in the SATB pattern field */
#define PCE_SPR_PATTERN(i) ((word)(PCE_SPR_BASE + ((i) * 2)))

#define PCE_BAT_W       32
#define PCE_BAT_H       32
#define PCE_SCREEN_W    256
#define PCE_SCREEN_H    224

/* Sprite coordinates: visible top-left is (32, 64) */
#define PCE_SPR_X0      32
#define PCE_SPR_Y0      64

/* BAT word: low 12 = tile index, high 4 = BG palette */
#define PCE_BAT(tile, pal) ((word)(tile) | ((word)(pal) << 12))

/* Sprite attribute word helpers */
#define PCE_SPR_PRI       0x0080u
#define PCE_SPR_CGX       0x0100u   /* 32px wide */
#define PCE_SPR_CGY16     0x0000u
#define PCE_SPR_CGY32     0x1000u
#define PCE_SPR_CGY64     0x3000u
#define PCE_SPR_HFLIP     0x0800u
#define PCE_SPR_VFLIP     0x8000u
#define PCE_SPR_PAL(p)    ((word)((p) & 0x0F))

/* VCE color: 9-bit gggrrrbbb in a 16-bit word */
#define PCE_RGB(r, g, b) \
  ((word)((((g) & 7) << 6) | (((r) & 7) << 3) | ((b) & 7)))

/* BAT address helpers (32-wide map → <<5, no multiply) */
#define PCE_BAT_ADDR_XY(x, y) ((word)(((word)(byte)(y) << 5) + (byte)(x)))

/* Init 256x224 / 32x32 BAT, tiles @0x1000, sprites @0x4000, SATB @0x7F00 */
void pce_gfx_init(void);

void pce_disp_off(void);
void pce_disp_on(void);          /* BG + sprites + VBlank IRQ */
void pce_bg_on(void);
void pce_spr_on(void);

void pce_scroll(word x, word y);

/*
 * Mid-frame horizontal scroll band (RCR IRQ).
 * Lines [top_px, bot_px) use BXR from pce_band_set_x(); elsewhere BXR=0.
 * Call enable after pce_disp_on().
 */
void pce_band_enable(byte top_px, byte bot_px);
void pce_band_disable(void);
void pce_band_set_x(word screen_shift);
/* After VB VRAM work: if top RCR was missed, force scrolled BXR now. */
void pce_band_catchup(void);

void pce_load_vram(word vaddr, const void *data, word nwords);
void pce_fill_vram(word vaddr, word value, word nwords);

/* Palette index 0..255 BG, 256..511 sprites; count = # of colors */
void pce_load_palette(word index, const word *colors, word count);
void pce_set_color(word index, word color);

/* BG tiles: 32 bytes / 16 words each. tile_index is BAT character code. */
void pce_load_tiles(word tile_index, const void *data, word ntiles);

/* Sprite patterns: 128 bytes / 64 words each (16x16). pattern = VRAM>>5. */
void pce_load_sprites(word pattern, const void *data, word npatterns);

void pce_put_tile(byte x, byte y, word bat);
/* Burst-write `n` BAT words starting at (x,y) — one MAWR, then stream. */
void pce_put_bat_row(byte x, byte y, const word *bats, byte n);
void pce_fill_bat(byte x, byte y, byte w, byte h, word bat);
void pce_load_bat(byte x, byte y, const word *map, byte w, byte h);

/* Sprite attribute table (64 entries) kept in RAM; flush each frame.
 * Prefer PCE_SPR_SET / PCE_SPR_HIDE macros on the hot path. */
extern unsigned char pce_satb[64 * 4 * 2];
void pce_satb_clear(void);
void pce_spr_hide(byte i);
void pce_spr_set(byte i, word x, word y, word pattern, word attr);
void pce_satb_update(void);
/* Upload only the first `n` SATB entries (n*4 words). Prefer this in-game. */
void pce_satb_update_n(byte n);

/* Direct SATB shadow writes (no call overhead) */
#define PCE_SPR_HIDE(i) do { \
  unsigned char *_pce_s = &pce_satb[(unsigned)(i) * 8]; \
  _pce_s[0] = 0; _pce_s[1] = 0; \
} while (0)

#define PCE_SPR_SET(i, x, y, pattern, attr) do { \
  unsigned char *_pce_s = &pce_satb[(unsigned)(i) * 8]; \
  word _pce_x = (word)(x); \
  word _pce_y = (word)(y); \
  word _pce_p = (word)(pattern); \
  word _pce_a = (word)(attr); \
  _pce_s[0] = (unsigned char)_pce_y; \
  _pce_s[1] = (unsigned char)(_pce_y >> 8); \
  _pce_s[2] = (unsigned char)_pce_x; \
  _pce_s[3] = (unsigned char)(_pce_x >> 8); \
  _pce_s[4] = (unsigned char)_pce_p; \
  _pce_s[5] = (unsigned char)(_pce_p >> 8); \
  _pce_s[6] = (unsigned char)_pce_a; \
  _pce_s[7] = (unsigned char)(_pce_a >> 8); \
} while (0)

/*
 * Wait for vblank (via cc65 vdc_flags — do NOT poll VDC status yourself),
 * then briefly wait out SATB DMA. Do BAT/SATB uploads right after this.
 */
void pce_wait_vsync(void);
/* VB only (skip SATB-idle wait). For perftest A/B comparisons. */
void pce_wait_vsync_vb(void);
/* Non-zero if a VB is pending in vdc_flags (does not consume it). */
unsigned char pce_vb_pending(void);
/* Incremented when wait sees VB already pending (frame overrun). */
extern unsigned short pce_vsync_overruns;
/* SATB-idle poll count from the last pce_wait_vsync() call. */
extern unsigned short pce_busy_wait_iters;

/* Low-level: MAWR+VWR+TIA in one asm call (nbytes is bytes, not words). */
void __fastcall__ pce_vram_burst(unsigned int vaddr, const void *src,
                                 unsigned int nbytes);

#endif
