
#include <stdlib.h>
#include <string.h>
#include <cv.h>
#include <cvu.h>

#define SPRITE_PATTERNS ((const cv_vmemp)0x3800)
#define SPRITES ((const cv_vmemp)0x3c00)

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;

uintptr_t __at(0x6a) font_bitmap_a;
uintptr_t __at(0x6c) font_bitmap_0;

volatile bool vint;
volatile uint_fast8_t vint_counter;

void vint_handler(void)
{
  vint = true;
  vint_counter++;
}

#define NUM_SPRITE_PATTERNS 5

const byte sprite_table[NUM_SPRITE_PATTERNS][16*2] = {
  /*{w:16,h:16,remap:[4,0,1,2,3,5,6,7,8,9],brev:1,count:4}*/ 
  { // first plane
  0x00, 0x00, 0x00, 0x02, 0x01, 0x06, 0x01, 0x07,
  0x1F, 0x7F, 0xFF, 0xEF, 0xF3, 0x7C, 0x3E, 0x2A,
  0x00, 0x00, 0x80, 0x80, 0x70, 0xF8, 0xEC, 0xFE,
  0xC0, 0xFC, 0xFE, 0xEF, 0xDE, 0xDC, 0x3C, 0x2A,
  },{
  0x02, 0x01, 0x06, 0x02, 0x19, 0x07, 0x0F, 0x1F,
  0x3F, 0x7F, 0x77, 0x73, 0x30, 0x38, 0x3E, 0x2A,
  0x38, 0x6C, 0xFE, 0xFE, 0x80, 0xEF, 0xF0, 0xFC,
  0xC0, 0xFC, 0xFE, 0xCE, 0x1C, 0x18, 0x3C, 0x2A,
  },{
  0x04, 0xC5, 0xA2, 0x51, 0x2A, 0x17, 0x0E, 0x1B,
  0x64, 0x89, 0x90, 0x61, 0x00, 0x01, 0x00, 0x00,
  0x20, 0xA3, 0x45, 0x8A, 0x54, 0xF8, 0x60, 0xD8,
  0xA6, 0x11, 0x89, 0x06, 0x80, 0x00, 0x80, 0x00,
  },{
  0x04, 0x05, 0x02, 0xE1, 0xDA, 0x3F, 0x06, 0x7B,
  0x8E, 0x91, 0x60, 0x01, 0x00, 0x01, 0x00, 0x00,
  0x20, 0xA0, 0x40, 0x87, 0x5B, 0xFC, 0x70, 0xEE,
  0xF1, 0x09, 0x86, 0x00, 0x80, 0x00, 0x80, 0x00,
  }
};

///

const unsigned char reverse_lookup[16] = {
0x0, 0x8, 0x4, 0xc, 0x2, 0xa, 0x6, 0xe, 0x1, 0x9, 0x5, 0xd, 0x3, 0xb, 0x7, 0xf, };

byte reverse_bits(byte n) {
  return (reverse_lookup[n&0b1111] << 4) | reverse_lookup[n>>4];
}

void flip_sprite_patterns(word dest, const byte* patterns, word len) {
  word i;
  for (i=0; i<len; i++) {
    cvu_voutb(reverse_bits(*patterns++), dest++ ^ 16); // swap left/right chars
  }
}

#define BGCOL CV_COLOR_BLUE

void setup_32_column_font() {
  cvu_vmemset(0, 0, 0x4000); // clear video memory
  
  cv_set_screen_mode(CV_SCREENMODE_STANDARD);
  
  cvu_memtovmemcpy(SPRITE_PATTERNS, sprite_table, sizeof(sprite_table));
  flip_sprite_patterns(SPRITE_PATTERNS + 512, (const byte*)sprite_table, sizeof(sprite_table));
  cv_set_sprite_pattern_table(SPRITE_PATTERNS);
  cv_set_sprite_attribute_table(SPRITES);
  cv_set_sprite_big(true);
  cvu_vmemset(SPRITES, 0xfc, 4*32); // to prevent spurious collisions
}

void wait_vsync() {
  vint = false;
  while (!vint) ;
}

void delay(byte i) {
  while (i--) {
    wait_vsync();
  }
}

#define Y_CEILING 32
#define Y_FLOOR 160
#define JUMP_SPEED 4

struct cvu_sprite player;
sbyte player_jump;
byte player_dir;

struct cvu_sprite bug;
byte bug_dir;

void draw_sprites() {
  if (player_jump)
    player.name = 4;
  else
    player.name = 0;
  if (!player_dir) player.name += 64;
  cvu_set_sprite(SPRITES, 0, &player);
  
  bug.name = (bug.x & 1) ? 8 : 12;
  cvu_set_sprite(SPRITES, 1, &bug);
}

void move_player() {
  struct cv_controller_state ctrl;
  cv_get_controller_state(&ctrl, 0);
  if (ctrl.joystick & CV_LEFT) {
    player.x--;
    player_dir = 0;
  }
  if (ctrl.joystick & CV_RIGHT) {
    player.x++;
    player_dir = 1;
  }
  if ((ctrl.joystick & CV_UP) && !player_jump) {
    player_jump = -JUMP_SPEED;
  }
  // are we jumping?
  if (player_jump) {
    player.y += player_jump;
    // when we hit the top of jump, bounce down
    if (player.y <= Y_CEILING)
      player_jump = JUMP_SPEED;
    // stop when we hit the ground
    if (player.y >= Y_FLOOR)
      player_jump = 0;
  }
}

void move_bug() {
  bug.x += bug_dir;
}

void place_new_bug() {
  bug.y = (rand() & 0x3f) + Y_CEILING;
  if (rand() & 1) {
    bug.x = 0;
    bug_dir = 1;
  } else {
    bug.x = 255;
    bug_dir = -1;
  }
}

void check_collision() {
  if (cv_get_sprite_collission()) {
    place_new_bug();
    player_jump = 2; // settle back down
  }
}

void play_scene() {
  while (1) {
    wait_vsync();
    draw_sprites();
    move_player();
    move_bug();
    check_collision();
  }
}

void init_sprites() {
  player.x = 128;
  player.y = Y_FLOOR;
  player.tag = CV_COLOR_GREEN;
  player_jump = 0;
  player_dir = 0;

  bug.tag = CV_COLOR_BLUE;
  place_new_bug();
}

void main() {
  setup_32_column_font();
  cv_set_screen_active(true);
  cv_set_vint_handler(&vint_handler);
  
  init_sprites();  
  play_scene();
}
