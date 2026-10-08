/*
A software framebuffer made of background tiles.

The Game Boy has no bitmap mode, but if every cell in a rectangle of the
tile map points at a *different* tile, then each pixel in that rectangle
belongs to exactly one bit of one tile -- and the tiles become a bitmap.

This header uses the layout from Faceball 2000 (1991):

- The viewport is 18x14 tiles (144x112 pixels): 252 unique tiles.
- The background uses the $8800 "signed" tile-data mode (LCDC bit 4 = 0).
  In that mode tile numbers $80..$FF live at $8800..$8FFF and $00..$7F at
  $9000..$97FF, so counting upward from tile $84 and wrapping past $FF
  gives one *linear* run of VRAM: $8840..$983F. One copy loop fills it.
- Tiles $80..$83 are left over for the border around the viewport.
- The CPU draws into a 4032-byte buffer in WRAM (tb_buf), which has the
  same tile-by-tile layout as VRAM, then tb_blit() copies it to VRAM
  eight bytes per scanline, during HBlank, while the screen is on.

The price is VRAM bandwidth: 4032 bytes / 8 per line = 504 scanlines,
about 3.5 frames just to copy one picture (only the 144 visible lines
of each frame have an HBlank to use). That is why 3D games on the
original Game Boy ran at single-digit frame rates.
*/

#ifndef _TILEBUF_H
#define _TILEBUF_H

#include <stdint.h>

#define TB_COLS   18            // viewport width in tiles
#define TB_ROWS   14            // viewport height in tiles
#define TB_W      (TB_COLS*8)   // 144 pixels
#define TB_H      (TB_ROWS*8)   // 112 pixels
#define TB_ROWBYTES (TB_COLS*16) // 288 bytes per row of tiles
#define TB_BYTES  (TB_ROWS*TB_ROWBYTES) // 4032
#define TB_FIRST_TILE 0x84      // first viewport tile number
#define TB_VRAM   ((uint8_t*)0x8840) // tile $84 in $8800 mode
#define TB_MAPX   1             // viewport position on the tile map
#define TB_MAPY   1

// the framebuffer, in WRAM, laid out exactly like the VRAM tiles
uint8_t tb_buf[TB_BYTES];

// address of pixel row y, column 0 -- Faceball keeps this same
// table at $0300 in its ROM ("FrameBufferRAMOffsets")
uint8_t* tb_rowaddr[TB_H];

// bit mask for each pixel column within a byte
const uint8_t tb_bit[8] = { 0x80,0x40,0x20,0x10,0x08,0x04,0x02,0x01 };

// ---------------------------------------------------------------------
// setup

// Border tiles: $80 blank, $81 horizontal edge, $82 vertical edge.
/*{w:8,h:8,bpp:1,count:3,brev:1,np:2,pofs:1,sl:2}*/
static const uint8_t tb_border_tiles[] = {
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xff,0xff,
  0x01,0x01,0x01,0x01,0x01,0x01,0x01,0x01,
  0x01,0x01,0x01,0x01,0x01,0x01,0x01,0x01,
};

void tb_init(void) {
  uint8_t x, y, t;
  uint8_t row[TB_COLS];
  // build the row-address table
  for (y = 0; y < TB_H; y++) {
    tb_rowaddr[y] = tb_buf + (y >> 3) * TB_ROWBYTES + (y & 7) * 2;
  }
  // border tiles live in the $8800 half, tile numbers $80..$82
  set_bkg_data(0x80, 3, tb_border_tiles);
  fill_bkg_rect(0, 0, 20, 18, 0x80);
  fill_bkg_rect(TB_MAPX, 0, TB_COLS, 1, 0x81);
  fill_bkg_rect(0, TB_MAPY, 1, TB_ROWS, 0x82);
  // number the viewport cells $84, $85, ... $FF, $00, ... $7F
  t = TB_FIRST_TILE;
  for (y = 0; y < TB_ROWS; y++) {
    for (x = 0; x < TB_COLS; x++) row[x] = t++;
    set_bkg_tiles(TB_MAPX, TB_MAPY + y, TB_COLS, 1, row);
  }
  // clear buffer and VRAM
  for (x = 0; x < TB_ROWS; x++) {
    uint8_t* p = tb_buf + x * TB_ROWBYTES;
    uint16_t i;
    for (i = 0; i < TB_ROWBYTES; i++) p[i] = 0;
  }
  // $8800 addressing: LCDC bit 4 clear
  LCDC_REG = LCDCF_ON | LCDCF_BG8800 | LCDCF_BG9800 | LCDCF_BGON;
}

// ---------------------------------------------------------------------
// the blitter

// Interrupts need a real stack while tb_blit() is borrowing SP,
// so we give them this one (Faceball uses $C9A1).
static uint8_t tb_isr_stack[96];
static uint16_t tb_saved_sp;

/*
Copy tb_buf to VRAM, 8 bytes per scanline, and clear tb_buf behind us.

This is a transcription of Faceball 2000's UpdateFrameBuffer routine
($13F0 in the ROM). The trick is the stack pointer: POP BC reads two
bytes and advances the pointer in 3 cycles, the fastest way to read
memory on the SM83. So SP is pointed at the buffer and the loop pops
its way through it:

  1. POP the first two bytes before we wait (saves time in HBlank)
  2. wait until STAT bit 1 is set (mode 2/3: the PPU is drawing)
  3. wait until STAT bit 1 is clear (mode 0: HBlank -- VRAM is free)
  4. write 8 bytes to VRAM. Mode 0 plus the following mode 2 (VRAM is
     only locked in mode 3) gives at least ~40 M-cycles, enough for 8.
  5. park SP on a safe stack and enable interrupts while the PPU draws
     the next line, so the VBlank handler/music can still run
  6. PUSH zeros over the 8 bytes we just copied -- clearing the buffer
     for the next frame costs almost nothing

Note that in VBlank (mode 1) STAT bit 1 is 0, so step 2 waits out all
of VBlank: this routine only uses the 144 visible lines per frame.
*/
void tb_blit(void) __naked {
__asm
    ld  (_tb_saved_sp), sp
    ld  hl, #0x8840          ; VRAM destination (tile $84)
    ld  de, #504             ; 4032 / 8 lines
    di
    ld  sp, #_tb_buf
1$:
    pop bc                   ; bytes 0,1
2$:
    ldh a, (0x41)            ; STAT
    and a, #0x02
    jr  z, 2$            ; wait for mode 2/3
3$:
    ldh a, (0x41)
    and a, #0x02
    jr  nz, 3$           ; wait for mode 0 (HBlank)
    ld  a, c
    ld  (hl+), a
    ld  a, b
    ld  (hl+), a
    pop bc                   ; bytes 2,3
    ld  a, c
    ld  (hl+), a
    ld  a, b
    ld  (hl+), a
    pop bc                   ; bytes 4,5
    ld  a, c
    ld  (hl+), a
    ld  a, b
    ld  (hl+), a
    pop bc                   ; bytes 6,7
    ld  a, c
    ld  (hl+), a
    ld  a, b
    ld  (hl+), a
    ; swap SP to the ISR stack, let interrupts in
    ld  c, l
    ld  b, h                 ; BC = VRAM pointer
    ldhl sp, #0              ; HL = buffer pointer
    ld  sp, #_tb_isr_stack+96
    ei
4$:
    ldh a, (0x41)
    and a, #0x02
    jr  z, 4$            ; wait until HBlank is over
    di
    ld  sp, hl
    ld  l, c
    ld  h, b                 ; HL = VRAM pointer again
    ld  bc, #0
    push bc                  ; clear the 8 bytes we just popped
    push bc
    push bc
    push bc
    add sp, #8
    dec de
    ld  a, d
    or  a, e
    jr  nz, 1$
    ; restore the C stack
    ld  a, (_tb_saved_sp)
    ld  l, a
    ld  a, (_tb_saved_sp+1)
    ld  h, a
    ld  sp, hl
    ei
    ret
__endasm;
}

// ---------------------------------------------------------------------
// drawing
//
// Each pixel row of a tile is two bytes: the low bit-plane, then the high
// bit-plane. Color c (0..3) sets bit (c & 1) in the first and (c & 2) in
// the second. So one pixel = two read-modify-writes, but eight pixels of
// the same color = two plain writes. Fast code draws bytes, not pixels.

uint8_t tb_color = 3;

void tb_pset(uint8_t x, uint8_t y) {
  uint8_t* p = tb_rowaddr[y] + ((x & 0xf8) << 1);
  uint8_t m = tb_bit[x & 7];
  if (tb_color & 1) p[0] |= m; else p[0] &= ~m;
  if (tb_color & 2) p[1] |= m; else p[1] &= ~m;
}

// ---------------------------------------------------------------------
// shades
//
// Shade 0,2,4,6 are the solid colors 0..3. Odd shades are a checkerboard
// of the two neighbors. Each shade is described by its two bit-plane
// bytes on even rows and on odd rows.

typedef struct { uint8_t lo0, hi0, lo1, hi1; } Shade;

const Shade shades[7] = {
  // lo0   hi0   lo1   hi1
  { 0x00, 0x00, 0x00, 0x00 }, // color 0
  { 0xAA, 0x00, 0x55, 0x00 }, // 0/1 checker
  { 0xFF, 0x00, 0xFF, 0x00 }, // color 1
  { 0x55, 0xAA, 0xAA, 0x55 }, // 1/2 checker
  { 0x00, 0xFF, 0x00, 0xFF }, // color 2
  { 0xAA, 0xFF, 0x55, 0xFF }, // 2/3 checker
  { 0xFF, 0xFF, 0xFF, 0xFF }, // color 3
};

// left mask for x&7, right mask for x&7
const uint8_t lmask[8] = { 0xFF,0x7F,0x3F,0x1F,0x0F,0x07,0x03,0x01 };
const uint8_t rmask[8] = { 0x80,0xC0,0xE0,0xF0,0xF8,0xFC,0xFE,0xFF };

// Fill pixels xl..xr (inclusive) of row y with a shade.
void span(uint8_t y, uint8_t xl, uint8_t xr, const Shade* s) {
  uint8_t *p = tb_rowaddr[y] + ((xl & 0xf8) << 1);
  uint8_t lo = (y & 1) ? s->lo1 : s->lo0;
  uint8_t hi = (y & 1) ? s->hi1 : s->hi0;
  uint8_t m = lmask[xl & 7];
  uint8_t n = (xr >> 3) - (xl >> 3); // number of byte boundaries crossed
  if (n == 0) {
    m &= rmask[xr & 7];              // span starts and ends in one byte
  } else {
    // left partial byte
    p[0] = (p[0] & ~m) | (lo & m);
    p[1] = (p[1] & ~m) | (hi & m);
    p += 16;
    // whole bytes: no masking, two writes per 8 pixels
    while (--n) {
      p[0] = lo;
      p[1] = hi;
      p += 16;
    }
    m = rmask[xr & 7];
  }
  // right (or only) partial byte
  p[0] = (p[0] & ~m) | (lo & m);
  p[1] = (p[1] & ~m) | (hi & m);
}

#endif
