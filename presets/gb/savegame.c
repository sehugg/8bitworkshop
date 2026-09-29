/*
Battery-backed save RAM for Game Boy.

The cartridge header declares MBC5 + RAM + battery, with 8 KB of RAM
mapped at 0xA000-0xBFFF. The RAM is switched off at power-up; we
write 0x0A to 0x0000 to enable it and anything else to disable it.

The save is a small record with a signature and a checksum, so that
a fresh cartridge (or one whose battery has died) is not mistaken
for a real save:

  0xA000  "GBSV"        signature
  0xA004  boots         how many times the game has been started
  0xA006  best          best score
  0xA008  check         sum of the bytes above, plus 0x5A

Controls: A adds a point, Start saves the score if it's a new best,
B erases the save. Reset the emulator (or switch a real console off
and on) and the numbers come back.
*/

//#symbol ld GB_MAPPER=0x1B
//#symbol ld GB_RAM_SIZE=0x02

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

typedef struct {
  char magic[4];
  uint16_t boots;
  uint16_t best;
  uint8_t check;
} Save;

#define SAVE ((volatile Save*)0xA000)

#define ENABLE_SAVE_RAM   (*(volatile uint8_t*)0x0000 = 0x0A)
#define DISABLE_SAVE_RAM  (*(volatile uint8_t*)0x0000 = 0x00)

// sum of every byte of the record except the checksum itself
static uint8_t save_sum(void) {
  volatile uint8_t* p = (volatile uint8_t*)SAVE;
  uint8_t i, sum = 0x5A;
  for (i = 0; i < sizeof(Save) - 1; i++) sum += p[i];
  return sum;
}

static uint8_t save_valid(void) {
  return SAVE->magic[0] == 'G' && SAVE->magic[1] == 'B' &&
         SAVE->magic[2] == 'S' && SAVE->magic[3] == 'V' &&
         SAVE->check == save_sum();
}

// RAM must be enabled by the caller
static void save_reset(void) {
  SAVE->magic[0] = 'G'; SAVE->magic[1] = 'B';
  SAVE->magic[2] = 'S'; SAVE->magic[3] = 'V';
  SAVE->boots = 0;
  SAVE->best = 0;
  SAVE->check = save_sum();
}

// format a number as five digits (the division is slow, so
// we do this while the screen is drawing, not during VBlank)
static void fmt_num(char* buf, uint16_t v) {
  uint8_t i;
  for (i = 5; i > 0; i--) {
    buf[i - 1] = '0' + v % 10;
    v /= 10;
  }
  buf[5] = '\0';
}

void main(void) {
  char bootbuf[6], bestbuf[6], scorebuf[6];
  const char* msg;
  uint16_t score = 0, best;
  uint8_t keys, prev = 0, fresh, dirty;

  DISPLAY_OFF;
  BGP_REG = 0xE4;
  font_init();

  // load the save, or start a new one
  ENABLE_SAVE_RAM;
  fresh = !save_valid();
  if (fresh) save_reset();
  SAVE->boots++;
  SAVE->check = save_sum();
  fmt_num(bootbuf, SAVE->boots);
  best = SAVE->best;
  DISABLE_SAVE_RAM;
  fmt_num(bestbuf, best);
  fmt_num(scorebuf, score);

  put_str(5, 2, "SAVE RAM");
  put_str(2, 5, "BOOTS");
  put_str(2, 7, "BEST");
  put_str(2, 9, "SCORE");
  put_str(2, 12, fresh ? "NEW SAVE" : "SAVE LOADED");
  put_str(2, 15, "A ADD  START SAVE");
  put_str(2, 16, "B ERASE");
  put_str(9, 5, bootbuf);
  put_str(9, 7, bestbuf);
  put_str(9, 9, scorebuf);

  SHOW_BKG;
  DISPLAY_ON;

  while (1) {
    keys = joypad();
    dirty = 0;
    msg = 0;

    if ((keys & J_A) && !(prev & J_A)) {
      score++;
      dirty = 1;
    }

    if ((keys & J_START) && !(prev & J_START) && score > best) {
      best = score;
      ENABLE_SAVE_RAM;
      SAVE->best = best;
      SAVE->check = save_sum();
      DISABLE_SAVE_RAM;
      msg = "SAVED      ";
      dirty = 1;
    }

    if ((keys & J_B) && !(prev & J_B)) {
      ENABLE_SAVE_RAM;
      save_reset();
      DISABLE_SAVE_RAM;
      best = 0;
      score = 0;
      msg = "ERASED     ";
      dirty = 1;
    }
    prev = keys;

    if (dirty) {
      fmt_num(bestbuf, best);
      fmt_num(scorebuf, score);
    }

    wait_vbl_done();
    if (dirty) {
      put_str(9, 7, bestbuf);
      put_str(9, 9, scorebuf);
      if (msg) put_str(2, 12, msg);
    }
  }
}
