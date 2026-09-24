// Everything in this file goes in ROM bank 2.
#pragma bank 2

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"

const char message2[] = "HELLO FROM BANK 2";

void get_message2(char* buf) __banked {
  const char* p = message2;
  while ((*buf++ = *p++));
}

uint8_t which_bank2(void) __banked {
  return _current_bank;
}
