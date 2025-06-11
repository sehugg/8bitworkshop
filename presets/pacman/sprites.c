#include <string.h>

typedef unsigned char byte;
typedef unsigned short word;

// Hardware memory addresses for Pacman
byte __at (0x4000) vram[32][36];  // Video RAM
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

// Input registers
volatile byte __at (0x5000) input0;
volatile byte __at (0x5040) input1;

// Input controls (active low)
#define UP1    !(input0 & 0x1)
#define LEFT1  !(input0 & 0x2)
#define RIGHT1 !(input0 & 0x4)
#define DOWN1  !(input0 & 0x8)
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

void clear_screen() {
  byte x, y;
  for (x = 0; x < 32; x++) {
    for (y = 0; y < 36; y++) {
      vram[x][y] = 0;
      cram[x][y] = 0;
    }
  }
}

void draw_text(byte x, byte y, const char* text, byte color) {
  byte i;
  for (i = 0; text[i]; i++) {
    vram[x][y + i] = text[i] - 0x20 + 0x10; // ASCII offset
    cram[x][y + i] = color;
  }
}

void init_sprites() {
  byte i;
  
  // Initialize all 8 sprites
  for (i = 0; i < 8; i++) {
    sprites[i].xpos = 60 + i * 20;  // Spread across screen
    sprites[i].ypos = 100 + i * 10; // Stagger vertically
    sprites[i].shape = i + 1;       // Different shapes
    sprites[i].color = i + 1;       // Different colors
  }
}

void move_sprites() {
  static byte counter = 0;
  byte i;
  
  counter++;
  
  // Move sprites in different patterns
  for (i = 0; i < 8; i++) {
    switch (i) {
      case 0: // Circular motion
        sprites[i].xpos = 112 + (signed char)(50 * cos_table[counter & 63]);
        sprites[i].ypos = 144 + (signed char)(30 * sin_table[counter & 63]);
        break;
        
      case 1: // Horizontal bounce
        sprites[i].xpos = 40 + ((counter * 2) & 127);
        if (sprites[i].xpos > 184) sprites[i].xpos = 224 - sprites[i].xpos;
        break;
        
      case 2: // Vertical bounce  
        sprites[i].ypos = 40 + ((counter * 3) & 127);
        if (sprites[i].ypos > 200) sprites[i].ypos = 288 - sprites[i].ypos;
        break;
        
      case 3: // Diagonal movement
        sprites[i].xpos = 20 + ((counter * 2) & 127);
        sprites[i].ypos = 20 + ((counter * 2) & 127);
        break;
        
      case 4: // Controlled by player
        if (UP1) sprites[i].ypos--;
        if (DOWN1) sprites[i].ypos++;
        if (LEFT1) sprites[i].xpos--;
        if (RIGHT1) sprites[i].xpos++;
        break;
        
      default: // Random jitter
        sprites[i].xpos += (counter & 1) ? 1 : -1;
        sprites[i].ypos += (counter & 2) ? 1 : -1;
        break;
    }
    
    // Keep sprites on screen
    if (sprites[i].xpos > 240) sprites[i].xpos = 240;
    if (sprites[i].ypos > 280) sprites[i].ypos = 280;
  }
}

void cycle_colors() {
  static byte color_counter = 0;
  byte i;
  
  color_counter++;
  
  // Cycle through colors every 30 frames
  if ((color_counter & 31) == 0) {
    for (i = 0; i < 8; i++) {
      sprites[i].color = (sprites[i].color & 0x0F) + 1;
      if (sprites[i].color > 15) sprites[i].color = 1;
    }
  }
}

// Simple sin/cos tables for smooth movement
const signed char cos_table[64] = {
  63, 62, 60, 57, 54, 50, 45, 40, 34, 28, 22, 15, 8, 1, -6, -13,
  -20, -27, -33, -39, -44, -49, -53, -56, -59, -61, -62, -63, -62, -61, -59, -56,
  -53, -49, -44, -39, -33, -27, -20, -13, -6, 1, 8, 15, 22, 28, 34, 40,
  45, 50, 54, 57, 60, 62, 63, 62, 60, 57, 54, 50, 45, 40, 34, 28
};

const signed char sin_table[64] = {
  0, 7, 14, 21, 27, 33, 39, 44, 49, 53, 56, 59, 61, 62, 63, 62,
  61, 59, 56, 53, 49, 44, 39, 33, 27, 21, 14, 7, 0, -7, -14, -21,
  -27, -33, -39, -44, -49, -53, -56, -59, -61, -62, -63, -62, -61, -59, -56, -53,
  -49, -44, -39, -33, -27, -21, -14, -7, 0, 7, 14, 21, 27, 33, 39, 44
};

void show_sprite_info() {
  draw_text(1, 2, "PACMAN SPRITE TEST", 0x0F);
  draw_text(3, 2, "8 HARDWARE SPRITES", 0x09);
  draw_text(5, 2, "USE JOYSTICK FOR #4", 0x0B);
  draw_text(7, 2, "PRESS START TO EXIT", 0x0C);
  
  // Show sprite numbers
  for (byte i = 0; i < 8; i++) {
    vram[10 + i * 2][2] = '0' + i - 0x20 + 0x10;
    cram[10 + i * 2][2] = i + 1;
  }
}

void main() {
  // Initialize hardware
  interrupt_enable = 1;
  sound_enable = 1;
  
  // Clear screen and show info
  clear_screen();
  show_sprite_info();
  
  // Initialize sprites
  init_sprites();
  
  // Main animation loop
  while (1) {
    wait_for_frame();
    
    move_sprites();
    cycle_colors();
    
    // Exit on start button
    if (START1) break;
  }
  
  // Hide all sprites
  for (byte i = 0; i < 8; i++) {
    sprites[i].xpos = 0;
    sprites[i].ypos = 0;
  }
  
  clear_screen();
  draw_text(14, 8, "SPRITE TEST COMPLETE", 0x0F);
  
  while(1) {
    wait_for_frame();
    if (START1) break;
  }
} 