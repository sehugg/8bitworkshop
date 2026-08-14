/*
 * Shared Pac-Man hardware helpers for 8bitworkshop demos.
 *
 * Owns the reset/IRQ CRT at absolute 0x0000 (_HEADER). Real Pac-Man VBLANK
 * is a maskable IRQ (IM2), not NMI — same as MAME. Optional per-game work
 * goes through pac_vblank_hook (set before pac_irq_enable()).
 *
 * Game demos must NOT define start(); call pac_irq_enable() from main.
 */
#pragma opt_code_speed
#include "pacman_common.h"

/*
 * Absolute CRT0 @ 0x0000 (ABS _HEADER, through ~0xC9). Game _CODE starts
 * at 0xCA (platforms.ts codeseg_start) — fills through what was empty
 * space up to 0x1FF, then onward. Do not name this function start — that
 * would place a second _start label in _CODE.
 */
static void pac_crt0(void) __naked {
__asm
        .area   _HEADER (ABS)
        .org    0x0000
_start::
        jp      real_start

        .org    0x0010
        ; RST 10/18/20 (Namco sound engine)
        .db 0x85,0x6f,0x3e,0x00,0x8c,0x67,0x7e,0xc9,0x78,0x87,0xd7,0x5f,0x23,0x56,0xeb,0xc9
        .db 0xe1,0x87,0xd7,0x5f,0x23,0x56,0xeb,0xe9

        ; IM2: OUT (0),#0x38 → CPU fetches word at 0x0038
        .org    0x0038
        .dw     vblank_isr

vblank_isr:
        push    af
        push    bc
        push    de
        push    hl
        push    ix
        push    iy

        ; Ack IRQ (MAME holds INT until 0x5000 bit0 is cleared)
        xor     a
        ld      (0x5000), a

        ; Latch software sound regs → hardware WSG
        ld      hl, #0x4e8c
        ld      de, #0x5050
        ld      bc, #0x0010
        ldir

        ld      a, (0x4ecc)
        and     a
        ld      a, (0x4ecf)
        jr      nz, 00010$
        ld      a, (0x4e9f)
00010$:
        ld      (0x5045), a
        ld      a, (0x4edc)
        and     a
        ld      a, (0x4edf)
        jr      nz, 00011$
        ld      a, (0x4eaf)
00011$:
        ld      (0x504a), a
        ld      a, (0x4eec)
        and     a
        ld      a, (0x4eef)
        jr      nz, 00012$
        ld      a, (0x4ebf)
00012$:
        ld      (0x504f), a

        ; Frame counter — ONLY the relocatable symbol. Do NOT touch absolute
        ; 0x4C84 (arcade ROM timer): our _DATA lives in 0x4C00+ and that
        ; address is inside BSS (often near pac_vblank_hook / last byte).
        ld      a, (_video_framecount)
        inc     a
        ld      (_video_framecount), a

        call    _pac_run_vblank_hook

        ld      a, #1
        ld      (0x5000), a

        pop     iy
        pop     ix
        pop     hl
        pop     de
        pop     bc
        pop     af
        ei
        reti

real_start:
        ld      sp, #0x4fc0
        ld      bc, #l__INITIALIZER
        ld      a, b
        or      a, c
        jr      z, 00001$
        ld      de, #s__INITIALIZED
        ld      hl, #s__INITIALIZER
        ldir
00001$:
        ld      hl, #0x4e8c
        ld      de, #0x4e8d
        ld      (hl), #0
        ld      bc, #0x006f
        ldir

        ; BSS not cleared; keep optional VBLANK hook null until game sets it
        xor     a
        ld      (_pac_vblank_hook+0), a
        ld      (_pac_vblank_hook+1), a

        xor     a
        ld      i, a
        im      2
        ld      a, #0x38
        out     (0), a

        jp      _main
        .area   _CODE
__endasm;
}

volatile byte video_framecount;

/* Optional game VBLANK work (Namco sound engine, etc.). BSS → NULL. */
void (*pac_vblank_hook)(void);

void pac_run_vblank_hook(void) {
  if (pac_vblank_hook)
    pac_vblank_hook();
}

void pac_irq_enable(void) {
  interrupt_enable = 1;
  __asm__("ei");
}

word vram_addr(byte x, byte y) {
  if (y < 2)
    return 0x3c0 + (word)y * 32 + (29 - x);
  if (y >= 34)
    return (word)(y - 34) * 32 + (29 - x);
  return 0x40 + (word)(27 - x) * 32 + (y - 2);
}

void poke_tile(byte x, byte y, byte tile, byte pal) {
  word a;
  if (x >= 28 || y >= 36) return;
  a = vram_addr(x, y);
  *((byte*)(0x4000 + a)) = tile;
  *((byte*)(0x4400 + a)) = pal;
}

void poke_pal(byte x, byte y, byte pal) {
  if (x >= 28 || y >= 36) return;
  *((byte*)(0x4400 + vram_addr(x, y))) = pal;
}

byte peek_tile(byte x, byte y) {
  if (x >= 28 || y >= 36) return T_BLANK;
  return *((byte*)(0x4000 + vram_addr(x, y)));
}

void clrscr(byte pal) {
  word i;
  for (i = 0; i < 0x400; i++) {
    ((byte*)0x4000)[i] = T_BLANK;
    ((byte*)0x4400)[i] = pal;
    if ((i & 63) == 0) watchdog = 0;
  }
}

void wait_vblank(void) {
  byte f = video_framecount;
  while (video_framecount == f) watchdog = 0;
}

void put_digit(byte x, byte y, byte d, byte pal) {
  if (d > 9) d = 9;
  poke_tile(x, y, (byte)('0' + d), pal);
}

/* Arcade tile ROM: 0-9/A-Z mostly ASCII; space=0x40; extras remapped below. */
void put_char(byte x, byte y, char ch, byte pal) {
  byte t;
  if (ch == ' ' || ch == '\t') t = T_BLANK;
  else if (ch == '!') t = 0x5B;
  else if (ch == '-') t = 0x3B;
  else if (ch == '/') t = 0x3A;
  else if (ch == '"') t = 0x26;
  else if (ch >= 'a' && ch <= 'z') t = (byte)(ch - 'a' + 'A');
  else t = (byte)ch;
  poke_tile(x, y, t, pal);
}

void put_string(byte x, byte y, const char* s, byte pal) {
  while (*s) {
    put_char(x++, y, *s++, pal);
    if (x >= 28) break;
  }
}

/* Sprite regs: shape/color @ 0x4FF0, coords @ 0x5060 (bottom-right origin) */
void set_sprite_ex(byte i, byte shape, byte color, byte sx, byte sy, byte flags) {
  byte* attr = (byte*)(0x4ff0 + (i << 1));
  byte* pos = (byte*)(0x5060 + (i << 1));
  attr[0] = (byte)((shape << 2) | (flags & 3));
  attr[1] = color;
  pos[0] = (byte)(239 - sx);
  pos[1] = (byte)(272 - sy);
}

void set_sprite(byte i, byte shape, byte color, byte sx, byte sy) {
  set_sprite_ex(i, shape, color, sx, sy, 0);
}

void hide_sprite(byte i) {
  set_sprite(i, 0, 0, 0, 0);
  ((byte*)0x5060)[i * 2] = 0;
  ((byte*)0x5060)[i * 2 + 1] = 0;
}

void hide_all_sprites(void) {
  byte i;
  for (i = 0; i < 8; i++) hide_sprite(i);
}

void sound_voice(byte voice, word freq, byte vol, byte wave) {
  word wave_addr, freq_addr;
  byte i, nibbles;
  if (voice > 2) return;
  if (voice == 0) { wave_addr = 0x5045; freq_addr = 0x5050; nibbles = 5; }
  else if (voice == 1) { wave_addr = 0x504a; freq_addr = 0x5056; nibbles = 4; }
  else { wave_addr = 0x504f; freq_addr = 0x505b; nibbles = 4; }
  /* Voices 1/2 are 16-bit; HW treats them as 20-bit with low nibble 0.
   * Callers always pass the voice-0 scale (≈ Hz * 11). */
  if (voice != 0) freq >>= 4;
  *(volatile byte*)wave_addr = wave & 7;
  for (i = 0; i < nibbles; i++) {
    ((volatile byte*)freq_addr)[i] = freq & 0x0f;
    freq >>= 4;
  }
  ((volatile byte*)freq_addr)[nibbles] = vol & 0x0f;
}

/* Update volume only — avoids rewriting frequency mid-note (clicks / jitter). */
void sound_vol(byte voice, byte vol) {
  if (voice == 0) ((volatile byte*)0x5055)[0] = vol & 0x0f;
  else if (voice == 1) ((volatile byte*)0x505a)[0] = vol & 0x0f;
  else if (voice == 2) ((volatile byte*)0x505f)[0] = vol & 0x0f;
}

void sound_off(void) {
  sound_voice(0, 0, 0, 0);
  sound_voice(1, 0, 0, 0);
  sound_voice(2, 0, 0, 0);
}

void sound_beep(word freq, byte frames) {
  sound_enable = 1;
  sound_voice(0, freq, 12, 1);
  while (frames--) wait_vblank();
  sound_voice(0, 0, 0, 0);
}
