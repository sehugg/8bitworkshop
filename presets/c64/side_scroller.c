
#include "common.h"
//#link "common.c"

#include "sprites.h"
//#link "sprites.c"

#include "rasterirq.h"
//#link "rasterirq.ca65"

#include "bcd.h"
//#link "bcd.c"

#include "sidmacros.h"

///// SPRITE DATA

#define NUM_SPRITE_PATTERNS 4

/*{w:12,h:21,bpp:2,brev:1,wpimg:64,count:4,aspect:2}*/
const char SPRITE_DATA[64*NUM_SPRITE_PATTERNS] = {
  0x0A,0xAA,0x80,0x0A,0xAA,0x80,0x2A,0xAA,
  0xA0,0x2A,0xAA,0xA0,0xAA,0xAA,0xA8,0xFF,
  0xD5,0x40,0xCD,0xD7,0x40,0x3D,0xD5,0x54,
  0x37,0x55,0x54,0x37,0x54,0x50,0x05,0x55,
  0x00,0x3A,0xA0,0x00,0xEA,0xA8,0x00,0xAB,
  0xAA,0x00,0xAB,0xAA,0x00,0xAB,0xAA,0x80,
  0xAA,0xEA,0x80,0xAA,0xAA,0x80,0x0F,0xFC,
  0x00,0x0F,0xFC,0x00,0x0F,0xFF,0xC0,0x00,

  0x02,0xAA,0xA0,0x02,0xAA,0xA0,0x0A,0xAA,
  0xA8,0x0A,0xAA,0xA8,0x2A,0xAA,0xAA,0x01,
  0x57,0xFF,0x01,0xD7,0x73,0x15,0x57,0x7C,
  0x15,0x55,0xDC,0x05,0x15,0xDC,0x00,0x55,
  0x50,0x00,0x0A,0xAC,0x00,0x2A,0xAB,0x00,
  0xAA,0xEA,0x00,0xAA,0xEA,0x02,0xAA,0xEA,
  0x02,0xAB,0xAA,0x02,0xAA,0xAA,0x00,0x3F,
  0xF0,0x00,0x3F,0xF0,0x03,0xFF,0xF0,0x00,

  0x03,0xFF,0xF0,0x0E,0xAA,0xAC,0x0E,0xAA,0xAC,
  0x3A,0xAE,0xAB,0x3A,0xBB,0xAB,0x3A,0xBA,0xAB,
  0x3A,0xBB,0xAB,0x3A,0xAE,0xAB,0x3A,0xAA,0xAB,
  0x35,0xAA,0x97,0x04,0x6A,0x44,0x04,0x15,0x04,
  0x01,0x04,0x10,0x01,0x04,0x10,0x01,0x04,0x10,
  0x00,0x44,0x40,0x00,0x44,0x40,0x00,0xEA,0xC0,
  0x00,0xD9,0xC0,0x00,0xE6,0xC0,0x00,0x3F,0x00,
  0x00,

  0x00,0x00,0x00,0x00,0xFF,0x00,0x03,0xAA,
  0xC0,0x0E,0xAA,0xB0,0x3A,0xAA,0xAC,0xE9,
  0x69,0x6B,0xEA,0x69,0xAB,0xEA,0xAA,0xAB,
  0xEA,0xAA,0xAB,0x3A,0x96,0xAC,0x3A,0x69,
  0xAC,0x0E,0xAA,0xB0,0x0E,0xAA,0xB0,0x0F,
  0xAA,0xF0,0x3A,0xAA,0xAC,0xEE,0xAA,0xBB,
  0xEE,0xAA,0xBB,0x33,0xAA,0xCC,0x03,0xAB,
  0x00,0x00,0xEB,0x00,0x00,0x3F,0xC0,0x00,
};

///// DEFINES

#define GAME_BASE 0x400
#define SCORE_BASE 0x2c00

#define SPRITE_SHAPE 192	// first sprite shape #
#define PLAYER_SHAPE SPRITE_SHAPE
#define POWERUP_SHAPE (SPRITE_SHAPE+2)
#define OBSTACLE_SHAPE (SPRITE_SHAPE+3)

#define PLAYER_INDEX 0		// sprite indices
#define POWERUP_INDEX 1
#define OBSTACLE_INDEX 2

#define CENTER_X 172		// sprite start X coord.
#define FLOOR_Y (128 << 8)	// sprite start Y (fixed 8.8)
#define JUMP_VELOCITY (-900)	// jump velocity (fixed 8.8)
#define GRAVITY 32		// gravity (fixed 8.8)

#define POWERUP_Y 80		// sprite Y of power up
#define OBSTACLE_Y 96		// sprite Y of obstacle

#define SCROLL_TOP 8		// scroll top row
#define SCROLL_ROWS 14		// scroll # of rows
#define GROUND_ROW 7		// ground row (+ top row)

///// VARIABLES

word player_x;		 // player X
word player_y;		 // player Y (fixed 8.8)
signed int player_vel_y; // player Y velocity (fixed 8.8)
byte faceleft = 0; 	 // 0 = face right, 1 = face left
word scroll_x = 0;	 // current scroll X position
word score = 0;		 // current player score

///// FUNCTIONS

// display list used by rasterirq.h
// draws scoreboard and sets scroll register
void display_list() {
  // set x scroll register to scroll value
  SET_SCROLL_X(scroll_x);
  // set background color
  VIC.bgcolor[0] = COLOR_CYAN;
  // next interrupt is two rows from bottom
  DLIST_NEXT(248-16);

  // set background color
  VIC.bgcolor[0] = COLOR_BLUE;
  // screen memory = 0x2800
  SET_VIC_SCREEN(SCORE_BASE);
  // clear x scroll register
  SET_SCROLL_X(0);
  // next interrupt is bottom of frame
  DLIST_NEXT(250);

  // reset screen to 0x400
  SET_VIC_SCREEN(0x400);
  // next interrupt is above top of next frame
  DLIST_RESTART(40);
}

void update_scoreboard() {
  draw_bcd_word(SCRNADR(SCORE_BASE,7,24), score);
}

void add_score(int delta) {
  score = bcd_add(score, delta);
  update_scoreboard();
}

// clear scoreboard and draw initial strings
void init_scoreboard() {
  memset((void*)SCORE_BASE, ' ', 1024);
  memcpy((void*)SCRNADR(SCORE_BASE,1,24), "SCORE:", 6);
  update_scoreboard();
}

void init_sprite_shapes() {
  sprite_set_shapes(SPRITE_DATA,
                    SPRITE_SHAPE,
                    NUM_SPRITE_PATTERNS);
}

void init_sprite_positions() {
  // setup sprite positions
  player_x = CENTER_X;
  player_y = FLOOR_Y;
  player_vel_y = 0;
  sprshad.spr_color[POWERUP_INDEX] = COLOR_YELLOW;
  sprshad.spr_color[OBSTACLE_INDEX] = COLOR_GRAY3;
}

void move_player(byte joy) {
  // move sprite based on joystick
  if (JOY_LEFT(joy)) {
    player_x -= 2;
    faceleft = 1;
  }
  if (JOY_RIGHT(joy)) {
    player_x += 1;
    faceleft = 0;
  }
  if (JOY_BTN_1(joy) && player_y == FLOOR_Y) {
    player_vel_y = JUMP_VELOCITY;
  }
  
  // apply velocity
  player_y += player_vel_y;
  // apply gravity
  player_vel_y += GRAVITY;
  // stop velocity when falling thru floor
  if (player_y >= FLOOR_Y) {
    player_y = FLOOR_Y;     // reset Y position
    player_vel_y = 0;       // reset velocity
  }
  
  // keep player from moving offscreen
  if (player_x < 36) player_x = 36;
  if (player_x > 300) player_x = 300;
  
  // draw player into sprite shadow buffer
  sprite_draw(PLAYER_INDEX,
              player_x,
              player_y >> 8, // fixed point conversion
              PLAYER_SHAPE + faceleft);
}

void move_items() {
  // move in sync with scrolling world
  // draw powerup
  sprite_draw(POWERUP_INDEX,
              ((scroll_x*2) & 0x1ff),
              POWERUP_Y,
              POWERUP_SHAPE);
  // draw obstacle
  sprite_draw(OBSTACLE_INDEX,
              ((scroll_x+256) & 0x1ff),
              OBSTACLE_Y,
              OBSTACLE_SHAPE);
}

byte get_char_for_row(byte row) {
  // ground?
  if (row >= GROUND_ROW) { return 253; }
  // obstacle?
  if (row >= GROUND_ROW-3) {
    // only show obstacle for certain values of scroll_x
    if ((scroll_x & 0b1110000) == 0) { return 247; }
  }
  // default is the sky (empty space)
  return 32;
}

void draw_right_column() {
  // get the top-right corner address of scroll area
  word addr = SCRNADR(GAME_BASE, 39, SCROLL_TOP);
  byte row;
  // draw one character per row
  for (row=0; row<SCROLL_ROWS; row++) {
    POKE(addr, get_char_for_row(row));
    addr += 40;
  }
}

void scroll_one_column_left() {
  // copy several rows of screen memory
  // backwards one byte
  const word start = SCRNADR(GAME_BASE, 0, SCROLL_TOP);
  const word nbytes = SCROLL_ROWS*40-1;
  memcpy((byte*)start, (byte*)start+1, nbytes);
  // draw the right column of characters
  draw_right_column();
}

void scroll_one_pixel_left() {
  // scroll left one pixel
  scroll_x -= 1;
  // set scroll register with lower three bits
  VIC.ctrl2 = (VIC.ctrl2 & ~7) | (scroll_x & 7);
  // move screen memory if the scroll register
  // has just gone past 0 and wrapped to 7
  if ((scroll_x & 7) == 7) {
    scroll_one_column_left();
  }
}

void detect_player_collision(byte bg_coll, byte spr_coll) {
  // did we hit a powerup? (#0 and #1)
  bool hit_powerup = (spr_coll & 0b011) == 0b011;
  // did player and obstacle sprite (#0 and #2) collide?
  bool hit_obstacle = (spr_coll & 0b101) == 0b101;
  // did player (#0) collide with background?
  hit_obstacle |= (bg_coll & 0b001) != 0;
  // did we hit anything bad?
  if (hit_obstacle) {
    // make player fall downward and backward
    player_vel_y = -JUMP_VELOCITY;
    player_x -= 1;
    sprshad.spr_color[PLAYER_INDEX] = COLOR_LIGHTRED;
    SID_PLAY_TONE(500);
    if (score != 0) { add_score(0x9999); } // BCD -1
  } else {
    sprshad.spr_color[PLAYER_INDEX] = COLOR_GREEN;
  }
  // did we hit powerup?
  if (hit_powerup) {
    sprshad.spr_color[POWERUP_INDEX] += 1; // cycle colors
    SID_PLAY_TONE(8000);
    add_score(1);
  }
}

void main() {  
  // clear screen, set background color
  clrscr();
  VIC.bgcolor[0] = COLOR_CYAN;
  VIC.bordercolor = COLOR_BLUE;
  
  // set vertical scroll = 3, 25 rows
  VIC.ctrl1 = 0b00011011;
  // set 38 column mode (for X scrolling)
  VIC.ctrl2 = 0b00000000;
  // set uniform color of characters
  memset(COLOR_RAM, COLOR_WHITE, 1000);

  // install the joystick driver
  joy_install (joy_static_stddrv);

  // setup sound
  SID_INIT(8,0);
  
  // set multicolor sprites and colors in shadow buffer
  sprite_clear(); // clear shadow buffer
  sprshad.spr_mcolor = 0b11111111; // all sprites multicolor
  sprshad.spr_exp_y = 1; // double height
  
  // set colors
  sprshad.spr_color[PLAYER_INDEX] = COLOR_GREEN;
  VIC.spr_mcolor0 = COLOR_GRAY2;
  VIC.spr_mcolor1 = COLOR_BLACK;
  
  // setup sprites
  init_sprite_shapes();
  init_sprite_positions();

  // setup scoreboard
  init_scoreboard();

  // setup rasterirq library for scoreboard split
  DLIST_SETUP(display_list);
  
  // game loop, repeat forever
  while (1) {
    // saved collision flags
    byte spr_coll, bg_coll;
    
    // wait for end of frame
    waitvsync();
    
    //--- START TIME CRITICAL SECTION
    // grab and reset collision flags 
    spr_coll = VIC.spr_coll;
    bg_coll = VIC.spr_bg_coll;
    
    // update sprite registers from sprite shadow buffer
    sprite_update(DEFAULT_SCREEN);
    
    // scroll screen
    scroll_one_pixel_left();
    //--- END TIME CRITICAL SECTION

    // use collision flags to see if player collided
    detect_player_collision(bg_coll, spr_coll);
    
    // get joystick bits and move player
    move_player(joy_read(0));
    
    // move obstacle and powerup sprites
    move_items();
  }
}
