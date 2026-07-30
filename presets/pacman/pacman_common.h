/*
 * Shared Pac-Man hardware helpers for 8bitworkshop demos.
 *
 * Link helpers only:
 *   //#link "pacman_common.c"
 *
 * Each demo owns its own graphics (tile/sprite/PROM data appended at the
 * end of that .c file). Do not share one gfx object across demos.
 *
 * Text tile codes are ASCII: '0'-'9', 'A'-'Z', space = 0x40.
 */
#ifndef PACMAN_COMMON_H
#define PACMAN_COMMON_H

typedef unsigned char byte;
typedef unsigned short word;
typedef signed char sbyte;

void main(void);

/* memory-mapped I/O */
#define interrupt_enable (*(volatile byte*)0x5000)
#define sound_enable     (*(volatile byte*)0x5001)
#define flip_screen      (*(volatile byte*)0x5003)
#define watchdog         (*(volatile byte*)0x50c0)
#define input0           (*(volatile byte*)0x5000)
#define input1           (*(volatile byte*)0x5040)

extern volatile byte video_framecount;

#define UP1    (!(input0 & 0x01))
#define LEFT1  (!(input0 & 0x02))
#define RIGHT1 (!(input0 & 0x04))
#define DOWN1  (!(input0 & 0x08))
#define FIRE1  (!(input0 & 0x80))
#define COIN1  (!(input0 & 0x20))
#define START1 (!(input1 & 0x20))

/* Tile indices — font is ASCII; others are homebrew utility tiles */
#define T_BLANK   0x40   /* empty / space */
#define T_DOT     0x10   /* pellet */
#define T_POWER   0x14   /* power pellet */
#define T_WALL_TL 0x28
#define T_WALL_TR 0x29
#define T_WALL_H  0x2a
#define T_WALL_V  0x2b
#define T_WALL_BL 0x2c
#define T_WALL_BR 0x2d
#define T_WALL_R  0x2e
#define T_CIRCLE  'O'    /* round letter — player marker in tile demos */
#define T_ALIEN   0x0b   /* formation alien glyph */
#define T_MISSILE '/'    /* thin glyph usable as a bullet */

/* Homebrew sprite ROM indices for set_sprite() */
#define S_PLAYER  0
#define S_ALIEN   1
#define S_BOOM1   2
#define S_BOOM2   3
#define S_BULLET  4
#define S_PLAYER2 5
/* friendly aliases used by older demos */
#define S_PAC     S_PLAYER
#define S_GHOST   S_ALIEN
#define S_GHOST2  S_ALIEN
#define S_GHOST3  S_ALIEN
#define S_FRUIT   S_PLAYER2
#define S_EYES    S_BOOM2

/* Palette PROM entry numbers (CRAM / sprite color) */
#define PAL_YELLOW 9
#define PAL_CYAN   5
#define PAL_PINK   3
#define PAL_ORANGE 7
#define PAL_BLUE   5 // actually cyan. no blue in this palette
#define PAL_RED    1
#define PAL_WHITE  15

word vram_addr(byte x, byte y);
void poke_tile(byte x, byte y, byte tile, byte pal);
byte peek_tile(byte x, byte y);
void clrscr(byte pal);
void wait_vblank(void);
void put_digit(byte x, byte y, byte d, byte pal);
void put_char(byte x, byte y, char ch, byte pal);
void put_string(byte x, byte y, const char* s, byte pal);
void set_sprite(byte i, byte shape, byte color, byte sx, byte sy);
/* flags: bit0 = flipY, bit1 = flipX (Pac-Man sprite attribute bits) */
void set_sprite_ex(byte i, byte shape, byte color, byte sx, byte sy, byte flags);
void hide_sprite(byte i);
void hide_all_sprites(void);

/* Namco WSG helpers (3 voices). freq ≈ Hz * 11 (voice-0 scale; voices 1/2
 * are adjusted inside sound_voice). vol 0..15. wave selects wave_rom[] 0..7. */
void sound_voice(byte voice, word freq, byte vol, byte wave);
void sound_vol(byte voice, byte vol);
void sound_off(void);
void sound_beep(word freq, byte frames);

#endif
