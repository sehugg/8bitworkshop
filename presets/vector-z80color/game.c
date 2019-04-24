
#include <string.h>
#include <stdlib.h>

typedef unsigned char byte;
typedef unsigned short word;
typedef signed char sbyte;

word __at(0xa000) dvgram[0x1000];
byte __at(0x8840) _dvgstart;

volatile int __at(0x8100) mathbox_sum;
sbyte __at(0x8102) mathbox_arg1;
sbyte __at(0x8103) mathbox_arg2;
byte __at(0x810f) mathbox_go_mul;

volatile byte __at (0x8000) input0;
volatile byte __at (0x8001) input1;
volatile byte __at (0x8002) input2;
volatile byte __at (0x800f) vidframe;
byte __at (0x8980) watchdog;

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

//

void main();
void __sdcc_heap_init(void); // for malloc()

void start() {
__asm
        LD      SP,#0x0
        DI
; copy initialized data
        LD    BC, #l__INITIALIZER
        LD    A, B
        LD    DE, #s__INITIALIZED
        LD    HL, #s__INITIALIZER
        LDIR
__endasm;
  // init heap for malloc() and run main pgm.
  __sdcc_heap_init();
  main();
}

// VECTOR ROUTINES

int dvgwrofs; // write offset for DVG buffer

inline word ___swapw(word j) {
  return ((j << 8) | (j >> 8));
}

inline void dvgreset() {
  dvgwrofs = 0;
}

inline void dvgstart() {
  _dvgstart = 0;
}

void dvgwrite(word w) {
  dvgram[dvgwrofs++] = w;
}

inline void VCTR(int dx, int dy, byte bright) {
  dvgwrite((dy & 0x1fff));
  dvgwrite(((bright & 7) << 13) | (dx & 0x1fff));
}

inline void SVEC(signed char dx, signed char dy, byte bright) {
  dvgwrite(0x4000 | (dx & 0x1f) | ((bright&7)<<5) | ((dy & 0x1f)<<8));
}

inline void JSRL(word offset) {
  dvgwrite(0xa000 | offset);
}

inline void JMPL(word offset) {
  dvgwrite(0xe000 | offset);
}

inline void RTSL() {
  dvgwrite(0xc000);
}

inline void CNTR() {
  dvgwrite(0x8000);
}

inline void HALT() {
  dvgwrite(0x2000);
}

inline void STAT(byte rgb, byte intens) {
  dvgwrite(0x6000 | ((intens & 0xf)<<4) | (rgb & 7));
}

inline void STAT_sparkle(byte intens) {
  dvgwrite(0x6800 | ((intens & 0xf)<<4));
}

inline void SCAL(word scale) {
  dvgwrite(0x7000 | scale);
}

enum {
  BLACK, BLUE, GREEN, CYAN, RED, MAGENTA, YELLOW, WHITE
} Color;


/// https://trmm.net/Asteroids_font

#define P(x,y) ((((x) & 0xF) << 4) | (((y) & 0xF) << 0))
#define FONT_UP 0xFE
#define FONT_LAST 0xFF

const byte vecfont[95][8] = {
  ['0' - 0x20] = { P(0,0), P(8,0), P(8,12), P(0,12), P(0,0), P(8,12), FONT_LAST },
  ['1' - 0x20] = { P(4,0), P(4,12), P(3,10), FONT_LAST },
  ['2' - 0x20] = { P(0,12), P(8,12), P(8,7), P(0,5), P(0,0), P(8,0), FONT_LAST },
  ['3' - 0x20] = { P(0,12), P(8,12), P(8,0), P(0,0), FONT_UP, P(0,6), P(8,6), FONT_LAST },
  ['4' - 0x20] = { P(0,12), P(0,6), P(8,6), FONT_UP, P(8,12), P(8,0), FONT_LAST },
  ['5' - 0x20] = { P(0,0), P(8,0), P(8,6), P(0,7), P(0,12), P(8,12), FONT_LAST },
  ['6' - 0x20] = { P(0,12), P(0,0), P(8,0), P(8,5), P(0,7), FONT_LAST },
  ['7' - 0x20] = { P(0,12), P(8,12), P(8,6), P(4,0), FONT_LAST },
  ['8' - 0x20] = { P(0,0), P(8,0), P(8,12), P(0,12), P(0,0), FONT_UP, P(0,6), P(8,6), },
  ['9' - 0x20] = { P(8,0), P(8,12), P(0,12), P(0,7), P(8,5), FONT_LAST },
  [' ' - 0x20] = { FONT_LAST },
  ['.' - 0x20] = { P(3,0), P(4,0), FONT_LAST },
  [',' - 0x20] = { P(2,0), P(4,2), FONT_LAST },
  ['-' - 0x20] = { P(2,6), P(6,6), FONT_LAST },
  ['+' - 0x20] = { P(1,6), P(7,6), FONT_UP, P(4,9), P(4,3), FONT_LAST },
  ['!' - 0x20] = { P(4,0), P(3,2), P(5,2), P(4,0), FONT_UP, P(4,4), P(4,12), FONT_LAST },
  ['#' - 0x20] = { P(0,4), P(8,4), P(6,2), P(6,10), P(8,8), P(0,8), P(2,10), P(2,2) },
  ['^' - 0x20] = { P(2,6), P(4,12), P(6,6), FONT_LAST },
  ['=' - 0x20] = { P(1,4), P(7,4), FONT_UP, P(1,8), P(7,8), FONT_LAST },
  ['*' - 0x20] = { P(0,0), P(4,12), P(8,0), P(0,8), P(8,8), P(0,0), FONT_LAST },
  ['_' - 0x20] = { P(0,0), P(8,0), FONT_LAST },
  ['/' - 0x20] = { P(0,0), P(8,12), FONT_LAST },
  ['\\' - 0x20] = { P(0,12), P(8,0), FONT_LAST },
  ['@' - 0x20] = { P(8,4), P(4,0), P(0,4), P(0,8), P(4,12), P(8,8), P(4,4), P(3,6) },
  ['$' - 0x20] = { P(6,2), P(2,6), P(6,10), FONT_UP, P(4,12), P(4,0), FONT_LAST },
  ['&' - 0x20] = { P(8,0), P(4,12), P(8,8), P(0,4), P(4,0), P(8,4), FONT_LAST },
  ['[' - 0x20] = { P(6,0), P(2,0), P(2,12), P(6,12), FONT_LAST },
  [']' - 0x20] = { P(2,0), P(6,0), P(6,12), P(2,12), FONT_LAST },
  ['(' - 0x20] = { P(6,0), P(2,4), P(2,8), P(6,12), FONT_LAST },
  [')' - 0x20] = { P(2,0), P(6,4), P(6,8), P(2,12), FONT_LAST },
  ['{' - 0x20] = { P(6,0), P(4,2), P(4,10), P(6,12), FONT_UP, P(2,6), P(4,6), FONT_LAST },
  ['}' - 0x20] = { P(4,0), P(6,2), P(6,10), P(4,12), FONT_UP, P(6,6), P(8,6), FONT_LAST },
  ['%' - 0x20] = { P(0,0), P(8,12), FONT_UP, P(2,10), P(2,8), FONT_UP, P(6,4), P(6,2) },
  ['<' - 0x20] = { P(6,0), P(2,6), P(6,12), FONT_LAST },
  ['>' - 0x20] = { P(2,0), P(6,6), P(2,12), FONT_LAST },
  ['|' - 0x20] = { P(4,0), P(4,5), FONT_UP, P(4,6), P(4,12), FONT_LAST },
  [':' - 0x20] = { P(4,9), P(4,7), FONT_UP, P(4,5), P(4,3), FONT_LAST },
  [';' - 0x20] = { P(4,9), P(4,7), FONT_UP, P(4,5), P(1,2), FONT_LAST },
  ['"' - 0x20] = { P(2,10), P(2,6), FONT_UP, P(6,10), P(6,6), FONT_LAST },
  ['\'' - 0x20] = { P(2,6), P(6,10), FONT_LAST },
  ['`' - 0x20] = { P(2,10), P(6,6), FONT_LAST },
  ['~' - 0x20] = { P(0,4), P(2,8), P(6,4), P(8,8), FONT_LAST },
  ['?' - 0x20] = { P(0,8), P(4,12), P(8,8), P(4,4), FONT_UP, P(4,1), P(4,0), FONT_LAST },
  ['A' - 0x20] = { P(0,0), P(0,8), P(4,12), P(8,8), P(8,0), FONT_UP, P(0,4), P(8,4) },
  ['B' - 0x20] = { P(0,0), P(0,12), P(4,12), P(8,10), P(4,6), P(8,2), P(4,0), P(0,0) },
  ['C' - 0x20] = { P(8,0), P(0,0), P(0,12), P(8,12), FONT_LAST },
  ['D' - 0x20] = { P(0,0), P(0,12), P(4,12), P(8,8), P(8,4), P(4,0), P(0,0), FONT_LAST },
  ['E' - 0x20] = { P(8,0), P(0,0), P(0,12), P(8,12), FONT_UP, P(0,6), P(6,6), FONT_LAST },
  ['F' - 0x20] = { P(0,0), P(0,12), P(8,12), FONT_UP, P(0,6), P(6,6), FONT_LAST },
  ['G' - 0x20] = { P(6,6), P(8,4), P(8,0), P(0,0), P(0,12), P(8,12), FONT_LAST },
  ['H' - 0x20] = { P(0,0), P(0,12), FONT_UP, P(0,6), P(8,6), FONT_UP, P(8,12), P(8,0) },
  ['I' - 0x20] = { P(0,0), P(8,0), FONT_UP, P(4,0), P(4,12), FONT_UP, P(0,12), P(8,12) },
  ['J' - 0x20] = { P(0,4), P(4,0), P(8,0), P(8,12), FONT_LAST },
  ['K' - 0x20] = { P(0,0), P(0,12), FONT_UP, P(8,12), P(0,6), P(6,0), FONT_LAST },
  ['L' - 0x20] = { P(8,0), P(0,0), P(0,12), FONT_LAST },
  ['M' - 0x20] = { P(0,0), P(0,12), P(4,8), P(8,12), P(8,0), FONT_LAST },
  ['N' - 0x20] = { P(0,0), P(0,12), P(8,0), P(8,12), FONT_LAST },
  ['O' - 0x20] = { P(0,0), P(0,12), P(8,12), P(8,0), P(0,0), FONT_LAST },
  ['P' - 0x20] = { P(0,0), P(0,12), P(8,12), P(8,6), P(0,5), FONT_LAST },
  ['Q' - 0x20] = { P(0,0), P(0,12), P(8,12), P(8,4), P(0,0), FONT_UP, P(4,4), P(8,0) },
  ['R' - 0x20] = { P(0,0), P(0,12), P(8,12), P(8,6), P(0,5), FONT_UP, P(4,5), P(8,0) },
  ['S' - 0x20] = { P(0,2), P(2,0), P(8,0), P(8,5), P(0,7), P(0,12), P(6,12), P(8,10) },
  ['T' - 0x20] = { P(0,12), P(8,12), FONT_UP, P(4,12), P(4,0), FONT_LAST },
  ['U' - 0x20] = { P(0,12), P(0,2), P(4,0), P(8,2), P(8,12), FONT_LAST },
  ['V' - 0x20] = { P(0,12), P(4,0), P(8,12), FONT_LAST },
  ['W' - 0x20] = { P(0,12), P(2,0), P(4,4), P(6,0), P(8,12), FONT_LAST },
  ['X' - 0x20] = { P(0,0), P(8,12), FONT_UP, P(0,12), P(8,0), FONT_LAST },
  ['Y' - 0x20] = { P(0,12), P(4,6), P(8,12), FONT_UP, P(4,6), P(4,0), FONT_LAST },
  ['Z' - 0x20] = { P(0,12), P(8,12), P(0,0), P(8,0), FONT_UP, P(2,6), P(6,6), FONT_LAST },
};

void draw_char(char ch) {
  const byte* p = vecfont[ch-0x20];
  byte bright = 0;
  byte x = 0;
  byte y = 0;
  byte i;
  for (i=0; i<8; i++) {
    byte b = *p++;
    if (b == FONT_LAST) break; // last move
    else if (b == FONT_UP) bright = 0; // pen up
    else {
      byte x2 = b>>4;
      byte y2 = b&15;
      SVEC((char)(x2-x), (char)(y2-y), bright);
      bright = 2;
      x = x2;
      y = y2;
    }
  }
  SVEC((char)12-x, (char)-y, 0);
}

static word font_shapes[95];

void make_cached_font() {
  char ch;
  for (ch=0; ch<95; ch++) {
    watchdog = 0;
    font_shapes[ch] = dvgwrofs;
    draw_char(ch+0x20);
    RTSL();
  }
}

void draw_string(const char* str, byte spacing) {
  while (*str) {
    JSRL(font_shapes[*str++ - 0x20]);
    if (spacing) SVEC(spacing, 0, 0);
  }
}

// MATH/3D ROUTINES

typedef struct {
  sbyte m[3][3];
} Matrix;

typedef struct {
  sbyte x,y,z;
} Vector8;

typedef struct {
  int x,y,z;
} Vector16;

typedef struct {
  byte numverts;
  const Vector8* verts; // array of vertices
  const sbyte* edges; // array of vertex indices (edges)
} Wireframe;

void mat_identity(Matrix* m) {
  memset(m, 0, sizeof(*m));
  m->m[0][0] = 127;
  m->m[1][1] = 127;
  m->m[2][2] = 127;
}

inline void mul16(sbyte a, sbyte b) {
  mathbox_arg1 = a;
  mathbox_arg2 = b;
  mathbox_go_mul=0;
}

void vec_mat_transform(Vector16* dest, const Vector8* v, const Matrix* m) {
  byte i;
  int* result = &dest->x;
  const sbyte* mval = &m->m[0][0];
  for (i=0; i<3; i++) {
    mathbox_sum = 0;
    mul16(*mval++, v->x);
    mul16(*mval++, v->y);
    mul16(*mval++, v->z);
    *result++ = mathbox_sum;
  }
}

const sbyte sintbl[64] = {
0, 3, 6, 9, 12, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 46,
49, 51, 54, 57, 60, 63, 65, 68, 71, 73, 76, 78, 81, 83, 85, 88,
90, 92, 94, 96, 98, 100, 102, 104, 106, 107, 109, 111, 112, 113, 115, 116,
117, 118, 120, 121, 122, 122, 123, 124, 125, 125, 126, 126, 126, 127, 127, 127,
};

sbyte isin(byte x0) {
  byte x = x0;
  if (x0 & 0x40) x = 127-x;
  if (x0 & 0x80) {
    return -sintbl[x-128];
  } else {
    return sintbl[x];
  }
}

sbyte icos(byte x) {
  return isin(x+64);
}

void mat_rotate(Matrix* m, byte axis, byte angle) {
  sbyte sin = isin(angle);
  sbyte cos = icos(angle);
  mat_identity(m);
  switch (axis) {
    case 0:
      m->m[1][1] = cos;
      m->m[2][1] = sin;
      m->m[1][2] = -sin;
      m->m[2][2] = cos;
      break;
    case 1:
      m->m[2][2] = cos;
      m->m[0][2] = sin;
      m->m[2][0] = -sin;
      m->m[0][0] = cos;
      break;
    case 2:
      m->m[0][0] = cos;
      m->m[1][0] = -sin;
      m->m[0][1] = sin;
      m->m[1][1] = cos;
      break;
  }
}

void xform_vertices(Vector16* dest, const Vector8* src, const Matrix* m, byte nv) {
  byte i;
  for (i=0; i<nv; i++) {
    vec_mat_transform(dest++, src++, m);
  }
}

void draw_wireframe(const Wireframe* wf, Vector16* scrnverts) {
  const char* e = wf->edges;
  byte bright = 0;
  int x1 = 0;
  int y1 = 0;
  do {
    sbyte i = *e++;
    if (i == -1)
      bright = 0;
    else if (i == -2)
      break;
    else {
      int x2 = scrnverts[i].x>>8;
      int y2 = scrnverts[i].y>>8;
      VCTR(x2-x1, y2-y1, bright);
      x1 = x2;
      y1 = y2;
    }
    bright = 2;
  } while (1);
}

void draw_wireframe_ortho(const Wireframe* wf, const Matrix* m) {
  Vector16 scrnverts[16];
  xform_vertices(scrnverts, wf->verts, m, wf->numverts);
  draw_wireframe(wf, scrnverts);
}

// SHAPE CACHE

const Vector8 tetra_v[] = { {0,-86,86},{86,86,86},{-86,86,86},{0,0,-86} };
const char tetra_e[] = { 0, 1, 2, 0, 3, 1, -1, 3, 2, -2 };
const Wireframe tetra_wf = { 4, tetra_v, tetra_e };

const Vector8 octa_v[] = { {86,0,0},{0,86,0},{-86,0,0},{0,-86,0},{0,0,86},{0,0,-86} };
const char octa_e[] = { 0, 1, 2, 3, 0, 4, 1, 5, 0, -1, 2, 4, 3, 5, 2, -2 };
const Wireframe octa_wf = { 6, octa_v, octa_e };

const Vector8 ship_v[] = { {0,86,0},{-30,-30,0},{-50,0,0},{50,0,0},{30,-30,0} };
const char ship_e[] = { 0, 1, 2, 3, 4, 0, -2 };
const Wireframe ship_wf = { 5, ship_v, ship_e };

const Vector8 thrust_v[] = { {-20,-30,0},{-30,-50,0},{0,-86,0},{30,-50,0},{20,-30,0} };
const char thrust_e[] = { 0, 1, 2, 3, 4, -2 };
const Wireframe thrust_wf = { 5, thrust_v, thrust_e };

const Vector8 torpedo_v[] = { {-86,0,0},{86,0,0},{-40,-40,0},{40,40,0},{0,-20,0},{0,20,0} };
const char torpedo_e[] = { 0, 1, -1, 2, 3, -1, 4, 5, -2 };
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
    watchdog = 0;
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
  byte removed:1;
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
  while (a != NULL) {
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
  while ((a = *prev) != NULL) {
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

inline word get_distance_squared(byte dx, byte dy) {
  mathbox_sum = 0;
  mul16(dx,dx);
  mul16(dy,dy);
  return mathbox_sum;
}

typedef void ActorCollisionFn(struct Actor*, struct Actor*);

byte test_actor_distance(ActorCollisionFn* fn, Actor* act1, byte mindist, byte flags) {
  Actor* a = first_actor;
  byte xx1 = act1->xx >> 8;
  byte yy1 = act1->yy >> 8;
  byte count = 0;
  // mindist2 = mindist * mindist
  word mindist2;
  mathbox_sum = 0;
  mul16(mindist,mindist);
  mindist2 = mathbox_sum;
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

void create_obstacles(byte count) {
  while (count--) {
    Actor* a = new_actor(&tetra_actor);
    a->xx = rand() | 0x8000;
    a->yy = rand();
    a->velx = (int)rand()<<8>>8;
    a->vely = (int)rand()<<8>>8;
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
  return first_actor && first_actor->next == NULL;
}

void main() {
  memset(dvgram, 0x20, sizeof(dvgram)); // HALTs
  dvgwrofs = 0x800;
  make_cached_font();
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
    while (vidframe == (frame & 0x3)) {}
  }
  main();
}
