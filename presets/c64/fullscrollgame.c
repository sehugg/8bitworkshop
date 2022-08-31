
#include <stdio.h>
#include <conio.h>
#include <c64.h>
#include <cbm_petscii_charmap.h>
#include <string.h>
#include <stdlib.h>
#include <stdint.h>
#include <joystick.h>

//#resource "c64-sid.cfg"
#define CFGFILE c64-sid.cfg

#include "common.h"
//#link "common.c"

#include "scrolling.h"
//#link "scrolling2.c"

#include "sprites.h"
//#link "sprites.c"

//#link "level2.ca65"

#define CAMERA_OFFSET_X 158
#define CAMERA_OFFSET_Y 120
#define CAMERA_MAX_DX 12
#define CAMERA_MAX_DY 8

#define MAX_ACTORS 8
#define ACTOR_OFFSET_X 28
#define ACTOR_OFFSET_Y 30
#define ACTOR_WIDTH 24
#define ACTOR_HEIGHT 21

#define JUMP_VELOCITY -36
#define MAX_FALL_VELOCITY 64
#define MAX_HORIZ_VELOCITY 16

#define MAP_COLS 16
#define MAP_ROWS 16

#define DEFAULT_CHAR chartileset_data[16]
#define DEFAULT_COLOR chartileset_colour_data[1]

#define FLAG_SOLID 1
#define FLAG_PLATFORM 2
#define FLAG_LADDER 4


// level map data
extern const byte charset_data[];
extern const byte charset_attrib_data[];
extern const byte chartileset_data[];
extern const byte chartileset_colour_data[];
extern const byte chartileset_tag_data[];
extern const byte map_data[];


static byte framecount;
static byte framemask;

const byte BITMASKS[8] = { 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80 };

static byte tileflagmap[MAP_ROWS*MAP_COLS];
static byte tileindex;
static byte tilechar;

static bool get_cell_at(byte world_x, byte world_y) {
  sbyte col = world_x >> 2;
  sbyte row = world_y >> 2;
  byte xofs = world_x & 3;
  byte yofs = world_y & 3;
  if (col < 0 || col >= MAP_COLS || row < 0 || row >= MAP_ROWS) {
    return false;
  } else {
    tileindex = map_data[col + row * MAP_ROWS];
    tilechar = chartileset_data[xofs + (yofs + tileindex*4)*4];
    return true;
  }
}

byte compute_tile_flags() {
    switch (tileindex) {
      case 3: return FLAG_PLATFORM;
      case 4: return FLAG_PLATFORM;
      case 5: return FLAG_SOLID;
      case 6: return FLAG_LADDER;
      case 7: return FLAG_PLATFORM | FLAG_LADDER;
      case 8: return FLAG_SOLID;
      default: return 0;
    }
}

byte get_tile_flags(word world_x, word world_y) {
  byte tilex = world_x >> 5;
  byte tiley = world_y >> 5;
  if (tilex < MAP_COLS && tiley < MAP_ROWS)
    return tileflagmap[tilex + tiley*MAP_COLS];
  else
    return 0;
}

static void build_tile_flag_map(void) {
  byte x,y;
  byte i=0;
  for (y=0; y<MAP_ROWS; y++) {
    for (x=0; x<MAP_COLS; x++) {
      if (get_cell_at(x*4, y*4))
        tileflagmap[i++] = compute_tile_flags();
    }
  }
}

static void draw_cell(word ofs, byte scrn_x, byte scrn_y) {
  byte ch, color;
  if (get_cell_at(scrn_x + origin_x, scrn_y + origin_y)) {
    ch = tilechar;
    color = chartileset_colour_data[tileindex];
  } else {
    ch = DEFAULT_CHAR;
    color = DEFAULT_COLOR;
  }
  hidbuf[ofs] = ch;
  colorbuf[ofs] = color;
}

void scroll_draw_column(byte col) {
  byte y;
  word ofs = col;
  for (y=0; y<ROWS; y++) {
    draw_cell(ofs, col, y);
    ofs += COLS;
  }
}

void scroll_draw_row(byte row) {
  byte x;
  word ofs = row * COLS;
  for (x=0; x<COLS; x++) {
    draw_cell(ofs, x, row);
    ++ofs;
  }
}

#define NUM_SPRITE_PATTERNS 13
/*{w:12,h:21,bpp:2,brev:1,count:13,aspect:2}*/
const char SPRITE_DATA[NUM_SPRITE_PATTERNS][64] = {
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

typedef enum {
  STANDING, JUMPING, CLIMBING
} ActorState;

typedef struct Actor {
  word xx;
  word yy;
  sbyte xvel;
  sbyte yvel;
  ActorState state;
  bool faceleft;
} Actor;

Actor actors[MAX_ACTORS];

Actor* const player = &actors[0];

void draw_actor(register Actor* actor, byte index) {
  byte shape = 240;
  word xpos = actor->xx + pixofs_x + fine_correct_x + ACTOR_OFFSET_X;
  word ypos = actor->yy + pixofs_y + fine_correct_y + ACTOR_OFFSET_Y;
  if (xpos > 320 || ypos > 250) {
    ypos = 255;
  }
  switch (actor->state) {
    case STANDING:
      if (actor->xvel && actor->xx & 4) shape += 4;
      if (!actor->faceleft) shape += 5;
      break;
    case JUMPING:
      shape += 2;
      if (!actor->faceleft) shape += 5;
      break;
    case CLIMBING:
      shape += 1;
      if (actor->yy & 2) shape += 5;
      break;
  }
  sprite_draw(index, xpos, ypos, shape);
}

const char velocity_bitmasks[8] = {
  0b00000000, // 0/8
  0b00001000, // 1/8
  0b00100010, // 2/8
  0b10010010, // 3/8
  0b01010101, // 4/8
  0b01110101, // 5/8
  0b11101110, // 6/8
  0b11110111, // 7/8
//  0b11111111, // 8/8
};

static byte box[4]; // hit box

/*
void actor_set_position(register Actor* actor,
                       word world_x,
                       word world_y,
                       ActorState state) {
  actor->xx = world_x;
  actor->yy = world_y;
  actor->state = state;
  actor->tileindex = (world_x>>5) | (world_y>>5)*MAP_COLS;
}
*/

void move_actor(register Actor* actor,
                sbyte cmd_dx,
                sbyte cmd_dy) {
  word xx,yy;
  byte flags;
  sbyte dx = cmd_dx;
  sbyte dy = cmd_dy;
  bool state = actor->state;
  
  xx = actor->xx + dx;
  yy = actor->yy + dy;
  // if we are standing, move hit box 1 pixel below our feet
  if (state == STANDING) {
    yy += 1 - dy; // cancel out any climbing vertical offset (dy)
    dy = 0;
  }
  // get hit box flags on all 4 corners
  {
    box[0] = get_tile_flags(xx, yy-ACTOR_HEIGHT);
    box[1] = get_tile_flags(xx+ACTOR_WIDTH, yy-ACTOR_HEIGHT);
    box[2] = get_tile_flags(xx, yy);
    box[3] = get_tile_flags(xx+ACTOR_WIDTH, yy);
    // cancel x velocity if either top corners is solid
    if (dx < 0 && ((box[0] | box[2]) & FLAG_SOLID)) {
      if (state != STANDING || box[0] & FLAG_SOLID) {
        actor->xvel = 0;
        dx = 0;
      }
    }
    else if (dx > 0 && ((box[1] | box[3]) & FLAG_SOLID)) {
      if (state != STANDING || box[1] & FLAG_SOLID) {
        actor->xvel = 0;
        dx = 0;
      }
    }
    // cancel upward velocity if both top corners are solid
    if (dy < 0 && ((box[0] | box[1]) & FLAG_SOLID)) {
      actor->yvel = 0;
      dy = 0;
    }
    switch (state) {
      case JUMPING:
        // are we moving downward?
        if (dy > 0) {
          // hit a solid brick?
          flags = box[2] | box[3];
          if (flags & FLAG_SOLID) {
            // don't land if we are bumping against a wall
            // but land if entire bottom border is solid
            if (box[2] & box[3] & FLAG_SOLID) flags = FLAG_PLATFORM;
            else if (box[0] & box[2] & FLAG_SOLID) { }
            else if (box[1] & box[3] & FLAG_SOLID) { }
            else flags = FLAG_PLATFORM;
          }
          // land on platform, but only if we 
          // transit past the lower boundary of a cell
          if (flags & FLAG_PLATFORM) {
            // maximum speed is 8 pixels/frame
            if ((yy & 31) <= 8) {
              if ((actor->yy & 31) >= 24) {
                actor->yy |= 31;
                actor->yvel = 0;
                dy = 0;
                actor->state = STANDING;
              }
            }
          }
        }
        break;
      case STANDING:
        // if either bottom corner is empty, fall down
        if ((box[2] | box[3]) == 0) {
          actor->state = JUMPING;
        }
        // climbing a ladder?
        else if (cmd_dy) {
          // look at top corners if going up, bottom corners if down
          flags = cmd_dy < 0 ? box[0] & box[1] : box[2] & box[3];
          if (flags & FLAG_LADDER) {
            actor->state = CLIMBING;
          } else {
            dy = 0;
          }
        }
        break;
      case CLIMBING:
        // any flags set on bottom corners?
        flags = box[2] & box[3];
        if (!(flags & FLAG_LADDER)) {
          // top of ladder, stand up
          if (dy < 0) {
            actor->state = STANDING;
          } else {
            // bottom of ladder, don't go thru floor
            actor->state = JUMPING;
            dy = 0;
          }
        }
        break;
    }
  }
  // update position and tile coordinate
  // unless we zeroed out the velocity
  if (dx) actor->xx += dx;
  if (dy) actor->yy += dy;
}

void control_actor(register Actor* actor, byte joy) {
  sbyte dx = 0;
  sbyte dy = 0;
  sbyte speed = 1;
  ActorState state = actor->state;
  // jump button
  if (JOY_BTN_1(joy) && state == STANDING) {
    actor->yvel = JUMP_VELOCITY;
    actor->state = state = JUMPING;
    framecount = 0; // TODO?
  }
  // update position based on x/y velocity
  if (actor->xvel) {
    dx += actor->xvel >> 3;
    if (framemask & velocity_bitmasks[actor->xvel & 7]) {
      dx++;
    }
  }
  if (actor->yvel) {
    dy += actor->yvel >> 3;
    if (framemask & velocity_bitmasks[actor->yvel & 7]) {
      dy++;
    }
  }
  // apply gravity when jumping or falling
  if (state == JUMPING &&
      actor->yvel < MAX_FALL_VELOCITY) {
    actor->yvel += 2;
  }
  // arrow keys give left/right velocity
  if (JOY_LEFT(joy)) {
    actor->faceleft = true;
    if (actor->xvel > -MAX_HORIZ_VELOCITY)
        actor->xvel -= speed;
  } else if (JOY_RIGHT(joy)) {
    actor->faceleft = false;
    if (actor->xvel < MAX_HORIZ_VELOCITY)
      actor->xvel += speed;
  } else {
    // slow down actor to a stop, horizontally
    if (actor->xvel) actor->xvel /= 2;
  }
  // climb ladder?
  if (state == STANDING || state == CLIMBING) {
    if (JOY_UP(joy)) { dy = -1; }
    if (JOY_DOWN(joy)) { dy = 1; }
  }
  // move sprite
  if (dx | dy) {
    move_actor(actor, dx, dy);
  }
}

void camera_follow(register Actor* actor) {
  int dx, dy;
  byte moving = actor->xvel || actor->yvel;
  // compute distance between player and camera
  dx = CAMERA_OFFSET_X - pixofs_x - actor->xx;
  dy = CAMERA_OFFSET_Y - pixofs_y - actor->yy;
  // if we are moving, scroll only when distance
  // from center is greater
  if (moving) {
    if (dx < -CAMERA_MAX_DX) dx += CAMERA_MAX_DX;
    else if (dx > CAMERA_MAX_DX) dx -= CAMERA_MAX_DX;
    else dx = 0;
    if (dy < -CAMERA_MAX_DY) dy += CAMERA_MAX_DY;
    else if (dy > CAMERA_MAX_DY) dy -= CAMERA_MAX_DY;
    else dy = 0;
  }
  // divide dx and dy by 16
  dx >>= 4;
  dy >>= 4;
  // do we need to scroll?
  if (dx || dy) {
    // what direction?
    byte dir = 0;
    if (dx < 0) dir |= SCROLL_LEFT;
    if (dx > 0) dir |= SCROLL_RIGHT;
    if (dy < 0) dir |= SCROLL_UP;
    if (dy > 0) dir |= SCROLL_DOWN;
    // start the scroll (ignored if one is already going)
    scroll_start(dir);
    // fast 8-pixel scroll if screen is moving too fast
    if (moving && (abs(dx) >= 4 || abs(dy) >= 4)) {
      scroll_finish();
    }
  }
}

void control_enemy(struct Actor* enemy) {
  byte control = 0;
  int pdx = player->xx - enemy->xx;
  int pdy = player->yy - enemy->yy;
  if (pdy > 0) {
    control |= JOY_DOWN_MASK;
  } else if (pdy < 0) {
    control |= JOY_UP_MASK;
  }
  if (pdx < -32) {
    control |= JOY_LEFT_MASK;
  } else if (pdx > 32) {
     control |= JOY_RIGHT_MASK;
  }
  control_actor(enemy, control);
}

void next_frame() {
  char joy;
  // increment frame counter
  framemask = BITMASKS[++framecount & 7];
  // get joystick bits
  joy = joy_read(0);
  // move player
  control_actor(player, joy);
  // move enemy
  control_enemy(&actors[1]);
  // move the camera if needed
  camera_follow(player);
  // animate sprites in shadow sprite ram
  draw_actor(&actors[0], 0);
  draw_actor(&actors[1], 1);
  // wait for vblank
  wait_vblank();
  // then update sprite registers
  sprite_update(visbuf);
  // do scrolling stuff each frame
  scroll_update();
}

void setup_sprites(void) {
  sprite_clear();
  sprite_set_shapes(SPRITE_DATA, 240, NUM_SPRITE_PATTERNS);
  sprshad.spr_color[0] = COLOR_WHITE;
  sprshad.spr_color[1] = COLOR_LIGHTRED;
  sprshad.spr_mcolor = 0xff;
  VIC.spr_mcolor0 = 12;
  VIC.spr_mcolor1 = 14;
}

void setup_charset() {
  // multicolor character mode
  VIC.ctrl2 |= 0x10;
  VIC.bgcolor0 = 6;
  VIC.bgcolor1 = 0;
  VIC.bgcolor2 = 1;
  
  // select character set @ 0x8800
  VIC.addr = 0x12;
  memcpy((char*)0x8800, charset_data, 0x800);
}

void main(void) {
  
  clrscr();
  
  // setup scrolling library
  scroll_setup();
  
  // setup the character set for the level
  setup_charset();

  // copy sprites to VIC bank
  setup_sprites();

  // build cache for actor-level collisions
  build_tile_flag_map();
  
  // install the joystick driver
  joy_install (joy_static_stddrv);

  // repaint screen memory w/ the map
  scroll_refresh();
  
  player->xx = 3*32+8;
  player->yy = 2*32+8-16;
  
  player->xx = 0;
  player->yy = 31;
  player->state = STANDING;
  /*
  player->xx = 32;
  player->yy = 0;
  player->xx = 33;
  player->yy = 100;
  player->state = JUMPING;
  */
//  actor_set_position(player, 63, 63, STANDING);
  actors[1].xx = 128;

  // infinite loop
  while (1) {
    next_frame();
  }
}
