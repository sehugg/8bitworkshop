
#include "neslib.h"
#include "vrambuf.h"

// index to end of buffer
byte updptr = 0;

// add EOF marker to buffer
void cendbuf(void) {
  updbuf[updptr] = NT_UPD_EOF;
}

void cclearbuf(void) {
  updptr = 0;
  cendbuf();
}

// flush buffer now, waiting for next frame
void cflushnow(void) {
  // make sure buffer has EOF marker
  cendbuf();
  // wait for next frame to flush update buffer
  // this will also set the scroll registers properly
  ppu_wait_frame();
  // clear the buffer
  cclearbuf();
}

// add multiple characters to update buffer
// using horizontal increment
void putbytes(word addr, const char* str, byte len) {
  // if bytes won't fit, wait for vsync and flush buffer
  if (updptr >= VBUFSIZE-4-len) cflushnow();
  // add vram address
  updbuf[updptr] = (addr >> 8) ^ NT_UPD_HORZ;
  updbuf[++updptr] = addr & 0xff;
  // add length
  updbuf[++updptr] = len;
  // add bytes
  while (len--) {
    	updbuf[++updptr] = *str++;
  }
  ++updptr;
  // add EOF mark
  cendbuf();
}
