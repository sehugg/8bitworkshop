/*
Which Game Boy is this?

The boot ROM leaves a fingerprint in the CPU registers when it jumps to
the cartridge at $0100:

  A = $01   original Game Boy (DMG) or Super Game Boy
  A = $FF   Game Boy Pocket / Light, or Super Game Boy 2
  A = $11   Game Boy Color -- or Game Boy Advance, in which case
            bit 0 of B is also set

GBDK's startup code (crt0) saves A in _cpu and, on color hardware, the B
bit in _is_GBA, before anything else can overwrite them. The Super Game
Boy can't be told apart by registers; the game has to send it a command
packet and see whether it answers (sgb_check()).

What games did with this:
- Shantae (2002) brightens its palettes on a GBA, whose unlit screen made
  GBC colors look muddy, and unlocks a bonus transformation there.
- Many DMG games (Donkey Kong Land, Kirby's Dream Land 2) add a border
  and colors when they find a Super Game Boy.
- "Dual-mode" cartridges use the color palettes only if _cpu == CGB_TYPE.
*/

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gb/cgb.h"
#include "gb/sgb.h"
#include "gbtext.h"

// a normal palette, and a brighter one for the GBA's darker screen.
// Stored as 15-bit CGB words; the RGB() values are in the comments.
/*{pal:555,n:4,bpw:16}*/
const palette_color_t pal_gbc[4] = {
  0x639C, 0x2214, 0x110C, 0x0842  // RGB(28,28,24), (20,16,8), (12,8,4), (2,2,2)
};
/*{pal:555,n:4,bpw:16}*/
const palette_color_t pal_gba[4] = {
  0x73FF, 0x3B1C, 0x21D4, 0x1084  // RGB(31,31,28), (28,24,14), (20,14,8), (4,4,4)
};

void put_hex(uint8_t x, uint8_t y, uint8_t v) {
  char s[3];
  const char* hex = "0123456789ABCDEF";
  s[0] = hex[v >> 4];
  s[1] = hex[v & 15];
  s[2] = 0;
  put_str(x, y, s);
}

void main(void) {
  uint8_t is_sgb;
  DISPLAY_OFF;
  BGP_REG = 0xE4;
  font_init();
  fill_bkg_rect(0, 0, 20, 18, ' ');
  SHOW_BKG;
  DISPLAY_ON;

  // the SGB needs a few frames after power-on before it listens
  wait_vbl_done(); wait_vbl_done(); wait_vbl_done(); wait_vbl_done();
  is_sgb = sgb_check();

  put_str(2, 1, "WHICH GAME BOY?");
  put_str(2, 4, "_CPU    = $");
  put_hex(13, 4, _cpu);
  put_str(2, 5, "_IS_GBA = $");
  put_hex(13, 5, _is_GBA);
  put_str(2, 6, "SGB     = ");
  put_str(12, 6, is_sgb ? "YES" : "NO");

  put_str(2, 9, "RUNNING ON:");
  if (_cpu == CGB_TYPE && _is_GBA == GBA_DETECTED) {
    put_str(3, 11, "GAME BOY ADVANCE");
    set_bkg_palette(0, 1, (palette_color_t*)pal_gba);
    put_str(3, 12, "(BRIGHT PALETTE)");
  } else if (_cpu == CGB_TYPE) {
    put_str(3, 11, "GAME BOY COLOR");
    set_bkg_palette(0, 1, (palette_color_t*)pal_gbc);
  } else if (is_sgb) {
    put_str(3, 11, "SUPER GAME BOY");
  } else if (_cpu == MGB_TYPE) {
    put_str(3, 11, "GAME BOY POCKET");
  } else {
    put_str(3, 11, "GAME BOY (DMG)");
  }

  while (1) wait_vbl_done();
}
