
#include <stdlib.h>
#include <string.h>

#include "neslib.h"
#include "nes.h"

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;
typedef enum { false, true } bool;

// TILES

//#link "jroatch.c"
extern unsigned char jroatch_chr[0x1000];
#define TILESET jroatch_chr

#define COLS 30
#define ROWS 60

#define XOFS 0 // sprite horiz. offset
#define SCREEN_Y_BOTTOM 208
#define ACTOR_MIN_X 16
#define ACTOR_SCROLL_UP_Y 110
#define ACTOR_SCROLL_DOWN_Y 140
#define BOTTOM_LEVEL_Y 2
#define JUMP_VELOCITY 17

#define BGCOL CV_COLOR_BLUE

#define CH_BORDER 64
#define CH_FLOOR 0xf4
#define CH_LADDER 0xd4
#define CH_FRUIT 0xcc
#define BLANK 0x20

byte rndint(byte a, byte b) {
  return (rand8() % (b-a)) + a;
}

#define OAMBUF ((unsigned char*) 0x200)

// VRAM UPDATE BUFFER

#define VBUFSIZE 64
byte updbuf[VBUFSIZE];
byte updptr = 0;

void cendbuf() {
  updbuf[updptr] = NT_UPD_EOF;
}

void cflushnow() {
  // make sure buffer has EOF marker
  cendbuf();
  // wait for next frame to flush update buffer
  // this will also set the scroll registers properly
  ppu_wait_frame();
  // clear the buffer
  updptr = 0;
  cendbuf();
}

void vdelay(byte count) {
  while (count--) cflushnow();
}

word getntaddr(byte x, byte y) {
  word addr;
  if (y < 30) {
    addr = NTADR_A(x,y);
  } else {
    addr = NTADR_C(x,y-30);
  }
  return addr;
}

word nt2attraddr(word a) {
  return (a & 0x2c00) | 0x3c0 | (a & 0x0C00) | 
    ((a >> 4) & 0x38) | ((a >> 2) & 0x07);
}

word getattraddr(byte row) {
  word addr;
  if (row < 15) {
    addr = NAMETABLE_A + 0x3c0 + (row>>1)*8;
  } else {
    addr = NAMETABLE_C + 0x3c0 + ((row-15)>>1)*8;
  }
  return addr;
}

void putchar(word addr, char ch) {
  if (updptr >= VBUFSIZE-4) cflushnow();
  updbuf[updptr++] = addr >> 8;
  updbuf[updptr++] = addr & 0xff;
  updbuf[updptr++] = ch;
  cendbuf();
}

void putbytes(word addr, char* str, byte len) {
  if (updptr >= VBUFSIZE-4-len) cflushnow();
  updbuf[updptr++] = (addr >> 8) | NT_UPD_HORZ;
  updbuf[updptr++] = addr & 0xff;
  updbuf[updptr++] = len;
  while (len--) {
    	updbuf[updptr++] = *str++;
  }
  cendbuf();
}

void putstring(byte x, byte y, char* str) {
  putbytes(getntaddr(x,y), str, strlen(str));
}

void clrscr() {
  updptr = 0;
  cendbuf();
  ppu_off();
  vram_adr(0x2000);
  vram_fill(BLANK, 0x800);
  vram_adr(0x0);
  ppu_on_all();
}

/// METASPRITES

#define DEF_METASPRITE_4x4(name,code,pal)\
const unsigned char name[]={\
        0,      0,      (code)+0,   pal, \
        8,      0,      (code)+1,   pal, \
        0,      8,      (code)+2,   pal, \
        8,      8,      (code)+3,   pal, \
        128};

#define DEF_METASPRITE_4x4_FLIP(name,code,pal)\
const unsigned char name[]={\
        8,      0,      (code)+0,   (pal)|OAM_FLIP_H, \
        0,      0,      (code)+1,   (pal)|OAM_FLIP_H, \
        8,      8,      (code)+2,   (pal)|OAM_FLIP_H, \
        0,      8,      (code)+3,   (pal)|OAM_FLIP_H, \
        128};

DEF_METASPRITE_4x4(playerRStand, 0xd8, 0);
DEF_METASPRITE_4x4(playerRRun1, 0xdc, 0);
DEF_METASPRITE_4x4(playerRRun2, 0xe0, 0);
DEF_METASPRITE_4x4(playerRRun3, 0xe4, 0);
DEF_METASPRITE_4x4(playerRJump, 0xe8, 0);
DEF_METASPRITE_4x4(playerRClimb, 0xec, 0);
DEF_METASPRITE_4x4(playerRSad, 0xf0, 0);

DEF_METASPRITE_4x4_FLIP(playerLStand, 0xd8, 0);
DEF_METASPRITE_4x4_FLIP(playerLRun1, 0xdc, 0);
DEF_METASPRITE_4x4_FLIP(playerLRun2, 0xe0, 0);
DEF_METASPRITE_4x4_FLIP(playerLRun3, 0xe4, 0);
DEF_METASPRITE_4x4_FLIP(playerLJump, 0xe8, 0);
DEF_METASPRITE_4x4_FLIP(playerLClimb, 0xec, 0);
DEF_METASPRITE_4x4_FLIP(playerLSad, 0xf0, 0);

const unsigned char* const playerRunSeq[16] = {
  playerLRun1, playerLRun2, playerLRun3, 
  playerLRun1, playerLRun2, playerLRun3, 
  playerLRun1, playerLRun2,
  playerRRun1, playerRRun2, playerRRun3, 
  playerRRun1, playerRRun2, playerRRun3, 
  playerRRun1, playerRRun2,
};

/// GAME LOGIC

typedef struct Level {
  byte ypos;
  byte height; // TODO: why does bitmask not work?
  int gap:4;
  int ladder1:4;
  int ladder2:4;
  int objtype:4;
  int objpos:4;
} Level;

#define MAX_LEVELS 32
#define GAPSIZE 4

Level levels[MAX_LEVELS];

bool is_in_gap(byte x, byte gap) {
  if (gap) {
    byte x1 = gap*16 + 4;
    return (x > x1 && x < x1+GAPSIZE*8-4);
  } else {
    return false;
  }
}

bool ladder_in_gap(byte x, byte gap) {
  return gap && x >= gap && x < gap+GAPSIZE*2;
}

void make_levels() {
  byte i;
  byte y = BOTTOM_LEVEL_Y;
  Level* prevlev = &levels[0];
  for (i=0; i<MAX_LEVELS; i++) {
    Level* lev = &levels[i];
    lev->height = rndint(2,5)*2;
    do {
      lev->gap = i>0 ? rndint(0,13) : 0;
    } while (ladder_in_gap(prevlev->ladder1, lev->gap) || 
             ladder_in_gap(prevlev->ladder2, lev->gap));
    do {
      lev->ladder1 = rndint(1,14);
      lev->ladder2 = rndint(1,14);
    } while (ladder_in_gap(lev->ladder1, lev->gap) || 
             ladder_in_gap(lev->ladder2, lev->gap));
    lev->objtype = rndint(1,3);
    do {
      lev->objpos = rndint(1,14);
    } while (ladder_in_gap(lev->objpos, lev->gap));
    lev->ypos = y;
    y += lev->height;
    prevlev = lev;
  }
  // top level is special
  levels[MAX_LEVELS-1].height = 15;
  levels[MAX_LEVELS-1].gap = 0;
  levels[MAX_LEVELS-1].ladder1 = 0;
  levels[MAX_LEVELS-1].ladder2 = 0;
  levels[MAX_LEVELS-1].objtype = 0;
}

// vertical scroll amount in pixels
static int scroll_pixel_yy = 0;
// vertical scroll amount in tiles
static byte scroll_tile_y = 0;

// last screen Y position of player sprite
static byte player_screen_y = 0;

void create_actors_on_level(byte i);

// TODO: crashes when drawing top floor
void draw_level_line(byte screen_y) {
  char buf[COLS];
  char attrs[8];
  byte level, i;
  byte y = screen_y;
  byte rowy;
  word addr;
  for (level=0; level<MAX_LEVELS; level++) {
    Level* lev = &levels[level];
    byte dy = y - lev->ypos;
    // is this level visible on-screen?
    if (dy < lev->height) {
      if (dy <= 1) {
        // draw floor
        for (i=0; i<COLS; i+=2) {
          if (dy) {
            buf[i] = CH_FLOOR;
            buf[i+1] = CH_FLOOR+1;
          } else {
            buf[i] = CH_FLOOR+2;
            buf[i+1] = CH_FLOOR+3;
          }
        }
        // draw the gap
	if (lev->gap)
          memset(buf+lev->gap*2, 0, GAPSIZE);
      } else {
        // draw empty space
        memset(buf, 0, sizeof(buf));
        // draw walls
        if (level < MAX_LEVELS-1) {
          buf[0] = CH_FLOOR+1;
          buf[COLS-1] = CH_FLOOR;
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
        byte ch = lev->objtype*4 + CH_FRUIT - 4;
        if (dy == 2) {
          buf[lev->objpos*2] = ch+2;
          buf[lev->objpos*2+1] = ch+3;
        }
        else if (dy == 3) {
          buf[lev->objpos*2] = ch+0;
          buf[lev->objpos*2+1] = ch+1;
        }
      }
      // compute row in name buffer and address
      rowy = (ROWS-1) - (screen_y%60);
      addr = getntaddr(1, rowy);
      // copy attribute table (every 4th row)
      if ((addr & 0x60) == 0) {
        byte a;
        if (dy==1)
          a = 0x05;
        else if (dy==3)
          a = 0x50;
        else
          a = 0x00;
        memset(attrs, a, 8);
        // TODO: this misses one row at the end?
        putbytes(nt2attraddr(addr), attrs, 8);
      }
      // copy line to screen buffer
      putbytes(addr, buf, COLS);
      // create actors on this level, if needed
      // TODO: maybe this happens too early?
      if (dy == 0 && level > 0) {
        create_actors_on_level(level);
      }
      break;
    }
  }
}

void draw_screen() {
  byte y;
  for (y=0; y<ROWS; y++) {
    draw_level_line(y);
  }
}

word get_floor_yy(byte level) {
  return levels[level].ypos * 8 + 16;
}

word get_ceiling_yy(byte level) {
  return (levels[level].ypos + levels[level].height) * 8 + 16;
}

void set_scroll_pixel_yy(int yy) {
  if ((yy & 7) == 0) {
    // draw an offscreen line
    // TODO: doesn't work when going downward
    draw_level_line(scroll_tile_y+30);
  }
  scroll_pixel_yy = yy;
  scroll_tile_y = yy >> 3; // divide by 8
  scroll(0, 479 - ((yy + 224) % 480));
}

void refresh_level(byte level) {
  byte y = levels[level].ypos;
  draw_level_line(y+2);
  draw_level_line(y+3);
}

// ACTORS

#define MAX_ACTORS 5

typedef enum ActorState {
  INACTIVE, STANDING, WALKING, CLIMBING, JUMPING, FALLING
};

typedef struct Actor {
  word yy;
  byte x;
  byte name;
  int color1:4;
  int color2:4;
  byte level;
  int state:4;
  int dir:1;
  int onscreen:1;
  union {
    struct {
      sbyte yvel;
      sbyte xvel;
    } jumping;
  } u;
} Actor;

Actor actors[MAX_ACTORS];

void create_actors_on_level(byte level_index) {
  byte actor_index = (level_index % (MAX_ACTORS-1)) + 1;
  struct Actor* a = &actors[actor_index];
  if (!a->onscreen) {
    Level *level = &levels[level_index];
    a->state = STANDING;
    a->color1 = level->ladder1;
    a->color2 = level->ladder2;
    a->name = 0;
    a->x = level->ladder1 ^ (level->ladder2<<3) ^ (level->gap<<6);
    a->yy = get_floor_yy(level_index);
    a->level = level_index;
    a->onscreen = 1;
  }
}

byte draw_actor(byte oam_id, byte i) {
  struct Actor* a = &actors[i];
  bool dir = a->dir;
  const unsigned char* meta;
  byte x,y; // sprite variables
  int screen_y = SCREEN_Y_BOTTOM - a->yy + scroll_pixel_yy;
  if (screen_y > 192+8 || screen_y < -18) {
    a->onscreen = 0;
    return oam_id; // offscreen vertically
  }
  switch (a->state) {
    case INACTIVE:
      a->onscreen = 0;
      return oam_id; // inactive, offscreen
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
  }
  // set sprite values
  x = a->x;
  y = screen_y;
  oam_id = oam_meta_spr(x, y, oam_id, meta);
  // actor 0 is player sprite
  if (i == 0) {
    player_screen_y = y; // last screen Y position
    // set special palette for player sprites
    OAMBUF[0+2] |= 3;
    OAMBUF[4+2] |= 3;
    OAMBUF[8+2] |= 3;
    OAMBUF[12+2] |= 3;
  }
  a->onscreen = 1;
  return oam_id;
}

void refresh_actors() {
  byte i;
  byte oam_id = 0;
  for (i=0; i<MAX_ACTORS; i++)
    oam_id = draw_actor(oam_id, i);
  oam_hide_rest(oam_id);
}

void refresh_screen() {
  ppu_wait_frame();
  draw_screen();
  refresh_actors();
}

byte is_ladder_close(byte actor_x, byte ladder_pos) {
  byte ladder_x;
  if (ladder_pos == 0)
    return 0;
  ladder_x = ladder_pos * 16;
  return ((byte)(actor_x - ladder_x) < 16) ? ladder_x : 0;
}

byte get_closest_ladder(byte player_x, byte level_index) {
  Level* level = &levels[level_index];
  byte x;
  if (level_index >= MAX_LEVELS) return 0;
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
  if (player_screen_y < ACTOR_SCROLL_UP_Y) {
    set_scroll_pixel_yy(scroll_pixel_yy + 1);
  }
}

void check_scroll_down() {
  if (player_screen_y > ACTOR_SCROLL_DOWN_Y && scroll_pixel_yy > 0) {
    set_scroll_pixel_yy(scroll_pixel_yy - 1);
  }
}

void fall_down(struct Actor* actor) {
  actor->level--;
  actor->state = FALLING;
  actor->u.jumping.xvel = 0;
  actor->u.jumping.yvel = 0;
}

void move_actor(struct Actor* actor, byte joystick, bool scroll) {
  switch (actor->state) {
      
    case STANDING:
    case WALKING:
      // left/right has priority over climbing
      if (joystick & PAD_A) {
        actor->state = JUMPING;
        actor->u.jumping.xvel = 0;
        actor->u.jumping.yvel = JUMP_VELOCITY;
        if (joystick & PAD_LEFT) actor->u.jumping.xvel = -1;
        if (joystick & PAD_RIGHT) actor->u.jumping.xvel = 1;
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
        mount_ladder(actor, -1); // state -> CLIMBING, level -= 1
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
      	if (actor->yy >= get_ceiling_yy(actor->level)) {
          actor->level++;
          actor->state = STANDING;
        } else {
          actor->yy++;
        }
      } else if (joystick & PAD_DOWN) {
        if (actor->yy <= get_floor_yy(actor->level)) {
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
      actor->x += actor->u.jumping.xvel;
      actor->yy += actor->u.jumping.yvel/4;
      actor->u.jumping.yvel -= 1;
      if (actor->yy <= get_floor_yy(actor->level)) {
	actor->yy = get_floor_yy(actor->level);
        actor->state = STANDING;
      }
      break;
  }
  // don't allow player to travel past left/right edges of screen
  if (actor->x == 0) actor->x = 255; // we wrapped around right edge
  if (actor->x < ACTOR_MIN_X) actor->x = ACTOR_MIN_X;
  // if player lands in a gap, they fall (switch to JUMPING state)
  if (actor->state <= WALKING && 
      is_in_gap(actor->x, levels[actor->level].gap)) {
    fall_down(actor);
  }
}

void pickup_object(Actor* actor) {
  Level* level = &levels[actor->level];
  byte objtype = level->objtype;
  if (objtype && actor->state <= WALKING) {
    byte objx = level->objpos * 16;
    if (actor->x >= objx && actor->x < objx+16) {
      level->objtype = 0;
      refresh_level(actor->level);
    }
  }
}

void move_player() {
  byte joy = pad_poll(0);
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
        iabs(a->yy - b->yy) < 8 && 
        iabs(a->x - b->x) < 8) {
      return true;
    }
  }
  return false;
}

///

void draw_blimp(struct cvu_sprite* sprite) {
  sprite=sprite;
  /* TODO
  sprite->name = 48;
  wait_vsync();
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
  */
  refresh_actors();
}

void blimp_pickup_scene() {
  /* TODO
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
  actors[0].state = STANDING;
  actors[0].color1 = 0xf;
  actors[0].color2 = 0xb;
  actors[0].name = 0;
  actors[0].x = 64;
  actors[0].yy = get_floor_yy(0);
  actors[0].level = 0;
  
  set_scroll_pixel_yy(0);
  create_actors_on_level(2);
  refresh_screen();
  
  while (actors[0].level != MAX_LEVELS-1) {
    //set_scroll_pixel_yy(scroll_pixel_yy+1);
    cflushnow();
    refresh_actors();
    move_player();
    // move all the actors
    for (i=1; i<MAX_ACTORS; i++) {
      move_actor(&actors[i], rand8(), false);
    }
    // see if the player hit another actor
    // test sprite 0 collision flag
    if (PPU.status & 0x40) {
      if (actors[0].level > BOTTOM_LEVEL_Y 
        && check_collision(&actors[0])) {
        fall_down(&actors[0]);
      }
    }
  }
  
  blimp_pickup_scene();
}

const char PALETTE[32] = {
  0x0f,

  0x11,0x24,0x3c, 0,
  0x01,0x15,0x25, 0,
  0x01,0x10,0x20, 0,
  0x06,0x16,0x26, 0,

  0x11,0x24,0x3c, 0,
  0x01,0x15,0x25, 0,
  0x31,0x35,0x3c, 0,
  0x01,0x17,0x30
};

void setup_graphics() {
  ppu_off();
  vram_adr(0x0);
  vram_write((unsigned char*)TILESET, sizeof(TILESET));
  pal_all(PALETTE);
  clrscr();
  set_vram_update(updbuf);
}

void main() {
  while (1) {
    setup_graphics();
    make_levels();
    play_scene();
  }
}
