#include <string.h>

typedef unsigned char byte;
typedef unsigned short word;
typedef signed char sbyte;

// Forward declaration
void main();

// Startup function - sets up stack pointer and calls main
void start() __naked {
__asm
	LD      SP,#0x4800      ; Set stack pointer to start of RAM
        EI                      ; Enable interrupts
; copy initialized data to RAM
        LD    BC, #l__INITIALIZER
        LD    A, B
        LD    DE, #s__INITIALIZED
        LD    HL, #s__INITIALIZER
        LDIR
  	JP    _main
; padding to get to offset 0x66
  	.ds   0x66 - (. - _start)
__endasm;
}

// Hardware memory addresses for Pacman
volatile byte __at (0x4000) vram[32][36];  // Video RAM - rotated layout!
volatile byte __at (0x4400) cram[32][36];  // Color RAM

struct {
  byte shape;
  byte color;
} __at (0x4FF0) sprites[8];

struct {
  byte xpos;
  byte ypos;
} __at (0x5060) sprite_coords[8];

byte __at (0x4800) ram[0x7F0];

// Hardware control registers
volatile byte __at (0x5000) interrupt_enable;
volatile byte __at (0x5001) sound_enable;
volatile byte __at (0x5003) flip_screen;

// Input ports (memory mapped, active low)
volatile byte __at (0x5000) input0;  // IN0: joystick + coins
volatile byte __at (0x5040) input1;  // IN1: start buttons + service

// Input macros for Pacman controls (active low) - using direct register access
#define UP1    !(input0 & 0x1)
#define LEFT1  !(input0 & 0x2)
#define RIGHT1 !(input0 & 0x4)
#define DOWN1  !(input0 & 0x8)
#define COIN1  !(input0 & 0x20)
#define COIN2  !(input0 & 0x40)
#define START1 !(input1 & 0x20)
#define START2 !(input1 & 0x40)

volatile byte video_framecount; // actual framecount

// starts at address 0x66 - VBLANK interrupt handler
void rst_66() __interrupt {
  video_framecount++;
}

// Watchdog register
volatile byte __at (0x50C0) watchdog;

// Palette data (32 colors, 4-bit RGB)
const char __at (0x6000) palette[32] = {/*{pal:444}*/
  0x000,0xf00,0x0f0,0xff0,0x00f,0xf0f,0x0ff,0xfff,
  0x888,0xf88,0x8f8,0xff8,0x88f,0xf8f,0x8ff,0xddd,
  0x111,0x500,0x050,0x550,0x005,0x505,0x055,0x777,
  0x333,0xd33,0x3d3,0xdd3,0x33d,0xd3d,0x3dd,0xbbb,
};

// Character ROM data (128 characters, 8x8 pixels, 2 bits per pixel, 8KB total)  
const char __at (0x4000) charrom[0x2000] = {/*{w:8,h:8,np:2,count:128,brev:1}*/
  // Character 0: space
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  // Character 1: simple filled square 
  0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  // Character 2: hollow square
  0xff,0x81,0x81,0x81,0x81,0x81,0x81,0xff,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  // Character 3: cross pattern
  0x18,0x18,0x18,0xff,0xff,0x18,0x18,0x18,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  // Character 4: diamond
  0x18,0x3c,0x7e,0xff,0xff,0x7e,0x3c,0x18,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  // Character 5: Pacman-like circle 
  0x3c,0x7e,0xe7,0xc3,0xc3,0xe7,0x7e,0x3c,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  // Character 6: dot
  0x00,0x00,0x18,0x3c,0x3c,0x18,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  // Character 7: small dot
  0x00,0x00,0x00,0x18,0x18,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  // Rest fill with test patterns (first 16 characters)
  0xaa,0x55,0xaa,0x55,0xaa,0x55,0xaa,0x55,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x55,0xaa,0x55,0xaa,0x55,0xaa,0x55,0xaa,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0xf0,0xf0,0xf0,0xf0,0x0f,0x0f,0x0f,0x0f,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x0f,0x0f,0x0f,0x0f,0xf0,0xf0,0xf0,0xf0,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0xff,0x00,0xff,0x00,0xff,0x00,0xff,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0xff,0x00,0xff,0x00,0xff,0x00,0xff,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x81,0x42,0x24,0x18,0x18,0x24,0x42,0x81,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x18,0x24,0x42,0x81,0x81,0x42,0x24,0x18,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  // Fill remaining characters with zeros for now (can be expanded later)
  // Total should be 128 * 16 = 2048 bytes (0x2000) for the full 8KB graphics ROM
};

#define BLANK 0x00

// Clear screen
void clrscr() {
  word i;
  for (i = 0; i < 0x400; i++) {
    ((byte*)0x4000)[i] = BLANK; // blank character
    ((byte*)0x4400)[i] = 0x0f;  // white on black
    
    // Kick watchdog every 64 iterations to prevent timeout during long clear
    if ((i & 63) == 0) {
      watchdog = 0;
    }
  }
}

// Put character at screen position (simplified mapping for now)
void my_putchar(byte x, byte y, byte ch) {
  word addr;
  
  // Simple linear mapping for now
  if (x < 28 && y < 36) {
    addr = y * 32 + x + 2; // basic offset
    if (addr < 0x400) {
      ((byte*)0x4000)[addr] = ch;
      ((byte*)0x4400)[addr] = 0x0f; // white on black
    }
  }
}

// Put string at position  
void putstring(byte x, byte y, char* str) {
  byte i;
  i = 0;
  while (str[i] && i < 20) {
    my_putchar(x + i, y, str[i]);
    i++;
  }
}

// Main program
void main() {
  // Declare all variables at start of function (old C requirement)
  byte x, y, frame, old_frame;
  
  // Initialize variables
  x = 10;
  y = 20;
  frame = 0;
  
  // Initialize hardware
  interrupt_enable = 1;   // Enable interrupts
  sound_enable = 1;       // Enable sound  
  flip_screen = 0;        // Normal orientation
  
  // Clear screen
  clrscr();
  
  // Test pattern - show some test characters
  my_putchar(4, 4, 0x01);  // test character 1
  my_putchar(6, 4, 0x02);  // test character 2
  my_putchar(8, 4, 0x03);  // test character 3
  my_putchar(10, 4, 0x04); // test character 4
  my_putchar(12, 4, 0x05); // test character 5
  my_putchar(14, 4, 0x06); // test character 6
  
  // Main game loop - now with proper interrupt-driven frame sync
  while (1) {
    // Kick the watchdog to prevent reset
    watchdog = 0;
    
    // Debug: show we're in the main loop
    my_putchar(2, 28, 0x01 + (frame & 3));
    
    // Wait for frame - now using interrupt-driven counter
    old_frame = video_framecount;
    while (video_framecount == old_frame) {
      // Kick watchdog while waiting too
      watchdog = 0;
    }
    frame++;
    
    // Clear old position
    my_putchar(x, y, BLANK);
    
    // Debug: test input reads
    my_putchar(24, 30, input0 & 0x1 ? 0x00 : 0x01);    // UP indicator
    my_putchar(24, 31, input0 & 0x4 ? 0x00 : 0x01);    // RIGHT indicator  
    my_putchar(24, 32, input0 & 0x8 ? 0x00 : 0x01);    // DOWN indicator
    my_putchar(24, 33, input0 & 0x2 ? 0x00 : 0x01);    // LEFT indicator
    
    // Handle input
    if (UP1 && y > 2) y--;
    if (DOWN1 && y < 34) y++;
    if (LEFT1 && x > 2) x--;
    if (RIGHT1 && x < 26) x++;
    
    // Draw player at new position  
    my_putchar(x, y, 0x05); // player character
    
    // Show status
    my_putchar(2, 30, 0x01 + (frame & 7));
    
    if (START1) {
      my_putchar(2, 32, 0x02); // show test character
    }
    
    if (COIN1) {
      my_putchar(2, 34, 0x04); // show test character
    }
  }
}

