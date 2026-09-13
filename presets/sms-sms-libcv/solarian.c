/*
Solarian for the Sega Master System (VDP mode 4).
Ported from the NES version (presets/nes/shoot2.c).

The NES 2bpp CHR was converted to mode-4 planar tiles.
Font and direct sprite tiles keep their NES indices.
SMS sprite names are 8 bits, so the mirrored attacker frames live at
128..239 while the shifted formation (background only) is at 256..279.

Sprites are 8x16 like the NES, using the mode-4 sprite attribute
table: 64 Y bytes followed by 64 X/name pairs.
*/

#include <stdlib.h>
#include <string.h>
#include <cv.h>
#include <cvu.h>

#include "common.h"
//#link "common.c"

#include "solarian_gfx.h"
//#link "solarian_gfx.c"

#include "stars.h"
//#link "stars.c"

#define NMISSILES 8
#define YOFFSCREEN 239

// sprite slots
#define SLOT_ATTACKER 0     // 6 attackers * 2 columns
#define SLOT_BOOM     12    // explosion, 2 columns
#define SLOT_PLAYER   14    // player ship, 2 columns
#define SLOT_MISSILE  16    // 8 missiles/bombs

// NES sprite flip bits (SMS has no hardware sprite flip)
#define FLIPX 0x40
#define FLIPY 0x80
#define FLIPXY 0xc0

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

// mode-4 sprite attribute table shadow (64 Y bytes + 64 X/name pairs)
byte oam[256];

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

// set one mode-4 sprite slot
void set_sprite(byte slot, byte y, byte x, byte name) {
  oam[slot] = y;
  oam[128 + slot*2] = x;
  oam[128 + slot*2 + 1] = name;
}

// tile base for an attacker direction code
byte attacker_tile(byte code) {
  byte frame = code & 7;
  byte fl = 0;
  if (code & FLIPX) fl |= 1;
  if (code & FLIPY) fl |= 2;
  return T_ENEMY_FLIP + ((frame*4 + fl) << 2);
}

void copy_sprites() {
  byte i;
  for (i=0; i<NMISSILES; i++) {
    if (missiles[i].ypos != YOFFSCREEN) {
      set_sprite(SLOT_MISSILE+i, missiles[i].ypos, missiles[i].xpos,
                 (i == 7) ? T_MISSILE : T_BOMB);
    } else {
      set_sprite(SLOT_MISSILE+i, YOFFSCREEN, 0, 0);
    }
  }
  cvu_memtovmemcpy(SPRITES, oam, sizeof(oam));
}

void draw_score() {
  byte j;
  word s = player_score;
  byte buf[4];
  for (j=0; j<4; j++) {
    buf[3-j] = 16 + (s & 0xf); // NES font: '0' is tile 16
    s >>= 4;
  }
  for (j=0; j<4; j++)
    putcharxy(j, 0, buf[j]);
  putcharxy(4, 0, 16);
}

void add_score(word bcd) {
  player_score = bcd_add(player_score, bcd);
  draw_score();
}

void clrobjs() {
  byte i;
  memset(oam, 0, sizeof(oam));
  for (i=0; i<64; i++)
    oam[i] = YOFFSCREEN;
  for (i=0; i<NMISSILES; i++) {
    missiles[i].ypos = YOFFSCREEN;
  }
}

void setup_formation() {
  byte i;
  memset(formation, 0, sizeof(formation));
  memset(attackers, 0, sizeof(attackers));
  for (i=0; i<MAX_IN_FORMATION; i++) {
    formation[i].shape = 1;
  }
  enemies_left = MAX_IN_FORMATION;
  formation_offset_x = 0;
}

// the name table stores (tile, attribute) for every cell in mode 4
byte rowbuf[32*2];

void draw_row(byte row) {
  byte i, x;
  byte x0 = formation_offset_x / 8;
  byte xd = (formation_offset_x & 7) * 3;
  byte y = 3 + row * 2;
  // fill with the starfield background
  for (x=0; x<32; x++) {
    rowbuf[x*2] = starfield_get_tile_xy(x, y);
    rowbuf[x*2+1] = 0;
  }
  // overlay the formation enemies
  x = x0;
  for (i=0; i<ENEMIES_PER_ROW; i++) {
    if (formation[i + row*ENEMIES_PER_ROW].shape) {
      word shape = T_FORM_SHIFT + xd;
      rowbuf[x*2] = (byte)shape;
      rowbuf[x*2+1] = (byte)(shape >> 8);
      x++;
      rowbuf[x*2] = (byte)(shape+1);
      rowbuf[x*2+1] = (byte)((shape+1) >> 8);
      x++;
      rowbuf[x*2] = (byte)(shape+2);
      rowbuf[x*2+1] = (byte)((shape+2) >> 8);
      x++;
    } else {
      x += 3;
    }
  }
  cvu_memtovmemcpy(IMAGE + y*64, rowbuf, sizeof(rowbuf));
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
  0|FLIPXY, 1|FLIPXY, 2|FLIPXY, 3|FLIPXY, 4|FLIPXY, 5|FLIPXY, 6|FLIPXY, 6|FLIPXY,
  6|FLIPX, 6|FLIPX, 5|FLIPX, 4|FLIPX, 3|FLIPX, 2|FLIPX, 1|FLIPX, 0|FLIPX,
  0, 1, 2, 3, 4, 5, 6, 6,
  6|FLIPY, 6|FLIPY, 5|FLIPY, 4|FLIPY, 3|FLIPY, 2|FLIPY, 1|FLIPY, 0|FLIPY,
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
  byte slot = SLOT_ATTACKER + i*2;
  if (a->findex) {
    byte code = DIR_TO_CODE[a->dir & 31];
    byte base = attacker_tile(code);
    byte x = a->x >> 8;
    byte y = a->y >> 8;
    set_sprite(slot, y, x, base);
    set_sprite(slot+1, y, x+8, base+2);
  } else {
    set_sprite(slot, YOFFSCREEN, 0, 0);
    set_sprite(slot+1, YOFFSCREEN, 0, 0);
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
  set_sprite(SLOT_PLAYER, player_y, player_x, T_SHIP);
  set_sprite(SLOT_PLAYER+1, player_y, player_x+8, T_SHIP+2);
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
  draw_player();
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
  set_sprite(SLOT_BOOM, y, x, T_EXPLODE);
  set_sprite(SLOT_BOOM+1, y, x+8, T_EXPLODE+2);
  enemy_exploding = 1;
}

void animate_enemy_explosion() {
  if (enemy_exploding) {
    byte frame = (enemy_exploding - 1) >> 2;
    if (frame >= 4) {
      enemy_exploding = 0; // hide explosion after 4 frames
      set_sprite(SLOT_BOOM, YOFFSCREEN, 0, 0);
      set_sprite(SLOT_BOOM+1, YOFFSCREEN, 0, 0);
    } else {
      byte base = T_EXPLODE + frame*4;
      set_sprite(SLOT_BOOM, oam[SLOT_BOOM], oam[128+SLOT_BOOM*2], base);
      set_sprite(SLOT_BOOM+1, oam[SLOT_BOOM], oam[128+(SLOT_BOOM+1)*2]+8,
                 base+2);
      enemy_exploding += 4;
    }
  }
}

void animate_player_explosion() {
  byte z = player_exploding;
  if (z <= 3) {
    if (z == 3) {
      set_sprite(SLOT_PLAYER, YOFFSCREEN, 0, 0);
      set_sprite(SLOT_PLAYER+1, YOFFSCREEN, 0, 0);
    } else {
      byte base = T_EXPLODE + z*4;
      set_sprite(SLOT_PLAYER, player_y, player_x, base);
      set_sprite(SLOT_PLAYER+1, player_y, player_x+8, base+2);
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
  if (missiles[7].ypos == YOFFSCREEN)
    return;
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
  if (missiles[7].ypos == YOFFSCREEN)
    return;
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
    if (missiles[i].ypos != YOFFSCREEN &&
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

void setup_graphics() {
  cvu_memtovmemcpy(PATTERN, solarian_tiles, sizeof(solarian_tiles));
  cv_set_colors(0, 4);
  set_default_palette();
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
