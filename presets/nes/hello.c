
#include "nes.h"

unsigned char index;

const unsigned char TEXT[]={"Hello PPU!!!"};

const unsigned char PALETTE[]={0x1, 0x00, 0x10, 0x20}; //blue, gray, lt gray, white

void main (void) {

 // turn off the screen
 PPU.control = 0;
 PPU.mask = 0;
 
 // load the palette
 PPU.vram.address = 0x3f;
 PPU.vram.address = 0x0;
 for(index = 0; index < sizeof(PALETTE); ++index){
  PPU.vram.data = PALETTE[index];
 }

 // load the text
 PPU.vram.address = 0x21; // set an address in the PPU of 0x21ca
 PPU.vram.address = 0xca;  // about the middle of the screen
 for( index = 0; index < sizeof(TEXT); ++index ){
  PPU.vram.data = TEXT[index];
 }
  
 // reset the scroll position 
 PPU.vram.address = 0x20;
 PPU.vram.address = 0x0;
 PPU.scroll = 0;
 PPU.scroll = 0;
 
 // turn on screen
 PPU.control = 0x80; // NMI on
 PPU.mask = 0x1e; // screen on
 
 // infinite loop
 while (1); 
}
