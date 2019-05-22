
/*
Generates random sounds in the APU, printing the parameters
to the screen. Also shows an asterisk while each channel is
playing, i.e. while its length counter is active.
*/

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include "neslib.h"

#include "apu.h"
//#link "apu.c"

#include "vrambuf.h"
//#link "vrambuf.c"

// link the pattern table into CHR ROM
//#link "chr_generic.s"

typedef struct APUParam {
  byte chmask;
  const char* name;
  word valmask;
} APUParam;

#define APU_DEFCOUNT 20

const APUParam APU_DEFS[APU_DEFCOUNT] = {
  {0x01, "Pulse1 Period",	0x7ff },
  {0x01, "Pulse1 Duty",		0xc0 },
  {0x01, "Pulse1 Decay",	0x0f },
  {0x01, "Pulse1 Length",	0x0f },
  {0x01, "Pulse1 Sweep Period",	0x07 },
  {0x01, "Pulse1 Sweep Rate",	0x07 },
  {0x01, "Pulse1 Sweep Up?",	0x01 },
  {0x02, "Pulse2 Period",	0x7ff },
  {0x02, "Pulse2 Duty",		0xc0 },
  {0x02, "Pulse2 Decay",	0x0f },
  {0x02, "Pulse2 Length",	0x0f },
  {0x02, "Pulse2 Sweep Period",	0x07 },
  {0x02, "Pulse2 Sweep Rate",	0x07 },
  {0x02, "Pulse2 Sweep Up?",	0x01 },
  {0x04, "Triangle Period",	0x7ff },
  {0x04, "Triangle Length",	0x0f },
  {0x08, "Noise Period",	0x0f },
  {0x08, "Noise Decay",		0x0f },
  {0x08, "Noise Length",	0x0f },
  {0x08, "Noise Buzz",		NOISE_PERIOD_BUZZ },
};

word enmask;
word vals[APU_DEFCOUNT];

void random_sound() {
  byte i;
  
  do {
    enmask = rand() & 15; // all except DMC
  } while (enmask == 0);
  
  for (i=0; i<APU_DEFCOUNT; i++) {
    vals[i] = rand() & APU_DEFS[i].valmask;
  }
}

void print_sound() {
  byte i;
  char buf[32];
  for (i=0; i<APU_DEFCOUNT; i++) {
    memset(buf, 0, sizeof(buf));
    if (enmask & APU_DEFS[i].chmask) {
      sprintf(buf, "%2d %19s %5d", i, APU_DEFS[i].name, vals[i]);
    }
    vram_adr(NTADR_A(1,i+1));
    vram_write(buf, 32);
  }
}

void play_sound() {
  APU_ENABLE(enmask);
  APU_PULSE_DECAY(0, vals[0], vals[1], vals[2], vals[3]);
  APU_PULSE_SWEEP(0, vals[4], vals[5], vals[6]);
  APU_PULSE_DECAY(1, vals[7], vals[8], vals[9], vals[10]);
  APU_PULSE_SWEEP(1, vals[11], vals[12], vals[13]);
  APU_TRIANGLE_LENGTH(vals[14], vals[15]);
  APU_NOISE_DECAY(vals[16]|vals[19], vals[17], vals[18]);
}

void print_status() {
  byte i;
  vrambuf_clear();
  for (i=0; i<APU_DEFCOUNT; i++) {
    char ch = APU.status & APU_DEFS[i].chmask ? '*' : ' ';
    vrambuf_put(NTADR_A(29,i+1), &ch, 1);
  }
}


void main(void)
{
  pal_col(1,0x04);
  pal_col(2,0x20);
  pal_col(3,0x30);
  vram_adr(NTADR_A(0,26));
  vram_write(" Space=New Sound, Enter=Replay ", 32);
  apu_init();
  while(1) {
    ppu_off();
    if (!(pad_state(0) & PAD_START)) {
      random_sound();
    }
    print_sound();
    play_sound();
    vrambuf_clear();
    set_vram_update(updbuf);
    ppu_on_all();
    // wait for key
    while (!pad_trigger(0)) {
      ppu_wait_nmi();
      print_status();
    }
  }
}
