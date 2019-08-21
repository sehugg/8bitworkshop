
/*
Bank-switching using the MMC3 mapper.
We use a special linker config that sets up
64 KB of PRG ROM and 64 KB of CHR ROM.
Macros are used to set MMC3 registers and switch banks.
CC65 #pragma directives are used to put things in various
PRG ROM segments (CODE0-CODE6, CODE).
*/

// bank-switching configuration
#define NES_MAPPER 4		// Mapper 4 (MMC3)
#define NES_PRG_BANKS 4		// # of 16KB PRG banks
#define NES_CHR_BANKS 8		// # of 8KB CHR banks

#include <peekpoke.h>
#include <string.h>
#include "neslib.h"

// link the pattern table into CHR ROM
//#link "chr_generic.s"

#define MMC_MODE 0x00

#define MMC3_SET_REG(r,n)\
	POKE(0x8000, MMC_MODE|(r));\
	POKE(0x8001, (n));

#define MMC3_CHR_0000(n) MMC3_SET_REG(0,n)
#define MMC3_CHR_0800(n) MMC3_SET_REG(1,n)
#define MMC3_CHR_1000(n) MMC3_SET_REG(2,n)
#define MMC3_CHR_1400(n) MMC3_SET_REG(3,n)
#define MMC3_CHR_1800(n) MMC3_SET_REG(4,n)
#define MMC3_CHR_1C00(n) MMC3_SET_REG(5,n)
#define MMC3_PRG_8000(n) MMC3_SET_REG(6,n)
#define MMC3_PRG_A000(n) MMC3_SET_REG(7,n)

#define MMC3_MIRROR(n) POKE(0xa000, (n))

#pragma rodata-name("CODE0")
const unsigned char TEXT0[]={"Bank 0 @ 8000"};
#pragma rodata-name("CODE1")
const unsigned char TEXT1[]={"Bank 1 @ 8000"};
#pragma rodata-name("CODE5")
const unsigned char TEXT5[]={"Bank 5 @ A000"};
#pragma rodata-name("CODE6")
const unsigned char TEXT6[]={"Bank 6 @ C000"};

// put functions in bank 1
#pragma code-name("CODE1")

void draw_text(word addr, const char* text) {
  vram_adr(addr);
  vram_write(text, strlen(text));
}

// back to main code segment
#pragma code-name("CODE")

void main(void)
{
  // set palette colors
  pal_col(1,0x04);
  pal_col(2,0x20);
  pal_col(3,0x30);
  // setup CHR bank switching for background
  MMC3_CHR_0000(0);
  MMC3_CHR_0800(1);
  // select bank 0 in $8000-$9fff
  MMC3_PRG_8000(0);
  vram_adr(NTADR_A(2,2));
  vram_write(TEXT0, 13);
  // select bank 1 in $8000-$9fff
  // also needed to call draw_text()
  MMC3_PRG_8000(1);
  draw_text(NTADR_A(2,3), TEXT1);
  // select bank 5 in $a000-$bfff
  MMC3_PRG_A000(5);
  draw_text(NTADR_A(2,4), TEXT5);
  // $c000-$dfff is fixed to bank 6
  draw_text(NTADR_A(2,5), TEXT6);  
  //enable rendering
  ppu_on_all();
  while(1);//do nothing, infinite loop
}
