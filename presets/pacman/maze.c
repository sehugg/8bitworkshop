#include <string.h>

typedef unsigned char byte;
typedef unsigned short word;

// Hardware memory addresses for Pacman
byte __at (0x4000) vram[32][36];  // Video RAM - rotated layout!
byte __at (0x4400) cram[32][36];  // Color RAM

struct {
  byte xpos;
  byte ypos;
  byte color;
  byte shape;
} __at (0x4FF0) sprites[8];

// Hardware control registers
byte __at (0x5000) interrupt_enable;
byte __at (0x5001) sound_enable;
byte __at (0x5003) flip_screen;

// Input registers  
volatile byte __at (0x5000) input0;
volatile byte __at (0x5040) input1;

#define START1 !(input1 & 0x20)

// Video frame counter
volatile byte video_framecount;

// NMI interrupt handler
void rst_66() __interrupt {
  video_framecount++;
}

// Entry point
void start() {
__asm
	LD      SP,#0x4800
        EI
        LD    BC, #l__INITIALIZER+1
        LD    A, B
        LD    DE, #s__INITIALIZED
        LD    HL, #s__INITIALIZER
        LDIR
__endasm;
	main();
}

void wait_for_frame() {
  byte initial_framecount = video_framecount;
  *(volatile byte*)0x50C0 = 0; // Reset watchdog
  while (video_framecount == initial_framecount);
}

// Simple maze characters
#define WALL_H    0x01  // Horizontal wall
#define WALL_V    0x02  // Vertical wall  
#define WALL_TL   0x03  // Top-left corner
#define WALL_TR   0x04  // Top-right corner
#define WALL_BL   0x05  // Bottom-left corner
#define WALL_BR   0x06  // Bottom-right corner
#define DOT       0x07  // Dot
#define POWER_DOT 0x08  // Power pellet
#define SPACE     0x00  // Empty space

// Colors
#define BLUE      0x01  // Wall color
#define YELLOW    0x09  // Dot color
#define WHITE     0x0F  // Power pellet color

void draw_maze() {
  byte x, y;
  
  // Clear screen
  for (x = 0; x < 32; x++) {
    for (y = 0; y < 36; y++) {
      vram[x][y] = SPACE;
      cram[x][y] = 0;
    }
  }
  
  // Draw outer walls
  for (y = 1; y < 35; y++) {
    vram[1][y] = WALL_V;   // Left wall
    vram[30][y] = WALL_V;  // Right wall  
    cram[1][y] = BLUE;
    cram[30][y] = BLUE;
  }
  
  for (x = 1; x < 31; x++) {
    vram[x][1] = WALL_H;   // Top wall
    vram[x][34] = WALL_H;  // Bottom wall
    cram[x][1] = BLUE;
    cram[x][34] = BLUE;
  }
  
  // Draw corners
  vram[1][1] = WALL_TL;
  vram[30][1] = WALL_TR;
  vram[1][34] = WALL_BL;
  vram[30][34] = WALL_BR;
  cram[1][1] = BLUE;
  cram[30][1] = BLUE;
  cram[1][34] = BLUE;
  cram[30][34] = BLUE;
  
  // Draw some inner maze structure
  for (x = 5; x < 27; x += 4) {
    for (y = 5; y < 30; y += 6) {
      vram[x][y] = WALL_H;
      vram[x+1][y] = WALL_H;
      vram[x][y+1] = WALL_V;
      vram[x][y+2] = WALL_V;
      cram[x][y] = BLUE;
      cram[x+1][y] = BLUE;
      cram[x][y+1] = BLUE;
      cram[x][y+2] = BLUE;
    }
  }
  
  // Add dots in corridors
  for (x = 3; x < 29; x += 2) {
    for (y = 3; y < 32; y += 2) {
      if (vram[x][y] == SPACE) {
        vram[x][y] = DOT;
        cram[x][y] = YELLOW;
      }
    }
  }
  
  // Add power pellets in corners
  vram[3][3] = POWER_DOT;
  vram[28][3] = POWER_DOT;
  vram[3][31] = POWER_DOT;
  vram[28][31] = POWER_DOT;
  cram[3][3] = WHITE;
  cram[28][3] = WHITE;
  cram[3][31] = WHITE;
  cram[28][31] = WHITE;
}

void draw_title() {
  const char* title = "PAC-MAN MAZE DEMO";
  byte i;
  byte x = 15; // Center-ish position
  byte y = 18; // Middle of screen
  
  for (i = 0; title[i]; i++) {
    vram[x][y + i] = title[i] - 0x20 + 0x10; // ASCII to character offset
    cram[x][y + i] = YELLOW;
  }
}

void animate_power_pellets() {
  static byte flash_counter = 0;
  byte color;
  
  flash_counter++;
  color = (flash_counter & 0x10) ? WHITE : BLUE;
  
  cram[3][3] = color;
  cram[28][3] = color;
  cram[3][31] = color;
  cram[28][31] = color;
}

void main() {
  // Initialize hardware
  interrupt_enable = 1;
  sound_enable = 1;
  flip_screen = 0;
  
  // Draw the maze
  draw_maze();
  draw_title();
  
  // Hide sprites
  for (byte i = 0; i < 8; i++) {
    sprites[i].xpos = 0;
    sprites[i].ypos = 0;
  }
  
  // Main loop - animate power pellets
  while (1) {
    wait_for_frame();
    animate_power_pellets();
    
    if (START1) break;
  }
  
  // Show exit message
  const char* exit_msg = "PRESS START TO EXIT";
  byte x = 14;
  byte y = 8;
  
  for (byte i = 0; exit_msg[i]; i++) {
    vram[x][y + i] = exit_msg[i] - 0x20 + 0x10;
    cram[x][y + i] = WHITE;
  }
  
  while(1) {
    wait_for_frame();
    if (START1) break;
  }
} 