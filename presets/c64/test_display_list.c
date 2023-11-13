
#include "common.h"
//#link "common.c"

#include "rasterirq.h"
//#link "rasterirq.ca65"

#include "bcd.h"
//#link "bcd.c"

///// DEFINES

#define GAME_BASE 0x400		// scrolling screen ram
#define SCORE_BASE 0x2c00	// scoreboard screen ram

#define SCROLL_TOP 8		// scroll top row
#define SCROLL_ROWS 14		// scroll # of rows
#define GROUND_ROW 7		// ground row (+ top row)

///// VARIABLES

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
  DLIST_NEXT(250-16);

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
}

// clear scoreboard and draw initial strings
void init_scoreboard() {
  memset((void*)SCORE_BASE, ' ', 1024);
  memcpy((void*)SCRNADR(SCORE_BASE,1,24), "SCORE:", 6);
  update_scoreboard();
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

  // setup scoreboard
  init_scoreboard();

  // setup rasterirq library for scoreboard split
  DLIST_SETUP(display_list);
  
  // game loop, repeat forever
  while (1) {    
    // wait for end of frame
    waitvsync();
    
    // scroll screen
    scroll_one_pixel_left();
    
    // add to score
    add_score(0x0001);
    update_scoreboard();
  }
}
