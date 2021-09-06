
#include <stdio.h>
#include "bios.h"

// http://www.users.globalnet.co.uk/~jg27paw4/pourri/rom-routines.txt

void init_stdio(void) {
  __asm
    ld a,#2
    call 0x1601
  __endasm;
}

int putchar(int ch) {
  if (ch == 10) ch = 13; // newline -> CR
  __asm
    ld	a,4 (ix)
    rst 0x10
  __endasm;
  return ch;
}

void beep(int divisor, int duration) {
  divisor;
  duration;
  __asm
    ld	l,4 (ix)
    ld	h,5 (ix)
    ld	e,6 (ix)
    ld	d,7 (ix)
    call 0x3b5
  __endasm;
}

int keyscan(void) {
  __asm
    call 0x028e
    ld  l,e
    ld  h,d
  __endasm;
}

void waitkey(int frames) {
  frames;
  __asm
    ld	c,4 (ix)
    ld	b,5 (ix)
    call 0x1f3d
  __endasm;
}

void setpixel(unsigned char x, unsigned char y) {
  x;
  y;
  __asm
    ld	c,4 (ix)
    ld	b,5 (ix)
    call 0x22e5
  __endasm;
}

#ifdef __MAIN__

void main() {
  init_stdio();
  printf("HELLO WORLD!\r");
  waitkey(50);
  printf("Wait...\r");
  waitkey(50);
  printf("Done!\r");
  beep(1000,20);
  beep(750,20);
  beep(500,20);
  while (1) {
    int key = keyscan();
    if (key != -1) printf("%04x", key);
  }
  while (1);
}

#endif
