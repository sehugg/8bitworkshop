/*
ROM bank switching for Game Boy.
Code and data in bank1.c and bank2.c live in switchable
ROM banks, mapped at 0x4000-0x7FFF one bank at a time.
A __banked function call switches banks, runs the function,
and switches back.

The ROM grows to fit the highest bank, and the build sets
the ROM size in the header. We pick an MBC5 mapper here;
the build defaults to MBC5 when a ROM has banks.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#link "bank1.c"
//#link "bank2.c"
//#resource "gb/global.sgb"
//#symbol ld GB_MAPPER=0x19

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

// defined in bank1.c and bank2.c
void get_message1(char* buf) __banked;
void get_message2(char* buf) __banked;
uint8_t which_bank1(void) __banked;
uint8_t which_bank2(void) __banked;

// banked data is only readable while its bank is mapped,
// so banked functions copy it into RAM for us
char buf[20];

void main(void) {
  DISPLAY_OFF;
  BGP_REG = 0xE4;
  font_init();

  put_str(2, 2, "BANK SWITCHING");

  get_message1(buf);
  put_str(2, 5, buf);

  get_message2(buf);
  put_str(2, 7, buf);

  // _current_bank tracks the mapped bank
  put_str(2, 10, "BANK 1 SAYS");
  put_char(15, 10, '0' + which_bank1());
  put_str(2, 12, "BANK 2 SAYS");
  put_char(15, 12, '0' + which_bank2());

  SHOW_BKG;
  DISPLAY_ON;
  while (1) {
    wait_vbl_done();
  }
}
