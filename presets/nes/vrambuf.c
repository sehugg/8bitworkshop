
#include "neslib.h"
#include "vrambuf.h"
#include <string.h>

// index to end of buffer
byte updptr = 0;

// add EOF marker to buffer (but don't increment pointer)
void vrambuf_end(void) {
  VRAMBUF_SET(NT_UPD_EOF);
}

// clear vram buffer and place EOF marker
void vrambuf_clear(void) {
  updptr = 0;
  vrambuf_end();
}

// wait for next frame, then clear buffer
// this assumes the NMI will call flush_vram_update()
void vrambuf_flush(void) {
  // make sure buffer has EOF marker
  vrambuf_end();
  // wait for next frame to flush update buffer
  // this will also set the scroll registers properly
  ppu_wait_frame();
  // clear the buffer
  vrambuf_clear();
}

// add multiple characters to update buffer
// using horizontal increment
void vrambuf_put(word addr, register const char* str, byte len) {
  // if bytes won't fit, wait for vsync and flush buffer
  if (VBUFSIZE-4-len < updptr) {
    vrambuf_flush();
  }
  // add vram address
  VRAMBUF_ADD((addr >> 8) ^ NT_UPD_HORZ);
  VRAMBUF_ADD(addr); // only lower 8 bits
  // add length
  VRAMBUF_ADD(len);
  // add data to buffer
  memcpy(updbuf+updptr, str, len);
  updptr += len;
  // place EOF mark
  vrambuf_end();
}
