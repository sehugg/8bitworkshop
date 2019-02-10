
#include <stdlib.h>
#include <string.h>

#include "neslib.h"

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;
typedef enum { false, true} bool;

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
#define BOTTOM_LEVEL_Y 1

#define BGCOL CV_COLOR_BLUE

#define CH_BORDER 64
#define CH_FLOOR 127
#define CH_LADDER 212
#define CH_FRUIT 204
#define BLANK 32

byte rndint(byte a, byte b) {
  return (rand8() % (b-a)) + a;
}

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

void putchar(byte x, byte y, char ch) {
  word addr = getntaddr(x,y);
  if (updptr >= VBUFSIZE-4) cflushnow();
  updbuf[updptr++] = addr >> 8;
  updbuf[updptr++] = addr & 0xff;
  updbuf[updptr++] = ch;
  cendbuf();
}

void putbytes(byte x, byte y, char* str, byte len) {
  word addr = getntaddr(x,y);
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
  putbytes(x, y, str, strlen(str));
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

const unsigned char playerStand[]={
        0,      0,      0xd8,   0,
        8,      0,      0xd9,   0,
        0,      8,      0xda,   0,
        8,      8,      0xdb,   0,
        128
};

const unsigned char playerRun1[]={
        0,      0,      0xdc,   0,
        8,      0,      0xdd,   0,
        0,      8,      0xde,   0,
        8,      8,      0xdf,   0,
        128
};

const unsigned char playerRun2[]={
        0,      0,      0xe0,   0,
        8,      0,      0xe1,   0,
        0,      8,      0xe2,   0,
        8,      8,      0xe3,   0,
        128
};

const unsigned char playerRun3[]={
        0,      0,      0xe4,   0,
        8,      0,      0xe5,   0,
        0,      8,      0xe6,   0,
        8,      8,      0xe7,   0,
        128
};

const unsigned char playerJump[]={
        0,      0,      0xe8,   0,
        8,      0,      0xe9,   0,
        0,      8,      0xea,   0,
        8,      8,      0xeb,   0,
        128
};

const unsigned char playerClimb[]={
        0,      0,      0xec,   0,
        8,      0,      0xed,   0,
        0,      8,      0xee,   0,
        8,      8,      0xef,   0,
        128
};

const unsigned char playerSad[]={
        0,      0,      0xf0,   0,
        8,      0,      0xf1,   0,
        0,      8,      0xf2,   0,
        8,      8,      0xf3,   0,
        128
};

const unsigned char* playerRunSeq[8] = {
  playerRun1, playerRun2, playerRun3, 
  playerRun1, playerRun2, playerRun3, 
  playerRun1, playerRun2,
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
#define GAPSIZE 3

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
    lev->height = rndint(4,7);
    lev->ladder1 = rndint(1,14);
    lev->ladder2 = rndint(1,14);
    do {
      lev->gap = i>0 ? rndint(0,13) : 0;
    } while (ladder_in_gap(prevlev->ladder1, lev->gap) || 
             ladder_in_gap(prevlev->ladder2, lev->gap));
    lev->objtype = rndint(1,3);
    lev->objpos = rndint(1,14);
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

void draw_level_line(byte screen_y) {
  char buf[COLS];
  byte i;
  byte y = screen_y; // + scroll_tile_y
  for (i=0; i<MAX_LEVELS; i++) {
    Level* lev = &levels[i];
    byte dy = y - lev->ypos;
    // is this level visible on-screen?
    if (dy < lev->height) {
      if (dy == 0) {
        // draw floor
        memset(buf, CH_FLOOR, COLS);
        // draw the gap
	if (lev->gap)
          memset(buf+lev->gap*2, 0, GAPSIZE);
      } else {
        // draw empty space
        memset(buf, 0, sizeof(buf));
        // draw walls
        if (i < MAX_LEVELS-1) {
          buf[0] = CH_FLOOR;
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
//buf[0] = i+'a';buf[1] = y;buf[2] = dy+'0';buf[3] = lev->ypos;buf[4] = lev->height+'0';
      // draw object, if it exists
      if (lev->objtype) {
        byte ch = lev->objtype*4 + CH_FRUIT - 4;
        if (dy == 1) {
          buf[lev->objpos*2] = ch+2;
          buf[lev->objpos*2+1] = ch+3;
        }
        else if (dy == 2) {
          buf[lev->objpos*2] = ch+0;
          buf[lev->objpos*2+1] = ch+1;
        }
      }
      // copy line to screen buffer
      putbytes(1, (ROWS-1)-(screen_y%60), buf, COLS);
      // create actors on this level, if needed
      // TODO: maybe this happens too early?
      if (dy == 0)
        create_actors_on_level(i);
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
  return levels[level].ypos * 8 + 8;
}

word get_ceiling_yy(byte level) {
  return (levels[level].ypos + levels[level].height) * 8 + 8;
}

void set_scroll_pixel_yy(int yy) {
  if ((yy & 7) == 0) {
    // draw an offscreen line
    draw_level_line(scroll_tile_y+30);
  }
  scroll_pixel_yy = yy;
  scroll_tile_y = yy >> 3; // divide by 8
  scroll(0, 479 - ((yy + 224) % 480));
}

void refresh_level(byte level) {
  byte y = levels[level].ypos;
  draw_level_line(y+2);
  draw_level_line(y+1);
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
  }
}

byte draw_actor(byte oam_id, byte i) {
  struct Actor* a = &actors[i];
  const unsigned char* meta = playerStand;
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
      meta = playerStand;
      break;
    case WALKING:
      meta = playerRunSeq[(a->x >> 1) & 7];
      break;
    case JUMPING:
      meta = playerJump;
      break;
    case FALLING:
      meta = playerSad;
      break;
    case CLIMBING:
      meta = playerClimb;
      break;
  }
  // set sprite values
  x = a->x;
  y = screen_y;
  /*
  tag = a->color1 | 0x80;
  */
  if (i == 0)
    player_screen_y = y;
  oam_id = oam_meta_spr(x, y, oam_id, meta);
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
        actor->u.jumping.yvel = 15;
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
      
    case JUMPING:
    case FALLING:
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
    //ppu_wait_frame();
    refresh_actors();
    move_player();
    // move all the actors
    for (i=1; i<MAX_ACTORS; i++) {
      move_actor(&actors[i], rand(), false);
    }
    // see if the player hit another actor
    /* TODO
    if (cv_get_sprite_collission()) {
      if (actors[0].level > BOTTOM_LEVEL_Y 
        && check_collision(&actors[0])) {
        fall_down(&actors[0]);
      }
    }
    */
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
  vram_adr(0x0);
  vram_write((unsigned char*)TILESET, sizeof(TILESET));
  pal_all(PALETTE);
  clrscr();
  set_vram_update(updbuf);
}

void main() {
  setup_graphics();
  make_levels();
  play_scene();
}
