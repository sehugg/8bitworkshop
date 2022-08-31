
#include "common.h"

#define MCB_COLORS 0xc000
#define MCB_BITMAP 0xe000

void setup_bitmap_multi();

byte is_pixel(byte x, byte y);

void set_pixel(byte x, byte y, byte color);

void draw_line(int x0, int y0, int x1, int y1, byte color);

byte flood_fill(byte x, byte y, byte color);
	