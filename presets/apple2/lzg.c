/*
LZG decompression library.
See lzh.h and https://liblzg.bitsnbites.eu/
*/

#include <string.h>

const unsigned char LZG_LENGTH_DECODE_LUT[32] = {
  2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,
  18,19,20,21,22,23,24,25,26,27,28,29,35,48,72,128
};

#pragma codesize (200)	// make code faster?

unsigned char* lzg_decode_vram(const unsigned char* _src, 
                     unsigned char* _dest, 
                     unsigned char* _end) {
  // copy params to static locals
  register const unsigned char* src = _src;
  register unsigned char* dest = _dest;
  unsigned char* end = _end;
  // more locals
  char marker[4];
  unsigned int length, offset;
  unsigned char sym, b, b2;
  
  // copy 4 marker bytes to locals
  memcpy(marker, src, 4);
  src += 4;
  // loop until we run out of buffer space
  while (dest < end) {
    sym = src[0];
    b = src[1];
    src += 2;
    // copy commands
    offset = 0;
    b2 = b & 0x1f;
    length = LZG_LENGTH_DECODE_LUT[b2]; // required for aaaa,y
    // look for marker symbols
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
      *dest++ = sym;
      continue;
    }
    // escape marker symbol
    if (b == 0) goto literal;
    // check for dest. overflow
    if (dest + length > end) {
      length = end - dest;
    }
    // copy bytes
    memcpy(dest, dest - offset, length);
    dest += length;
  }
  return dest;
}
