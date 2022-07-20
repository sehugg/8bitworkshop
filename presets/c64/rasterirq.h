#ifndef _RASTERIRQ_H
#define _RASTERIRQ_H


void dlist_setup(void* ptr);

#define DLIST_SETUP(func) \
  dlist_setup(((char*)func)-1)

#define DLIST_NEXT(line) \
  __A__ = line; \
  asm ("jsr DLIST_IRQ_NEXT");

#define DLIST_RESTART(line) \
  __A__ = line; \
  asm ("jmp DLIST_IRQ_RESTART");


#endif
