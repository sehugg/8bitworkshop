/*
Streaming animation: only the current frame lives in VRAM.

A 32x32 pre-rendered ball (see ballframes.h, made by the book's
tools/prerender.py) has 16 animation frames of 16 tiles each: 256 tiles,
which is more than the sprite half of VRAM holds for *everything*. Games
with lots of big, smooth animation -- Donkey Kong Land, Shantae -- don't
keep every frame in VRAM. They keep only the frame being shown, and copy
the next one in from ROM as it's needed.

To avoid showing a half-copied frame, sprite tiles are double-buffered:

  tiles  0..15  set A      the sprites point at one set while we
  tiles 16..31  set B      copy the next frame into the other, then flip

How fast is the copy? On a DMG the CPU copies 256 bytes with the usual
VRAM-safe loop. On a Game Boy Color, one general-purpose DMA (GDMA)
moves it in about one scanline while the CPU waits. copy_start and
copy_end record the scanline (LY) before and after, so you can compare:
run this on the "gb" and "gb.color" platforms and watch them in the
memory view.
*/

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gb/cgb.h"

// DMA reads its source on 16-byte boundaries, so pin the frames to an
// aligned address in the upper ROM (this demo's code stays below it)
#define BALL_FRAMES_AT __at(0x7000)
#include "ballframes.h"

#define SET_A 0
#define SET_B 16

uint8_t copy_start, copy_end;  // LY before and after the last copy

// Copy one frame's 16 tiles into sprite tiles 'dest'..dest+15.
void load_frame(uint8_t frame, uint8_t dest) {
  const uint8_t* src = ball_frames[frame];
  copy_start = LY_REG;
  if (_cpu == CGB_TYPE) {
    uint16_t s = (uint16_t)src;
    uint16_t d = 0x8000 + dest * 16;
    HDMA1_REG = s >> 8;          // source, high/low
    HDMA2_REG = s & 0xff;
    HDMA3_REG = d >> 8;          // destination in VRAM, high/low
    HDMA4_REG = d & 0xff;
    HDMA5_REG = BALL_TILES - 1;  // bit 7 = 0: general-purpose, 16 blocks
                                 // of 16 bytes; the CPU halts until done
  } else {
    set_sprite_data(dest, BALL_TILES, src);
  }
  copy_end = LY_REG;
}

// point the 8 sprites (8x16 mode, 4 across x 2 down) at a tile set
void show_set(uint8_t base) {
  uint8_t i;
  for (i = 0; i < 8; i++) set_sprite_tile(i, base + i * 2);
}

void place(uint8_t x, uint8_t y) {
  uint8_t i;
  for (i = 0; i < 8; i++) {
    move_sprite(i, x + (i & 3) * 8, y + (i >> 2) * 16);
  }
}

/*{pal:555,n:4,bpw:16}*/
const palette_color_t ball_pal[4] = {
  0x0000, 0x4B9F, 0x11DC, 0x088C  // RGB(0,0,0), (31,28,18), (28,14,4), (12,4,2)
};
/*{pal:555,n:4,bpw:16}*/
const palette_color_t bg_pal[4] = {
  0x7F54, 0x2A8A, 0x1986, 0x0000  // RGB(20,26,31), (10,20,10), (6,12,6), (0,0,0)
};

void main(void) {
  uint8_t frame = 0, tick = 0, cur = SET_A, x = 20;
  int8_t dx = 1;

  DISPLAY_OFF;
  BGP_REG = 0xE4;
  // sprite colors 1..3 = white, light gray, dark gray (0 is transparent)
  OBP0_REG = 0x90;
  if (_cpu == CGB_TYPE) {
    set_sprite_palette(0, 1, (palette_color_t*)ball_pal);
    set_bkg_palette(0, 1, (palette_color_t*)bg_pal);
  }
  SPRITES_8x16;
  load_frame(0, SET_A);
  show_set(SET_A);
  place(x, 70);
  SHOW_BKG;
  SHOW_SPRITES;
  DISPLAY_ON;

  while (1) {
    wait_vbl_done();
    // next frame every other video frame: 30 fps animation. Copy first,
    // while we're still in VBlank: GDMA must not run while the PPU is
    // drawing (mode 3), because VRAM writes are ignored then.
    if (++tick & 1) {
      uint8_t back = (cur == SET_A) ? SET_B : SET_A;
      frame = (frame + (dx > 0 ? 1 : BALL_FRAMES - 1)) & (BALL_FRAMES - 1);
      load_frame(frame, back);   // copy into the hidden set...
      show_set(back);            // ...then flip (OAM updates next VBlank)
      cur = back;
    }
    // roll back and forth
    x += dx;
    if (x < 10 || x > 130) dx = -dx;
    place(x, 70);
  }
}
