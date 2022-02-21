
#include <stdlib.h>
#include <stdio.h>
#include <ctype.h>
#include <conio.h>

int main (void)
{
  printf("\nKeyboard Test\n");
  while (1) {
    char ch = cgetc();
    printf("%3d ($%2x) = %c\n", ch, ch, ch);
  }
  return EXIT_SUCCESS;
}

