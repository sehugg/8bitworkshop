
#include <stdlib.h>
#include <string.h>
#include <cc65.h>

#include "vecops.h"
//#link "vecops.c"

#include "vecfont.h"
//#link "vecfont.c"

#include "vec3d.h"
//#link "vec3d.c"

#define input0   (*(byte*)0x7800)
#define input1   (*(byte*)0x8000)
#define watchdog (*(byte*)0x8980)
#define vidframe (*(byte*)0x0)

#define LEFT1 !(input1 & 0x8)
#define RIGHT1 !(input1 & 0x4)
#define UP1 !(input1 & 0x10)
#define DOWN1 !(input1 & 0x20)
#define FIRE1 !(input1 & 0x2)
#define BOMB1 !(input1 & 0x1)
#define COIN1 (input0 & 0x2)
#define COIN2 (input0 & 0x1)
#define START1 (input2 & 0x20)
#define START2 (input2 & 0x40)

// SHAPE CACHE

const Vector8 tetra_v[] = { {0,-86,86},{86,86,86},{-86,86,86},{0,0,-86} };
const sbyte tetra_e[] = { 0, 1, 2, 0, 3, 1, -1, 3, 2, -2 };
const Wireframe tetra_wf = { 4, tetra_v, tetra_e };

const Vector8 octa_v[] = { {86,0,0},{0,86,0},{-86,0,0},{0,-86,0},{0,0,86},{0,0,-86} };
const sbyte octa_e[] = { 0, 1, 2, 3, 0, 4, 1, 5, 0, -1, 2, 4, 3, 5, 2, -2 };
const Wireframe octa_wf = { 6, octa_v, octa_e };

const Vector8 ship_v[] = { {0,86,0},{-30,-30,0},{-50,0,0},{50,0,0},{30,-30,0} };
const sbyte ship_e[] = { 0, 1, 2, 3, 4, 0, -2 };
const Wireframe ship_wf = { 5, ship_v, ship_e };

const Vector8 thrust_v[] = { {-20,-30,0},{-30,-50,0},{0,-86,0},{30,-50,0},{20,-30,0} };
const sbyte thrust_e[] = { 0, 1, 2, 3, 4, -2 };
const Wireframe thrust_wf = { 5, thrust_v, thrust_e };

const Vector8 torpedo_v[] = { {-86,0,0},{86,0,0},{-40,-40,0},{40,40,0},{0,-20,0},{0,20,0} };
const sbyte torpedo_e[] = { 0, 1, -1, 2, 3, -1, 4, 5, -2 };
const Wireframe torpedo_wf = { 6, torpedo_v, torpedo_e };

word ship_shapes[32];
word thrust_shapes[32];
word tetra_shapes[32];
word torpedo_shapes[16];
word explosion_shape[1];

void draw_explosion() {
  byte i;
  for (i=0; i<30; i++) {
    byte angle = rand();
    sbyte xd = isin(angle) >> 4;
    sbyte yd = icos(angle) >> 4;
    SVEC(xd, yd, 2);
    SVEC(-xd, -yd, 2);
  }
}

void make_cached_shapes() {
  Matrix mat;
  byte i;
  for (i=0; i<32; i++) {
    //watchdog = 0;
    ship_shapes[i] = dvgwrofs;
    mat_rotate(&mat, 2, i<<3);
    draw_wireframe_ortho(&ship_wf, &mat);
    RTSL();
    thrust_shapes[i] = dvgwrofs;
    draw_wireframe_ortho(&thrust_wf, &mat);
    RTSL();
    tetra_shapes[i] = dvgwrofs;
    mat_rotate(&mat, 0, i<<3);
    draw_wireframe_ortho(&octa_wf, &mat);
    RTSL();
  }
  for (i=0; i<16; i++) {
    torpedo_shapes[i] = dvgwrofs;
    mat_rotate(&mat, 2, i<<4);
    draw_wireframe_ortho(&torpedo_wf, &mat);
    RTSL();
  }
  explosion_shape[0] = dvgwrofs;
  STAT_sparkle(15);
  draw_explosion();
  RTSL();
}

// MAIN PROGRAM

struct Actor;

typedef void ActorUpdateFn(struct Actor*);

typedef struct Actor {
  word* shapes;
  ActorUpdateFn* update_fn;
  byte angshift;
  byte scale;
  byte color;
  byte intens;
  byte collision_flags;
  byte angle;
  word xx;
  word yy;
  int velx;
  int vely;
  struct Actor* next;
  byte removed;
} Actor;

#define WORLD_SCALE 0x2c0

void draw_actor(const Actor* a) {
  CNTR(); // center beam (0,0)
  SCAL(WORLD_SCALE); // world scale
  VCTR(a->xx>>3, a->yy>>3, 0); // go to object center
  SCAL(a->scale); // object scale
  STAT(a->color, a->intens); // set color/intensity
  JSRL(a->shapes[a->angle >> a->angshift]); // draw
}

void move_actor(Actor* a) {
  a->xx += a->velx;
  a->yy += a->vely;
}

static Actor* first_actor = NULL;

Actor* new_actor(const Actor* base) {
  Actor* a = (Actor*) malloc(sizeof(Actor));
  memcpy(a, base, sizeof(Actor));
  a->next = first_actor;
  first_actor = a;
  return a;
}

void draw_and_update_actors() {
  Actor* a = first_actor;
  while (a) {
    draw_actor(a);
    move_actor(a);
    if (a->update_fn) a->update_fn(a);
    a = a->next;
  }
}

void remove_expired_actors() {
  Actor* a;
  // get address of first pointer
  Actor** prev = &first_actor;
  while ((a = *prev)) {
    // was actor removed?
    if (a->removed) {
      // set previous pointer to skip this actor
      *prev = a->next;
      // free memory
      free(a);
    } else {
      // get address of next pointer
      prev = &a->next;
    }
  }
}

void draw_actor_rect(Actor* a) {
  CNTR(); // center beam (0,0)
  SCAL(WORLD_SCALE); // world scale
  VCTR(a->xx>>3, a->yy>>3, 0); // go to object center
  SCAL(a->scale); // object scale
  STAT(RED, 7); // set color/intensity
  VCTR(-86,-86,0);
  VCTR(86*2,0,2);
  VCTR(0,86*2,2);
  VCTR(-86*2,0,2);
  VCTR(0,-86*2,2);
}

word get_distance_squared(byte dx, byte dy) {
  return cc65_imul8x8r16(dx,dx) + cc65_imul8x8r16(dy,dy);
}

typedef void ActorCollisionFn(struct Actor*, struct Actor*);

byte test_actor_distance(ActorCollisionFn* fn, Actor* act1, byte mindist, byte flags) {
  Actor* a = first_actor;
  byte xx1 = act1->xx >> 8;
  byte yy1 = act1->yy >> 8;
  byte count = 0;
  word mindist2 = mindist * mindist;
  // go through list of actors
  while (a) {
    // only compare against actors with certain flags
    // (that haven't been removed)
    if ((a->collision_flags & flags) && !a->removed) {
      byte dx = abs(xx1 - (a->xx >> 8));
      byte dy = abs(yy1 - (a->yy >> 8));
      if (dx+dy < mindist) {
        word dist2 = get_distance_squared(dx, dy);
        if (dist2 < mindist2) {
          if (fn) fn(act1, a);
          count++;
        }
      }
    }
    a = a->next;
  }
  return count;
}

void explode_at(Actor* base);

void explode_actor(Actor* a, Actor* b) {
  a->removed = 1;
  explode_at(b);
  b->removed = 1;
}

void obstacle_update_fn(struct Actor* a) {
  a->angle += 1;
}

void torpedo_update_fn(struct Actor* a) {
  // expire?
  if ((a->angle += 60) == 0) {
    a->removed = 1;
  } else {
    // check for torpedo hits
    test_actor_distance(explode_actor, a, 12, 0x2);
  }
}

void explosion_update_fn(struct Actor* a) {
  a->scale -= 2;
  if (a->scale < 8) {
    a->removed = 1;
  }
}

const Actor ship_actor = {
  ship_shapes, NULL, 3, 0xb0, WHITE, 7, 0x1,
};
const Actor tetra_actor = {
  tetra_shapes, obstacle_update_fn, 3, 0x80, CYAN, 7, 0x2,
};
const Actor torpedo_actor = {
  torpedo_shapes, torpedo_update_fn, 4, 0xe0, YELLOW, 15, 0x4,
};
const Actor explosion_actor = {
  explosion_shape, explosion_update_fn, 8, 0xa0, WHITE, 15, 0,
};

void create_obstacle() {
  Actor* a = new_actor(&tetra_actor);
  a->xx = rand() | 0x8000;
  a->yy = rand();
  a->velx = (int)rand()<<8>>8;
  a->vely = (int)rand()<<8>>8;
}

void create_obstacles(byte count) {
  while (count--) {
    create_obstacle();
  }
}

static int frame = 0;

static Actor* curship = NULL;

void draw_thrust() {
  word rnd = rand();
  // save old values in actor
  byte oldcolor = curship->color;
  byte oldintens = curship->intens;
  // temporarily give new thrust values
  curship->shapes = thrust_shapes;
  curship->scale ^= rnd; // random thrust scale
  curship->intens = 15;
  curship->color = (rnd&1) ? RED : YELLOW;
  // draw thrust using player's ship actor
  draw_actor(curship);
  // restore previous values
  curship->shapes = ship_shapes;
  curship->scale ^= rnd;
  curship->color = oldcolor;
  curship->intens = oldintens;
}

void thrust_ship() {
  sbyte sin = isin(curship->angle);
  sbyte cos = icos(curship->angle);
  curship->velx += sin>>3;
  curship->vely += cos>>3;
}

int apply_friction(int vel) {
  int delta = vel >> 8;
  if (delta == 0 && vel > 0) delta++;
  return vel - delta;
}

void shoot_torpedo() {
  sbyte sin = isin(curship->angle);
  sbyte cos = icos(curship->angle);
  Actor* torp = new_actor(&torpedo_actor);
  torp->velx = sin << 2;
  torp->vely = cos << 2;
  torp->xx = curship->xx + torp->velx*4;
  torp->yy = curship->yy + torp->vely*4;
}

static byte can_fire;
static byte newship_timer;

void new_player_ship() {
  if (curship == NULL) {
    curship = new_actor(&ship_actor);
  }
}

void explode_at(Actor* base) {
  Actor* a = new_actor(&explosion_actor);
  a->xx = base->xx;
  a->yy = base->yy;
}

void control_player() {
  if (newship_timer && --newship_timer == 0) {
    new_player_ship();
  }
  if (!curship) return;
  
  if (LEFT1) curship->angle -= 2;
  if (RIGHT1) curship->angle += 2;
  if ((frame&1)==1) {
    curship->velx = apply_friction(curship->velx);
    curship->vely = apply_friction(curship->vely);
  }
  if (UP1) {
    // draw flame
    draw_thrust();
    // thrust every 4 frames, to avoid precision issues
    if (!(frame&3)) thrust_ship();
  }
  if (FIRE1) {
    // must release fire button before firing again
    if (can_fire) {
      shoot_torpedo();
      can_fire = 0;
    }
  } else {
    can_fire = 1;
  }
  // ship ran into something?
  if (test_actor_distance(NULL, curship, 16, 0x2)) {
    explode_at(curship);
    curship->removed = 1;
    curship = NULL;
    newship_timer = 255;
  }
}

byte just_one_actor_left() {
  return first_actor != NULL && first_actor->next == NULL;
}

void main() {
  dvgclear();
  dvgwrofs = 0x800; //write into the middle of VEC ROM (TODO)
  make_cached_shapes();
  create_obstacles(5);
  new_player_ship();
  while (!just_one_actor_left()) {
    dvgreset();
    control_player();
    draw_and_update_actors();
    CNTR();
    HALT();
    dvgstart();
    remove_expired_actors();
    frame++;
    watchdog=0;
//    while (vidframe == (frame & 0x3)) {}
  }
  main();
}
