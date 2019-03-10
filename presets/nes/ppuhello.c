
#include <nes.h>

const unsigned char TEXT[]="Hello PPU!!!!";

const unsigned char PALETTE[]={0x1, 0x00, 0x10, 0x20}; // blue, gray, lt gray, white

void main (void) {
  unsigned char index; // used in 'for' loops

  // if we've just powered on,
  // wait for PPU to warm-up
  waitvsync();
  waitvsync();

  // turn off screen
  PPU.control = 0x0; // NMI off
  PPU.mask = 0x0; // screen off

  // load the palette
  // set PPU address to 0x3f00
  PPU.vram.address = 0x3f;
  PPU.vram.address = 0x00;
  for (index = 0; index < sizeof(PALETTE); index++) {
    PPU.vram.data = PALETTE[index];
  }

  // load the text into VRAM
  // set PPU address to 0x21c9
  PPU.vram.address = 0x21;
  PPU.vram.address = 0xc9;
  for (index = 0; index < sizeof(TEXT); index++) {
    PPU.vram.data = TEXT[index];
  }

  // reset the scroll position to 0
  PPU.scroll = 0;
  PPU.scroll = 0;
  // reset the PPU address to 0x2000 (frame start)
  PPU.vram.address = 0x20;
  PPU.vram.address = 0x00;
 
  // turn on the screen
  PPU.mask = 0x1e;

  // infinite loop
  while (1);
}
