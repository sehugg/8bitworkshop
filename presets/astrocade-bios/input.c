
#include "bios.h"

#include <string.h>

#pragma opt_code_speed

// for SENTRY
extern volatile byte CNT;
extern volatile byte SEMI4S;
extern volatile byte OPOT[4];
extern volatile byte KEYSEX;
extern volatile byte OSW[4];
extern volatile word COLLST;
extern volatile byte SENFLG;
extern volatile byte TIMOUT;

void RCALL(ContextBlock *ctx);
void MCALL(ContextBlock *ctx);

void SENTRY(ContextBlock *ctx) {
  byte i;
  byte A = SNUL;
  byte B = 0;
  byte key = 0;
  byte val[4];
  // joysticks and switches
  val[0] = hw_p1ctrl;
  val[1] = hw_p2ctrl;
  val[2] = hw_p3ctrl;
  val[3] = hw_p4ctrl;
  for (i=0; i<4; i++) {
    if (val[i] != OSW[i]) {
      A = SJ0+i*2;
      if ((val[i] ^ OSW[i]) & 0x10) {
        A++;
      }
      B = val[i];
    }
  }
  memcpy(OSW, val, 4); // update previous state
  // keypad
  val[0] = hw_keypad0;
  val[1] = hw_keypad1;
  val[2] = hw_keypad2;
  val[3] = hw_keypad3;
  for (i=0; i<4; i++) {
    // key down? and with mask
    if (val[i] && (val[i] &= ((byte*)_DE)[i])) {
      key = i+1;
      while (val[i]) {
        key += 4;
        val[i] >>= 1;
      }
    }
  }
  // key up?
  // TODO: race condition with KEYSEX and interrupt
  if (key && key != KEYSEX) {
    B = KEYSEX = key;
    A = SKYD;
  }
  else if (!key && KEYSEX) {
    if (KEYSEX & 0x80) {
      A = SSEC;	// second timer
    } else {
      A = SKYU;
    }
    B = 0;
    KEYSEX = 0;
  }
  // pots
  val[0] = hw_p1pot;
  val[1] = hw_p2pot;
  val[2] = hw_p3pot;
  val[3] = hw_p4pot;
  for (i=0; i<4; i++) {
    if (val[i] != OPOT[i]) {
      A = SP0+i;
      B = val[i];
    }
  }
  memcpy(OPOT, val, 4); // update previous state
  // semiphores
  if (SEMI4S) {
    B = SEMI4S;
    for (i=7; i>=0; i--) {
      if (B & 0x80) {
        A = SF0+i;
        SEMI4S ^= 1 << i;
        break;
      }
      B <<= 1;
    }
  }
  // counters
  if (SENFLG) {
    B = SENFLG;
    for (i=7; i>=0; i--) {
      if (B & 0x80) {
        A = SF0+i;
        SENFLG ^= 1 << i;
        break;
      }
      B <<= 1;
    }
  }
  // clear timeout counter (TODO)
  if (A >= SKYU) {
    TIMOUT = 0xff;
  }
  _A = A;
  _B = B;
}

void DOIT(ContextBlock *ctx) {
  byte* list = (byte*) _HL;
  byte code = _A;
  byte op;
  while ((op = *list) < 0xc0) {
    if ((op & 0x3f) == code) {
      _HL = *(word*)(list+1);
      switch (op & 0xc0) {
        // TODO: JMP
        case 0x00:
        // RCALL
        case 0x40:
          RCALL(ctx);
          break;
        // MCALL
        case 0x80:
          MCALL(ctx);
          break;
      }
      return;
    }
    list += 3;
  }
}

void DOITB(ContextBlock *ctx) {
  _A = _B;
  DOIT(ctx);
}

