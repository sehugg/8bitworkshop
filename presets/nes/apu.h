
#ifndef _APU_H
#define _APU_H

#include <nes.h>

// Functions/macros for direct control
// of APU sound generation

// enable
#define ENABLE_PULSE0	0x1
#define ENABLE_PULSE1	0x2
#define ENABLE_TRIANGLE	0x4
#define ENABLE_NOISE	0x8
#define ENABLE_DMC	0x10

#define APU_ENABLE(enable)\
  APU.status = (enable);

// pulse channels
#define DUTY_75 0xc0
#define DUTY_50 0x80
#define DUTY_25 0x40
#define DUTY_12 0x00

#define PULSE_ENVLOOP	0x20
#define PULSE_CONSTVOL	0x10
#define PULSE_VOLENVMASK 0xf

#define PULSE_CH0	0
#define PULSE_CH1	1

#define APU_PULSE_DECAY(channel,period,duty,decay,len)\
  APU.pulse[channel].period_low = (period)&0xff;\
  APU.pulse[channel].len_period_high = (((period)>>8)&7) | ((len)<<3);\
  APU.pulse[channel].control = (duty) | (decay);

#define APU_PULSE_SUSTAIN(channel,period,duty,vol)\
  APU.pulse[channel].period_low = (period)&0xff;\
  APU.pulse[channel].len_period_high = (((period)>>8)&7);\
  APU.pulse[channel].control = (duty) | (vol) | (PULSE_CONSTVOL|PULSE_ENVLOOP);

#define APU_PULSE_SET_DECAY(channel,duty,decay)\
  APU.pulse[channel].control = (duty) | (decay);

#define APU_PULSE_SET_VOLUME(channel,duty,vol)\
  APU.pulse[channel].control = (duty) | (vol) | (PULSE_CONSTVOL|PULSE_ENVLOOP);

#define APU_PULSE_SWEEP(channel,period,shift,up)\
  APU.pulse[channel].ramp = 0x80 | (period<<4) | (up?8:0) | shift;

#define APU_PULSE_SWEEP_DISABLE(channel)\
  APU.pulse[channel].ramp = 0;

// triangle channel
#define TRIANGLE_LC_HALT	0x80
#define TRIANGLE_LC_MASK	0x7f

#define APU_TRIANGLE_LENGTH(period,len)\
  APU.triangle.counter = 0x7f;\
  APU.triangle.period_low = (period)&0xff;\
  APU.triangle.len_period_high = (((period)>>8)&7) | ((len)<<3);

#define APU_TRIANGLE_SUSTAIN(period)\
  APU.triangle.counter = 0xff;\
  APU.triangle.period_low = (period)&0xff;\
  APU.triangle.len_period_high = (((period)>>8)&7);

// noise channel
#define NOISE_ENVLOOP	0x20
#define NOISE_CONSTVOL	0x10
#define NOISE_VOLENVMASK 0xf

#define NOISE_PERIOD_BUZZ	0x80

#define APU_NOISE_SUSTAIN(_period,vol)\
    APU.noise.control = (vol) | (NOISE_ENVLOOP|NOISE_CONSTVOL);\
    APU.noise.period = (_period);

#define APU_NOISE_DECAY(_period,_decay,_len)\
    APU.noise.control = (_decay);\
    APU.noise.period = (_period);\
    APU.noise.len = (_len);


// initialize APU with default state
void apu_init(void);


#endif
