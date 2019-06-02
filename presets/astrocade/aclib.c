
#include <string.h>
#include "aclib.h"

#pragma opt_code_speed

// set entire palette at once (8 bytes to port 0xb)
// bytes in array should be in reverse
void set_palette(byte palette[8]) __z88dk_fastcall {
  palette;
__asm
  ld bc,#0x80b	; B -> 8, C -> 0xb
  otir		; write C bytes from HL to port[B]
  ret		; return
__endasm;
}

// set entire sound registers at once (8 bytes to port 0x18)
// bytes in array should be in reverse
void set_sound_registers(byte regs[8]) __z88dk_fastcall {
  regs;
__asm
  ld bc,#0x818	; B -> 8, C -> 0x18
  otir		; write C bytes from HL to port[B]
  ret		; return
__endasm;
}

