
#include <string.h>

typedef unsigned char byte;
typedef unsigned short word;
typedef signed char sbyte;

const __sfr __at (0x0) command;
__sfr __at (0x0) dac;

#define HALT __asm halt __endasm;

// press "2" or higher to activate...

typedef struct {
  word duration;
  word offset;
  word delta;
  int deltainc;
  byte wavetable;
  signed char lfo;
} SoundEffect;

const char WAVES[] = {
  -64,-64,-64,-64,-64,-64,-64,
  -64,-64,-64,-64,-64,-64,-64,
  64,64,64,64,64,64,64,64,
  64,64,64,64,64,64,64,64,
  
  -64,64,-64,64,-64,64,-64,64,
  -64,64,-64,64,-64,64,-64,64,
  -64,64,-64,64,-64,64,-64,64,
  -64,64,-64,64,-64,64,-64,64,
  
  -0x80,-0x78,-0x70,-0x68, -0x60,-0x58,-0x50,-0x48,
  -0x40,-0x38,-0x30,-0x28, -0x20,-0x18,-0x10,-0x08,
  0x00,0x08,0x10,0x18, 0x20,0x28,0x30,0x38,
  0x40,0x48,0x50,0x58, 0x60,0x68,0x70,0x78,
  
0x60,0x37,0x3f,0x5c,0x16,0xca,0xc2,0xa5,0xfe,0xba,0x77,0x89,0xaa,0x77,0x13,0xd8,
0xae,0x82,0xfd,0x22,0x9c,0x46,0xde,0x14,0x50,0xb4,0x97,0x46,0x54,0x9d,0x60,0x2b,
};

const sbyte* wav;
SoundEffect e;

const SoundEffect SOUNDS[] = {
  { 2000, 0, 3000, -1, 0x40, 0 }
};

void play();

void main() {
  if (command == 0) HALT;
  memcpy(&e, &SOUNDS[command-1], sizeof(e));
  play();
  HALT;
}

void sample() {
  dac = wav[(e.offset >> 11) & 0x1f];
  e.offset += e.delta;
}

void play() {
  wav = &WAVES[e.wavetable];
  while (e.duration--) {
    sample();
    sample();
    sample();
    sample();
    sample();
    sample();
    sample();
    sample();
    e.delta += e.deltainc;
    e.deltainc += e.lfo;
  }
}
