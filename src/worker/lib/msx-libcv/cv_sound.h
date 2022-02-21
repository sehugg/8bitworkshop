#ifndef CV_SOUND_H
#define CV_SOUND_H 1

#include <stdint.h>
#include <stdbool.h>

enum cv_soundchannel {
  CV_SOUNDCHANNEL_0 = 0x0,
  CV_SOUNDCHANNEL_1 = 0x2,
  CV_SOUNDCHANNEL_2 = 0x4,
  CV_SOUNDCHANNEL_NOISE = 0x6
};

enum cv_shift {
  CV_NOISE_SHIFT_512 = 0,
  CV_NOISE_SHIFT_1024 = 1,
  CV_NOISE_SHIFT_2048 = 2,
  CV_NOISE_SHIFT_CHAN2 = 3
};

/*
  Set attenuation for given sound channel in dezibel. Maximum attenuation is 28 db,
  granularity is 2 db.
*/
extern void cv_set_attenuation(enum cv_soundchannel channel, uint8_t dezibel);

/*
  Set frequency of a tone generator. The frequency is 3.579/frequency_divider Mhz.
  This function is not reentrant. While it is called neither cv_set_attenuation() nor
  cv_set_noise() may be called. n should be a multiple of 32. The valid range is [0, 32736].
*/

extern void cv_set_frequency(enum cv_soundchannel channel, uint16_t frequency_divider);

extern void cv_set_noise(bool white, enum cv_shift shift);

#ifdef CV_MSX
static volatile __sfr __at 0xa0 psg_port_register;
static volatile __sfr __at 0xa1 psg_port_write;
static volatile __sfr __at 0xa2 psg_port_read;
#endif

#endif
