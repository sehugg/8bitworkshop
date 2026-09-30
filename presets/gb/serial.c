/*
Serial link port on Game Boy.

Two Game Boys shift bytes through a link cable, one bit at a time, at the
same moment: each side sends its SB register and receives the other's.
One side supplies the clock (the master, SC = $81); the other waits for it
(the slave, SC = $80). When all 8 bits have moved, SC bit 7 clears, SB
holds the byte that came in, and the serial interrupt fires.

This demo stays a slave until you press A, which starts a transfer as the
master, sending a counter. Whichever side gets a byte shows it. With no
cable connected a master reads back $FF and a slave just waits.
*/

#include <stdint.h>
#include "gb/types.h"
#include "gb/hardware.h"
#include "gb/gb.h"
#include "gbtext.h"

// write a byte as two hex digits
static void put_hex(uint8_t x, uint8_t y, uint8_t v) {
  char buf[3];
  buf[0] = "0123456789ABCDEF"[v >> 4];
  buf[1] = "0123456789ABCDEF"[v & 15];
  buf[2] = '\0';
  put_str(x, y, buf);
}

void main(void) {
  uint8_t keys, last_keys = 0;
  uint8_t tx = 1;       // next byte to send
  uint8_t rx = 0;       // last byte received
  uint8_t count = 0;    // completed transfers
  uint8_t busy = 0;     // a transfer is armed or running

  DISPLAY_OFF;
  BGP_REG = OBP0_REG = OBP1_REG = 0xE4;
  font_init();

  put_str(4, 0,  "SERIAL LINK");
  put_str(2, 3,  "SEND");
  put_str(2, 5,  "RECV");
  put_str(2, 7,  "COUNT");
  put_str(2, 12, "A: SEND AS MASTER");

  SHOW_BKG;
  DISPLAY_ON;

  while (1) {
    wait_vbl_done();
    keys = joypad();

    // a transfer finished: SC bit 7 is cleared by the hardware
    if (busy && !(SC_REG & 0x80)) {
      rx = SB_REG;
      count++;
      busy = 0;
    }

    if ((keys & J_A) && !(last_keys & J_A)) {
      // become the master: SB goes out, SC bit 0 selects our own clock
      SB_REG = tx;
      SC_REG = 0x81;
      put_hex(8, 3, tx);
      tx++;
      busy = 1;
    } else if (!busy) {
      // wait for the other side to clock us, and reply with the next byte
      SB_REG = tx;
      SC_REG = 0x80;
      busy = 1;
    }
    last_keys = keys;

    put_hex(8, 5, rx);
    put_hex(8, 7, count);
  }
}
