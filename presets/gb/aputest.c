/*
Generates random sounds in the Game Boy APU, printing the parameters
to the screen. Also shows an asterisk while each channel is
playing, i.e. while its length counter is active (NR52 bits 0-3).

Port of presets/nes/aputest.c. The Game Boy has two pulse channels
(the first with a frequency sweep), a wave channel and a noise channel.
Only one or two channels are picked at a time so that all of their
parameters fit on the 20x18 tile screen.

A = new sound, B or START = replay the same sound.
*/

#include <stdint.h>
#include <string.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

typedef uint8_t byte;
typedef uint16_t word;

// channel bits, same as NR52 status bits
#define CH_PULSE1 0x01
#define CH_PULSE2 0x02
#define CH_WAVE   0x04
#define CH_NOISE  0x08

typedef struct APUParam {
  byte chmask;
  const char* name;
  word valmask;
  word valmin;
} APUParam;

// parameter indices (order of APU_DEFS)
enum {
  P1_FREQ, P1_DUTY, P1_VOL, P1_ENVPER, P1_LEN, P1_SWPPER, P1_SWPDN, P1_SWPSHF,
  P2_FREQ, P2_DUTY, P2_VOL, P2_ENVPER, P2_LEN,
  W_FREQ, W_LEVEL, W_LEN,
  N_SHIFT, N_WIDTH, N_DIV, N_VOL, N_ENVPER, N_LEN,
  APU_DEFCOUNT
};

const APUParam APU_DEFS[APU_DEFCOUNT] = {
  {CH_PULSE1, "Pulse1 Freq",	0x7ff, 0x100 },
  {CH_PULSE1, "Pulse1 Duty",	0x03, 0 },
  {CH_PULSE1, "Pulse1 Vol",	0x0f, 1 },
  {CH_PULSE1, "Pulse1 EnvPer",	0x07, 0 },
  {CH_PULSE1, "Pulse1 Length",	0x3f, 0 },
  {CH_PULSE1, "Pulse1 SwpPer",	0x07, 0 },
  {CH_PULSE1, "Pulse1 SwpDown?",0x01, 0 },
  {CH_PULSE1, "Pulse1 SwpShf",	0x07, 0 },
  {CH_PULSE2, "Pulse2 Freq",	0x7ff, 0x100 },
  {CH_PULSE2, "Pulse2 Duty",	0x03, 0 },
  {CH_PULSE2, "Pulse2 Vol",	0x0f, 1 },
  {CH_PULSE2, "Pulse2 EnvPer",	0x07, 0 },
  {CH_PULSE2, "Pulse2 Length",	0x3f, 0 },
  {CH_WAVE,   "Wave Freq",	0x7ff, 0x100 },
  {CH_WAVE,   "Wave Level",	0x03, 1 },
  {CH_WAVE,   "Wave Length",	0xff, 0 },
  {CH_NOISE,  "Noise Shift",	0x0f, 0 },
  {CH_NOISE,  "Noise 7-bit?",	0x01, 0 },
  {CH_NOISE,  "Noise Divisor",	0x07, 0 },
  {CH_NOISE,  "Noise Vol",	0x0f, 1 },
  {CH_NOISE,  "Noise EnvPer",	0x07, 0 },
  {CH_NOISE,  "Noise Length",	0x3f, 0 },
};

/* 32-sample waveform, two 4-bit samples per byte. */
const byte wave_pattern[16] = {
  0x01,0x23,0x45,0x67,0x89,0xab,0xcd,0xef,0xfe,0xdc,0xba,0x98,0x76,0x54,0x32,0x10
};

// 16-bit LCG
static word rnd = 0xCACE;
static word rand16(void) {
  rnd = rnd * 17 + 53;
  return rnd ^ (rnd >> 7);
}

byte enmask;
word vals[APU_DEFCOUNT];

static byte popcount4(byte x) {
  return (x & 1) + ((x >> 1) & 1) + ((x >> 2) & 1) + ((x >> 3) & 1);
}

void random_sound(void) {
  byte i;
  // pick one or two channels
  do {
    enmask = rand16() & 15;
  } while (enmask == 0 || popcount4(enmask) > 2);
  for (i = 0; i < APU_DEFCOUNT; i++) {
    const APUParam* p = &APU_DEFS[i];
    vals[i] = p->valmin + (rand16() & p->valmask);
    if (vals[i] > p->valmask && p->valmask < 0x100) vals[i] = p->valmask;
    if (vals[i] > 0x7ff) vals[i] = 0x7ff;
  }
}

// write decimal number, right-aligned in a field of 'width' chars
static void put_num(byte x, byte y, word v, byte width) {
  char buf[6];
  byte i = width;
  memset(buf, ' ', width);
  do {
    buf[--i] = '0' + (v % 10);
    v /= 10;
  } while (v && i);
  set_bkg_tiles(x, y, width, 1, (uint8_t*)buf);
}

// only rows of enabled channels are shown, in a compact list;
// row_ch[] remembers which channel each screen row belongs to
byte row_ch[16];
byte row_count;

void print_sound(void) {
  byte i;
  byte y = 0;
  // clear the parameter area
  for (i = 0; i < 16; i++) put_str(0, i, "                    ");
  row_count = 0;
  for (i = 0; i < APU_DEFCOUNT; i++) {
    if ((enmask & APU_DEFS[i].chmask) && y < 16) {
      put_str(0, y, APU_DEFS[i].name);
      put_num(14, y, vals[i], 5);
      row_ch[y] = APU_DEFS[i].chmask;
      y++;
    }
  }
  row_count = y;
}

void play_sound(void) {
  byte envdown = 0; // envelope always decays (bit 3 = 0)
  NR51_REG = enmask | (enmask << 4);   // route only the chosen channels
  if (enmask & CH_PULSE1) {
    NR10_REG = (vals[P1_SWPPER] << 4) | (vals[P1_SWPDN] << 3) | vals[P1_SWPSHF];
    NR11_REG = (vals[P1_DUTY] << 6) | vals[P1_LEN];
    NR12_REG = (vals[P1_VOL] << 4) | envdown | vals[P1_ENVPER];
    NR13_REG = vals[P1_FREQ] & 0xff;
    NR14_REG = 0xc0 | (vals[P1_FREQ] >> 8);  // trigger + length enable
  }
  if (enmask & CH_PULSE2) {
    NR21_REG = (vals[P2_DUTY] << 6) | vals[P2_LEN];
    NR22_REG = (vals[P2_VOL] << 4) | envdown | vals[P2_ENVPER];
    NR23_REG = vals[P2_FREQ] & 0xff;
    NR24_REG = 0xc0 | (vals[P2_FREQ] >> 8);
  }
  if (enmask & CH_WAVE) {
    NR30_REG = 0x80;                     // wave DAC on
    NR31_REG = vals[W_LEN];
    NR32_REG = vals[W_LEVEL] << 5;
    NR33_REG = vals[W_FREQ] & 0xff;
    NR34_REG = 0xc0 | (vals[W_FREQ] >> 8);
  }
  if (enmask & CH_NOISE) {
    NR41_REG = vals[N_LEN];
    NR42_REG = (vals[N_VOL] << 4) | envdown | vals[N_ENVPER];
    NR43_REG = (vals[N_SHIFT] << 4) | (vals[N_WIDTH] << 3) | vals[N_DIV];
    NR44_REG = 0xc0;
  }
}

void print_status(void) {
  byte i;
  byte st = NR52_REG;
  for (i = 0; i < row_count; i++) {
    put_char(19, i, (st & row_ch[i]) ? '*' : ' ');
  }
}

void apu_init(void) {
  byte i;
  NR52_REG = 0x80;         // sound on
  NR50_REG = 0x77;         // master volume
  NR30_REG = 0x00;         // wave DAC off while loading wave RAM
  for (i = 0; i < 16; i++) _AUD3WAVERAM[i] = wave_pattern[i];
}

void main(void) {
  byte keys;
  DISPLAY_OFF;
  BGP_REG = 0xE4;
  font_init();
  put_str(0, 17, "A=New B/Start=Replay");
  SHOW_BKG;
  DISPLAY_ON;
  apu_init();
  random_sound();
  while (1) {
    print_sound();
    play_sound();
    // wait for a key, updating the channel status each frame
    do {
      wait_vbl_done();
      print_status();
      rnd++; // stir the RNG while waiting
      keys = joypad();
      while (joypad()) ;
    } while (!(keys & (J_A | J_B | J_START)));
    if (keys & J_A) random_sound();
  }
}
