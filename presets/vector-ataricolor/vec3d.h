
#ifndef _VEC3D_H
#define _VEC3D_H

#include "vecops.h"

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

extern const Matrix IDENTITY;

void mat_identity(Matrix* m);
void vec_mat_transform(Vector16* dest, const Vector8* v, const Matrix* m);
sbyte isin(byte x0);
sbyte icos(byte x);
void mat_rotate(Matrix* m, byte axis, byte angle);
void xform_vertices(Vector16* dest, const Vector8* src, const Matrix* m, byte nv);
void draw_wireframe(const Wireframe* wf, Vector16* scrnverts);
void draw_wireframe_ortho(const Wireframe* wf, const Matrix* m);

#endif
