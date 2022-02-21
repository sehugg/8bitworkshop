
/*
Demonstration game.
For more information, see "Making Games for the NES".
*/

#include <stdlib.h>
#include <string.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"
//#link "common.c"

// for SMS
//#link "fonts.s"

#define XOFS 12 // sprite horiz. offset

#define BGCOL CV_COLOR_BLUE

#define CH_BORDER 64
#define CH_FLOOR 65
#define CH_LADDER 66

const byte char_table[8][8] = {
  /*{w:8,h:8,brev:1,count:8}*/ 
  {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF},
  {0xFF,0xBF,0xBF,0x00,0xFF,0xFB,0xFB,0x00},
  {0x81,0xFF,0x81,0x81,0x81,0xFF,0x81,0x81},
  {0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00},
  {0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00},
  {0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00},
  {0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00},
  {0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00},
};

const byte static_sprite_table[2][16*2] = {
  /*{w:16,h:16,brev:1,remap:[4,0,1,2,3,5,6,7,8,9],count:2}*/ 
  {
  0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x02, 0x3F,
  0x35, 0x2A, 0x20, 0x20, 0x20, 0x20, 0x20, 0x3F,
  0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0x40, 0xFC,
  0x54, 0xAC, 0x04, 0x04, 0x04, 0x04, 0x04, 0xFC,
  },{
  0x00, 0x19, 0x1F, 0x0A, 0x05, 0x07, 0x0E, 0x1C,
  0x3A, 0x2A, 0x3C, 0x2E, 0x1E, 0x18, 0x0E, 0x07,
  0x00, 0x80, 0x00, 0x00, 0x00, 0xC0, 0xF0, 0x38,
  0xFC, 0xF4, 0x7C, 0xB4, 0xB8, 0x68, 0xF0, 0xE0,
  }
};

const byte blimp_sprite_table[4][16*2] = {
  /*{w:16,h:16,remap:[-5,0,1,2,3,5,6,7,8,9],count:4}*/ 
  {
  0x00, 0x01, 0x03, 0xE7, 0xFF, 0xFE, 0xFE, 0xFE,
  0xFE, 0xFF, 0xE7, 0x03, 0x01, 0x00, 0x00, 0x00,
  0xF0, 0xE0, 0xC0, 0x80, 0xC0, 0x20, 0xFF, 0xFF,
  0x20, 0xC0, 0x80, 0xC0, 0xE0, 0xF0, 0x00, 0x00,
  },{
  0xFC, 0xFF, 0xFF, 0xF6, 0xF5, 0xF5, 0xF6, 0xF5,
  0xF5, 0x86, 0xFF, 0xFF, 0xFF, 0xFC, 0x40, 0x80,
  0x00, 0xE0, 0xFE, 0x3F, 0xBF, 0xBF, 0x3F, 0xBF,
  0xBF, 0x3F, 0xFF, 0xFE, 0xE0, 0x11, 0x0E, 0x01,
  },{
  0x00, 0x1F, 0xFF, 0xF8, 0xF6, 0xF6, 0xF8, 0xFE,
  0xFE, 0xFE, 0xFF, 0xFF, 0x1F, 0x00, 0x00, 0x00,
  0xFF, 0xFF, 0xFF, 0xBA, 0x92, 0xAA, 0xAA, 0xBA,
  0xBA, 0xBA, 0xFF, 0xFF, 0xFF, 0xFF, 0x08, 0x07,
  },{
  0x00, 0x00, 0x00, 0x00, 0x03, 0x07, 0x07, 0x7F,
  0x07, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x07, 0x7F, 0xFF, 0xFF, 0xFF, 0xFF,
  0xFF, 0xFF, 0x7F, 0x07, 0x00, 0x00, 0x00, 0x00,
  }
};

#define NUM_SPRITE_PATTERNS 5
#define NUM_SPRITE_STATES 4

const byte sprite_table[NUM_SPRITE_PATTERNS*2][16*2] = {
  /*{w:16,h:16,remap:[-5,0,1,2,3,5,6,7,8,9],count:5,np:2}*/ 
  { // first plane
  0x03, 0x07, 0x07, 0x07, 0x03, 0x00, 0x0F, 0x0F,
  0x0F, 0x07, 0x07, 0x07, 0x0F, 0x0F, 0x02, 0x00,
  0xC0, 0xA0, 0xA0, 0xA0, 0xC0, 0x00, 0x80, 0x80,
  0xF0, 0xE0, 0x80, 0x80, 0x80, 0x00, 0x00, 0x00,
  },{
  0x03, 0x07, 0x07, 0x07, 0x02, 0x04, 0x0C, 0x1C,
  0x1C, 0x14, 0x07, 0x06, 0x0E, 0x0E, 0x00, 0x00,
  0xC0, 0xE0, 0xEC, 0xEC, 0x4C, 0x38, 0x30, 0x20,
  0x20, 0x20, 0xF0, 0x70, 0x00, 0x00, 0x00, 0x00,
  },{
  0x03, 0x07, 0x07, 0x07, 0x03, 0x00, 0x0F, 0x0F,
  0x0F, 0x07, 0x07, 0x0F, 0x0F, 0x0C, 0x0C, 0x00,
  0xC0, 0xA0, 0xA0, 0xA0, 0xC0, 0x00, 0x98, 0xF8,
  0xF0, 0x80, 0x80, 0xE0, 0xF0, 0x00, 0x00, 0x00,
  },{
  0x03, 0x04, 0x06, 0x06, 0x43, 0x60, 0x3F, 0x1C,
  0x05, 0x04, 0x07, 0x0F, 0x1C, 0x00, 0x00, 0x00,
  0xC0, 0x20, 0x60, 0x60, 0xC0, 0x02, 0xE6, 0x3C,
  0xB8, 0x20, 0xE0, 0xE0, 0x70, 0x00, 0x00, 0x00,
  },{
  0x03, 0x07, 0x07, 0x07, 0x03, 0x00, 0x0F, 0x0F,
  0x0F, 0x47, 0x47, 0x0F, 0x1F, 0x19, 0x00, 0x00,
  0xC0, 0xA0, 0xA0, 0xA0, 0xC0, 0x00, 0x98, 0xB0,
  0xE0, 0x80, 0x80, 0x80, 0x80, 0xC0, 0x00, 0x00,
  },{ // second plane
  0x00, 0x00, 0x00, 0x00, 0x00, 0x37, 0x30, 0x30, 
  0x30, 0x30, 0x00, 0x00, 0x00, 0x00, 0x0D, 0x0D, 
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0xC0, 
  },{
  0x00, 0x00, 0x00, 0x00, 0x01, 0x03, 0x03, 0x03, 
  0x03, 0x03, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x1C, 
  0x00, 0x00, 0x00, 0x00, 0x80, 0xC0, 0xC0, 0xC0, 
  0xC0, 0xC0, 0x00, 0x00, 0x30, 0x38, 0x00, 0x00, 
  },{
  0x00, 0x00, 0x00, 0x00, 0x00, 0x37, 0x30, 0x30, 
  0x30, 0x30, 0x00, 0x00, 0x00, 0x30, 0x30, 0x20, 
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
  0x00, 0x00, 0x00, 0x00, 0x00, 0x30, 0x38, 0x00, 
  },{
  0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x00, 0x03, 
  0x02, 0x03, 0x00, 0x00, 0x00, 0x18, 0x38, 0x00, 
  0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0x00, 0xC0, 
  0x40, 0xC0, 0x00, 0x00, 0x00, 0x30, 0x38, 0x00, 
  },{
  0x00, 0x00, 0x00, 0x00, 0x00, 0x37, 0x30, 0x30, 
  0x30, 0x30, 0x00, 0x00, 0x00, 0x00, 0x19, 0x0C, 
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xC0, 0xE0, 
  }
};

///

typedef struct Level {
  byte ypos;
  byte height; // TODO: why does bitmask not work?
  byte gap:4;
  byte ladder1:4;
  byte ladder2:4;
  byte objtype:4;
  byte objpos:4;
} Level;

#define MAX_LEVELS 32
#define GAPSIZE 3

Level levels[MAX_LEVELS];

bool is_in_gap(byte x, byte gap) {
  if (gap) {
    byte x1 = gap*16 + 26 - XOFS;
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
  byte y=0;
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
    lev->objtype = rndint(1,2);
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

static byte scroll_y = 0;

void create_actors_on_level(byte i);

void draw_level_line(byte screen_y) {
  char buf[COLS];
  byte i;
  byte y = screen_y + scroll_y;
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
        if (lev->ladder1)
          buf[lev->ladder1*2] = CH_LADDER;
        if (lev->ladder2)
          buf[lev->ladder2*2] = CH_LADDER;
      }
//buf[0] = i+'a';buf[1] = y;buf[2] = dy+'0';buf[3] = lev->ypos;buf[4] = lev->height+'0';
      // draw object, if it exists
      if (lev->objtype) {
        byte ch = lev->objtype*4+128-4;
        if (dy == 1) {
          buf[lev->objpos*2] = ch+1;
          buf[lev->objpos*2+1] = ch+3;
        }
        else if (dy == 2) {
          buf[lev->objpos*2] = ch;
          buf[lev->objpos*2+1] = ch+2;
        }
      }
      // copy line to screen buffer
      cvu_memtovmemcpy(IMAGE + COLS*(ROWS-1) - COLS*screen_y, buf, COLS);
      // create actors on this level, if needed
      // (only when drawing top and bottom of screen)
      if (screen_y == 0 || screen_y == ROWS-1)
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

#define MAX_ACTORS 5

typedef enum ActorState {
  INACTIVE, WALKING, CLIMBING, JUMPING, FALLING
};

typedef struct Actor {
  word yy;
  byte x;
  byte name;
  byte color1:4;
  byte color2:4;
  byte level;
  byte state:4;
  byte dir:1;
  byte onscreen:1;
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
    a->state = WALKING;
    a->color1 = level->ladder1;
    a->color2 = level->ladder2;
    a->name = 0;
    a->x = level->ladder1 ^ (level->ladder2<<3) ^ (level->gap<<6);
    a->yy = get_floor_yy(level_index);
    a->level = level_index;
  }
}

void draw_actor(byte i) {
  struct Actor* a = &actors[i];
  struct cvu_sprite sprite;
  int screen_y = 175 - a->yy + scroll_y*8;
  if (screen_y > 192+8 || screen_y < -18) {
    a->onscreen = 0;
    return; // offscreen vertically
  }
  sprite.name = a->name + (a->state - WALKING)*4;
  switch (a->state) {
    case INACTIVE:
      a->onscreen = 0;
      return; // inactive, offscreen
    case WALKING:
      sprite.name += (a->x & 4) ? NUM_SPRITE_STATES*4 : 0;
    case JUMPING:
    case FALLING:
      sprite.name += a->dir ? 16*4 : 0;
      break;
    case CLIMBING:
      sprite.name += (a->yy & 4) ? 16*4 : 0;
      break;
  }
  sprite.x = a->x;
  sprite.y = screen_y;
  sprite.tag = a->color1 | 0x80;
  if (sprite.x >= 255-XOFS) {
    sprite.tag &= ~0x80;
    sprite.x -= 32-XOFS;
  } else {
    sprite.x += XOFS;
  }
  cvu_set_sprite(SPRITES, i*2, &sprite);
  sprite.name += NUM_SPRITE_PATTERNS*4;
  sprite.tag ^= a->color1 ^ a->color2;
  cvu_set_sprite(SPRITES, i*2+1, &sprite);
  a->onscreen = 1;
}

void refresh_actors() {
  byte i;
  for (i=0; i<MAX_ACTORS; i++)
    draw_actor(i);
}

void refresh_screen() {
  wait_vsync();
  draw_screen();
  refresh_actors();
}

byte is_ladder_close(byte actor_x, byte ladder_pos) {
  byte ladder_x;
  if (ladder_pos == 0)
    return 0;
  ladder_x = ladder_pos * 16 + 21 - XOFS;
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
  byte player_screen_y = cvu_vinb(SPRITES + 0); // sprite Y pos
  if (player_screen_y < 192/2-4) {
    scroll_y++;
    refresh_screen();
    check_scroll_up();
  }
}

void check_scroll_down() {
  byte player_screen_y = cvu_vinb(SPRITES + 0); // sprite Y pos
  if (player_screen_y > 192/2+4 && scroll_y > 0) {
    scroll_y--;
    refresh_screen();
    check_scroll_down();
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
      
    case WALKING:
      // left/right has priority over climbing
      if (joystick & CV_FIRE_0) {
        actor->state = JUMPING;
        actor->u.jumping.xvel = 0;
        actor->u.jumping.yvel = 15;
        if (joystick & CV_LEFT) actor->u.jumping.xvel = -1;
        if (joystick & CV_RIGHT) actor->u.jumping.xvel = 1;
      } else if (joystick & CV_LEFT) {
        actor->x--;
        actor->dir = 1;
      } else if (joystick & CV_RIGHT) {
        actor->x++;
        actor->dir = 0;
      } else if (joystick & CV_UP) {
        mount_ladder(actor, 0); // state -> CLIMBING
        if (scroll) check_scroll_up();
      } else if (joystick & CV_DOWN) {
        mount_ladder(actor, -1); // state -> CLIMBING, level -= 1
        if (scroll) check_scroll_down();
      }
      break;
      
    case CLIMBING:
      if (joystick & CV_UP) {
      	if (actor->yy >= get_ceiling_yy(actor->level)) {
          actor->level++;
          actor->state = WALKING;
          if (scroll) check_scroll_up();
        } else {
          actor->yy++;
        }
      } else if (joystick & CV_DOWN) {
        if (actor->yy <= get_floor_yy(actor->level)) {
          actor->state = WALKING;
          if (scroll) check_scroll_down();
        } else {
          actor->yy--;
        }
      }
      break;
      
    case JUMPING:
    case FALLING:
      actor->x += actor->u.jumping.xvel;
      actor->yy += actor->u.jumping.yvel/4;
      actor->u.jumping.yvel -= 1;
      if (actor->yy <= get_floor_yy(actor->level)) {
	actor->yy = get_floor_yy(actor->level);
        actor->state = WALKING;
        if (scroll) check_scroll_down();
      }
      break;
  }
  // don't allow player to travel past left/right edges of screen
  if (actor->x == 0) actor->x = 255; // we wrapped around right edge
  if (actor->x < 24) actor->x = 24;
  // if player lands in a gap, they fall (switch to JUMPING state)
  if (actor->state == WALKING && 
      is_in_gap(actor->x, levels[actor->level].gap)) {
    fall_down(actor);
  }
}

void pickup_object(Actor* actor) {
  Level* level = &levels[actor->level];
  byte objtype = level->objtype;
  if (objtype && actor->state == WALKING) {
    byte objx = level->objpos * 16 + 24 - XOFS;
    if (actor->x >= objx && actor->x < objx+16) {
      level->objtype = 0;
      refresh_screen();
    }
  }
}

void move_player() {
  struct cv_controller_state ctrl;
  cv_get_controller_state(&ctrl, 0);
  move_actor(&actors[0], ctrl.joystick, true);
  pickup_object(&actors[0]);
}

inline byte iabs(int x) {
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

void preview_stage() {
  scroll_y = levels[MAX_LEVELS-1].ypos;
  while (scroll_y > 0) {
    wait_vsync();
    refresh_screen();
    refresh_actors();
    scroll_y--;
  }
}

void draw_blimp(struct cvu_sprite* sprite) {
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
  refresh_actors();
}

void blimp_pickup_scene() {
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
}

void play_scene() {
  byte i;
  
  memset(actors, 0, sizeof(actors));
  actors[0].state = WALKING;
  actors[0].color1 = 0xf;
  actors[0].color2 = 0xb;
  actors[0].name = 0;
  actors[0].x = 64;
  actors[0].yy = 8;
  actors[0].level = 0;
  
  create_actors_on_level(2);
  refresh_screen();
  
  while (actors[0].level != MAX_LEVELS-1) {
    wait_vsync();
    refresh_actors();
    move_player();
    // move all the actors
    for (i=1; i<MAX_ACTORS; i++) {
      move_actor(&actors[i], rand(), false);
    }
    // see if the player hit another actor
    if (cv_get_sprite_collission()) {
      if (actors[0].level > 0 && check_collision(&actors[0])) {
        fall_down(&actors[0]);
      }
    }
  }
  
  blimp_pickup_scene();
}

void setup_graphics() {
#ifndef CV_MSX
  cvu_memtovmemcpy(PATTERN, (void *)(font_bitmap_0 - '0'*8), 0x800);
#endif
  cvu_memtovmemcpy(PATTERN+8*64, char_table, sizeof(char_table));
  cvu_memtovmemcpy(PATTERN+8*128, static_sprite_table, sizeof(static_sprite_table));

#ifndef CV_MSX
  cvu_vmemset(COLOR, 0x30|BGCOL, 8); // set color for chars 0-63
  cvu_vmemset(COLOR+8, 0x0|BGCOL, 32-8); // set chars 63-255
  cvu_vmemset(COLOR+16, 0xb0|BGCOL, 1); // set chars 128-128+8
#endif

  cvu_memtovmemcpy(SPRITE_PATTERNS, sprite_table, sizeof(sprite_table));
  flip_sprite_patterns(SPRITE_PATTERNS + 512, (const byte*)sprite_table, sizeof(sprite_table));
  flip_sprite_patterns(SPRITE_PATTERNS + 384, (const byte*)blimp_sprite_table, sizeof(blimp_sprite_table));
}

void main() {
  vdp_setup();
  setup_graphics();
  cv_set_screen_active(true);
  cv_set_vint_handler(&vint_handler);  
  make_levels();
  play_scene();
}
