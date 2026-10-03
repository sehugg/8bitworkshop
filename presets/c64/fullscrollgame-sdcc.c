// fullscrollgame.c built with SDCC's mos6502 backend instead of cc65.
// The program is fullscrollgame.c; common.h supplies the C64 definitions SDCC lacks.
// (The C files are #included, since cc65 and SDCC objects can't be linked together,
// and the level data from level2.s is converted to C in level2-data.c.)

#include "common.h"
#include "common.c"

#include "scrolling.h"
#include "scrolling2.c"

#include "sprites.h"
#include "sprites.c"

#include "level2-data.c"

#include "fullscrollgame.c"
