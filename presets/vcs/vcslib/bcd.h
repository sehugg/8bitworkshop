
#ifndef _BCD_H
#define _BCD_H

#define BCD_ADD(a,b) { \
    int _temp = (b); \
    asm("sed"); \
    (a) += _temp; \
    asm("cld"); \
  }

#define BCD_SUB(a,b) { \
    int _temp = (b); \
    asm("sed"); \
    (a) -= _temp; \
    asm("cld"); \
  }

#endif
