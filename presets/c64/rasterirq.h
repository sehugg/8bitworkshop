#ifndef _RASTERIRQ_H
#define _RASTERIRQ_H


// internal function, use macro instead
void __dlist_setup(void* ptr);
void __dlist_done();

// initialize display list with function 'func'
#define DLIST_SETUP(func) \
  __dlist_setup(((char*)func)-1)

// continue on line 'line'
#define DLIST_NEXT(line) \
  __A__ = line; \
  asm ("jsr DLIST_IRQ_NEXT");

// restart display list on line 'line'
#define DLIST_RESTART(line) \
  __A__ = line; \
  asm ("jmp DLIST_IRQ_RESTART");

// stop display list
#define DLIST_DONE() __dlist_done();

#endif
