
#ifndef _VECOPS_H
#define _VECOPS_H

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;

extern word dvgwrofs; // write offset for DVG buffer

// DVG operation functions

typedef enum {
  BLACK, BLUE, GREEN, CYAN, RED, MAGENTA, YELLOW, WHITE
} Color;

void dvgclear(void);
void dvgreset(void);
void dvgstart(void);
void dvgwrite(word w);
void VCTR(int dx, int dy, byte bright);
void SVEC(signed char dx, signed char dy, byte bright);
void JSRL(word offset);
void JMPL(word offset);
void RTSL(void);
void CNTR(void);
void HALT(void);
void STAT(byte rgb, byte intens);
void STAT_sparkle(byte intens);
void SCAL(word scale);

// jump to pointer in DVG ROM
void JSRPTR(const word* dvgrom);

// macro versions for DVG ROM constants

#define _VCTR(dx,dy,bright) \
  (dy & 0x1fff), \
  (((bright & 7) << 13) | (dx & 0x1fff))
#define _SVEC(dx,dy,bright) (0x4000 | (dx & 0x1f) | ((bright&7)<<5) | ((dy & 0x1f)<<8))
#define _JSRL(offset) (0xa000 | offset)
#define _JMPL(offset) (0xe000 | offset)
#define _RTSL() (0xc000)
#define _CNTR() (0x8000)
#define _HALT() (0x2000)
#define _STAT(rgb,intens) (0x6000 | ((intens & 0xf)<<4) | (rgb & 7))
#define _SCAL(scale) (0x7000 | scale)

#endif /* _VECOPS_H */
