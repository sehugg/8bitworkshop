   /*
Climber for Game Boy - port of presets/nes/climber.c.

Climb a randomly generated building from the basement to the roof:
jump on ladders, dodge (or bounce off) the other climbers, watch out
for holes in the floors, and pick up whatever you find on the way.
Reach the roof to rescue the person waiting there.

Porting notes:
- The NES version scrolls a 60-row stage using two nametables and a
  VRAM update buffer. The Game Boy background is one 32x32 tile map
  (256 px), so we keep a 32-row window of the stage resident and
  redraw the row that enters the window whenever the camera crosses
  a tile boundary. VRAM writes are queued and flushed right after
  the next vblank.
- Tiles come from presets/nes/chr_generic.s. NES and GB are both 2bpp,
  but the NES stores the two bitplanes in separate 8-byte blocks while
  GB interleaves them, so the bytes were re-packed (see the array
  headers, which also drive the Asset Editor previews).
- The stage/scene logic is unchanged from the NES version. Types are
  the GBDK ones; bitfields were replaced by plain bytes.
- CGB palettes color the floor, ladders/items, text and actors. On DMG
  everything falls back to the four-shade BGP/OBP palettes.
- Background music was dropped; the four sound effects are simple PSG
  beeps.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"

#include <stdint.h>
#include <string.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gb/metasprites.h"
#include "gb/cgb.h"
#include "gbtext.h"

typedef uint8_t  byte;
typedef uint16_t word;
typedef int8_t   sbyte;

///// DEFINES

#define COLS 20                // floor width in tiles
#define ROWS 60                // total scrollable height in tiles

#define MAX_FLOORS 20          // total # of floors in a stage
#define GAPSIZE 4              // gap size in tiles
#define BOTTOM_FLOOR_Y 2       // offset for bottommost floor

#define MAX_ACTORS 8           // max # of moving actors
#define SCREEN_H 144           // screen height in pixels
#define SCREEN_Y_BOTTOM 128    // screen Y of a floor at level pixel 0
#define ACTOR_MIN_X 8          // leftmost position of actor
#define ACTOR_MAX_X 140        // rightmost position of actor
#define ACTOR_SCROLL_UP_Y 56   // min Y position to scroll up
#define ACTOR_SCROLL_DOWN_Y 80 // max Y position to scroll down
#define JUMP_VELOCITY 18       // Y velocity when jumping

// The map holds a 32-row window of the stage. Keep a few rows of margin
// on either side of the 18 visible rows so a missed frame never shows a
// blank line.
#define WINDOW_LO 6
#define WINDOW_HI 25

// constants for various tiles (indices into bg_tiles)
#define CH_BLANK 0x00
#define CH_FLOOR 0x01
#define CH_LADDER 0x05
#define CH_ITEM 0x07           // base of item type 1; +4 per type
#define CH_BORDER 0x13
#define CH_BASEMENT 0x14

// sprite frames, in the order packed into sprite_tiles
// map the NES joystick bits onto the Game Boy d-pad
#define PAD_A J_A
#define PAD_LEFT J_LEFT
#define PAD_RIGHT J_RIGHT
#define PAD_UP J_UP
#define PAD_DOWN J_DOWN

#define SPR_BASE 0x7b          // first sprite tile (after the 91 font tiles)
#define SPR_STAND 0
#define SPR_RUN1 1
#define SPR_RUN2 2
#define SPR_RUN3 3
#define SPR_JUMP 4
#define SPR_CLIMB 5
#define SPR_FALL 6
#define SPR_RESCUE 7

// sprite palettes: CGB palette number plus the DMG OBP1 select bit
#define PAL_ENEMY 0x00         // CGB palette 0 / OBP0
#define PAL_PLAYER 0x11        // CGB palette 1 / OBP1
#define PAL_RESCUE 0x12        // CGB palette 2 / OBP1

///// SOUND

// indices of sound effects (0..3)
typedef enum { SND_START, SND_HIT, SND_COIN, SND_JUMP } SFXIndex;

void psg_init(void) {
  NR52_REG = 0x80;             // sound on
  NR50_REG = 0x77;             // master volume
  NR51_REG = 0xFF;             // all channels to both outputs
  NR10_REG = 0x00;             // pulse 1 sweep off
}

void beep(word per, byte vol) {
  NR11_REG = 0x80;             // 50% duty
  NR12_REG = (vol << 4) | 0x01; // decay envelope
  NR13_REG = (byte)(per & 0xff);
  NR14_REG = (byte)(0x80 | ((per >> 8) & 7)); // trigger
}

void play_sfx(byte id) {
  switch (id) {
    case SND_START: beep(0x480, 10); break;
    case SND_JUMP:  beep(0x700, 9);  break;
    case SND_COIN:  beep(0x680, 12); break;
    case SND_HIT:   beep(0x300, 12); break;
  }
}

///// GLOBALS

// vertical scroll amount in pixels
static int scroll_pixel_yy = 0;

// vertical scroll amount in tiles (scroll_pixel_yy / 8)
static byte scroll_tile_y = 0;

// last screen Y position of player sprite
static byte player_screen_y = 0;

// score (BCD)
static byte score = 0;

// hit flash timer
static byte flash_timer = 0;
static byte flash_on = 0;

// is this a Color Game Boy?
static byte cgb_mode = 0;

// next free OAM sprite index
static byte oam_off = 0;

// pending tile-map rows, flushed during the next vblank
#define MAX_PENDING 8
static byte pending_rows[MAX_PENDING];
static byte pending_count = 0;

// 16-bit LCG. rand8() alone has a short cycle, so rndint() uses the
// full 16 bits (matching the NES version's use of rand()).
static word rnd = 0xCACE;
byte rand8(void) {
  rnd = rnd * 17 + 53;
  return (byte)(rnd >> 8);
}
word rand16(void) {
  rnd = rnd * 17 + 53;
  return rnd;
}

///// GRAPHICS DATA

/*{w:8,h:8,bpp:1,count:21,brev:1,np:2,pofs:1,sl:2}*/
const uint8_t bg_tiles[] = {
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  0xff,0x00,0x80,0x7f,0x80,0x7f,0x9f,0x7f,0x90,0x7f,0x97,0x7f,0x97,0x7f,0x97,0x7f,
  0x97,0x7f,0x97,0x7f,0x97,0x7f,0x97,0x78,0x9f,0x7f,0xbf,0x60,0xff,0x40,0x00,0x00,
  0xfe,0x00,0x02,0xfe,0x06,0xfc,0xfe,0xf8,0x0e,0xf8,0xfe,0xe8,0xfe,0xe8,0xfe,0xe8,
  0xfe,0xe8,0xfe,0xe8,0xfe,0xe8,0xfe,0x08,0xfe,0xf8,0xfe,0x00,0xfe,0x00,0x00,0x00,
  0xb0,0xe0,0xb0,0xe0,0xbf,0xe0,0xb0,0xff,0xbf,0xef,0xbf,0xe0,0xb0,0xe0,0xb0,0xe0,
  0x0b,0x0e,0x0b,0x0e,0xfb,0x0e,0x0b,0xfe,0xfb,0xf6,0xfb,0x0e,0x0b,0x0e,0x0b,0x0e,
  0x00,0x0f,0x0f,0x30,0x3f,0x4d,0x3f,0x6d,0x7f,0xad,0x00,0xff,0x7f,0x80,0x7f,0xad,
  0x7f,0xad,0x7f,0xad,0x7f,0xad,0x00,0xff,0x7f,0x80,0x7f,0xad,0x7f,0xad,0x00,0xff,
  0x00,0xf0,0xf0,0x0c,0xfc,0xb2,0xfc,0xb6,0xfe,0xb7,0x00,0xff,0xfe,0x01,0xfe,0xb7,
  0xea,0xb5,0xe2,0xbd,0xfe,0xa1,0x00,0xff,0xfe,0x01,0xfe,0xb7,0xfe,0xb7,0x00,0xff,
  0x00,0x01,0x22,0x63,0x4c,0x3f,0x1f,0x20,0x36,0x2d,0x3f,0x29,0x5f,0x60,0x17,0xec,
  0xff,0x68,0x7f,0x20,0x36,0x0d,0x3f,0x29,0x1f,0x20,0x5c,0x77,0x22,0x43,0x00,0x01,
  0x80,0x00,0xc4,0x86,0xf2,0xdc,0xfc,0x04,0xdc,0xb0,0xfc,0x24,0xfa,0x06,0xd8,0x37,
  0xff,0x26,0xfe,0x04,0xdc,0xb0,0xfc,0x20,0xfc,0x04,0xfa,0xcc,0xc4,0x86,0x80,0x00,
  0x00,0x00,0x00,0x00,0x00,0x1c,0x1c,0x3e,0x26,0x7f,0x2f,0x7f,0x3f,0x7f,0x3f,0x7f,
  0x1f,0x3f,0x0f,0x1f,0x07,0x0f,0x03,0x07,0x01,0x02,0x00,0x01,0x00,0x00,0x00,0x00,
  0x00,0x00,0x00,0x00,0x00,0x38,0x38,0x74,0x4c,0xfa,0xdc,0xfa,0xf4,0xfa,0xf4,0xfa,
  0xe8,0xf4,0xd0,0xe8,0xa0,0xd0,0x40,0xa0,0x80,0x40,0x00,0x80,0x00,0x00,0x00,0x00,
  0x3c,0x38,0x7e,0x44,0x7e,0x5c,0x7e,0x54,0x7e,0x5c,0x7e,0x40,0x7e,0x3c,0x3e,0x00,
  0x01,0xff,0x01,0xff,0x01,0xff,0x01,0xff,0x01,0xff,0x01,0xff,0x01,0xff,0xfe,0x00
};

// 8 16x16 frames (7 player poses + the rescuee), each four 8x8 tiles
// in UL, LL, UR, LR order.
/*{w:16,h:16,bpp:1,count:8,brev:1,np:2,pofs:1,sl:2,wpimg:64,remap:[5,1,2,3,4,0,6,7,8,9,10,11,12]}*/
const uint8_t sprite_tiles[] = {
  0x17,0x17,0x3F,0x28,0x1F,0x10,0x3F,0x20,0x32,0x2D,0x70,0x4F,0x38,0x37,0x18,0x07,
  0x0F,0x0F,0x1F,0x1F,0x1F,0x1F,0x13,0x1C,0x03,0x0C,0x0E,0x00,0x0E,0x0E,0x0F,0x0F,
  0xC8,0xC8,0xFC,0x34,0xFC,0x04,0xF8,0x08,0x40,0xA0,0x40,0xF0,0x00,0xE0,0x00,0xC0,
  0xC0,0xC0,0xE0,0xE0,0xE0,0xE0,0xC0,0x20,0xC0,0x20,0xC0,0x00,0xE0,0xE0,0x70,0x70,
  0x17,0x17,0x3F,0x28,0x1F,0x10,0x3F,0x20,0x32,0x2D,0x70,0x4F,0x38,0x37,0x18,0x07,
  0x1F,0x1F,0x1F,0x3F,0x0F,0x3F,0x0F,0x00,0x3F,0x00,0x7C,0x60,0x30,0x30,0x18,0x18,
  0xC8,0xC8,0xFC,0x34,0xFC,0x04,0xF8,0x08,0x40,0xA0,0x40,0xF0,0x00,0xE0,0x00,0xC0,
  0xC0,0xCC,0xF0,0xFC,0xF8,0xF8,0xE4,0x04,0xFC,0x0C,0xFC,0x0C,0x7C,0x0C,0x00,0x00,
  0x17,0x17,0x3F,0x28,0x1F,0x10,0x3F,0x20,0x32,0x2D,0x70,0x4F,0x38,0x37,0x18,0x07,
  0x0F,0x0F,0x1F,0x1F,0x1F,0x1F,0x13,0x1C,0x03,0x0C,0x0E,0x00,0x0E,0x0E,0x0F,0x0F,
  0xC8,0xC8,0xFC,0x34,0xFC,0x04,0xF8,0x08,0x40,0xA0,0x40,0xF0,0x00,0xE0,0x00,0xC0,
  0xC0,0xC0,0xC0,0xC0,0xC0,0xE0,0xC0,0x20,0xC0,0x00,0xC0,0xC0,0xE0,0xE0,0x00,0x00,
  0x00,0x00,0x17,0x17,0x3F,0x28,0x1F,0x10,0x3F,0x20,0x32,0x2D,0x70,0x4F,0x18,0x17,
  0x18,0x07,0x1F,0x1F,0x0F,0x3F,0x0F,0x37,0x3F,0x20,0x7B,0x60,0x43,0x43,0x03,0x03,
  0x00,0x00,0xC8,0xC8,0xFC,0x34,0xFC,0x04,0xF8,0x08,0x40,0xA0,0x40,0xF0,0x00,0xE0,
  0x00,0xC0,0xE0,0xF8,0xE0,0xF8,0xC0,0xC0,0xC0,0x00,0x80,0x00,0x80,0x80,0xC0,0xC0,
  0x17,0x17,0x3F,0x28,0x1F,0x10,0x3F,0x20,0x32,0x2D,0x70,0x4F,0x38,0x37,0x18,0x1F,
  0x3F,0x3F,0x3F,0x7F,0x0F,0x6F,0x7F,0x60,0x7F,0x60,0x7E,0x60,0x40,0x40,0x00,0x00,
  0xC8,0xC8,0xFC,0x34,0xFC,0x04,0xF8,0x08,0x40,0xA0,0x40,0xB0,0x00,0xE0,0x00,0xCC,
  0xD0,0xDC,0xF8,0xF8,0xF0,0xF0,0xC4,0x04,0xFC,0x0C,0xFC,0x0C,0x7C,0x0C,0x00,0x00,
  0x07,0x07,0x1F,0x08,0x1F,0x10,0x3F,0x20,0x3F,0x20,0x7F,0x40,0x0F,0x30,0x7F,0x60,
  0x7F,0x7F,0x3F,0x3F,0x1F,0x1F,0x0F,0x00,0x0F,0x00,0x0F,0x06,0x0F,0x0F,0x0F,0x0F,
  0xE0,0xE0,0xF0,0x10,0xF8,0x08,0xFC,0x04,0xFC,0x04,0xFE,0x02,0xFC,0x0C,0xFC,0x04,
  0xF8,0xF8,0xF8,0xF8,0xF8,0xC0,0xF8,0x00,0xF0,0x70,0x00,0x00,0x00,0x00,0x00,0x00,
  0x17,0x17,0x3F,0x28,0x1F,0x10,0x3F,0x20,0x3A,0x27,0x19,0x66,0x1A,0x75,0x7C,0x63,
  0x7F,0x7F,0x3F,0x3F,0x5F,0x5F,0x7F,0x60,0x7F,0x60,0x7F,0x61,0x1E,0x1E,0x00,0x00,
  0xE8,0xE8,0xFC,0x14,0xF8,0x08,0xFC,0x04,0x5C,0xE4,0x9E,0x62,0x5C,0xAC,0x3C,0xC7,
  0xFC,0xFF,0xFE,0xFE,0xF0,0xF0,0xF0,0x10,0xF8,0x08,0xF8,0x08,0xE0,0xE0,0x70,0x70,
  0x0F,0x0F,0x1F,0x1F,0x3F,0x3F,0x3D,0x3F,0x38,0x3F,0x38,0x3F,0x3C,0x3F,0x16,0x17,
  0xF2,0x0D,0xF1,0x0E,0xF1,0x1E,0x1F,0x10,0x3F,0x20,0x7B,0x44,0x31,0x2E,0x10,0x1F,
  0xF0,0xF0,0xF8,0xF8,0xBC,0xFC,0x14,0xFC,0xA0,0x58,0xA0,0x58,0x08,0xF8,0x1C,0xFC,
  0x20,0xE0,0xF0,0x10,0xF8,0x08,0xF8,0x08,0xFC,0x04,0xDE,0x22,0x8C,0x74,0x84,0xFC
};

// CGB palettes: 3 background palettes (floor, ladders/items, text),
// then 3 sprite palettes (enemy, player, rescuee).
/*{pal:555,n:12,bpw:16}*/
palette_color_t bkg_palettes[12] = {
  0x2041, 0x5106, 0x7261, 0x7fff,
  0x2041, 0x7148, 0x025f, 0x7fff,
  0x2041, 0x39ce, 0x4210, 0x7fff,
};
/*{pal:555,n:12,bpw:16}*/
palette_color_t spr_palettes[12] = {
  0x0000, 0x109c, 0x625f, 0x2388,
  0x0000, 0x1084, 0x025f, 0x2388,
  0x0000, 0x39ce, 0x731f, 0x4bf2,
};
/*{pal:555,n:12,bpw:16}*/
palette_color_t bkg_flash[12] = {
  0x7fff, 0x7fff, 0x7fff, 0x7fff,
  0x7fff, 0x7fff, 0x7fff, 0x7fff,
  0x7fff, 0x7fff, 0x7fff, 0x7fff,
};
/*{pal:555,n:12,bpw:16}*/
palette_color_t spr_flash[12] = {
  0x0000, 0x7fff, 0x7fff, 0x7fff,
  0x0000, 0x7fff, 0x7fff, 0x7fff,
  0x0000, 0x7fff, 0x7fff, 0x7fff,
};

///// GAME LOGIC

// struct definition for a single floor
typedef struct Floor {
  byte ypos;            // # of tiles from ground
  byte height;          // # of tiles to next floor
  byte gap;             // X position of gap (in 2-tile units, 0 = none)
  byte ladder1;         // X position of first ladder
  byte ladder2;         // X position of second ladder
  byte objtype;         // item type (FloorItem)
  byte objpos;          // X position of object
  byte _reserved;       // pad to 8 bytes
} Floor;

// various items the player can pick up
typedef enum FloorItem { ITEM_NONE, ITEM_MINE, ITEM_HEART, ITEM_POWER };

// array of floors
Floor floors[MAX_FLOORS];

// random byte between (a ... b-1)
byte rndint(byte a, byte b) {
  return (rand16() % (b-a)) + a;
}

// is this x (pixel) position within the gap <gap>?
byte is_in_gap(byte x, byte gap) {
  if (gap) {
    byte x1 = gap*16 + 4;
    return (x > x1 && x < x1+GAPSIZE*8-4);
  } else {
    return 0;
  }
}

// is this ladder at (tile) position x within the gap?
byte ladder_in_gap(byte x, byte gap) {
  return gap && x >= gap && x < gap+GAPSIZE*2;
}

// create floors at start of game
void make_floors(void) {
  byte i;
  byte y = BOTTOM_FLOOR_Y;
  Floor* prevlev = &floors[0];
  for (i=0; i<MAX_FLOORS; i++) {
    Floor* lev = &floors[i];
    lev->height = rndint(2,5)*2;
    do {
      // only have gaps in higher floors
      lev->gap = i>=5 ? rndint(0,8) : 0;
    } while (ladder_in_gap(prevlev->ladder1, lev->gap) ||
             ladder_in_gap(prevlev->ladder2, lev->gap));
    do {
      lev->ladder1 = rndint(1,10);
      lev->ladder2 = rndint(1,10);
    } while (ladder_in_gap(lev->ladder1, lev->gap) ||
             ladder_in_gap(lev->ladder2, lev->gap));
    if (i > 0) {
      lev->objtype = rndint(1,4);
      do {
        lev->objpos = rndint(1,10);
      } while (ladder_in_gap(lev->objpos, lev->gap));
    } else {
      lev->objtype = 0;
      lev->objpos = 0;
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

// get Y pixel position for a given floor
word get_floor_yy(byte floor) {
  return floors[floor].ypos * 8 + 16;
}

// get Y ceiling position for a given floor
word get_ceiling_yy(byte floor) {
  return (floors[floor].ypos + floors[floor].height) * 8 + 16;
}

///// ACTORS

typedef enum ActorState {
  INACTIVE, STANDING, WALKING, CLIMBING, JUMPING, FALLING, PACING
};

typedef enum ActorType {
  ACTOR_PLAYER, ACTOR_ENEMY, ACTOR_RESCUE
};

typedef struct Actor {
  word yy;              // Y position in pixels (16 bit)
  byte x;               // X position in pixels (8 bit)
  byte floor;           // floor index
  byte state;           // ActorState
  sbyte yvel;           // Y velocity (when jumping)
  sbyte xvel;           // X velocity (when jumping)
  byte type;            // ActorType
  byte pal;             // palette selector
  byte dir;             // direction (0=right, 1=left)
  byte onscreen;        // is actor onscreen?
} Actor;

Actor actors[MAX_ACTORS];       // all actors

// player run sequence, indexed by ((x>>1)&7)
const byte run_frame[8] = { SPR_RUN1, SPR_RUN2, SPR_RUN3,
                            SPR_RUN1, SPR_RUN2, SPR_RUN3, SPR_RUN1, SPR_RUN2 };

///// FORWARD DECLARATIONS

void draw_floor_line(byte row_height);
void create_actors_on_floor(byte floor_index);
void refresh_floor(byte floor);
void set_palettes(byte flash);

///// TILE MAP

// queue a stage row to redraw during the next vblank
void queue_row(byte row_height) {
  if (pending_count < MAX_PENDING)
    pending_rows[pending_count++] = row_height;
}

void flush_rows(void) {
  byte i;
  for (i=0; i<pending_count; i++)
    draw_floor_line(pending_rows[i]);
  pending_count = 0;
}

// which CGB background palette does this tile use?
byte tile_attr(byte t) {
  if (t >= CH_LADDER && t <= CH_ITEM+11) return 1;      // ladders + items
  if (t >= FONT_TILE_BASE && t < SPR_BASE) return 2;    // text
  return 0;                                             // floor, blank, walls
}

// map row (0..31) for a level row counted from the bottom
#define MAPROW(h) ((32 - ((h) & 31)) & 31)

// draw a stage line into the tile map
// 0 == bottom of stage
void draw_floor_line(byte row_height) {
  byte buf[COLS];       // tile buffer
  byte attrs[COLS];     // CGB attribute buffer
  byte floor = 0;       // floor counter
  byte dy = 0xff;       // height in rows above floor
  byte i;               // loop counter
  byte mrow;
  // clear buffer (areas above the top floor are blank)
  memset(buf, 0, sizeof(buf));
  // loop over all floors
  for (floor=0; floor<MAX_FLOORS; floor++) {
    Floor* lev = &floors[floor];
    // compute height in rows above floor
    dy = row_height - lev->ypos;
    // if below bottom floor (in basement)
    if (dy >= 255 - BOTTOM_FLOOR_Y) dy = 0;
    // does this floor intersect the desired row?
    if (dy < lev->height) {
      // first two rows (floor)?
      if (dy <= 1) {
        // iterate through all columns
        for (i=0; i<COLS; i+=2) {
          if (dy) {
            buf[i] = CH_FLOOR;          // upper-left
            buf[i+1] = CH_FLOOR+2;      // upper-right
          } else {
            buf[i] = CH_FLOOR+1;        // lower-left
            buf[i+1] = CH_FLOOR+3;      // lower-right
          }
        }
        // is there a gap? if so, clear tiles
        if (lev->gap)
          memset(buf+lev->gap*2, 0, GAPSIZE);
      } else {
        // clear buffer
        memset(buf, 0, sizeof(buf));
        // draw walls
        if (floor < MAX_FLOORS-1) {
          buf[0] = CH_FLOOR+1;          // left side
          buf[COLS-1] = CH_FLOOR;       // right side
        }
        // draw ladders
        if (lev->ladder1) {
          buf[lev->ladder1*2] = CH_LADDER;
          buf[lev->ladder1*2+1] = CH_LADDER+1;
        }
        if (lev->ladder2) {
          buf[lev->ladder2*2] = CH_LADDER;
          buf[lev->ladder2*2+1] = CH_LADDER+1;
        }
      }
      // draw object, if it exists
      if (lev->objtype) {
        byte ch = CH_ITEM + (lev->objtype-1)*4;
        if (dy == 2) {
          buf[lev->objpos*2] = ch+1;    // bottom-left
          buf[lev->objpos*2+1] = ch+3;  // bottom-right
        } else if (dy == 3) {
          buf[lev->objpos*2] = ch+0;    // top-left
          buf[lev->objpos*2+1] = ch+2;  // top-right
        }
      }
      break;
    }
  }
  // write the row into the tile map
  mrow = MAPROW(row_height);
  set_bkg_tiles(0, mrow, COLS, 1, buf);
  if (cgb_mode) {
    for (i=0; i<COLS; i++)
      attrs[i] = tile_attr(buf[i]);
    VBK_REG = 1;
    set_bkg_tiles(0, mrow, COLS, 1, attrs);
    VBK_REG = 0;
  }
  // create actors on this floor, if needed
  if (dy == 0 && floor >= 2)
    create_actors_on_floor(floor);
}

// draw the initial 32-row window of the stage at the current scroll
void draw_entire_stage(void) {
  int h;
  for (h=scroll_tile_y-WINDOW_LO; h<=scroll_tile_y+WINDOW_HI; h++) {
    wait_vbl_done();
    draw_floor_line((byte)h);
  }
}

// set scrolling position
void set_scroll_pixel_yy(int yy) {
  byte new_tile = yy >> 3;
  // did we cross a tile boundary? then the window slid one row
  if (new_tile != scroll_tile_y) {
    if (new_tile > scroll_tile_y)
      queue_row(new_tile + WINDOW_HI);     // new top of window
    else
      queue_row(new_tile - WINDOW_LO);     // new bottom of window
    scroll_tile_y = new_tile;
  }
  scroll_pixel_yy = yy;
  SCY_REG = (120 - yy) & 0xff;
  SCX_REG = 0;
}

// redraw a floor when object picked up
void refresh_floor(byte floor) {
  byte y = floors[floor].ypos;
  queue_row(y+2);       // redraw 3rd line
  queue_row(y+3);       // redraw 4th line
}

///// DRAWING

// draw a 2x2 sprite at oam_off, using sprite_tiles[frame*4..]
void put_2x2(byte x, byte y, byte frame, byte props, byte flip) {
  byte i, col, row, px, py, tilebase, oam;
  tilebase = SPR_BASE + frame*4;
  for (i=0; i<4; i++) {
    col = i >> 1;       // 0 = left, 1 = right
    row = i & 1;        // 0 = top, 1 = bottom
    px = x + ((flip ? (1-col) : col) << 3);
    py = y + (row << 3);
    oam = oam_off + i;
    set_sprite_tile(oam, tilebase+i);
    set_sprite_prop(oam, props | (flip ? S_FLIPX : 0));
    move_sprite(oam, px+8, py+16);
  }
}

// draw an actor, return # of sprites used
byte draw_actor(byte i) {
  struct Actor* a = &actors[i];
  byte frame, props, flip;
  int screen_y;
  // get screen Y position of actor
  screen_y = SCREEN_Y_BOTTOM - a->yy + scroll_pixel_yy;
  // is it offscreen?
  if (screen_y > SCREEN_H+8 || screen_y < -18) {
    a->onscreen = 0;
    return 0;
  }
  switch (a->state) {
    case INACTIVE:
      a->onscreen = 0;
      return 0;
    case STANDING: frame = SPR_STAND; break;
    case WALKING:  frame = run_frame[(a->x >> 1) & 7]; break;
    case JUMPING:  frame = SPR_JUMP; break;
    case FALLING:  frame = SPR_FALL; break;
    case CLIMBING: frame = SPR_CLIMB; break;
    case PACING:   frame = SPR_RESCUE; break;
    default:       frame = SPR_STAND; break;
  }
  if (a->type == ACTOR_RESCUE) props = PAL_RESCUE;
  else if (a->type == ACTOR_ENEMY) props = PAL_ENEMY;
  else props = PAL_PLAYER;
  flip = a->dir;
  if (a->state == CLIMBING) flip = (a->yy & 4) ? 1 : 0;
  put_2x2(a->x, (byte)screen_y, frame, props, flip);
  if (i == 0)
    player_screen_y = (byte)screen_y;
  a->onscreen = 1;
  return 4;
}

// draw the scoreboard, right now just two digits
void draw_scoreboard(void) {
  set_sprite_tile(oam_off, '0' + (score >> 4));
  set_sprite_prop(oam_off, PAL_PLAYER);
  move_sprite(oam_off, 24+8, 4+16);
  oam_off++;
  set_sprite_tile(oam_off, '0' + (score & 0xf));
  set_sprite_prop(oam_off, PAL_PLAYER);
  move_sprite(oam_off, 32+8, 4+16);
  oam_off++;
}

// draw all sprites
void refresh_sprites(void) {
  byte i;
  oam_off = 0;
  for (i=0; i<MAX_ACTORS; i++)
    oam_off += draw_actor(i);
  draw_scoreboard();
  hide_sprites_range(oam_off, 40);
}

///// GAME LOGIC (cont.)

// put an actor on a floor, if its slot is empty
void create_actors_on_floor(byte floor_index) {
  byte actor_index = (floor_index % (MAX_ACTORS-1)) + 1;
  struct Actor* a = &actors[actor_index];
  if (!a->onscreen) {
    Floor *floor = &floors[floor_index];
    a->state = STANDING;
    a->type = ACTOR_ENEMY;
    a->x = rand8();
    a->yy = get_floor_yy(floor_index);
    a->floor = floor_index;
    a->onscreen = 1;
    // rescue person on top of the building
    if (floor_index == MAX_FLOORS-1) {
      a->type = ACTOR_RESCUE;
      a->state = PACING;
      a->x = 0;
      a->pal = 1;
    }
  }
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
  Floor* floor;
  byte x;
  if (floor_index >= MAX_FLOORS) return 0;
  floor = &floors[floor_index];
  x = is_ladder_close(player_x, floor->ladder1);
  if (x) return x;
  x = is_ladder_close(player_x, floor->ladder2);
  if (x) return x;
  return 0;
}

// put the player on the ladder, and move up or down (floor_adjust)
byte mount_ladder(Actor* player, sbyte floor_adjust) {
  byte x = get_closest_ladder(player->x + 8, player->floor + floor_adjust);
  if (x) {
    player->x = x;
    player->state = CLIMBING;
    player->floor += floor_adjust;
    return 1;
  } else
    return 0;
}

// should we scroll the screen upward?
void check_scroll_up(void) {
  if (player_screen_y < ACTOR_SCROLL_UP_Y)
    set_scroll_pixel_yy(scroll_pixel_yy + 1);
}

// should we scroll the screen downward?
void check_scroll_down(void) {
  if (player_screen_y > ACTOR_SCROLL_DOWN_Y && scroll_pixel_yy > 0)
    set_scroll_pixel_yy(scroll_pixel_yy - 1);
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
void move_actor(struct Actor* actor, byte joystick, byte scroll) {
  switch (actor->state) {

    case STANDING:
    case WALKING:
      // left/right has priority over climbing
      if (joystick & PAD_A) {
        actor->state = JUMPING;
        actor->xvel = 0;
        actor->yvel = JUMP_VELOCITY;
        if (joystick & PAD_LEFT) actor->xvel = -1;
        if (joystick & PAD_RIGHT) actor->xvel = 1;
        // play sound for player
        if (scroll) play_sfx(SND_JUMP);
      } else if (joystick & PAD_LEFT) {
        actor->x--;
        actor->dir = 1;
        actor->state = WALKING;
      } else if (joystick & PAD_RIGHT) {
        actor->x++;
        actor->dir = 0;
        actor->state = WALKING;
      } else if (joystick & PAD_UP) {
        mount_ladder(actor, 0); // state -> CLIMBING
      } else if (joystick & PAD_DOWN) {
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
      if (joystick & PAD_UP) {
        if (actor->yy >= get_ceiling_yy(actor->floor)) {
          actor->floor++;
          actor->state = STANDING;
        } else {
          actor->yy++;
        }
      } else if (joystick & PAD_DOWN) {
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
      // fall through
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
  // if player lands in a gap, they fall (switch to FALLING state)
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
        play_sfx(SND_HIT);
        flash_timer = 8; // flash
      } else {
        // we picked up an object, add to score (BCD)
        score = (score + 1) & 0xff;
        if ((score & 0x0f) > 9) score = (score + 6) & 0xff;
        play_sfx(SND_COIN);
      }
    }
  }
}

// read joystick 0 and move the player
void move_player(void) {
  byte joy = joypad();
  if (joy & J_B) joy |= J_A;    // B also jumps
  move_actor(&actors[0], joy, 1);
  pickup_object(&actors[0]);
}

// returns absolute value of x
byte iabs(int x) {
  return x >= 0 ? x : -x;
}

// check to see if actor collides with any non-player actor
byte check_collision(Actor* a) {
  byte i;
  byte afloor = a->floor;
  // can't fall through basement
  if (afloor == 0) return 0;
  // can't collide if already falling
  if (a->state == FALLING) return 0;
  // iterate through entire list of actors
  for (i=1; i<MAX_ACTORS; i++) {
    Actor* b = &actors[i];
    // actors must be on same floor and within 8 pixels
    if (b->onscreen &&
        afloor == b->floor &&
        iabs(a->yy - b->yy) < 8 &&
        iabs(a->x - b->x) < 8) {
      return 1;
    }
  }
  return 0;
}

///// TEXT

// write a single character into the tile map with a CGB palette
void put_char_pal(byte x, byte y, char c, byte pal) {
  set_bkg_tiles(x, y, 1, 1, (uint8_t*)&c);
  if (cgb_mode) {
    VBK_REG = 1;
    set_bkg_tiles(x, y, 1, 1, &pal);
    VBK_REG = 0;
  }
}

// map row that currently sits at screen row sr
byte screen_row_to_map(byte sr) {
  return (((SCY_REG >> 3) + sr) & 31);
}

const char* RESCUE_TEXT =
  "Is this a rescue?\n"
  "I am just hanging\n"
  "on this building.\n"
  "Get lost!!!";

// draw a message on the screen, one character at a time
void type_message(const char* charptr) {
  char ch;
  byte x, y;
  x = 2;
  y = screen_row_to_map(3);
  while ((ch = *charptr++)) {
    if (ch == '\n') {
      x = 2;
      y = (y+1) & 31;
    } else {
      put_char_pal(x, y, ch, 2);
      x++;
    }
    play_sfx(SND_HIT);          // typewriter sound
    wait_vbl_done();
    wait_vbl_done();
    wait_vbl_done();
  }
}

// reward scene when player reaches roof
void rescue_scene(void) {
  byte i;
  // make player face to the left
  actors[0].dir = 1;
  actors[0].state = STANDING;
  refresh_sprites();
  type_message(RESCUE_TEXT);
  // wait 2 seconds
  for (i=0; i<100; i++)
    wait_vbl_done();
}

// game loop
void play_scene(void) {
  byte i;
  // initialize actors array
  memset(actors, 0, sizeof(actors));
  actors[0].state = STANDING;
  actors[0].type = ACTOR_PLAYER;
  actors[0].pal = 3;
  actors[0].x = 64;
  actors[0].floor = 0;
  actors[0].yy = get_floor_yy(0);
  // put actor at bottom
  scroll_tile_y = 0;
  set_scroll_pixel_yy(0);
  // draw initial view of level into tile map
  draw_entire_stage();
  // repeat until player reaches the roof
  while (actors[0].floor != MAX_FLOORS-1) {
    // prepare sprites and read input
    refresh_sprites();
    move_player();
    // move all the actors
    for (i=1; i<MAX_ACTORS; i++)
      move_actor(&actors[i], rand8(), 0);
    // see if the player hit another actor
    if (check_collision(&actors[0])) {
      fall_down(&actors[0]);
      play_sfx(SND_HIT);
      flash_timer = 8;
    }
    // frame boundary: flush queued rows and update the flash
    wait_vbl_done();
    if (pending_count) flush_rows();
    if ((flash_timer != 0) != flash_on) {
      flash_on = (flash_timer != 0);
      set_palettes(flash_on);
    }
    if (flash_timer) flash_timer--;
  }
  // player reached goal; reward scene
  rescue_scene();
}

///// SETUP

// choose the CGB palettes if we're on a Color Game Boy, else the
// four-shade DMG palettes (BGP/OBP0/OBP1).
void set_palettes(byte flash) {
  if (flash) {
    set_bkg_palette(0, 3, bkg_flash);
    set_sprite_palette(0, 3, spr_flash);
  } else {
    set_bkg_palette(0, 3, bkg_palettes);
    set_sprite_palette(0, 3, spr_palettes);
  }
  BGP_REG = flash ? 0x1b : 0xe4;
  OBP0_REG = flash ? 0x1b : 0xe4;
  OBP1_REG = flash ? 0x1b : 0xd2;
}

// set up PPU
void setup_graphics(void) {
  cgb_mode = DEVICE_SUPPORTS_COLOR;
  DISPLAY_OFF;
  set_bkg_data(0, sizeof(bg_tiles)/16, bg_tiles);
  set_sprite_data(SPR_BASE, sizeof(sprite_tiles)/16, sprite_tiles);
  font_init();
  set_palettes(0);
  LCDC_REG = LCDCF_ON | LCDCF_BGON |
             LCDCF_OBJ8 | LCDCF_OBJON | LCDCF_WINOFF;
  hide_sprites_range(0, 40);
  // clear the background map (and its CGB attributes)
  fill_bkg_rect(0, 0, 32, 32, 0);
  if (cgb_mode) {
    VBK_REG = 1;
    fill_bkg_rect(0, 0, 32, 32, 0);
    VBK_REG = 0;
  }
  SHOW_BKG;
  SHOW_SPRITES;
  DISPLAY_ON;
}

// main program
void main(void) {
  psg_init();
  while (1) {
    setup_graphics();       // setup PPU, clear screen
    play_sfx(SND_START);    // play starting sound
    make_floors();          // make random level
    play_scene();           // play the level
  }
}
