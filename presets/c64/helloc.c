
#include <stdio.h>
#include <conio.h>
#include <c64.h>
#include <cbm_petscii_charmap.h>

void main(void) {
  clrscr();			// clear screen
  puts("Hello World!\n");	// write message at cursor
  chline(12);			// horizontal line
  bordercolor(COLOR_LIGHTBLUE);	// set color to blue
  bgcolor(COLOR_GREEN);		// set background color
  textcolor(COLOR_YELLOW);	// set text color
  puts("\nThis text is yellow!\n"); // write message
  cgetc();			// wait for input
}
