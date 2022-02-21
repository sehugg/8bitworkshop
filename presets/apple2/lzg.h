
/*
Decode a LZG buffer (without the 16-byte header) to memory.
  src = source buffer
  dest = destination buffer
  end = 1 + final byte in destination buffer
*/
unsigned char* lzg_decode_vram(const unsigned char* src, 
                               unsigned char* dest, 
                               unsigned char* end);

