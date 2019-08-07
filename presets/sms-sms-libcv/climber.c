
#include <stdlib.h>
#include <string.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"
//#link "common.c"

//#link "chr_generic.c"
extern const unsigned char CHR_GENERIC[8192];

// constants for various tiles
#define CH_BORDER 	0x8f
#define CH_FLOOR	0xf4
#define CH_LADDER	0xd4
#define CH_ITEM		0xc4
#define CH_PLAYER	0xd8
#define CH_BLANK	0x20
#define CH_BASEMENT	0x30

///// DEFINES

#define ROW_OFFSET 0
#define UPDATE_ROW_DELTA -1
#define MESSAGE_ROW_DELTA 10

#define MAX_FLOORS 20		// total # of floors in a stage
#define GAPSIZE 4		// gap size in tiles
#define BOTTOM_FLOOR_Y 2	// offset for bottommost floor

#define MAX_ACTORS 5		// max # of moving actors
#define SCREEN_Y_BOTTOM 176	// bottom of screen in pixels
#define ACTOR_MIN_X 16		// leftmost position of actor
#define ACTOR_MAX_X 228		// rightmost position of actor
#define ACTOR_SCROLL_UP_Y 100	// min Y position to scroll up
#define ACTOR_SCROLL_DOWN_Y 120	// max Y position to scroll down
#define JUMP_VELOCITY 18	// Y velocity when jumping

// indices of sound effects (0..3)
typedef enum { SND_START, SND_HIT, SND_COIN, SND_JUMP } SFXIndex;

///// GLOBALS

// vertical scroll amount in pixels
static int scroll_pixel_yy = 0;

// vertical scroll amount in tiles (scroll_pixel_yy / 8)
static byte scroll_tile_y = 0;

// last screen Y position of player sprite
static byte player_screen_y = 0;

// score (BCD)
static byte score = 0;

// screen flash animation (virtual bright)
static byte vbright = 4;

// random byte between (a ... b-1)
// use rand() because rand8() has a cycle of 255
byte rndint(byte a, byte b) {
  return (rand() % (b-a)) + a;
}
//TODO
void sfx_play(byte index, byte channel) {
  index; channel;
}
void music_play(byte index) {
  index;
}
void music_stop() {
}

/*{pal:222,n:16}*/
const char PALETTE0[16] = {
  0x30, 0x38, 0x3E, 0x3F,
  0x30, 0x38, 0x3E, 0x3F,
  0x30, 0x38, 0x3E, 0x3F,
  0x30, 0x38, 0x3E, 0x3F,
};

/*{pal:222,n:16}*/
const char PALETTE1[16] = {
  0x30, 0x00, 0x3F, 0x03,
  0x30, 0x38, 0x3E, 0x3F,
  0x30, 0x38, 0x3E, 0x3F,
  0x30, 0x38, 0x3E, 0x3F,
};

/// METASPRITES

// define a 2x2 metasprite
#define DEF_METASPRITE_2x2(name,code,pal)\
const unsigned char name[]={\
        0,      0,      (code)+0,   pal, \
        8,      0,      (code)+2,   pal, \
        128}

// define a 2x2 metasprite, flipped horizontally
#define DEF_METASPRITE_2x2_FLIP(name,code,pal)\
const unsigned char name[]={\
        8,      0,      (code)+0,   (pal)|0, \
        0,      0,      (code)+2,   (pal)|0, \
        128}

// right-facing
DEF_METASPRITE_2x2(playerRStand, 0xd8, 0);
DEF_METASPRITE_2x2(playerRRun1, 0xdc, 0);
DEF_METASPRITE_2x2(playerRRun2, 0xe0, 0);
DEF_METASPRITE_2x2(playerRRun3, 0xe4, 0);
DEF_METASPRITE_2x2(playerRJump, 0xe8, 0);
DEF_METASPRITE_2x2(playerRClimb, 0xec, 0);
DEF_METASPRITE_2x2(playerRSad, 0xf0, 0);

// left-facing
DEF_METASPRITE_2x2_FLIP(playerLStand, 0xd8-0x50, 0);
DEF_METASPRITE_2x2_FLIP(playerLRun1, 0xdc-0x50, 0);
DEF_METASPRITE_2x2_FLIP(playerLRun2, 0xe0-0x50, 0);
DEF_METASPRITE_2x2_FLIP(playerLRun3, 0xe4-0x50, 0);
DEF_METASPRITE_2x2_FLIP(playerLJump, 0xe8-0x50, 0);
DEF_METASPRITE_2x2_FLIP(playerLClimb, 0xec-0x50, 0);
DEF_METASPRITE_2x2_FLIP(playerLSad, 0xf0-0x50, 0);

// rescuee at top of building
const unsigned char personToSave[]={
        0,      -8,      (0xba)+0,   3, 
        0,      1,      (0xba)+2,   0, 
        8,      -8,      (0xba)+1,   3, 
        8,      1,      (0xba)+3,   0, 
        128};

// player run sequence
const unsigned char* const playerRunSeq[16] = {
  playerLRun1, playerLRun2, playerLRun3, 
  playerLRun1, playerLRun2, playerLRun3, 
  playerLRun1, playerLRun2,
  playerRRun1, playerRRun2, playerRRun3, 
  playerRRun1, playerRRun2, playerRRun3, 
  playerRRun1, playerRRun2,
};

byte oam_off = 0;

void oam_meta_spr_pal(byte x, byte y, byte pal, const sbyte* meta) {
  struct cvu_sprite4 spr;
  while (*meta != -128) {
    spr.x = x + *meta++;
    spr.y = y + *meta++;
    spr.name = *meta++;
    meta++; pal;
    cvu_set_sprite4(SPRITES, oam_off, &spr);
    oam_off++;
  }
}

void oam_hide_rest() {
  if (oam_off < 64) {
    cvu_vmemset(SPRITES+oam_off, 240, 64-oam_off);
  }
}

cv_vmemp getntaddr(byte x, byte y) {
  return IMAGE + y*64 + x*2;
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
    byte x1 = gap*16 + 4;
    return (x > x1 && x < x1+GAPSIZE*8-4);
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
  for (i=0; i<MAX_FLOORS; i++) {
    Floor* lev = &floors[i];
    lev->height = rndint(2,5)*2;
    do {
      // only have gaps in higher floors
      lev->gap = i>=5 ? rndint(0,13) : 0;
    } while (ladder_in_gap(prevlev->ladder1, lev->gap) || 
             ladder_in_gap(prevlev->ladder2, lev->gap));
    do {
      lev->ladder1 = rndint(1,14);
      lev->ladder2 = rndint(1,14);
    } while (ladder_in_gap(lev->ladder1, lev->gap) || 
             ladder_in_gap(lev->ladder2, lev->gap));
    if (i > 0) {
      lev->objtype = rndint(1,4);
      do {
        lev->objpos = rndint(1,14);
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

// row image buffer
char buf[COLS*2];

// draw a nametable line into the frame buffer at <screen_y>
// 0 == bottom of stage
void draw_floor_line(byte screen_y) {
  byte floor, i;
  byte rowy, dy;
  cv_vmemp addr;
  // iterate through all floors
  for (floor=0; floor<MAX_FLOORS; floor++) {
    Floor* lev = &floors[floor];
    dy = screen_y - lev->ypos;
    // if below BOTTOM_Y_FLOOR
    if (dy >= 255 - BOTTOM_FLOOR_Y) {
      memset(buf, CH_BASEMENT, sizeof(buf));
      break;
    }
    // is this floor visible on-screen?
    else if (dy < lev->height) {
      if (dy <= 1) {
        // iterate through all 32 columns
        for (i=0; i<COLS*2; i+=4) {
          if (dy) {
            buf[i] = CH_FLOOR;		// upper-left
            buf[i+2] = CH_FLOOR+2;	// upper-right
          } else {
            buf[i] = CH_FLOOR+1;	// lower-left
            buf[i+2] = CH_FLOOR+3;	// lower-right
          }
        }
        // is there a gap? if so, clear bytes
	if (lev->gap)
          memset(buf+lev->gap*4, 0, GAPSIZE*2);
      } else {
        // clear buffer
        memset(buf, 0, sizeof(buf));
        // draw walls
        if (floor < MAX_FLOORS-1) {
          buf[0] = CH_FLOOR+1;		// left side
          buf[COLS*2-4] = CH_FLOOR;	// right side
        }
        // draw ladders
        if (lev->ladder1) {
          buf[lev->ladder1*4] = CH_LADDER;
          buf[lev->ladder1*4+2] = CH_LADDER+2;
        }
        if (lev->ladder2) {
          buf[lev->ladder2*4] = CH_LADDER;
          buf[lev->ladder2*4+2] = CH_LADDER+2;
        }
      }
      // draw object, if it exists
      if (lev->objtype) {
        byte ch = lev->objtype*4 + CH_ITEM;
        if (dy == 2) {
          buf[lev->objpos*4] = ch+1;	// bottom-left
          buf[lev->objpos*4+2] = ch+3;	// bottom-right
        }
        else if (dy == 3) {
          buf[lev->objpos*4] = ch+0;	// top-left
          buf[lev->objpos*4+2] = ch+2;	// top-right
        }
      }
      break;
    }
  }
  // ran out of floors? draw sky
  if (floor == MAX_FLOORS) {
    memset(buf, 0, sizeof(buf));
  }
  // compute row in name buffer and address
  rowy = (ROWS-1) - ((screen_y + ROW_OFFSET) % ROWS);
  addr = getntaddr(1, rowy);
  // copy line to screen buffer
  cvu_memtovmemcpy(addr, buf, sizeof(buf));
  // create actors on this floor, if needed
  // TODO: maybe this happens too early?
  if (dy == 0 && (floor >= 2)) {
    create_actors_on_floor(floor);
  }
}

// draw entire stage at current scroll position
// filling up entire name table
void draw_entire_stage() {
  byte y;
  for (y=0; y<ROWS; y++) {
    draw_floor_line(y);
    wait_vsync();
  }
}

// get Y pixel position for a given floor
word get_floor_yy(byte floor) {
  return floors[floor].ypos * 8 + 16;
}

// get Y ceiling position for a given floor
word get_ceiling_yy(byte floor) {
  return (floors[floor].ypos + floors[floor].height) * 8 + 16;
}

// set scrolling position
void set_scroll_pixel_yy(int yy) {
  // draw an offscreen line, every 8 pixels
  if ((yy & 7) == 0) {
    // scrolling upward or downward?
    if (yy > scroll_pixel_yy)
      draw_floor_line(scroll_tile_y + ROWS + UPDATE_ROW_DELTA);
    else if (yy > -UPDATE_ROW_DELTA)
      draw_floor_line(scroll_tile_y + UPDATE_ROW_DELTA);
  }
  // set scroll variables
  scroll_pixel_yy = yy;
  scroll_tile_y = yy >> 3; // divide by 8
  // set scroll registers (TODO: const)
  cv_set_vscroll(223 - ((yy + 192) % 224));
}

// redraw a floor when object picked up
void refresh_floor(byte floor) {
  byte y = floors[floor].ypos;
  draw_floor_line(y+2);
  draw_floor_line(y+3);
}

///// ACTORS

typedef enum ActorState {
  INACTIVE, STANDING, WALKING, CLIMBING, JUMPING, FALLING, PACING
};

typedef enum ActorType {
  ACTOR_PLAYER, ACTOR_ENEMY, ACTOR_RESCUE
};

typedef struct Actor {
  word yy;		// Y position in pixels (16 bit)
  byte x;		// X position in pixels (8 bit)
  byte floor;		// floor index
  byte state;		// ActorState
  int name:2;		// ActorType (2 bits)
  int pal:2;		// palette color (2 bits)
  int dir:1;		// direction (0=right, 1=left)
  int onscreen:1;	// is actor onscreen?
  sbyte yvel;		// Y velocity (when jumping)
  sbyte xvel;		// X velocity (when jumping)
} Actor;

Actor actors[MAX_ACTORS];	// all actors

// creete actors on floor_index, if slot is empty
void create_actors_on_floor(byte floor_index) {
  byte actor_index = (floor_index % (MAX_ACTORS-1)) + 1;
  struct Actor* a = &actors[actor_index];
  if (!a->onscreen) {
    Floor *floor = &floors[floor_index];
    a->state = STANDING;
    a->name = ACTOR_ENEMY;
    a->x = rand();
    a->yy = get_floor_yy(floor_index);
    a->floor = floor_index;
    a->onscreen = 1;
    // rescue person on top of the building
    if (floor_index == MAX_FLOORS-1) {
      a->name = ACTOR_RESCUE;
      a->state = PACING;
      a->x = 0;
      a->pal = 1;
    }
  }
}

void draw_actor(byte i) {
  struct Actor* a = &actors[i];
  bool dir;
  const unsigned char* meta;
  byte x,y; // sprite variables
  // get screen Y position of actor
  int screen_y = SCREEN_Y_BOTTOM - a->yy + scroll_pixel_yy;
  // is it offscreen?
  if (screen_y > 192+8 || screen_y < -18) {
    a->onscreen = 0;
    return; // offscreen vertically
  }
  dir = a->dir;
  switch (a->state) {
    default:
    case INACTIVE:
      a->onscreen = 0;
      return; // inactive, offscreen
    case STANDING:
      meta = dir ? playerLStand : playerRStand;
      break;
    case WALKING:
      meta = playerRunSeq[((a->x >> 1) & 7) + (dir?0:8)];
      break;
    case JUMPING:
      meta = dir ? playerLJump : playerRJump;
      break;
    case FALLING:
      meta = dir ? playerLSad : playerRSad;
      break;
    case CLIMBING:
      meta = (a->yy & 4) ? playerLClimb : playerRClimb;
      break;
    case PACING:
      meta = personToSave;
      break;
  }
  // set sprite values, draw sprite
  x = a->x;
  y = screen_y;
  oam_meta_spr_pal(x, y, a->pal, meta);
  // is this actor 0? (player sprite)
  if (i == 0) {
    player_screen_y = y; // save last screen Y position
  }
  a->onscreen = 1; // if we drew the actor, consider it onscreen
  return;
}

// draw the scoreboard, right now just two digits
void draw_scoreboard() {
  /*
  oam_off = oam_spr(24+0, 24, '0'+(score >> 4), 2, oam_off);
  oam_off = oam_spr(24+8, 24, '0'+(score & 0xf), 2, oam_off);
  */
}

// draw all sprites
void refresh_sprites() {
  byte i;
  // reset sprite index to 0
  oam_off = 0;
  // draw all actors
  for (i=0; i<MAX_ACTORS; i++)
    draw_actor(i);
  // draw scoreboard
  draw_scoreboard();
  // hide rest of actors
  oam_hide_rest();
}

// if ladder is close to X position, return ladder X position, otherwise 0
byte is_ladder_close(byte actor_x, byte ladder_pos) {
  byte ladder_x;
  if (ladder_pos == 0)
    return 0;
  ladder_x = ladder_pos * 16;
  return ((byte)(actor_x - ladder_x) < 16) ? ladder_x : 0;
}

// get the closest ladder to the player
byte get_closest_ladder(byte player_x, byte floor_index) {
  Floor* floor = &floors[floor_index];
  byte x;
  if (floor_index >= MAX_FLOORS) return 0;
  x = is_ladder_close(player_x, floor->ladder1);
  if (x) return x;
  x = is_ladder_close(player_x, floor->ladder2);
  if (x) return x;
  return 0;
}

// put the player on the ladder, and move up or down (floor_adjust)
byte mount_ladder(Actor* player, signed char floor_adjust) {
  byte x = get_closest_ladder(player->x, player->floor + floor_adjust);
  if (x) {
    player->x = x + 8;
    player->state = CLIMBING;
    player->floor += floor_adjust;
    return 1;
  } else
    return 0;
}

// should we scroll the screen upward?
void check_scroll_up() {
  if (player_screen_y < ACTOR_SCROLL_UP_Y) {
    set_scroll_pixel_yy(scroll_pixel_yy + 1);
  }
}

// should we scroll the screen downward?
void check_scroll_down() {
  if (player_screen_y > ACTOR_SCROLL_DOWN_Y && scroll_pixel_yy > 0) {
    set_scroll_pixel_yy(scroll_pixel_yy - 1);
  }
}

// actor falls down a floor
void fall_down(struct Actor* actor) {
  actor->floor--;
  actor->state = FALLING;
  actor->xvel = 0;
  actor->yvel = 0;
}

// move an actor (player or enemies)
// joystick - game controller mask
// scroll - if true, we should scroll screen (is player)
void move_actor(struct Actor* actor, byte joystick, bool scroll) {
  switch (actor->state) {
      
    case STANDING:
    case WALKING:
      // left/right has priority over climbing
      if (joystick & CV_FIRE_0) {
        actor->state = JUMPING;
        actor->xvel = 0;
        actor->yvel = JUMP_VELOCITY;
        if (joystick & CV_LEFT) actor->xvel = -1;
        if (joystick & CV_RIGHT) actor->xvel = 1;
        // play sound for player
        if (scroll) sfx_play(SND_JUMP,0);
      } else if (joystick & CV_LEFT) {
        actor->x--;
        actor->dir = 1;
        actor->state = WALKING;
      } else if (joystick & CV_RIGHT) {
        actor->x++;
        actor->dir = 0;
        actor->state = WALKING;
      } else if (joystick & CV_UP) {
        mount_ladder(actor, 0); // state -> CLIMBING
      } else if (joystick & CV_DOWN) {
        mount_ladder(actor, -1); // state -> CLIMBING, floor -= 1
      } else {
        actor->state = STANDING;
      }
      if (scroll) {
        check_scroll_up();
        check_scroll_down();
      }
      break;
      
    case CLIMBING:
      if (joystick & CV_UP) {
      	if (actor->yy >= get_ceiling_yy(actor->floor)) {
          actor->floor++;
          actor->state = STANDING;
        } else {
          actor->yy++;
        }
      } else if (joystick & CV_DOWN) {
        if (actor->yy <= get_floor_yy(actor->floor)) {
          actor->state = STANDING;
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
      if (actor->yy <= get_floor_yy(actor->floor)) {
	actor->yy = get_floor_yy(actor->floor);
        actor->state = STANDING;
      }
      break;
  }
  // don't allow player to travel past left/right edges of screen
  if (actor->x > ACTOR_MAX_X) actor->x = ACTOR_MAX_X; // we wrapped around right edge
  if (actor->x < ACTOR_MIN_X) actor->x = ACTOR_MIN_X;
  // if player lands in a gap, they fall (switch to JUMPING state)
  if (actor->state <= WALKING && 
      is_in_gap(actor->x, floors[actor->floor].gap)) {
    fall_down(actor);
  }
}

// should we pickup an object? only player does this
void pickup_object(Actor* actor) {
  Floor* floor = &floors[actor->floor];
  byte objtype = floor->objtype;
  // only pick up if there's an object, and if we're walking or standing
  if (objtype && actor->state <= WALKING) {
    byte objx = floor->objpos * 16;
    // is the actor close to the object?
    if (actor->x >= objx && actor->x < objx+16) {
      // clear the item from the floor and redraw
      floor->objtype = 0;
      refresh_floor(actor->floor);
      // did we hit a mine?
      if (objtype == ITEM_MINE) {
        // we hit a mine, fall down
        fall_down(actor);
        sfx_play(SND_HIT,0);
        vbright = 8; // flash
      } else {
        // we picked up an object, add to score
        score = bcd_add(score, 1);
        sfx_play(SND_COIN,0);
      }
    }
  }
}

// read joystick 0 and move the player
void move_player() {
  struct cv_controller_state state;
  cv_get_controller_state(&state, 0);
  move_actor(&actors[0], state.joystick, true);
  pickup_object(&actors[0]);
}

// returns absolute value of x
byte iabs(int x) {
  return x >= 0 ? x : -x;
}

// check to see if actor collides with any non-player actor
bool check_collision(Actor* a) {
  byte i;
  byte afloor = a->floor;
  // can't fall through basement
  if (afloor == 0) return false;
  // can't fall if already falling
  if (a->state == FALLING) return false;
  // iterate through entire list of actors
  for (i=1; i<MAX_ACTORS; i++) {
    Actor* b = &actors[i];
    // actors must be on same floor and within 8 pixels
    if (b->onscreen &&
        afloor == b->floor && 
        iabs(a->yy - b->yy) < 8 && 
        iabs(a->x - b->x) < 8) {
      return true;
    }
  }
  return false;
}

///

const char* RESCUE_TEXT = 
  "Is this a rescue?\n"
  "I am just hanging out\n"
  "on top of this building.\n"
  "Get lost!!!";

// draw a message on the screen
void type_message(const char* charptr) {
  char ch;
  byte x,y;
  x = 2;
  // compute message y position relative to scroll
  y = ROWS*8 + MESSAGE_ROW_DELTA - scroll_tile_y;
  // repeat until end of string (0) is read
  while ((ch = *charptr++)) {
    while (y >= ROWS) y -= ROWS; // compute (y % ROWS)
    // newline character? go to start of next line
    if (ch == '\n') {
      x = 2;
      y++;
    } else {
      // put character into nametable
      cvu_voutb(ch, getntaddr(x, y));
      x++;
    }
    // typewriter sound
    sfx_play(SND_HIT,0);
    // flush buffer and wait a few frames
    delay(5);
  }
}

// reward scene when player reaches roof
void rescue_scene() {
  // make player face to the left
  actors[0].dir = 1;
  actors[0].state = STANDING;
  refresh_sprites();
  music_stop();
  type_message(RESCUE_TEXT);
  // wait 2 seconds
  delay(100);
}

const byte PALBR_OR[9] = {
  0x00, 0x00, 0x00, 0x00, 0x00,
  0b010101,
  0b010101,
  0b101010,
  0b111111,
};
const byte PALBR_AND[9] = {
  0b000000,
  0b010101,
  0b010101,
  0b101010,
  0x3f, 0x3f, 0x3f, 0x3f, 0x3f
};

void pal_bright(byte level) {
  byte pal[16];
  byte i;
  byte or = PALBR_OR[level];
  byte and = PALBR_AND[level];
  for (i=0; i<16; i++) {
    pal[i] = PALETTE0[i] & and | or;
  }
  cvu_memtocmemcpy(0xc000, pal, 16);
}

// game loop
void play_scene() {
  byte i;
  // initialize actors array  
  memset(actors, 0, sizeof(actors));
  actors[0].state = STANDING;
  actors[0].name = ACTOR_PLAYER;
  actors[0].pal = 3;
  actors[0].x = 64;
  actors[0].floor = 0;
  actors[0].yy = get_floor_yy(0);
  // put actor at bottom
  set_scroll_pixel_yy(0);
  // draw initial view of level into nametable
  draw_entire_stage();
  // repeat until player reaches the roof
  while (actors[0].floor != MAX_FLOORS-1) {
    // flush VRAM buffer (waits next frame)
    wait_vsync();
    refresh_sprites();
    move_player();
    // move all the actors
    for (i=1; i<MAX_ACTORS; i++) {
      move_actor(&actors[i], rand(), false);
    }
    // see if the player hit another actor
    if (check_collision(&actors[0])) {
      fall_down(&actors[0]);
      sfx_play(SND_HIT,0);
      vbright = 8; // flash
    }
    // flash effect
    if (vbright > 4) {
      pal_bright(--vbright);
    }
  }
  // player reached goal; reward scene  
  rescue_scene();
}

/////

void setup_graphics() {
  cvu_memtovmemcpy(PATTERN, CHR_GENERIC, sizeof(CHR_GENERIC));
  cvu_memtocmemcpy(0xc000, PALETTE0, 16);
  cvu_memtocmemcpy(0xc010, PALETTE1, 16);
  flip_sprite_patterns(PATTERN+0x80*32, CHR_GENERIC+0xd0*32, 0x30*32);
  cv_set_left_column_blank(true);
}

void main() {
  vdp_setup();
  while (1) {
    setup_graphics();
    cv_set_screen_active(true);
    cv_set_vint_handler(&vint_handler);
    sfx_play(SND_START,0);	// play starting sound
    make_floors();		// make random level
    music_play(0);		// start the music
    play_scene();		// play the level
  }
}
