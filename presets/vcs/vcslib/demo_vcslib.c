
//#resource "vcs-ca65.inc"
//#resource "kernel.inc"

//#link "demo_kernels.ca65"

//#link "libvcs.ca65"
//#link "mapper_3e.ca65"
//#link "xdata.ca65"
//#link "frameloop.c"
//#link "scorepf.ca65"
//#link "rand8.ca65"
//#link "bitmap48.ca65"
//#link "tinyfont48.c"
//#link "score6.ca65"

//#link "sound.ca65"
//#link "music.ca65"
//#link "demo_sounds.c"

#include <peekpoke.h>
#include "bcd.h"
#include "vcslib.h"

#define NSPRITES 2
#define NOBJS 5

#pragma bss-name (push,"ZEROPAGE")

/*
Attributes (position, etc) for all objects.
These map directly to player0/player1/missile0/missile1/ball.
(But they don't have to, if you write the code differently.)
*/
byte xpos[NOBJS];
byte ypos[NOBJS];

/*
These are variables used by the display kernels.
Some of them are modified by the kernels, like k_ypos,
so they must be initialized before the kernel starts.
*/
byte k_height[NOBJS];
byte k_ypos[NOBJS];
byte* k_bitmap[NSPRITES];
byte* k_colormap[NSPRITES];
const byte* k_playfield;

/*
BCD-encoded score, used by score display routines.
*/
byte bcd_score[3];	// support 6-digit score (3 bytes)

#pragma bss-name (pop)

/*
We build a number of 30x5 bitmaps with tinyfont48
*/
#define NCAPTIONS 4

// the font doesn't map exactly to ASCII
#pragma charmap (0x20, 0x5b)
#pragma charmap (0x21, 0x29)
#pragma charmap (0x5f, 0x2d)

// use the same ROM bank as tinyfont
#pragma bss-name(push, "XDATA")

// these have to be either in PERM or in XDATA
const char* const CAPTIONS[NCAPTIONS] = {
  "HELLO WORLD!",
  " WELCOME TO ",
  "**[VCSLIB[**",
  "C FOR 2600!!",
};

// used by tinyfont48 routine
byte font_bitmap[NCAPTIONS][32]; // at least 30 bytes each

#pragma bss-name(pop)

// music data (demo_sounds.c)
extern const byte music_1[];
extern const byte music_2[];

// kernel function for player sprites + background
extern void fastcall kernel_2pp_4pfa(byte nlines);

#pragma code-name (push, "ROM2")
#pragma rodata-name (push, "ROM2")

// kernel function for banner
extern void fastcall kernel_2pfasync(byte nlines);

// asynchronous playfield bitmap
/*{w:48,h:8,flip:1}*/
const byte k_asyncpf[6*8] = {
  0x00,0x00,0x00,0x00,0x00,0x00,
  0x80,0x0C,0xCE,0x30,0xEE,0x10,
  0x40,0x92,0x50,0x00,0x49,0x28,
  0x20,0x50,0x50,0x00,0x49,0x50,
  0x20,0x50,0x4E,0x00,0x4E,0x28,
  0x20,0x52,0x41,0x00,0x49,0x50,
  0x20,0x4C,0x4E,0x00,0xEE,0x20,
  0x00,0x00,0x00,0x00,0x00,0x00,
};

// number of lines in the 2pp sprite kernel
#define NLINES (192-44-48)

// Player sprite bitmap
/*{w:8,h:17,flip:1}*/
const byte Frame0[17] = {
    0b1100001,
    0b100010,
    0b100100,
    0b101100,
    0b111000,
    0b10111001,
    0b10111010,
    0b1111100,
    0b11000,
    0b111100,
    0b1100110,
    0b1011010,
    0b1111110,
    0b1111110,
    0b1010110,
    0b1111110,
    0b10111101,
};

// Player sprite color map
const byte ColorFrame0[17+1] = {
    0xF4, // bottom
    0xF6,
    0x84,
    0x86,
    0x88,
    0xC2,
    0xC4,
    0xC6,
    0xC8,
    0x18,
    0x28,
    0x18,
    0x18,
    0x18,
    0x18,
    0x16,
    0x5c, // top
    0x5c, // (duplicated)
};

// move player with joystick
void move_joy(void) {
  if (JOY_UP(0)) {
    if (ypos[1] > 0x22) ypos[1]--;
  }
  if (JOY_DOWN(0)) {
    if (ypos[1] < 0x22 + 16 + NLINES/2) ypos[1]++;
  }
  if (JOY_LEFT(0)) {
    if (xpos[1] > 0x3) xpos[1]--;
    TIA.refp1 = NO_REFLECT;
  }
  if (JOY_RIGHT(0)) {
    if (xpos[1] < 0x9c) xpos[1]++;
    TIA.refp1 = REFLECT;
  }
}

// Setup an object for the kernel routines.
void setup_object(byte index) {
  k_ypos[index] = ypos[index] >> 1;
  set_horiz_pos((index<<8) | xpos[index]);
}

// Setup a player object for the kernel routines.
void setup_player(byte nlines, byte index) {
  byte y = ypos[index] >> 1;
  byte ofs = nlines - y + 1;
  k_bitmap[index] = (char*) Frame0 - ofs;
  ofs -= 1;
  ofs -= ypos[index] & 1;
  k_colormap[index] = (char*) ColorFrame0 - ofs;
  k_ypos[index] = y;
  set_horiz_pos((index<<8) | xpos[index]);
}

/*
This function runs after VSYNC, and before the display kernel.
*/
void my_preframe(void) {
  TIA.vdelp0 = ypos[0];
  TIA.vdelp1 = ypos[1];
  TIA.nusiz0 = ONE_COPY | MSBL_SIZE4;
  TIA.nusiz1 = DOUBLE_SIZE | MSBL_SIZE4;
  setup_player(NLINES/2, P0);
  setup_player(NLINES/2, P1);
  setup_object(M0);
  setup_object(M1);
  apply_hmove();
//  k_playfield = (char*) 0xf000;
}

/*
Versatile playfield data is pretty easy:
FIrst byte contains the register, second byte has the value.
It's in reverse order.
*/
const byte VersatilePlayfield_data_e0_b0[] = {
    0x00, 0x3F, 0x00, 0x3F, 0x00, 0x0E, 0xAA, 0x0E,
    0x18, 0x08, 0x02, 0x09, 0x00, 0x0F, 0x08, 0x0F,
    0x7F, 0x0F, 0x3E, 0x0F, 0x1C, 0x0F, 0x08, 0x0F,
    0xC2, 0x08, 0x00, 0x3F, 0x00, 0x3F, 0x00, 0x3F,
    0x00, 0x0E, 0x1E, 0x0E, 0x08, 0x08, 0x7F, 0x0E,
    0xFE, 0x0E, 0x38, 0x0E, 0x06, 0x08, 0x01, 0x0A,
    0xa0, 0x09
};

/*
This function is called to display the frame.
*/
void my_doframe(void) {
  byte caption_index; // which message to display? (0..NCAPTIONS-1)

  // draw the VCSLIB title using the async playfield kernel
  TIA.ctrlpf = 0;
  do_wsync();
  TIA.colubk = COLOR_CONV(0x68);
  TIA.colupf = COLOR_CONV(0xa2);
  kernel_2pfasync(42);
  
  // draw the sprites + playfield
  TIA.colubk = 0x0;
  TIA.ctrlpf = PF_REFLECT;
  kernel_2pp_4pfa(NLINES/2); // each line is doubled
  
  // draw the playfield 2-digit score
  TIA.ctrlpf = PF_SCORE;
  do_wsync();
  TIA.colubk = COLOR_CONV(0xa2);
  TIA.colup0 = COLOR_CONV(0x2e);
  TIA.colup1 = COLOR_CONV(0x8e);
  scorepf_kernel();
  TIA.wsync = 0;
  TIA.colubk = 0;
  TIA.ctrlpf = PF_REFLECT;

  // draw a 12-letter caption using bitmap48
  TIA.colubk = COLOR_CONV(0x82);
  // cycle between the messages
  // (we are low on memory, so use whatever counter is available :P)
  caption_index = ((byte)music_ptr>>3) & (NCAPTIONS-1);
  bitmap48_setheight(5); // must call before bitmap48_setaddress()
  bitmap48_setaddress(font_bitmap[caption_index]);
  bitmap48_setup();
  bitmap48_kernel(5); // 5 lines high
  
  // draw the 6-digit score (again using bitmap48)
  score6_build();
  bitmap48_kernel(8); // 8 lines high
}

/*
This function is called after the frame is displayed,
and before overscan.
*/
void my_postframe(void) {
  // move P1
  move_joy();
  // move P0
  if (++xpos[P0] > 150) {
    xpos[P0] = 0;
  }
  if (++ypos[P0] > 100) {
    ypos[P0] = 0;
  }
  // set missile positions
  ypos[M0] = 80;
  ypos[M1] = 82;
  xpos[M0] = 10;
  xpos[M1] = 155;
  // fire buttons
  if (JOY_FIRE(0)) {
    sound_play(7);
    score6_add(0x0199);
  }
  if (JOY_FIRE(1)) {
    BCD_ADD(bcd_score[0], 1);
  }
  // update sound
  sound_update();
  music_update();
  // update sound meter
  k_height[M0] = sndchan_timer[0]*4;
  k_height[M1] = sndchan_timer[1]*4;
  // prepare score for next frame
  scorepf_build();
  // play more music?
  if (SW_SELECT()) { music_play(music_2); }
}

/*
kernel_loop() is the main loop routine.
It's wrapped with wrapped-call so that it
switches to the appropriate bank (the one
that contains the function) before running.

kernel_1() etc. do not have to be wrapped,
as long as they are called from a function
that is itself wrapped and in the same bank.
*/

#pragma wrapped-call (push, bankselect, bank)

void kernel_loop() {
  while (1) {
    kernel_1();
    my_preframe();
    kernel_2();
    my_doframe();
    kernel_3();
    my_postframe();
    kernel_4();
  }
}

#pragma wrapped-call (pop)

#pragma rodata-name (pop)
#pragma code-name (pop)


/*
These are just test routines, they can be removed.
*/
#pragma code-name(push, "XDATA");
#pragma data-name(push, "XDATA");
long int var = 0xdeadbeef;
int testfn() {
  return 0x1234;
}
#pragma code-name(pop);
#pragma data-name(pop);

#pragma wrapped-call (push, ramselect, 0)
void ramtest(void) {
  char x;
  POKE(0x17f0, 0xaa);
  x = PEEK(0x17f0);
  if (x != 0xaa) asm("brk");
  x = PEEK(&var); // 0xdeadbeef
  if (x != 0xef) asm("brk");
  x = PEEK((char*)testfn+4); // rts from testfn()
  if (x != 0x60) asm("brk");
  // TODO: doesn't work when ram selected
  xramset((char*)0x13e0);
  xramwrite(0x55);
  x = xramread(); // TODO: selects ROM0 here
  if (x != 0x55) asm("brk");
}
#pragma wrapped-call (pop)
/* end of test routines */


/*
init() runs first, and runs out of ROM0, which is
selected at power-up.
*/

#pragma wrapped-call (push, bankselect, bank)
#pragma code-name (push, "ROM0")

void init(void) {
  byte i;

  // set up initial object positions
  xpos[P1] = 80;
  ypos[P1] = 50;
  ypos[M0] = 30;
  ypos[M1] = 40;
  ypos[BALL] = 60;
  
  // set up kernel variables
  k_playfield = VersatilePlayfield_data_e0_b0-1; // kernel expects offset to be -1
  k_height[P0] = 16;
  k_height[P1] = 16;
  k_height[M0] = 0; // multiple of 4
  k_height[M1] = 4; // multiple of 4
  k_height[BALL] = 10;

  // initial BCD scores
  bcd_score[0] = 0x12;
  bcd_score[1] = 0x34;

  // build bitmap for caption messages
  for (i=0; i<NCAPTIONS; i++) {
    tinyfont48_build(font_bitmap[i], CAPTIONS[i]);
  }
  
  // start playing music
  music_play(music_1);
}

#pragma code-name (pop)
#pragma wrapped-call (pop)

/*
The main() function is called at startup.
It resides in the shared ROM area (PERM).
*/
void main(void) {
  
  // call functions once for "Analyze CPU Timing" button
  // (bank-switching does an indirect jump which isn't detected)
  asm("lda #4");
  asm("jsr _kernel_2pp_4pfa");
  asm("lda #4");
  asm("jsr _kernel_2pfasync");
  
  // copy initialized data to XRAM
  copyxdata();
  
  // test XRAM (can be removed)
  ramtest();
 
  // initialization
  init();
  
  // main kernel loop
  kernel_loop();
}

