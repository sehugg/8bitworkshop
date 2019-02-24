
#ifndef _VRAMBUF_H
#define _VRAMBUF_H

#include "neslib.h"

// VBUFSIZE = maximum update buffer bytes
#define VBUFSIZE 128

// update buffer starts at $100 (stack page)
#define updbuf ((byte*)0x100)

// index to end of buffer
extern byte updptr;

// macros
#define VRAMBUF_PUT(addr,len,flags)\
  updbuf[updptr++] = ((addr) >> 8) | (flags);\
  updbuf[updptr++] = (addr) & 0xff;\
  updbuf[updptr++] = (len);

#define VRAMBUF_ADD(b)\
  updbuf[updptr++] = (b);

// add EOF marker to buffer
void cendbuf(void);

// clear update buffer
void cclearbuf(void);

// flush buffer now, waiting for next frame
void cflushnow(void);

// add multiple characters to update buffer
// using horizontal increment
void putbytes(word addr, char* str, byte len);

#endif // vrambuf.h
