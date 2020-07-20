
#include <conio.h>
#include <atari5200.h>

// Atari 5200 20x24 screen example

int main() {
  clrscr();
  // position the cursor, output text
  gotoxy(0,0);
  cputs("Hello Atari 5200");
  // draw a line
  gotoxy(0,23);
  chline(20);
  return 0;
}
