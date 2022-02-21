
#pragma vx_copyright "2020"
#pragma vx_title_pos -100, -80 
#pragma vx_title_size -8, 80
#pragma vx_title "CMOC ROTATE"
#pragma vx_music vx_music_1 

#include "stdlib.h"
#include "bios.h"

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
  *m = IDENTITY;
}

void vec_mat_transform(Vector16* dest, const Vector8* v, const Matrix* m) {
  byte i;
  int* result = &dest->x;
  const sbyte* mval = &m->m[0][0];
  for (i=0; i<3; i++) {
    int sum = 0;
    sum += (int)*mval++ * v->x;
    sum += (int)*mval++ * v->y;
    sum += (int)*mval++ * v->z;
    *result++ = sum;
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
      int x2,y2;
      x2 = scrnverts[i].x >> 8;
      y2 = scrnverts[i].y >> 8;
      if (bright == 0)
        move((char)(x2-x1), (char)(y2-y1));
      else
        line((char)(x2-x1), (char)(y2-y1));
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

word frame = 0;
Matrix m;

int main()
{
  sbyte x,y;
  mat_identity(&m);
  while(1)
  {
    x = isin((byte)frame)>>1;
    y = icos((byte)frame)>>1;
    wait_retrace();
    intensity(0x1f);
    // draw radar line
    move(0,0);
    line(x,y);
    line(-x,-y);
    // draw 3d shape
    mat_rotate(&m, (byte)(frame>>8)&3, (byte)frame);
    draw_wireframe_ortho(&tetra, &m);
    frame++;
  }
  return 0;
}
