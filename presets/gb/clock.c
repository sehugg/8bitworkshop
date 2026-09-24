/*
Digital clock for Game Boy, reading the MBC3 real-time clock.

The cartridge header declares an MBC3 + timer + battery cart, so
the emulator runs a wall-clock RTC that starts at the current time.
Reading the clock is the same on real hardware:

- write 0x08-0x0C to 0x4000 to select a register
  (0x08 seconds, 0x09 minutes, 0x0A hours, 0x0B/0x0C days+flags)
- write 0x00 then 0x01 to 0x6000 to latch the live time
- read the latched value from 0xA000

The screen redraws only when the seconds change.
*/

//#link "gb/sfr.sgb"
//#link "gb/crt0.sgb"
//#resource "gb/global.sgb"
//#symbol ld GB_MAPPER=0x10

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

// MBC3 registers
#define MBC_SELECT (*(volatile uint8_t*)0x4000)
#define MBC_LATCH  (*(volatile uint8_t*)0x6000)
#define RTC_DATA   (*(volatile uint8_t*)0xA000)

// latch the live clock into the readable registers
static void rtc_latch(void) {
  MBC_LATCH = 0x00;
  MBC_LATCH = 0x01;
}

// read a latched register (0x08-0x0C)
static uint8_t rtc_read(uint8_t reg) {
  MBC_SELECT = reg;
  return RTC_DATA;
}

// write two decimal digits, zero-padded
static void put2(char* p, uint8_t v) {
  p[0] = '0' + (v / 10) % 10;
  p[1] = '0' + (v % 10);
}

void main(void) {
  char buf[9];
  uint8_t last_sec = 0xFF;
  uint8_t sec, min, hour;

  buf[8] = '\0';

  // enable cartridge RAM/RTC access
  MBC_SELECT = 0x00;
  *(volatile uint8_t*)0x0000 = 0x0A;

  DISPLAY_OFF;
  BGP_REG = 0xE4;
  OBP0_REG = OBP1_REG = 0xE4;

  font_init();
  put_str(6, 7, "MBC3 RTC");
  put_str(6, 9, "--:--:--");

  SHOW_BKG;
  DISPLAY_ON;

  while (1) {
    wait_vbl_done();

    rtc_latch();
    sec = rtc_read(0x08);
    min = rtc_read(0x09);
    hour = rtc_read(0x0A);

    if (sec != last_sec) {
      last_sec = sec;
      put2(buf + 0, hour);
      buf[2] = ':';
      put2(buf + 3, min);
      buf[5] = ':';
      put2(buf + 6, sec);
      put_str(6, 9, buf);
    }
  }
}
