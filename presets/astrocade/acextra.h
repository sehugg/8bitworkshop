
#ifndef _ACEXTRA_H
#define _ACEXTRA_H

#include "aclib.h"

// special case for draw_sprite()
#define M_ERASE		0x04

// font constants
#define LOCHAR 32
#define HICHAR 127
#define FONT_BWIDTH 1
#define FONT_HEIGHT 8

void clrscr();
void vline(byte x, byte y1, byte y2, byte col, byte op);
void pixel(byte x, byte y, byte col, byte op);
void render_sprite(const byte* src, byte x, byte y, byte op);
void draw_char(byte ch, byte x, byte y, byte op);
void draw_string(byte x, byte y, byte options, const char* str);
void draw_bcd_word(word bcd, byte x, byte y, byte op);
word bcd_add(word a, word b);

#define pixel(x,y,color,op) vline(x, y, y, color, op);
#define erase_sprite(src,x,y) render_sprite(src,x,y,M_ERASE);

#endif
