
#include <string.h>

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;

word __at(0xa000) dvgram[0x1000];
byte __at(0x8840) _dvgstart;

volatile int __at(0x8100) mathbox_sum;
sbyte __at(0x8102) mathbox_arg1;
sbyte __at(0x8103) mathbox_arg2;
byte __at(0x810f) mathbox_go_mul;

//

void main();

void start() {
__asm
        LD      SP,#0x0
        DI
__endasm;
  main();
}

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

inline void SVEC(sbyte dx, sbyte dy, byte bright) {
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

///

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

const Matrix IDENTITY = {{{127,0,0},{0,127,0},{0,0,127}}};

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

/*
void vec_mat_transform2(Vector16* dest, const Vector8* v, const Matrix* m) {
  dest->x = v->x*m->m[0][0] + v->y*m->m[0][1] + v->z*m->m[0][2];
  dest->y = v->x*m->m[1][0] + v->y*m->m[1][1] + v->z*m->m[1][2];
  dest->z = v->x*m->m[2][0] + v->y*m->m[2][1] + v->z*m->m[2][2];
}
*/

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
      m->m[1][0] = sin;
      m->m[0][1] = -sin;
      m->m[1][1] = cos;
      break;
  }
}

const Vector8 tetra_v[] = { {0,-86,86},{86,86,86},{-86,86,86},{0,0,-86} };
const char tetra_e[] = { 0, 1, 2, 0, 3, 1, -1, 3, 2, -2 };
const Wireframe tetra = { 4, tetra_v, tetra_e };

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

///

word frame;

void main() {
  int x,y;
  Matrix m;
  mat_identity(&m);
  while (1) {
    dvgreset();
    CNTR();
    SCAL(0x1f);
    STAT(RED, 5);
    x = isin(frame/8);
    y = icos(frame/8);
    VCTR(x, y, 2);
    STAT(GREEN, 15);
    mat_rotate(&m, (frame>>8)&3, frame);
    draw_wireframe_ortho(&tetra, &m);
    HALT();
    dvgstart();
    frame++;
  }
}
