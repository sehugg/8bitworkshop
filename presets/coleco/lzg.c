
#include <cv.h>
#include <cvu.h>
#include <string.h>

const unsigned char LZG_LENGTH_DECODE_LUT[32] = {
  2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,
  18,19,20,21,22,23,24,25,26,27,28,29,35,48,72,128
};

void lzg_decode_vram(const unsigned char* src, unsigned int dest, unsigned int end) {
  static char marker[4];
  unsigned int length, offset;
  unsigned char sym, b, b2;
  
  memcpy(marker, src, 4);
  src += 4;
  while (dest < end) {
    sym = *src++;
    b = *src++;
    // copy commands
    offset = 0;
    length = LZG_LENGTH_DECODE_LUT[b & 0x1f];
    if (sym == marker[0]) {
      if (b == 0) goto literal;
      b2 = *src++;
      offset = ((b2 << 8) | *src++) + 2056; // 16-bit value
    } else if (sym == marker[1]) {
      if (b == 0) goto literal;
      b2 = *src++;
      offset = (((b & 0xe0) << 3) | b2) + 8;
    } else if (sym == marker[2]) {
      length = (b >> 6) + 3;
      offset = (b & 0x3f) + 8;
    } else if (sym == marker[3]) {
      offset = (b >> 5) + 1;
    } else {
      src--;
literal:
      cvu_voutb(sym, dest++);
      continue;
    }
    // escape marker symbol
    if (b == 0) goto literal;
    offset = dest - offset;
    while (length-- && dest < end) {
      b = cvu_vinb(offset++);
      cvu_voutb(b, dest++);
    }
  }
}

