/* vgr3_gb.c -- Game Boy DMG playback of a .vgr3 file, the GB sibling of
 * vgr3_coleco.c / vgr3_nes.c / vgr3_pokey.c.
 *
 * The DMG sound registers are a memory-mapped block. The VGR3 shadow
 * layout flattens two disjoint hardware ranges into one index space:
 *
 *   0x00-0x16  NR10-NR52      ($FF10-$FF26)
 *   0x20-0x2F  wave RAM       ($FF30-$FF3F)
 *
 * Both map to the same address formula, $FF10 + r, so the flush is just
 * "write every dirty byte" in ascending order. The hole at 0x17-0x1F
 * ($FF27-$FF2F, unused IO) and 0x30+ are skipped; the encoder never
 * dirties them, but we test the range rather than trust that.
 *
 * Ascending order puts the per-channel NRx0-NRx4 setup and NR52 (0x16,
 * sound enable) ahead of the wave RAM reload, which is what the source
 * VGM stream wants: a channel must be configured before it can be
 * triggered, and wave RAM is typically rewritten while CH3 is off.
 *
 * The decoder only marks a byte dirty when an op writes it, and the
 * encoder replays "side-effect" bytes whenever the source writes them
 * even if the value is unchanged. Those extra bytes for the DMG are the
 * NRx4 trigger bits (a value-equal write still retriggers a voice) and
 * the NRx1 length loads (a value-equal write still reloads the length
 * counter while length is enabled). So a value-equal write that still
 * has a hardware effect is preserved by the dirty bitmap.
 *
 * Like the other ports this reads its .vgr3 file in place, so the file
 * must live in ROM.
 */

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

#include "vgr3_play.h"
//#link "vgr3_play.c"

const unsigned char MUSIC[] = {
  #embed "tune.vgr3"
};

#pragma opt_code_speed

/* 0x00-0x16 -> $FF10-$FF26, 0x20-0x2F -> $FF30-$FF3F. */
static void gbSoundOut(uint8_t reg, uint8_t val) {
  ((volatile uint8_t *)0xFF10)[reg] = val;
}

static Vgr3Player g_player;

static void gbFlush8(uint8_t r0) {
  uint8_t dirty = g_player.dirty[r0];
  uint8_t r;
  if (!dirty) return;
  g_player.dirty[r0] = 0;
  r = r0 << 3;
  while (dirty) {
    if (dirty & 1) {
      gbSoundOut(r, g_player.regs[r]);
    }
    r++;
    dirty >>= 1;
  }
}

void gbFlushVgr(void) {
  gbFlush8(0); // 0x0
  gbFlush8(1); // 0x8
  gbFlush8(2); // 0x10 - 0x16
  gbFlush8(4); // 0x20
  gbFlush8(5); // 0x28
}

const char HEX_CHAR[] = "0123456789ABCDEF";

void main(void) {
  uint16_t frame = 0;
  char hexstr[5] = "0000\0";
  DISPLAY_OFF;
  BGP_REG = 0xE4;
  font_init();
  put_str(2, 2, "VGR3 PLAYER");
  put_str(2, 4, "FRAME");
  SHOW_BKG;
  DISPLAY_ON;

  if (!vgr3Init(&g_player, MUSIC)) {
    put_str(2, 8, "BAD FILE");
    while (1) wait_vbl_done();
  }
  while (1) {
    wait_vbl_done();     // once per frame, in vblank
    gbFlushVgr();       // send them to the APU
    vgr3Frame(&g_player);  // decode this frame's register writes
    frame++;
    hexstr[3] = HEX_CHAR[frame & 0xf];
    hexstr[2] = HEX_CHAR[(frame >> 4) & 0xf];
    hexstr[1] = HEX_CHAR[(frame >> 8) & 0xf];
    hexstr[0] = HEX_CHAR[(frame >> 12) & 0xf];
    put_str(8, 4, hexstr);
  }
}
