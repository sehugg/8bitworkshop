
#include "aclib.h"

extern void fast_sprite_8(const byte* pattern, byte* dst);
extern void fast_sprite_16(const byte* pattern, byte* dst);
// clips off bottom
extern void fast_sprite_16_yclip(const byte* pattern, byte* dst, byte height);

