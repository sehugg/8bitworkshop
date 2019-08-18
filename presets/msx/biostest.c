
#include "msxbios.h"
//#link "msxbios.c"

const char* STR = "HELLO WORLD!";

void main() {
  int i;
  FORCLR = COLOR_WHITE;
  BAKCLR = COLOR_BLUE;
  BDRCLR = COLOR_GREEN;
  CHGCLR(); 
  DISSCR();
  ENASCR();
  POSIT(11+11*256);
  CHPUT('C');
  WRTVDP(0x070e); // reg 7, color e
  WRTVRM(0x1962, '1');
  SETRD();
  SETWRT();
  FILVRM(0x19a2, 33*8, '2');
  LDIRVM(0x18c2, STR, 12);
  i = CHGET();
  CHPUT(i);
  CLS();
  CHPUT('.');
  CHPUT(i);
  while (1);
}
