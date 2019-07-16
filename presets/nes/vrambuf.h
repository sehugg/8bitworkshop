
#ifndef _VRAMBUF_H
#define _VRAMBUF_H

#include "neslib.h"

// VBUFSIZE = maximum update buffer bytes
#define VBUFSIZE 128

// update buffer starts at $100 (stack page)
#define updbuf ((byte*)0x100)

// index to end of buffer
extern byte updptr;

// C versions of macros
#define VRAMBUF_SET(b) updbuf[updptr] = (b);
#define VRAMBUF_ADD(b) VRAMBUF_SET(b); ++updptr

// macro to add a raw header (useful for single bytes)
#define VRAMBUF_PUT(addr,len,flags)\
  VRAMBUF_ADD(((addr) >> 8) | (flags));\
  VRAMBUF_ADD(addr);\
  VRAMBUF_ADD(len);

// OR with address to put vertical run
#define VRAMBUF_VERT	0x8000

// add EOF marker to buffer (but don't increment pointer)
void vrambuf_end(void);

// clear vram buffer and place EOF marker
void vrambuf_clear(void);

// wait for next frame, then clear buffer
// this assumes the NMI will call flush_vram_update()
void vrambuf_flush(void);

// add multiple characters to update buffer
// using horizontal increment
void vrambuf_put(word addr, const char* str, byte len);

#endif // vrambuf.h
