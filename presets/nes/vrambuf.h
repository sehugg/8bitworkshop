
#ifndef _VRAMBUF_H
#define _VRAMBUF_H

#include "neslib.h"

// VBUFSIZE = maximum update buffer bytes
#define VBUFSIZE 128

// update buffer starts at $100 (stack page)
#define updbuf ((byte* const)0x100)

// index to end of buffer
extern byte updptr;

// macro to add a multibyte header
#define VRAMBUF_PUT(addr,len,flags)\
  VRAMBUF_ADD(((addr) >> 8) | (flags));\
  VRAMBUF_ADD(addr);\
  VRAMBUF_ADD(len);

// macro to set a single byte in buffer
#define VRAMBUF_SET(b)\
  __A__ = (b);\
  asm("ldy %v", updptr);\
  asm("sta $100,y");

// macro to set a single byte to buffer, then increment
#define VRAMBUF_ADD(b)\
  VRAMBUF_SET(b)\
  asm("inc %v", updptr);

// add EOF marker to buffer (but don't increment pointer)
void cendbuf(void);

// clear vram buffer and place EOF marker
void cclearbuf(void);

// wait for next frame, then clear buffer
// this assumes the NMI will call flush_vram_update()
void cflushnow(void);

// add multiple characters to update buffer
// using horizontal increment
void putbytes(word addr, const char* str, byte len);

#endif // vrambuf.h
