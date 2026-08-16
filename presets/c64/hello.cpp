// Hello World for the Oscar64 optimizing C compiler
// https://github.com/drmortalwombat/oscar64

#include <stdio.h>
#include <conio.h>

int main(void)
{
  clrscr();
  textcolor(COLOR_LT_BLUE);
  gotoxy(10, 10);
  
  // use alternate character set
  putchar(14);

  // p prefix = PETSCII string literal
  printf(p"Hello, world!");

  return 0;
}
