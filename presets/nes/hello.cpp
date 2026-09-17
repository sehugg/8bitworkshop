/*
A simple "hello world" example using the Oscar64 compiler.

Place the ASCII font into CHR ROM, set the palette, write a message to
the nametable, and turn on the PPU to display video.
*/

#include <nes/neslib.h>

// place the pattern table into CHR ROM (region 0 -> NROM CHR bank)
#pragma section( tiles, 0 )
#pragma region( tbank, 0x0000, 0x2000, , 0, { tiles } )
#pragma data(tiles)
__export char tiles[] = {
#embed "jroatch.chr"
};
#pragma data(data)

// Oscar64's neslib calls this after console reset
void nes_game(void) {
  // set palette colors
  pal_col(0, 0x02);   // dark blue
  pal_col(1, 0x14);   // fuchsia
  pal_col(2, 0x20);   // grey
  pal_col(3, 0x30);   // white

  // write text to the name table
  vram_adr(NTADR_A(2, 2));
  vram_write("HELLO, WORLD!", 13);

  // enable PPU rendering (turn on screen)
  ppu_on_all();

  // infinite loop
  while (1) ;
}
