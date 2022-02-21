
/*
Demonstration game.
For more information, see "Making Arcade Games in C".
*/

#include <stdlib.h>
#include <string.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"
//#link "common.c"

#include "stars.h"
//#link "stars.c"

// for SMS
//#link "fonts.s"

#define NSPRITES 16
#define NMISSILES 8
#define YOFFSCREEN 239

static byte pattern_table[8*2] = {
  /*{w:16,h:8,brev:1,remap:[-4,0,1,2]}*/
  0xCC, 0xF2, 0xD0, 0xFC, 0xF3, 0xE8, 0xC4, 0x03,
  0x0C, 0x13, 0x02, 0x0F, 0x33, 0x05, 0x08, 0x30,
};

static byte sprite_table[][16*2] = {
  /*{w:16,h:16,brev:1,remap:[4,0,1,2,3,5,6,7,8,9],count:15}*/ 
  {
  0x01, 0x03, 0x02, 0x01, 0x01, 0x01, 0x01, 0x01,
  0x03, 0x86, 0xCD, 0xBE, 0x9F, 0xB1, 0xC0, 0x80,
  0x80, 0xC0, 0x40, 0x80, 0x80, 0x80, 0x80, 0x80,
  0xC0, 0x61, 0xB3, 0x7D, 0xF9, 0x8D, 0x03, 0x01,
  },{
  0x00, 0x00, 0x01, 0x03, 0x05, 0x01, 0x01, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x80, 0xC0, 0xE0, 0xD0, 0xC0, 0xC0, 0x80,
  0xA0, 0x80, 0x40, 0x00, 0x00, 0x00, 0x40, 0x00,
  },{
  0x00, 0x00, 0x02, 0x03, 0x01, 0x01, 0x01, 0x01,
  0x03, 0x07, 0x07, 0x03, 0x03, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x40, 0xC0, 0x80, 0x80, 0x80, 0x80,
  0xC0, 0xE0, 0xE0, 0xC0, 0xC0, 0x80, 0x00, 0x00,
  },{
  0x00, 0x00, 0x00, 0x04, 0x08, 0x11, 0x04, 0x05,
  0x15, 0x24, 0x02, 0x00, 0x08, 0x30, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x08, 0xC4, 0x22, 0x08, 0xE8,
  0xEA, 0xC9, 0x10, 0x00, 0xC4, 0x03, 0x00, 0x00,
  },{
  0x00, 0x00, 0x08, 0x30, 0x01, 0x00, 0x08, 0x0A,
  0x00, 0x09, 0x04, 0x00, 0x10, 0x00, 0x40, 0x00,
  0x00, 0x00, 0x04, 0xC3, 0x20, 0x00, 0x04, 0x14,
  0x00, 0x24, 0x08, 0x00, 0x04, 0xC0, 0x01, 0x00,
  },{
  0x04, 0x10, 0x00, 0x22, 0x00, 0x00, 0x44, 0x02,
  0x00, 0x40, 0x02, 0x24, 0x00, 0x00, 0x48, 0x01,
  0x08, 0x42, 0x00, 0x11, 0x00, 0x80, 0x91, 0x20,
  0x00, 0x00, 0x21, 0x90, 0x82, 0x00, 0x08, 0x21,
  },{ // enemy ship rotations
  0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x13, 0x02,
  0x0F, 0x33, 0x05, 0x08, 0x30, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0xCC, 0xF2, 0xD0,
  0xFC, 0xF3, 0xE8, 0xC4, 0x03, 0x00, 0x00, 0x00,
  },{
  0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x1F,
  0x12, 0x13, 0x03, 0x02, 0x04, 0x18, 0x00, 0x00,
  0x00, 0x00, 0x70, 0x42, 0x4C, 0xF0, 0xBF, 0xF0,
  0xF8, 0xF8, 0xF8, 0xF0, 0x80, 0x80, 0x80, 0x00,
  },{
  0x00, 0x02, 0x04, 0x04, 0x03, 0x02, 0x07, 0x07,
  0x02, 0x03, 0x04, 0x04, 0x02, 0x00, 0x00, 0x00,
  0x48, 0x48, 0x90, 0xA0, 0xC0, 0xE0, 0xF0, 0xF0,
  0xE0, 0xC0, 0xA0, 0x90, 0x48, 0x48, 0x00, 0x00,
  },{
  0x02, 0x12, 0x0A, 0x0A, 0x27, 0x27, 0x3D, 0x07,
  0x07, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0xE0, 0xF0, 0xF0, 0xF0, 0xFE,
  0x60, 0xF0, 0x08, 0x04, 0xC4, 0x00, 0x00, 0x00,
  },{
  0x00, 0x00, 0x00, 0xC0, 0x23, 0x17, 0xCF, 0x3F,
  0x0B, 0x4F, 0x33, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x0C, 0x10, 0xA0, 0xCC, 0xF0,
  0x40, 0xC8, 0x30, 0x00, 0x00, 0x00, 0x00, 0x00,
  },{
  0x00, 0x01, 0x01, 0x01, 0x0F, 0x1F, 0x1F, 0x1F,
  0x0F, 0xFD, 0x0F, 0x32, 0x42, 0x0E, 0x00, 0x00,
  0x00, 0x00, 0x18, 0x20, 0x40, 0xC0, 0xC8, 0x48,
  0xF8, 0x80, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00,
  },{
  0x00, 0x00, 0x12, 0x12, 0x09, 0x05, 0x03, 0x07,
  0x0F, 0x0F, 0x07, 0x03, 0x05, 0x09, 0x12, 0x12,
  0x00, 0x00, 0x00, 0x40, 0x20, 0x20, 0xC0, 0x40,
  0xE0, 0xE0, 0x40, 0xC0, 0x20, 0x20, 0x40, 0x00,
  },{
  0x00, 0x00, 0x00, 0x23, 0x20, 0x10, 0x0F, 0x06,
  0x7F, 0x0F, 0x0F, 0x0F, 0x07, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x80, 0x80, 0x80, 0x80, 0xE0,
  0xE0, 0xBC, 0xE4, 0xE4, 0x50, 0x50, 0x48, 0x40,
  },{
  0x00, 0x00, 0x00, 0x00, 0x00, 0x0C, 0x13, 0x02,
  0x0F, 0x33, 0x05, 0x08, 0x30, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0xCC, 0xF2, 0xD0,
  0xFC, 0xF3, 0xE8, 0xC4, 0x03, 0x00, 0x00, 0x00,
  }
};  

#define SPRI_SHIP	(4*0)
#define SPRI_MISSILE	(4*1)
#define SPRI_BOMB	(4*2)
#define SPRI_EXPLODE	(4*3)
#define SPRI_ENEMY	(4*6)

#define COLOR_FORMATION		CV_COLOR_LIGHT_GREEN
#define COLOR_ATTACKER		CV_COLOR_LIGHT_RED
#define COLOR_PLAYER		CV_COLOR_LIGHT_YELLOW
#define COLOR_MISSILE		CV_COLOR_WHITE
#define COLOR_SCORE		CV_COLOR_LIGHT_BLUE
#define COLOR_EXPLOSION		CV_COLOR_RED

// GAME CODE

typedef struct {
  byte shape;
} FormationEnemy;

// should be power of 2 length
typedef struct {
  byte findex;
  byte shape;
  word x;
  word y;
  byte dir;
  byte returning;
} AttackingEnemy;

typedef struct {
  signed char dx;
  byte xpos;
  signed char dy;
  byte ypos;
} Missile;

#define ENEMIES_PER_ROW 8
#define ENEMY_ROWS 4
#define MAX_IN_FORMATION (ENEMIES_PER_ROW*ENEMY_ROWS)
#define MAX_ATTACKERS 6

FormationEnemy formation[MAX_IN_FORMATION];
AttackingEnemy attackers[MAX_ATTACKERS];
Missile missiles[NMISSILES];
struct cvu_sprite vsprites[NSPRITES];

byte formation_offset_x;
signed char formation_direction;
byte current_row;
byte player_x;
const byte player_y = 168;
byte player_exploding;
byte enemy_exploding;
byte enemies_left;
word player_score;
word framecount;

void copy_sprites() {
  byte i;
  word ofs;
  cvu_memtovmemcpy(SPRITES, vsprites, sizeof(vsprites));
  // copy all "shadow missiles" to video memory
  ofs = SPRITES + NSPRITES*4;
  for (i=0; i<NMISSILES; i++) {
    // sprite struct: {y, x, name, tag}
    cv_set_write_vram_address(ofs);
    cv_voutb(missiles[i].ypos);
    cv_voutb(missiles[i].xpos);
    ofs += 4;
  }
}

void add_score(word bcd) {
  player_score = bcd_add(player_score, bcd);
  draw_bcd_word(0, 0, player_score);
  putcharxy(4, 0, CHAR('0'));
}

void clrobjs() {
  byte i;
  word ofs;
  memset(vsprites, 0, sizeof(vsprites));
  for (i=0; i<NSPRITES; i++) {
    vsprites[i].y = YOFFSCREEN;
  }
  ofs = SPRITES + NSPRITES*4;
  for (i=0; i<NMISSILES; i++) {
    // sprite struct: {y, x, name, tag}
    cvu_voutb(i == 7 ? 4 : 8, ofs+2);
    cvu_voutb(CV_COLOR_WHITE, ofs+3);
    ofs += 4;
    missiles[i].ypos = YOFFSCREEN;
  }
}

void setup_formation() {
  byte i;
  memset(formation, 0, sizeof(formation));
  memset(attackers, 0, sizeof(attackers));
  for (i=0; i<MAX_IN_FORMATION; i++) {
    byte flagship = i < ENEMIES_PER_ROW;
    formation[i].shape = flagship ? 0x43 : 0x43;
  }
  enemies_left = MAX_IN_FORMATION;
}

#define BLANK 0

void draw_row(byte row) {
  byte i,j;
  byte x = formation_offset_x / 8;
  byte xd = (formation_offset_x & 7) * 3;
  byte y = 3 + row * 2;
  cv_set_write_vram_address(IMAGE + y*32);
  for (i=0; i<x; i++)
    cv_graphics_port = starfield_get_tile_xy(i,y);
  for (i=0; i<ENEMIES_PER_ROW; i++) {
    byte shape = formation[i + row*ENEMIES_PER_ROW].shape;
    if (shape) {
      shape += xd;
      for (j=0; j<3; j++) {
        cv_graphics_port = shape++;
        x++;
      }
    } else {
      for (j=0; j<3; j++) {
        cv_graphics_port = starfield_get_tile_xy(x,y);
        x++;
      }
    }
  }
  for (; x<COLS; x++)
    cv_graphics_port = starfield_get_tile_xy(x,y);
}

void draw_next_row() {
  draw_row(current_row);
  if (++current_row == ENEMY_ROWS) {
    current_row = 0;
    formation_offset_x += formation_direction;
    if (formation_offset_x == 71) {
      formation_direction = -1;
    }
    else if (formation_offset_x == 0) {
      formation_direction = 1;
    }
  }
}

const byte DIR_TO_CODE[32] = {
  16, 16,
  20, 20, 20, 20,
  24, 24, 24, 24,
  28, 28, 28, 28,
  0, 0, 0, 0,
  4, 4, 4, 4,
  8, 8, 8, 8,
  12, 12, 12, 12,
  16, 16,
};

const byte SINTBL[32] = {
  0, 25, 49, 71, 90, 106, 117, 125,
  127, 125, 117, 106, 90, 71, 49, 25,
  0, -25, -49, -71, -90, -106, -117, -125,
  -127, -125, -117, -106, -90, -71, -49, -25,
};

signed char isin(byte dir) {
  return SINTBL[dir & 31];
}

signed char icos(byte dir) {
  return isin(dir+8);
}

#define FORMATION_X0 0
#define FORMATION_Y0 19
#define FORMATION_XSPACE 24
#define FORMATION_YSPACE 16

byte get_attacker_x(byte formation_index) {
  byte column = (formation_index % ENEMIES_PER_ROW);
  return FORMATION_XSPACE*column + FORMATION_X0 + formation_offset_x;
}

byte get_attacker_y(byte formation_index) {
  byte row = formation_index / ENEMIES_PER_ROW;
  return FORMATION_YSPACE*row + FORMATION_Y0;
}

void draw_attacker(byte i) {
  AttackingEnemy* a = &attackers[i];
  if (a->findex) {
    vsprites[i].name = SPRI_ENEMY + DIR_TO_CODE[a->dir & 31]; // TODO: code + a->shape + 14;
    vsprites[i].x = a->x >> 8;
    vsprites[i].y = a->y >> 8;
    vsprites[i].tag = COLOR_ATTACKER;
  } else {
    vsprites[i].y = YOFFSCREEN;
  }
}

void draw_attackers() {
  byte i;
  for (i=0; i<MAX_ATTACKERS; i++) {
    draw_attacker(i);
  }
}

void return_attacker(AttackingEnemy* a) {
  byte fi = a->findex-1;
  byte destx = get_attacker_x(fi);
  byte desty = get_attacker_y(fi);
  byte ydist = desty - (a->y >> 8);
  // are we close to our formation slot?
  if (ydist == 0) {
    // convert back to formation enemy
    formation[fi].shape = a->shape;
    a->findex = 0;
  } else {
    a->dir = (ydist + 16) & 31;
    a->x = destx << 8;
    a->y += 128;
  }
}

void fly_attacker(AttackingEnemy* a) {
  a->x += isin(a->dir) * 2;
  a->y += icos(a->dir) * 2;
  if ((a->y >> 8) == 0) {
    a->returning = 1;
  }
}

void move_attackers() {
  byte i;
  for (i=0; i<MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex) {
      if (a->returning)
        return_attacker(a);
      else
        fly_attacker(a);
    }
  }
}

void think_attackers() {
  byte i;
  for (i=0; i<MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex) {
      // rotate?
      byte x = a->x >> 8;
      byte y = a->y >> 8;
      // don't shoot missiles after player exploded
      if (y < 112 || player_exploding) {
        if (x < 128) {
          a->dir++;
        } else {
          a->dir--;
        }
      } else {
        // lower half of screen
        // shoot a missile?
        if (missiles[i].ypos == YOFFSCREEN) {
          missiles[i].ypos = y+16;
          missiles[i].xpos = x;
          missiles[i].dy = 2;
        }
      }
    }
  }
}

void formation_to_attacker(byte formation_index) {
  byte i;
  // out of bounds? return
  if (formation_index >= MAX_IN_FORMATION)
    return;
  // nobody in formation? return
  if (!formation[formation_index].shape)
    return;
  // find an empty attacker slot
  for (i=0; i<MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex == 0) {
      a->x = get_attacker_x(formation_index) << 8;
      a->y = get_attacker_y(formation_index) << 8;
      a->shape = formation[formation_index].shape;
      a->findex = formation_index+1;
      a->dir = 0;
      a->returning = 0;
      formation[formation_index].shape = 0;
      break;
    }
  }
}

void draw_player() {
  vsprites[7].x = player_x;
  vsprites[7].y = player_y;
  vsprites[7].name = SPRI_SHIP;
  vsprites[7].tag = COLOR_PLAYER;
}

void move_player() {
  struct cv_controller_state state;
  cv_get_controller_state(&state, 0);
  // move left/right?
  if ((state.joystick & CV_LEFT) && player_x > 16) player_x--;
  if ((state.joystick & CV_RIGHT) && player_x < 224) player_x++;
  // shoot missile?
  if ((state.joystick & CV_FIRE_0) && missiles[7].ypos == YOFFSCREEN) {
    missiles[7].ypos = player_y-8; // must be multiple of missile speed
    missiles[7].xpos = player_x; // player X position
    missiles[7].dy = -4; // player missile speed
  }
  vsprites[7].x = player_x;
}

void move_missiles() {
  byte i;
  for (i=0; i<8; i++) { 
    if (missiles[i].ypos != YOFFSCREEN) {
      // hit the bottom or top?
      if ((byte)(missiles[i].ypos += missiles[i].dy) > YOFFSCREEN) {
        missiles[i].ypos = YOFFSCREEN;
      }
    }
  }
}

void blowup_at(byte x, byte y) {
  vsprites[6].tag = COLOR_EXPLOSION;
  vsprites[6].name = SPRI_EXPLODE; // TODO
  vsprites[6].x = x;
  vsprites[6].y = y;
  enemy_exploding = 1;
}

void animate_enemy_explosion() {
  if (enemy_exploding) {
    // animate next frame
    if (enemy_exploding >= 8) {
      enemy_exploding = 0; // hide explosion after 4 frames
      vsprites[6].y = YOFFSCREEN;
    } else {
      vsprites[6].name = SPRI_EXPLODE + (enemy_exploding += 4); // TODO
    }
  }
}

void animate_player_explosion() {
  byte z = player_exploding;
  if (z <= 3) {
    if (z == 3) {
      vsprites[7].y = YOFFSCREEN;
    } else {
      vsprites[7].name = SPRI_EXPLODE + z*4;
    }
  }
}

void hide_player_missile() {
  missiles[7].ypos = YOFFSCREEN;
}

void does_player_shoot_formation() {
  byte mx = missiles[7].xpos + 8;
  byte my = missiles[7].ypos;
  signed char row = (my - FORMATION_Y0) / FORMATION_YSPACE;
  if (row >= 0 && row < ENEMY_ROWS) {
    // ok if unsigned (in fact, must be due to range)
    byte xoffset = mx - FORMATION_X0 - formation_offset_x;
    byte column = xoffset / FORMATION_XSPACE;
    byte localx = xoffset - column * FORMATION_XSPACE;
    if (column < ENEMIES_PER_ROW && localx < 16) {
      char index = column + row * ENEMIES_PER_ROW;
      if (formation[index].shape) {
        formation[index].shape = 0;
        enemies_left--;
        blowup_at(get_attacker_x(index), get_attacker_y(index));
        hide_player_missile();
        add_score(2);
      }
    }
  }
}

void does_player_shoot_attacker() {
  byte mx = missiles[7].xpos + 8;
  byte my = missiles[7].ypos;
  byte i;
  for (i=0; i<MAX_ATTACKERS; i++) {
    AttackingEnemy* a = &attackers[i];
    if (a->findex && in_rect(mx, my, a->x >> 8, a->y >> 8, 16, 16)) {
      blowup_at(a->x >> 8, a->y >> 8);
      a->findex = 0;
      enemies_left--;
      hide_player_missile();
      add_score(5);
      break;
    }
  }
}

void does_missile_hit_player() {
  byte i;
  if (player_exploding)
    return;
  for (i=0; i<MAX_ATTACKERS; i++) {
    if (missiles[i].dy && 
        in_rect(missiles[i].xpos + 8, missiles[i].ypos + 16, 
                player_x, player_y, 16, 16)) {
      player_exploding = 1;
      break;
    }
  }
}

void new_attack_wave() {
  byte i = rand();
  byte j;
  // find a random slot that has an enemy
  for (j=0; j<MAX_IN_FORMATION; j++) {
    i = (i+1) & (MAX_IN_FORMATION-1);
    // anyone there?
    if (formation[i].shape) {
      formation_to_attacker(i);
      formation_to_attacker(i+1);
      formation_to_attacker(i+ENEMIES_PER_ROW);
      formation_to_attacker(i+ENEMIES_PER_ROW+1);
      break;
    }
  }
}

void new_player_ship() {
  player_exploding = 0;
  player_x = 128;
  draw_player();
}

void set_sounds() {
  byte i;
  // missile fire sound
  if (missiles[7].ypos != YOFFSCREEN) {
    cv_set_frequency(CV_SOUNDCHANNEL_0, 2000-missiles[7].ypos*4);
    cv_set_attenuation(CV_SOUNDCHANNEL_0, 18);
  } else {
    cv_set_attenuation(CV_SOUNDCHANNEL_0, 32);
  }
  // enemy explosion sound
  if (enemy_exploding) {
    cv_set_frequency(CV_SOUNDCHANNEL_1, 500+enemy_exploding*64);
    cv_set_attenuation(CV_SOUNDCHANNEL_1, 14);
  } else {
    cv_set_attenuation(CV_SOUNDCHANNEL_1, 32);
  }
  cv_set_attenuation(CV_SOUNDCHANNEL_2, 32);
  // player explosion
  if (player_exploding && player_exploding < 15) {
    cv_set_frequency(CV_SOUNDCHANNEL_2, player_exploding*256);
    cv_set_attenuation(CV_SOUNDCHANNEL_NOISE, 4+player_exploding);
    cv_set_noise(true, 3);
  } else {
    // set diving sounds for spaceships
    cv_set_attenuation(CV_SOUNDCHANNEL_NOISE, 32);
    for (i=0; i<3; i++) {
      byte y = attackers[i].y >> 8;
      if (y >= 0x80) {
        cv_set_frequency(CV_SOUNDCHANNEL_2, 4000+y*8);
        cv_set_attenuation(CV_SOUNDCHANNEL_2, 28);
        break;
      }
    }
  }
}

void wait_for_frame() {
  while (((vint_counter ^ framecount) & 3) == 0);
}

void play_round() {
  byte end_timer = 255;
  player_score = 0;
  add_score(0);
  //putstringxy(0, 0, "PLAYER 1");
  setup_formation();
  clrobjs();
  formation_direction = 1;
  vint_counter = 0;
  framecount = 0;
  new_player_ship();
  while (end_timer) {
    if (player_exploding) {
      if ((framecount & 7) == 1) {
        animate_player_explosion();
        if (++player_exploding > 32 && enemies_left) {
          new_player_ship();
        }
      }
    } else {
      if ((framecount & 0x7f) == 0 || enemies_left < 8) {
        new_attack_wave();
      }
      move_player();
      does_missile_hit_player();
    }
    if ((framecount & 3) == 0) animate_enemy_explosion();
    move_attackers();
    move_missiles();
    does_player_shoot_formation();
    does_player_shoot_attacker(); 
    draw_next_row();
    draw_attackers();
    if ((framecount & 0xf) == 0) think_attackers();
    set_sounds();
    framecount++;
    if (!enemies_left) end_timer--;
    wait_for_frame();
    copy_sprites();
    starfield_update();
  }
}

/*
PATTERN TABLE:
0-95		6x8 font, starting at ' '
67-82		shifted enemy sprites
*/

void setup_graphics() {
  byte i;
  copy_default_character_set();
  cvu_memtovmemcpy(SPRITE_PATTERNS, sprite_table, sizeof(sprite_table));
  cvu_vmemset(COLOR, COLOR_SCORE<<4, 8); // set color for chars 0-63
  cvu_vmemset(COLOR+8, COLOR_FORMATION<<4, 32-8); // set chars 63-255
  for (i=0; i<8; i++)
    set_shifted_pattern(pattern_table, PATTERN+67*8+i*3*8, i);
}

void main() {
  vdp_setup();
  setup_graphics();
  clrscr();
  starfield_setup();
  cv_set_vint_handler(&vint_handler);
  cv_set_screen_active(true);
  play_round();
  main();
}
