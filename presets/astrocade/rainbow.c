
//#resource "astrocade.inc"
#include "aclib.h"
//#link "aclib.s"
#include "acbios.h"
//#link "acbios.s"
//#link "hdr_autostart.s"

#include <stdlib.h>
#include <string.h>

#pragma opt_code_speed

// we have a special interrupt handler that sets
// palette colors every 4 lines
byte linenum = 0;

void inthandler(void) __interrupt {
  byte i = linenum;
  hw_col0l = i;
  hw_col1l = i+1;
  hw_col2l = i+2;
  hw_col3l = i+3;
  i += 4;
  if (i > 200) i = 0;
  hw_inlin = i;
  linenum = i;
}

// pointer to the interrupt handler
const t_interrupt_handler const intvector = &inthandler;

// patterns to fill each 4-line scanline group
const byte FILLPATS[4] = { 0x00, 0x55, 0xaa, 0xff };

void main(void) {
  // fill screen with colors 0-3 every 4 scanlines
  for (byte i=0; i<89; i++) {
    memset(&vidmem[i], FILLPATS[i&3], 40);
  }
  // set our custom interrupt vector
  set_interrupt_vector(&intvector);
  // set screen height
  // set horizontal color split (position / 4)
  // set interrupt status (on)
  SYS_SETOUT(89*2, 20, 0x8);
  // infinite loop
  // let the interrupt handler do the work
  while (1) ;
}
