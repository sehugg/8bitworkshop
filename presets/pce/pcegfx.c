/*
 * PC Engine VDC/VCE helpers — see pcegfx.h
 *
 * Performance notes (accurate emulators / real hardware):
 *  - Bulk VRAM uses HuC6280 TIA via pce_vram_burst / pce_tia_vdc.
 *  - SATB: write shadow → VRAM only; DCR auto-DMA copies each vblank.
 *    Do NOT rewrite register 19 every frame (forces an extra DMA + stalls).
 *  - Call BAT/SATB updates immediately after pce_wait_vsync() — it syncs on
 *    cc65's vdc_flags (IRQ clears VDC status) then waits out SATB DMA.
 */
#include "pcegfx.h"

/* Mirror ports outside ZP ($00xx redirects to $20xx on HuC6280) */
#define VDC_CTRL     (*(volatile unsigned char *)0x0200)
#define VDC_DATA_LO  (*(volatile unsigned char *)0x0202)
#define VDC_DATA_HI  (*(volatile unsigned char *)0x0203)

#define VCE_CTRL     (*(volatile unsigned char *)0x0400)
#define VCE_ADDR_LO  (*(volatile unsigned char *)0x0402)
#define VCE_ADDR_HI  (*(volatile unsigned char *)0x0403)
#define VCE_DATA_LO  (*(volatile unsigned char *)0x0404)
#define VCE_DATA_HI  (*(volatile unsigned char *)0x0405)

#define VDC_MAWR  0
#define VDC_VWR   2
#define VDC_CR    5
#define VDC_BXR   7
#define VDC_BYR   8
#define VDC_MWR   9
#define VDC_HSR   10
#define VDC_HDR   11
#define VDC_VSR   12
#define VDC_VDR   13
#define VDC_VCR   14
#define VDC_DCR   15
#define VDC_SATB  19

#define CR_BG     0x80
#define CR_SPR    0x40
#define CR_VBL    0x08
#define CR_RCR    0x04

static unsigned char cr_lo;

/* 64 sprites * 4 words — little-endian bytes match TIA upload order */
unsigned char pce_satb[64 * 4 * 2];

/* fill pattern reused by fill_vram / fill_bat */
static unsigned char fillbuf[64];

static void vdc_reg(unsigned char reg, word value) {
  VDC_CTRL = reg;
  VDC_DATA_LO = (unsigned char)value;
  VDC_DATA_HI = (unsigned char)(value >> 8);
}

static void apply_cr(void) {
  vdc_reg(VDC_CR, cr_lo);
}

void pce_disp_off(void) {
  cr_lo = CR_VBL;
  apply_cr();
}

void pce_bg_on(void) {
  cr_lo |= CR_BG;
  apply_cr();
}

void pce_spr_on(void) {
  cr_lo |= CR_SPR;
  apply_cr();
}

void pce_disp_on(void) {
  cr_lo = CR_BG | CR_SPR | CR_VBL;
  apply_cr();
}

void pce_scroll(word x, word y) {
  /* BYR is latched before BXR each scanline — write Y first. */
  vdc_reg(VDC_BYR, y);
  vdc_reg(VDC_BXR, x);
}

/* Asm: pcegfx_tia.s */
void __fastcall__ pce_band_scroll_set(unsigned int bxr);
void __fastcall__ pce_band_scroll_enable(unsigned int top_rcr, unsigned int bot_rcr);
void pce_band_scroll_disable(void);

void pce_band_enable(byte top_px, byte bot_px) {
  /* RCR line 0 of active display is register value 64. */
  pce_band_scroll_enable((word)(64 + top_px), (word)(64 + bot_px));
  cr_lo |= CR_RCR;
  apply_cr();
}

void pce_band_disable(void) {
  pce_band_scroll_disable();
  cr_lo &= (unsigned char)~CR_RCR;
  apply_cr();
}

void pce_band_set_x(word screen_shift) {
  /* Increasing shift moves BG content to the right (BXR decreases). */
  pce_band_scroll_set((word)(0 - screen_shift) & 0x03FF);
}

void pce_band_catchup(void); /* asm */

void pce_gfx_init(void) {
  (void)VDC_CTRL;

  cr_lo = 0;
  apply_cr();

  vdc_reg(VDC_BXR, 0);
  vdc_reg(VDC_BYR, 0);
  vdc_reg(6, 0);                 /* RCR off */

  /*
   * MWR: 32x32 BAT (bits 4-6 = 000), 2-cycle CPU VRAM access (bits 0-1 = 01).
   * MWR=0 (1-cycle) is unsafe after crt0's `csh` and stalls forever-ish on
   * accurate cores when the VDC is busy.
   */
  vdc_reg(VDC_MWR, 0x0001);
  vdc_reg(VDC_HSR, 0x0202);
  vdc_reg(VDC_HDR, 0x041F);
  vdc_reg(VDC_VSR, 0x0D07);
  vdc_reg(VDC_VDR, 0x00DF);
  vdc_reg(VDC_VCR, 0x0003);

  /* Auto VRAM→SATB each vblank; set source once. */
  vdc_reg(VDC_DCR, 0x0010);
  vdc_reg(VDC_SATB, PCE_SATB_ADDR);

  /* 5 MHz pixel clock (256-wide) */
  VCE_CTRL = 0x04;

  pce_fill_vram(PCE_BAT_ADDR, 0, PCE_BAT_W * PCE_BAT_H);
  pce_fill_vram(0, 0, 16);

  pce_satb_clear();
  pce_satb_update();

  cr_lo = CR_VBL;
  apply_cr();
}

void pce_load_vram(word vaddr, const void *data, word nwords) {
  if (!nwords) return;
  pce_vram_burst(vaddr, data, (unsigned int)nwords << 1);
}

void pce_fill_vram(word vaddr, word value, word nwords) {
  unsigned char lo = (unsigned char)value;
  unsigned char hi = (unsigned char)(value >> 8);
  word i;

  if (!nwords) return;

  for (i = 0; i < 64; i += 2) {
    fillbuf[i] = lo;
    fillbuf[i + 1] = hi;
  }

  while (nwords) {
    word chunk = nwords > 32 ? 32 : nwords;
    pce_vram_burst(vaddr, fillbuf, (unsigned int)chunk << 1);
    vaddr += chunk;
    nwords -= chunk;
  }
}

void pce_set_color(word index, word color) {
  VCE_ADDR_LO = (unsigned char)index;
  VCE_ADDR_HI = (unsigned char)(index >> 8);
  VCE_DATA_LO = (unsigned char)color;
  VCE_DATA_HI = (unsigned char)(color >> 8);
}

void pce_load_palette(word index, const word *colors, word count) {
  VCE_ADDR_LO = (unsigned char)index;
  VCE_ADDR_HI = (unsigned char)(index >> 8);
  while (count--) {
    word c = *colors++;
    VCE_DATA_LO = (unsigned char)c;
    VCE_DATA_HI = (unsigned char)(c >> 8);
  }
}

void pce_load_nes_pal(word base, const word *colors) {
  byte p, c;
  for (p = 0; p < 4; p++) {
    word idx = (word)(base + ((word)p << 4));
    VCE_ADDR_LO = (unsigned char)idx;
    VCE_ADDR_HI = (unsigned char)(idx >> 8);
    for (c = 0; c < 4; c++) {
      word col = colors[(word)p * 4 + c];
      VCE_DATA_LO = (unsigned char)col;
      VCE_DATA_HI = (unsigned char)(col >> 8);
    }
  }
}

/* Word-by-word VRAM poke (no TIA). Large ROM→VRAM TIA transfers were only
 * committing the first tile pattern(s) in Chase; poke is slower but reliable. */
static void vram_poke_words(word vaddr, const word *data, byte n) {
  const unsigned char *p = (const unsigned char *)data;
  VDC_CTRL = VDC_MAWR;
  VDC_DATA_LO = (unsigned char)vaddr;
  VDC_DATA_HI = (unsigned char)(vaddr >> 8);
  VDC_CTRL = VDC_VWR;
  while (n--) {
    VDC_DATA_LO = *p++;
    VDC_DATA_HI = *p++;
  }
}

void pce_load_tiles(word tile_index, const void *data, word ntiles) {
  const unsigned char *p = (const unsigned char *)data;
  while (ntiles--) {
    byte i;
    word addr = (word)(tile_index << 4);
    VDC_CTRL = VDC_MAWR;
    VDC_DATA_LO = (unsigned char)addr;
    VDC_DATA_HI = (unsigned char)(addr >> 8);
    VDC_CTRL = VDC_VWR;
    for (i = 0; i < 32; i += 2) {
      VDC_DATA_LO = p[i];
      VDC_DATA_HI = p[i + 1];
    }
    p += 32;
    tile_index++;
  }
}

/* SMS/4-plane row format → VDC bitplane-pair format (one tile at a time). */
void pce_load_tiles_planar(word tile_index, const void *data, word ntiles) {
  const unsigned char *p = (const unsigned char *)data;
  unsigned char buf[32];
  while (ntiles--) {
    byte y;
    for (y = 0; y < 8; y++) {
      buf[y * 2] = p[y * 4];
      buf[y * 2 + 1] = p[y * 4 + 1];
      buf[16 + y * 2] = p[y * 4 + 2];
      buf[16 + y * 2 + 1] = p[y * 4 + 3];
    }
    pce_load_tiles(tile_index, buf, 1);
    p += 32;
    tile_index++;
  }
}

void pce_load_sprites(word pattern, const void *data, word npatterns) {
  const unsigned char *p = (const unsigned char *)data;
  while (npatterns--) {
    byte i;
    word addr = (word)(pattern << 5);
    VDC_CTRL = VDC_MAWR;
    VDC_DATA_LO = (unsigned char)addr;
    VDC_DATA_HI = (unsigned char)(addr >> 8);
    VDC_CTRL = VDC_VWR;
    for (i = 0; i < 128; i += 2) {
      VDC_DATA_LO = p[i];
      VDC_DATA_HI = p[i + 1];
    }
    p += 128;
    pattern += 2;
  }
}

void pce_put_bat_row(byte x, byte y, const word *bats, byte n) {
  if (!n) return;
  vram_poke_words(PCE_BAT_ADDR_XY(x, y), bats, n);
}

/* pce_put_tile is in pcegfx_tia.s. This 4-byte-arg variant keeps bat off AX. */
void pce_put_tile_raw(byte x, byte y, byte bat_lo, byte bat_hi) {
  word addr = (word)(((word)y << 5) + x);
  VDC_CTRL = VDC_MAWR;
  VDC_DATA_LO = (unsigned char)addr;
  VDC_DATA_HI = (unsigned char)(addr >> 8);
  VDC_CTRL = VDC_VWR;
  VDC_DATA_LO = bat_lo;
  VDC_DATA_HI = bat_hi;
}


void pce_fill_bat(byte x, byte y, byte w, byte h, word bat) {
  byte row, col;
  for (row = 0; row < h; ++row)
    for (col = 0; col < w; ++col)
      pce_put_tile((byte)(x + col), (byte)(y + row), bat);
}

void pce_load_bat(byte x, byte y, const word *map, byte w, byte h) {
  byte row;
  for (row = 0; row < h; ++row) {
    pce_put_bat_row(x, (byte)(y + row), map, w);
    map += w;
  }
}

void pce_satb_clear(void) {
  word i;
  for (i = 0; i < sizeof(pce_satb); ++i)
    pce_satb[i] = 0;
}

void pce_spr_hide(byte i) {
  PCE_SPR_HIDE(i);
}

void pce_spr_set(byte i, word x, word y, word pattern, word attr) {
  PCE_SPR_SET(i, x, y, pattern, attr);
}

void pce_satb_update(void) {
  pce_satb_update_n(64);
}

void pce_satb_update_n(byte n) {
  if (!n) return;
  if (n > 64) n = 64;
  /* Copy shadow into VRAM SATB source. Auto-DMA (DCR bit4) ships it
   * next vblank — do not poke register 19 here. */
  pce_vram_burst(PCE_SATB_ADDR, pce_satb, (unsigned int)n << 3);
}
