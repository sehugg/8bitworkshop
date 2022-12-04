
#ifndef _VECFONT_H
#define _VECFONT_H

#include "vecops.h"

extern const word* const VECFONT[];

void draw_char(char ch);
void draw_string(const char* str, byte spacing);

#endif
