
#include "vecops.h"
//#link "vecops.c"

#include "vec3d.h"
//#link "vec3d.c"

const Vector8 tetra_v[] = { {0,-86,86},{86,86,86},{-86,86,86},{0,0,-86} };
const sbyte tetra_e[] = { 0, 1, 2, 0, 3, 1, -1, 3, 2, -2 };
const Wireframe tetra = { 4, tetra_v, tetra_e };

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
