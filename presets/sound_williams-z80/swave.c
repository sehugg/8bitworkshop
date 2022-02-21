
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
  byte* wavetable;
  byte wavemask;
  signed char lfo;
} SoundEffect;

const char SQUARE_LOFREQ[32] = {
  -64,-64,-64,-64,-64,-64,-64,
  -64,-64,-64,-64,-64,-64,-64,
  64,64,64,64,64,64,64,64,
  64,64,64,64,64,64,64,64
};
const char SQUARE_HIFREQ[32] = {
  -64,64,-64,64,-64,64,-64,64,
  -64,64,-64,64,-64,64,-64,64,
  -64,64,-64,64,-64,64,-64,64,
  -64,64,-64,64,-64,64,-64,64,
};
const char SINTBL[128] = {
0, 3, 6, 9, 12, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46,
49, 51, 54, 57, 60, 63, 65, 68, 71, 73, 76, 78, 81, 83, 85, 88,
90, 92, 94, 96, 98, 100, 102, 104, 106, 107, 109, 111, 112, 113, 115, 116,
117, 118, 120, 121, 122, 122, 123, 124, 125, 125, 126, 126, 126, 127, 127, 127,
127, 127, 127, 127, 126, 126, 126, 125, 125, 124, 123, 122, 122, 121, 120, 118,
117, 116, 115, 113, 112, 111, 109, 107, 106, 104, 102, 100, 98, 96, 94, 92,
90, 88, 85, 83, 81, 78, 76, 73, 71, 68, 65, 63, 60, 57, 54, 51,
49, 46, 43, 40, 37, 34, 31, 28, 25, 22, 19, 16, 12, 9, 6, 3,
};
const char TRIANGLE[32] = {  
  -0x80,-0x78,-0x70,-0x68, -0x60,-0x58,-0x50,-0x48,
  -0x40,-0x38,-0x30,-0x28, -0x20,-0x18,-0x10,-0x08,
  0x00,0x08,0x10,0x18, 0x20,0x28,0x30,0x38,
  0x40,0x48,0x50,0x58, 0x60,0x68,0x70,0x78,
};
const char NOISE[32] = {  
0x60,0x37,0x3f,0x5c,0x16,0xca,0xc2,0xa5,0xfe,0xba,0x77,0x89,0xaa,0x77,0x13,0xd8,
0xae,0x82,0xfd,0x22,0x9c,0x46,0xde,0x14,0x50,0xb4,0x97,0x46,0x54,0x9d,0x60,0x2b,
};

SoundEffect e;
byte volume;

const SoundEffect SOUNDS[] = {
  { 1200, 0, 0, 1, NOISE, 0xff, 0 },
  { 250, 0, 1000, -4, SINTBL, 0x7f, 0 },
  { 500, 0, 1000, 2, TRIANGLE, 0x1f, 0 },
  { 600, 0, 3000, -1, SQUARE_LOFREQ, 0x1f, 0 },
  { 600, 0, 3000, -1, SQUARE_HIFREQ, 0x1f, 0 },
  { 600, 0, 3000, 1, SQUARE_LOFREQ, 0x3f, 0 },
  { 1200, 0, 0, 1, SINTBL, 0x7f, 1 },
};

void play();

void main() {
  // halt on command = 0
  if (command == 0) HALT;
  // load stack pointer
  __asm
    ld sp,#0x8000
    di
  __endasm;
  // copy sound to RAM
  memcpy(&e, &SOUNDS[command-1], sizeof(e));
  // play sound
  play();
  // turn off speaker and halt
  dac = 0;
  HALT;
}

void sample() {
  byte val = e.wavetable[(byte)(e.offset >> 8) & e.wavemask];
  if (val <= volume) dac = val;
  e.offset += e.delta;
}

void play() {
  volume = 0xff;
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
    // taper off volume
    if (e.duration <= 0xff) volume = e.duration;
  }
}
