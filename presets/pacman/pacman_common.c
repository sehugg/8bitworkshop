/*
 * Shared Pac-Man hardware helpers for 8bitworkshop demos.
 * Per-demo graphics are appended to each game .c file.
 */
#include "pacman_common.h"

volatile byte video_framecount;

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
  poke_tile(x, y, (byte)('0' + (d % 10)), pal);
}

/* Arcade tile ROM uses ASCII codes for 0-9 / A-Z; space = 0x40 */
void put_char(byte x, byte y, char ch, byte pal) {
  byte t;
  if (ch == ' ' || ch == '\t') t = T_BLANK;
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
  ((byte*)0x4ff0)[i * 2] = (shape << 2) | (flags & 3);
  ((byte*)0x4ff0)[i * 2 + 1] = color;
  ((byte*)0x5060)[i * 2] = 239 - sx;
  ((byte*)0x5060)[i * 2 + 1] = 272 - sy;
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
