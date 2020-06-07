
#include <stdlib.h>
#include <string.h>

#include <c64.h>
#include <joystick.h>

#include "bcd.h"
//#link "bcd.c"

#include "common.h"
//#link "common.c"

#include "scrolling.h"
//#link "scrolling.c"

#include "sprites.h"
//#link "sprites.c"

// indices of sound effects (0..3)
typedef enum { SND_START, SND_HIT, SND_COIN, SND_JUMP } SFXIndex;

///// DEFINES

#define MAX_FLOORS 20		// total # of floors in a stage
#define GAPSIZE 4		// gap size in tiles
#define BOTTOM_FLOOR_Y 2	// offset for bottommost floor

#define MAX_ACTORS 5		// max # of moving actors
#define SCREEN_Y_BOTTOM 208	// bottom of screen in pixels
#define ACTOR_MIN_X 16		// leftmost position of actor
#define ACTOR_MAX_X 228		// rightmost position of actor
#define ACTOR_SCROLL_UP_Y 110	// min Y position to scroll up
#define ACTOR_SCROLL_DOWN_Y 140	// max Y position to scroll down
#define JUMP_VELOCITY 18	// Y velocity when jumping

#define LADDER_XOFS -21
#define XOFS 34
#define BOTTOM_Y 242
#define START_ORIGIN_Y (0xff - ROWS)
#define GAP_OFS_X -16

// constants for various tiles
#define CH_BLANK 0x20
#define CH_WALL 0x7f
#define CH_FLOOR 0x66
#define CH_LADDER1 0x6b
#define CH_LADDER2 0x73
#define CH_ITEM 0x04

#define COLOR_LEVEL 0x01
#define COLOR_LADDER 0x03

///// CHARS

const byte ITEM_CHARS[3][4] = {
  { 0xe9,0xe9,0x5f,0x69 },
  { 0x55,0x49,0x4a,0x4b },
  { 0x7f,0x7f,0x7f,0x7f },
};

#define NUM_SPRITE_PATTERNS 13

/*{w:12,h:21,bpp:2,brev:1,count:13,aspect:2}*/
const char SPRITE_DATA[NUM_SPRITE_PATTERNS][3*21] = {
  // left direction
  {
  0x00,0x00,0x00,0x00,0xA8,0x00,0x02,0xEA,0x00,
  0x02,0xEA,0x00,0x02,0xEA,0x00,0x02,0xEA,0x00,
  0x00,0xA8,0x50,0x00,0x15,0x50,0x00,0xAA,0x50,
  0x00,0xAA,0x50,0x00,0xAA,0x50,0x0A,0xAA,0x50,
  0x02,0xAA,0x50,0x00,0xFF,0x00,0x00,0xAA,0x00,
  0x00,0xAA,0x00,0x00,0xA2,0x80,0x00,0xA2,0x80,
  0x00,0x22,0x80,0x01,0x51,0x40,0x01,0x51,0x40
  },
  {
  0x00,0x00,0x00,0x00,0xA8,0x00,0x02,0xAA,0x00,
  0x02,0xAA,0x00,0x22,0xAA,0x00,0x22,0xAA,0x00,
  0x20,0xA8,0x00,0x28,0x54,0x00,0x2A,0x56,0x80,
  0x0A,0x56,0xA0,0x02,0x56,0xA0,0x02,0x56,0x20,
  0x02,0x56,0x20,0x03,0xFF,0x20,0x02,0xAA,0x00,
  0x02,0x8A,0x00,0x02,0x8A,0x00,0x01,0x4A,0x00,
  0x05,0x4A,0x00,0x00,0x05,0x00,0x00,0x05,0x40
  },
  {
  0x00,0x00,0x00,0x00,0xA8,0x00,0x02,0xEA,0x00,
  0x02,0xEA,0x00,0x02,0xEA,0x00,0x02,0xEA,0x00,
  0x00,0xA8,0x50,0x00,0x15,0x50,0x00,0xAA,0x50,
  0x20,0xAA,0x50,0x2A,0xAA,0x50,0x0A,0xAA,0x50,
  0x00,0xAA,0x50,0x00,0xFF,0x00,0x00,0xAA,0x00,
  0x00,0xAA,0x00,0x0A,0xA2,0x80,0x0A,0xA2,0x94,
  0x0A,0x02,0x94,0x15,0x00,0x94,0x15,0x00,0x04
  },
  {
  0x00,0x00,0x00,0x00,0x2A,0x00,0x00,0xBF,0x80,
  0x00,0xAE,0x80,0x00,0xAE,0x80,0x00,0xAE,0x80,
  0x00,0x2A,0x00,0x00,0x15,0x02,0x20,0xAA,0xAA,
  0x2A,0xBF,0xA8,0x0A,0xAA,0xA0,0x02,0xBF,0x80,
  0x00,0xAA,0x80,0x00,0xFF,0xC0,0x00,0xAA,0x80,
  0x00,0xAA,0x80,0x02,0xA2,0xA0,0x02,0x80,0xA0,
  0x02,0x80,0xA0,0x01,0x40,0x50,0x05,0x40,0x54
  },
  {
  0x00,0x00,0x00,0x00,0xA8,0x00,0x02,0xEA,0x00,
  0x02,0xEA,0x00,0x02,0xEA,0x00,0x02,0xEA,0x00,
  0x00,0xA8,0x50,0x00,0x15,0x50,0x00,0xAA,0x50,
  0x08,0xAA,0x90,0x0A,0xAA,0xA0,0x02,0xAA,0x60,
  0x00,0xAA,0x50,0x00,0xFF,0x00,0x00,0xAA,0x00,
  0x00,0xA2,0x00,0x00,0xA8,0x80,0x00,0x2A,0x80,
  0x02,0x8A,0x90,0x01,0x40,0x50,0x05,0x41,0x40
  },
  // right direction
  {
  0x00,0x00,0x00,0x00,0x2A,0x00,0x00,0xAB,0x80,
  0x00,0xAB,0x80,0x00,0xAB,0x80,0x00,0xAB,0x80,
  0x05,0x2A,0x00,0x05,0x54,0x00,0x05,0xAA,0x00,
  0x05,0xAA,0x00,0x05,0xAA,0x00,0x05,0xAA,0xA0,
  0x05,0xAA,0x80,0x00,0xFF,0x00,0x00,0xAA,0x00,
  0x00,0xAA,0x00,0x02,0x8A,0x00,0x02,0x8A,0x00,
  0x02,0x88,0x00,0x01,0x45,0x40,0x01,0x45,0x40
  },
  {
  0x00,0x00,0x00,0x00,0xA8,0x00,0x02,0xAA,0x00,
  0x02,0xAA,0x00,0x02,0xAA,0x20,0x02,0xAA,0x20,
  0x00,0xA8,0x20,0x00,0x54,0xA0,0x0A,0x56,0xA0,
  0x2A,0x56,0x80,0x2A,0x56,0x00,0x22,0x56,0x00,
  0x22,0x56,0x00,0x23,0xFF,0x00,0x02,0xAA,0x00,
  0x02,0x8A,0x00,0x02,0x8A,0x00,0x02,0x85,0x00,
  0x02,0x85,0x40,0x01,0x40,0x00,0x05,0x40,0x00
  },
  {
  0x00,0x00,0x00,0x00,0x2A,0x00,0x00,0xAB,0x80,
  0x00,0xAB,0x80,0x00,0xAB,0x80,0x00,0xAB,0x80,
  0x05,0x2A,0x00,0x05,0x54,0x00,0x05,0xAA,0x00,
  0x05,0xAA,0x08,0x05,0xAA,0xA8,0x05,0xAA,0xA0,
  0x05,0xAA,0x00,0x00,0xFF,0x00,0x00,0xAA,0x00,
  0x00,0xAA,0x00,0x02,0x8A,0xA0,0x16,0x8A,0xA0,
  0x16,0x80,0xA0,0x16,0x00,0x54,0x10,0x00,0x54
  },
  {
  0x00,0x00,0x00,0x00,0x2A,0x00,0x00,0xBF,0x80,
  0x00,0xAE,0x80,0x00,0xAE,0x80,0x00,0xAE,0x80,
  0x00,0x2A,0x00,0x20,0x15,0x00,0x2A,0xAA,0x82,
  0x0A,0xBF,0xAA,0x02,0xAA,0xA8,0x00,0xBF,0xA0,
  0x00,0xAA,0x80,0x00,0xFF,0xC0,0x00,0xAA,0x80,
  0x00,0xAA,0x80,0x02,0xA2,0xA0,0x02,0x80,0xA0,
  0x02,0x80,0xA0,0x01,0x40,0x50,0x05,0x40,0x54
  },
  {
  0x00,0x00,0x00,0x00,0x2A,0x00,0x00,0xAB,0x80,
  0x00,0xAB,0x80,0x00,0xAB,0x80,0x00,0xAB,0x80,
  0x05,0x2A,0x00,0x05,0x54,0x00,0x05,0xAA,0x00,
  0x06,0xAA,0x20,0x0A,0xAA,0xA0,0x09,0xAA,0x80,
  0x05,0xAA,0x00,0x00,0xFF,0x00,0x00,0xAA,0x00,
  0x00,0x8A,0x00,0x02,0x2A,0x00,0x02,0xA8,0x00,
  0x06,0xA2,0x80,0x05,0x01,0x40,0x01,0x41,0x50
  },
  // explosion
  {
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x20,0x00,
  0x00,0x20,0x00,0x08,0x20,0x80,0x02,0x02,0x00,
  0x00,0x10,0x00,0x00,0x54,0x00,0x00,0x10,0x00,
  0x02,0x02,0x00,0x08,0x20,0x80,0x00,0x20,0x00,
  0x00,0x20,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00
  },
  {
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0xA8,0x00,0x02,0x02,0x00,
  0x08,0x00,0x80,0x20,0x00,0x20,0x20,0x54,0x20,
  0x21,0x01,0x20,0x21,0x01,0x20,0x21,0x01,0x20,
  0x20,0x54,0x20,0x20,0x00,0xA0,0x08,0x00,0x80,
  0x02,0x02,0x00,0x00,0xA8,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00
  },
  {
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0xA8,0x00,0x02,0x02,0x00,
  0x08,0x10,0x80,0x08,0x54,0x80,0x08,0x10,0x80,
  0x02,0x02,0x00,0x00,0xA8,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00
  },
};

///// GLOBALS

// random byte between (a ... b-1)
// use rand() because rand8() has a cycle of 255
byte rndint(byte a, byte b) {
  return (rand() % (b-a)) + a;
}

///// GAME LOGIC

// struct definition for a single floor
typedef struct Floor {
  byte ypos;		// # of tiles from ground
  int height:4;		// # of tiles to next floor
  int gap:4;		// X position of gap
  int ladder1:4;	// X position of first ladder
  int ladder2:4;	// X position of second ladder
  int objtype:4;	// item type (FloorItem)
  int objpos:4;		// X position of object
} Floor;

// various items the player can pick up
typedef enum FloorItem { ITEM_NONE, ITEM_MINE, ITEM_HEART, ITEM_POWER };

// array of floors
Floor floors[MAX_FLOORS];

// is this x (pixel) position within the gap <gap>?
bool is_in_gap(byte x, byte gap) {
  if (gap) {
    byte x1 = gap*16 + GAP_OFS_X;
    return (x > x1+2 && x < x1+GAPSIZE*8-14);
  } else {
    return false;
  }
}

// is this ladder at (tile) position x within the gap?
bool ladder_in_gap(byte x, byte gap) {
  return gap && x >= gap && x < gap+GAPSIZE*2;
}

// create floors at start of game
void make_floors() {
  byte i;
  byte y = BOTTOM_FLOOR_Y;
  Floor* prevlev = &floors[0];
  // create data for each floor
  for (i=0; i<MAX_FLOORS; i++) {
    Floor* lev = &floors[i];
    lev->height = rndint(4,8);
    do {
      // only have gaps in higher floors
      lev->gap = i>=3 ? rndint(0,COLS/2-5) : 0;
    } while (ladder_in_gap(prevlev->ladder1, lev->gap) || 
             ladder_in_gap(prevlev->ladder2, lev->gap));
    do {
      lev->ladder1 = rndint(2,COLS-6);
      lev->ladder2 = rndint(2,COLS-6);
    } while (ladder_in_gap(lev->ladder1, lev->gap) || 
             ladder_in_gap(lev->ladder2, lev->gap));
    if (i > 0) {
      lev->objtype = rndint(0,3);
      do {
        lev->objpos = rndint(5,COLS-7);
      } while (ladder_in_gap(lev->objpos, lev->gap));
    }
    lev->ypos = y;
    y += lev->height;
    prevlev = lev;
  }
  // top floor is special
  floors[MAX_FLOORS-1].height = 15;
  floors[MAX_FLOORS-1].gap = 0;
  floors[MAX_FLOORS-1].ladder1 = 0;
  floors[MAX_FLOORS-1].ladder2 = 0;
  floors[MAX_FLOORS-1].objtype = 0;
}

// creete actors on floor_index, if slot is empty
void create_actors_on_floor(byte floor_index);

// draw a nametable line into the frame buffer at <row_height>
// 0 == bottom of stage
void scroll_draw_row(byte row) {
  char *buf;	// nametable buffer
  char *attrs;	// attribute buffer 
  byte floor;		// floor counter
  byte dy;		// height in rows above floor
  byte row_height;	// rows above bottom of level
  // set screen/color buffer addresses
  buf = hidbuf + row*COLS;
  attrs = colorbuf + row*COLS;
  row_height = -(row + origin_y);
  // loop over all floors
  for (floor=0; floor<MAX_FLOORS; floor++) {
    Floor* lev = &floors[floor];
    // compute height in rows above floor
    dy = row_height - lev->ypos;
    // if below bottom floor (in basement)
    if (dy >= 255 - BOTTOM_FLOOR_Y) dy = 0;
    // does this floor intersect the desired row?
    if (dy < lev->height) {
      // set all colors to default
      memset(attrs, COLOR_LEVEL, COLS);
      // first two rows (floor)?
      if (dy == 0) {
        // draw floor
        memset(buf, CH_FLOOR, COLS);
        // is there a gap? if so, clear bytes
	if (lev->gap)
          memset(buf+lev->gap*2, CH_BLANK, GAPSIZE);
      } else {
        // clear buffer
        memset(buf, CH_BLANK, COLS);
        // draw walls
        if (floor < MAX_FLOORS-1) {
          buf[1] = CH_WALL;		// left side
          buf[COLS-2] = CH_WALL;	// right side
        }
        // draw ladders
        if (lev->ladder1) {
          byte i = lev->ladder1*2;
          buf[i] = CH_LADDER1;	// left
          buf[i+1] = CH_LADDER2; // right
          attrs[i] = COLOR_LADDER;
          attrs[i+1] = COLOR_LADDER;
        }
        if (lev->ladder2) {
          byte i = lev->ladder2*2;
          buf[i] = CH_LADDER1;	// left
          buf[i+1] = CH_LADDER2; // right
          attrs[i] = COLOR_LADDER;
          attrs[i+1] = COLOR_LADDER;
        }
      }
      // draw object, if it exists
      if (lev->objtype && (dy == 1 || dy == 2)) {
        const byte* ichars = ITEM_CHARS[lev->objtype - 1];
        byte i = lev->objpos*2;
        if (dy == 1) {
          buf[i+0] = ichars[2];	// bottom-left
          buf[i+1] = ichars[3];	// bottom-right
        } else {
          buf[i+0] = ichars[0];	// top-left
          buf[i+1] = ichars[1];	// top-right
        }
        attrs[i+0] = 0x7;
        attrs[i+1] = 0x7;
      }
      break;
    }
  }
  // create actors on this floor, if needed
  if (dy == 0 && (floor >= 2)) {
    create_actors_on_floor(floor);
  }
}

// not used, since we don't scroll left/right
void scroll_draw_column(byte col) {
  col=col;
}

// draw entire stage at current scroll position
// filling up entire name table
void draw_entire_stage() {
  byte y;
  for (y=0; y<ROWS; y++) {
    scroll_draw_row(y);
  }
  swap_needed = true;
}

// y = (256 - origin_y) - floor
void refresh_floor(byte floor) {
  byte row = floors[floor].ypos;  // get floor bottom coordinate
  row = -origin_y - row;
  scroll_draw_row(row-1);         // redraw 2rd line
  scroll_draw_row(row-2);         // redraw 3th line
  swap_needed = true;
}

// EXPLOSION

byte explode_timer = 0;

#define SPRITE_XPLODE 7
#define SHAPE_XPLODE0 (32+10)
#define NUM_XPLODE_SHAPES 3

void explode(int x, byte y) {
  sprite_draw(SPRITE_XPLODE, x, y, SHAPE_XPLODE0+NUM_XPLODE_SHAPES-1);
  sprshad.spr_color[SPRITE_XPLODE] = 10;
  explode_timer = NUM_XPLODE_SHAPES;
}

void animate_explosion(void) {
  if (explode_timer) {
    if (--explode_timer == 0) {
      sprshad.spr_ena &= ~(1 << SPRITE_XPLODE);
    } else {
      sprshad.spr_ena |= (1 << SPRITE_XPLODE);
      sprshad.spr_shapes[SPRITE_XPLODE] = SHAPE_XPLODE0-1+explode_timer;
    }
  }
}

// ACTORS

word get_floor_yy(byte level) {
  return floors[level].ypos * 8 + 8;
}

word get_ceiling_yy(byte level) {
  return (floors[level].ypos + floors[level].height) * 8 + 8;
}

typedef enum ActorState {
  INACTIVE, WALKING, CLIMBING, JUMPING, FALLING
};

typedef struct Actor {
  word yy;
  byte x;
  byte level;
  sbyte yvel;
  sbyte xvel;
  unsigned int color1:4;
  unsigned int color2:4;
  unsigned int state:4;
  unsigned int dir:1;
  unsigned int onscreen:1;
} Actor;

Actor actors[MAX_ACTORS];

void create_actors_on_floor(byte level_index) {
  byte actor_index = (level_index % (MAX_ACTORS-1)) + 1;
  struct Actor* a = &actors[actor_index];
  if (!a->onscreen) {
    Floor *level = &floors[level_index];
    a->state = WALKING;
    a->color1 = level->ladder1 ^ level->ladder2;
    a->color2 = level->ladder2;
    a->x = level->ladder1 ^ (level->ladder2<<3) ^ (level->gap<<6);
    a->yy = get_floor_yy(level_index);
    a->level = level_index;
  }
}

static word yscroll;

void draw_actor(byte i) {
  byte name;
  struct Actor* a = &actors[i];
  word screen_y = yscroll - a->yy;
  if (screen_y > 240) {
    a->onscreen = 0;
    return; // offscreen vertically
  }
  name = 32 + (a->state - WALKING);
  switch (a->state) {
    case INACTIVE:
      a->onscreen = 0;
      return; // inactive, offscreen
    case WALKING:
      name += (a->x & 4);
    case JUMPING:
      if (!a->dir) name += 5;
      break;
    case FALLING:
    case CLIMBING:
      if (a->yy & 4) name += 5;
      break;
  }
  sprite_draw(i, a->x + XOFS, screen_y, name);
  sprshad.spr_color[i] = a->color1;
  a->onscreen = 1;
}

void refresh_actors() {
  byte i;
  yscroll = BOTTOM_Y + scroll_fine_y + (START_ORIGIN_Y - origin_y)*8;
  sprite_clear();
  for (i=0; i<MAX_ACTORS; i++)
    draw_actor(i);
  animate_explosion();
}

void refresh_screen() {
  draw_entire_stage();
  refresh_actors();
}

byte is_ladder_close(byte actor_x, byte ladder_pos) {
  byte ladder_x;
  if (ladder_pos == 0)
    return 0;
  ladder_x = ladder_pos * 16 + LADDER_XOFS;
  return ((byte)(actor_x - ladder_x) < 16) ? ladder_x : 0;
}

byte get_closest_ladder(byte player_x, byte level_index) {
  Floor* level = &floors[level_index];
  byte x;
  if (level_index >= MAX_FLOORS) return 0;
  x = is_ladder_close(player_x, level->ladder1);
  if (x) return x;
  x = is_ladder_close(player_x, level->ladder2);
  if (x) return x;
  return 0;
}

byte mount_ladder(Actor* player, signed char level_adjust) {
  byte x = get_closest_ladder(player->x, player->level + level_adjust);
  if (x) {
    player->x = x + 8;
    player->state = CLIMBING;
    player->level += level_adjust;
    return 1;
  } else
    return 0;
}

void check_scroll_up() {
  if (sprshad.spr_pos[0].y < BOTTOM_Y/2+16) {
    scroll_vert(1);
  }
}

void check_scroll_down() {
  if (sprshad.spr_pos[0].y > BOTTOM_Y/2+32
      && (origin_y < START_ORIGIN_Y || scroll_fine_y)) {
    scroll_vert(-1);
  }
}

void fall_down(struct Actor* actor) {
  actor->level--;
  actor->state = FALLING;
  actor->xvel = 0;
  actor->yvel = 0;
}

void move_actor(struct Actor* actor, byte joystick, bool scroll) {
  switch (actor->state) {
      
    case WALKING:
      // left/right has priority over climbing
      if (joystick & JOY_BTN_1_MASK) {
        actor->state = JUMPING;
        actor->xvel = 0;
        actor->yvel = 15;
        if (joystick & JOY_LEFT_MASK) actor->xvel = -1;
        if (joystick & JOY_RIGHT_MASK) actor->xvel = 1;
      } else if (joystick & JOY_LEFT_MASK) {
        actor->x--;
        actor->dir = 1;
      } else if (joystick & JOY_RIGHT_MASK) {
        actor->x++;
        actor->dir = 0;
      } else if (joystick & JOY_UP_MASK) {
        mount_ladder(actor, 0); // state -> CLIMBING
      } else if (joystick & JOY_DOWN_MASK) {
        mount_ladder(actor, -1); // state -> CLIMBING, level -= 1
      } else {
        //actor->state = STANDING;
      }
      if (scroll) {
        check_scroll_up();
        check_scroll_down();
      }
      break;
      
    case CLIMBING:
      if (joystick & JOY_UP_MASK) {
      	if (actor->yy >= get_ceiling_yy(actor->level)) {
          actor->level++;
          actor->state = WALKING;
        } else {
          actor->yy++;
        }
        if (scroll) check_scroll_up();
      } else if (joystick & JOY_DOWN_MASK) {
        if (actor->yy <= get_floor_yy(actor->level)) {
          actor->state = WALKING;
        } else {
          actor->yy--;
        }
      }
      if (scroll) {
        check_scroll_up();
        check_scroll_down();
      }
      break;
      
    case FALLING:
      if (scroll) {
        check_scroll_up();
        check_scroll_down();
      }
    case JUMPING:
      actor->x += actor->xvel;
      actor->yy += actor->yvel/4;
      actor->yvel -= 1;
      if (actor->yy <= get_floor_yy(actor->level)) {
	actor->yy = get_floor_yy(actor->level);
        actor->state = WALKING;
        if (scroll) check_scroll_down();
      }
      break;
  }
  // don't allow player to travel past left/right edges of screen
  if (actor->x == 0) actor->x = 255; // we wrapped around right edge
  if (actor->x == 1) actor->x = 2; // left edge
  // if player lands in a gap, they fall (switch to JUMPING state)
  if (actor->state == WALKING && 
      is_in_gap(actor->x, floors[actor->level].gap)) {
    fall_down(actor);
  }
}

// should we pickup an object? only player does this
void pickup_object(Actor* actor) {
  Floor* floor = &floors[actor->level];
  byte objtype = floor->objtype;
  // only pick up if there's an object, and if we're walking or standing
  if (objtype && actor->state <= WALKING) {
    byte objx = floor->objpos * 16 + 16 - XOFS;
    // is the actor close to the object?
    if (actor->x >= objx && actor->x < objx+16) {
      // clear the item from the floor and redraw
      floor->objtype = 0;
      refresh_floor(actor->level);
      // show explosion
      explode(objx + XOFS, yscroll - actor->yy);
      // did we hit a mine?
      if (objtype == ITEM_MINE) {
        // we hit a mine, fall down
        fall_down(actor);
        //sfx_play(SND_HIT,0);
      } else {
        // we picked up an object, add to score
        //score = bcd_add(score, 1);
        //sfx_play(SND_COIN,0);
      }
    }
  }
}

void move_player() {
  char joy = joy_read(0);
  move_actor(&actors[0], joy, true);
  pickup_object(&actors[0]);
}

byte iabs(int x) {
  return x >= 0 ? x : -x;
}

bool check_collision(Actor* a) {
  byte i;
  for (i=1; i<MAX_ACTORS; i++) {
    Actor* b = &actors[i];
    // actors must be on same level
    // no need to apply XOFS because both sprites are offset
    if (a->level == b->level && 
        b->onscreen &&
        iabs(a->yy - b->yy) < 16 && 
        iabs(a->x - b->x) < 16) {
      return true;
    }
  }
  return false;
}

///

void draw_blimp(struct cvu_sprite* sprite) {
  /*
  sprite->name = 48;
  wait_vblank();
  cvu_set_sprite(SPRITES, 28, sprite);
  sprite->name += 4;
  sprite->x += 16;
  cvu_set_sprite(SPRITES, 29, sprite);
  sprite->name += 4;
  sprite->x += 16;
  cvu_set_sprite(SPRITES, 30, sprite);
  sprite->name += 4;
  sprite->x += 16;
  cvu_set_sprite(SPRITES, 31, sprite);
  refresh_actors();
  */
  sprite=sprite;
}

void blimp_pickup_scene() {
  /*
  struct cvu_sprite sprite;
  byte player_screen_y = cvu_vinb(SPRITES + 0); // sprite Y pos
  sprite.x = actors[0].x-14;
  sprite.y = 240;
  sprite.tag = 0x8f;
  while (sprite.y != player_screen_y-16) {
    draw_blimp(&sprite);
    sprite.x -= 48;
    sprite.y++;
  }
  while (sprite.y != 240) {
    draw_blimp(&sprite);
    sprite.x -= 48;
    sprite.y--;
    actors[0].yy++;
  }
  */
}

void play_scene() {
  byte i;
  
  memset(actors, 0, sizeof(actors));
  actors[0].state = WALKING;
  actors[0].color1 = 0x1;
  actors[0].color2 = 0xb;
  actors[0].x = 64;
  actors[0].yy = get_floor_yy(0);
  actors[0].level = 0;
  
  create_actors_on_floor(2);
  refresh_screen();
  
  while (actors[0].level != MAX_FLOORS-1) {
    refresh_actors();
    move_player();
    // move all the actors
    for (i=1; i<MAX_ACTORS; i++) {
      move_actor(&actors[i], rand(), false);
    }
    // see if the player hit another actor
    if (VIC.spr_coll & 0x01) {
      if (actors[0].level > 0 && check_collision(&actors[0])) {
        fall_down(&actors[0]);
      }
    }
    if (swap_needed) sprite_update(hidbuf);
    wait_vblank();
    scroll_update();
    sprite_update(visbuf);
  }
  
  blimp_pickup_scene();
}

// main program
void main() {
  byte i;
  
  // set up scrolling
  scroll_setup();
  // set up sprites
  sprite_clear();
  for (i=0; i<NUM_SPRITE_PATTERNS; i++) {
    sprite_shape(hidbuf, 32+i, SPRITE_DATA[i]);
  }
  sprshad.spr_mcolor = 0xff;
  sprshad.spr_mcolor0 = 0x0f;
  sprshad.spr_mcolor1 = 0x00;
  // select character set 2
  VIC.addr = 0x15;
  // start scrolling @ bottom of level
  origin_y = START_ORIGIN_Y;
  // install joystick
  joy_install (joy_static_stddrv);
  // main game loop
  while (1) {
    make_floors();
    draw_entire_stage();
    play_scene();
  }
}
