
const __sfr __at (0x0) command;
__sfr __at (0x0) dac;

#define HALT __asm halt __endasm;

// press "2" or higher to activate...

void main() {
  char i;
  char j;
  if (command == 0) HALT;
  for (i=0; i<255; i++) {
    for (j=0; j<i; j++) dac=j^i;
  }
  HALT;
}
