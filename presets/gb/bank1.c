// Everything in this file goes in ROM bank 1.
#pragma bank 1

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"

const char message1[] = "HELLO FROM BANK 1";

void get_message1(char* buf) __banked {
  const char* p = message1;
  while ((*buf++ = *p++));
}

uint8_t which_bank1(void) __banked {
  return _current_bank;
}
