
#include "neslib.h"

word bcd_add(word a, word b) {
  word result = 0;
  byte c = 0;
  byte shift = 0;
  while (shift < 16) {
    byte d = (a & 0xf) + (b & 0xf) + c;
    c = 0;
    while (d >= 10) {
      ++c;
      d -= 10;
    }
    result |= d << shift;
    shift += 4;
    a >>= 4;
    b >>= 4;
  }
  return result;
}

