
#include "neslib.h"

word bcd_add(word a, word b) {
  register word c, d;      // intermediate values
  c = a + 0x0666;          // add 6 to each BCD digit
  d = c ^ b;               // sum without carry propagation
  c += b;                  // provisional sum
  d = ~(c ^ d) & 0x1110;   // just the BCD carry bits
  d = (d >> 2) | (d >> 3); // correction
  return c - d;            // corrected BCD sum
}

