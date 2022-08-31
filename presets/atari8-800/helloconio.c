
#include <conio.h>
#include <atari.h>

void main() {
  clrscr();
  // position the cursor, output text
  gotoxy(0,1);
  cputs("Hello Atari 8-bit World!\r\n\r\nPlease type a key...\r\n");
  // read from the console
  // cartridge ROMs do not exit, so loop forever
  while (1) {
    cprintf("You typed character code %d!\r\n", cgetc());
  }
}
