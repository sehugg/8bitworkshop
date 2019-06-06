
/**
AstroLibre
An open source Bally Astrocade BIOS implementation in C
by Steven Hugg (@sehugg) for 8bitworkshop.com

To the extent possible under law, the author(s) have
dedicated all copyright and related and neighboring
rights to this software to the public domain worldwide.
This software is distributed without any warranty.

See: http://creativecommons.org/publicdomain/zero/1.0/
**/

//#resource "astrocade.inc"
//#link "biosasm.s"

// demo code
//#link "test1.s"

// music processor
//#link "bmusic.c"

// input
//#link "input.c"

// graphics
//#link "gfx.c"

#include <string.h>

#include "bios.h"

// uncomment to make code better, but slower compile
#pragma opt_code_speed

// start @ $4FCE
volatile word MUZPC;   // music PC
volatile word MUZSP;   // music SP
volatile byte PVOLAB;  // channels A and B volume
volatile byte PVOLMC;  // channel C volume and noise mask
volatile byte VOICES;  // voice smask

volatile byte CT[8];   // counter timers

// for SENTRY
volatile byte CNT;
volatile byte SEMI4S;
volatile byte OPOT[4];
volatile byte KEYSEX;
volatile byte OSW[4];
volatile word COLLST;

volatile byte DURAT;   // note duration
volatile byte TMR60;   // 1/60 sec timer
volatile byte TIMOUT;  // blackout timer
volatile byte GTSECS;  // seconds timer
volatile byte GTMINS;  // minutes timer

unsigned long RANSHT;	// RNG
byte NUMPLY;		// # players
byte ENDSCR[3];		// end score
byte MRLOCK;		// magic register lock out
byte GAMSTB;		// game status
byte PRIOR;		// music protect
byte SENFLG; 		// sentry control

byte* UMARGT;		// user mask table (-64 bytes)
word* USERTB;		// user routine table (-128 bytes)

// from bmusic.c
extern void music_update(void);

// INTERRUPT HANDLER
//#define USE_ALT_REGS
void hw_interrupt()
#ifdef USE_ALT_REGS
__naked {
  __asm__("ex af,af'");
  __asm__("exx");
#else
__interrupt {
#endif
  CT[0]++;
  CT[1]++;
  CT[2]++;
  CT[3]++;
  if (++TMR60 == 60) {
    TMR60 = 0;
    ++TIMOUT;
    KEYSEX |= 0x80; // notify SENTRY
    if (++GTSECS == 60) {
      GTMINS++;
    }
  }
  // TODO?
  if (VOICES) {
    if (DURAT) {
      DURAT--;
    } else {
      music_update();
    }
  }
#ifdef USE_ALT_REGS
  __asm__("exx");
  __asm__("ex af,af'");
  __asm__("ei");
  __asm__("reti");
#endif
}

void add_counters(byte mask, byte delta) {
  byte i = 0;
  while (mask) {
    if (mask & 1) {
      if (CT[i]) {
        // notify SENTRY if counters go to 0
        if (!(CT[i] += delta)) {
          SENFLG |= 1<<i;
        }
      }
    }
    mask >>= 1;
    i++;
  }
}

void STIMER() {
}

void CTIMER() {
}

void TIMEZ() {
  // updates game timer, blackout timer, and music processor
}

void TIMEY() {
  add_counters(0x0f, -1);
}

void TIMEX() {
}
  
void DECCTS(ContextBlock *ctx) {
  add_counters(_C, -1);
}

// INTERPRETER

void INTPC(ContextBlock *ctx) {
  while (ctx->params[0] > 2) { // 0,2 = exit
    SYSCALL(ctx);
  }
  ctx->params++; // skip EXIT opcode
}

// never called, hopefully
void EXIT(ContextBlock *ctx) {
  ctx;
}

// jumps to HL
void RCALL(ContextBlock *ctx) {
  ((Routine*)_HL)();
}

// start interpreting at HL
void MCALL(ContextBlock *ctx) {
  ctx->params = (byte*)_HL;
  while (ctx->params[0] != 8) { // 8 = MRET
    SYSCALL(ctx);
  }
}

// exit MCALL loop
void MRET(ContextBlock *ctx) {
  ctx; // TODO
}

void NOOP(ContextBlock *ctx) {
  ctx;
}

// jump within MCALL
void MJUMP(ContextBlock *ctx) {
  ctx->params = (byte*) _HL; // TODO?
}

void suckParams(ContextBlock *ctx, byte argmask) {
  byte* dest = (byte*) ctx;
  byte* src = ctx->params;
  if (argmask & REG_IX) {
    _IXL = *src++;
    _IXH = *src++;
  }
  if (argmask & REG_E)
    _E = *src++;
  if (argmask & REG_D)
    _D = *src++;
  if (argmask & REG_C)
    _C = *src++;
  if (argmask & REG_B)
    _B = *src++;
  if (argmask & REG_A)
    _A = *src++;
  if (argmask & REG_HL) {
    _L = *src++;
    _H = *src++;
  }
  ctx->params = src;
}

void SUCK(ContextBlock* ctx) {
  suckParams(ctx, _B);
}


const void* const actint_vec = &hw_interrupt;

void ACTINT(ContextBlock *ctx) {
  ctx;
__asm
  LD	BC,#(_actint_vec)  ; upper 8 bits of address
  LD	A,B
  LD	I,A
  IM	2	; mode 2
  EI		; enable interrupts
__endasm;
  hw_inlin = 200;
  hw_infbk = (byte) &actint_vec;
  hw_inmod = 0x8;
  TIMEZ();
  TIMEY();
}

// Outputs D to port 0A, B to port 09, A to port 0E.
void SETOUT(ContextBlock *ctx) {
  hw_verbl = _D;
  hw_horcb = _B;
  hw_inmod = _A;
}

// set entire palette at once (8 bytes to port 0xb)
// bytes in array should be in reverse
void set_palette(byte palette[8]) __z88dk_fastcall;

// sets color palettes from (HL)
void COLSET(ContextBlock *ctx) {
  set_palette((byte*)_HL);
}

// Stores A in BC bytes starting at location DE.
void FILL(ContextBlock *ctx) {
  byte* dest = (byte*) _DE;
  word count = _BC;
  byte val = _A;
  memset(dest, val, count);
}

void wait_vsync() {
  byte x = TMR60;
  while (x == TMR60) ; // wait until timer/60 changes
}

void PAWS(ContextBlock *ctx) {
  while (_B--) {
    wait_vsync();
  }
}

// MATH

void MOVE(ContextBlock *ctx) {
  memcpy((byte*)_DE, (const byte*)_HL, _BC);
}

word bcdadd8(byte a, byte b, byte c);

void BCDADD(ContextBlock *ctx) {
  byte* dest = (byte*) _DE;
  const byte* src = (const byte*) _HL;
  byte n = _B;
  byte carry = 0;
  while (n--) {
    byte a = *src++;
    byte b = *dest;
    word r = bcdadd8(a,b,carry);
    carry = (r>>8);
    *dest++ = r;
  }
}

void RANGED(ContextBlock *ctx) {
  /* Algorithm "xor" from p. 4 of Marsaglia, "Xorshift RNGs" */
  RANSHT ^= RANSHT << 13;
  RANSHT ^= RANSHT >> 17;
  RANSHT ^= RANSHT << 5;
  if (_A == 0) {
    _A = (byte)RANSHT;
  } else {
    _A = (byte)(RANSHT % _A);
  }
}

void INDEXB(ContextBlock *ctx) {
  word addr = _HL + _A;
  _HL = addr;
  _A = *((byte*)addr);
}

void INDEXW(ContextBlock *ctx) {
  word addr = _HL + _A*2;
  _HL = addr;
  _DE = *((word*)addr);
}

void INDEXN(ContextBlock *ctx) {
  byte ofs = _C;
  word addr = _HL + ofs/2;
  byte val = *((byte*)addr);
  _A = (ofs & 1) ? (val>>4) : (val&0xf);
}

// input

extern const byte KCTASC_TABLE[25];

void KCTASC(ContextBlock *ctx) {
  _A = KCTASC_TABLE[_B];
}

// music

void BMUSIC(ContextBlock *ctx) {
  VOICES = _A;
  MUZPC = _HL;
  MUZSP = _IX;
  DURAT = 0;
}

void EMUSIC(ContextBlock *ctx) {
  ctx;
  VOICES = 0;
}

// externals

extern void SENTRY(ContextBlock *ctx);
extern void DOIT(ContextBlock *ctx);
extern void DOITB(ContextBlock *ctx);

extern void RECTAN(const ContextBlock *ctx);
extern void WRITR(const ContextBlock *ctx);
extern void WRITP(const ContextBlock *ctx);
extern void WRIT(const ContextBlock *ctx);
extern void CHRDIS(const ContextBlock *ctx);
extern void STRDIS(const ContextBlock *ctx);
extern void DISNUM(const ContextBlock *ctx);

// table

const SysCallEntry SYSCALL_TABLE[64] = {
  /* 0 */
  { &INTPC,	0 },
  { &EXIT,	0 },
  { &RCALL,	REG_HL },
  { &MCALL,	REG_HL },
  { &MRET, 	0 },
  /* 10 */
  { &MJUMP,	REG_HL },
  { &SUCK,	REG_B },
  { &ACTINT,	0 },
  { &DECCTS,	REG_C },
  { &BMUSIC,    REG_HL|REG_IX|REG_A },
  /* 20 */
  { &EMUSIC,    },
  { &SETOUT,	REG_D|REG_B|REG_A },
  { &COLSET,	REG_HL },
  { &FILL,	REG_A|REG_BC|REG_DE },
  { &RECTAN,	REG_A|REG_B|REG_C|REG_D|REG_E },
  /* 30 */
  { &NOOP,	REG_HL|REG_IX },	// VWRITR
  { &WRITR,  	REG_E|REG_D|REG_A|REG_HL },
  { &WRITP,  	REG_E|REG_D|REG_A|REG_HL },
  { &WRIT,   	REG_E|REG_D|REG_C|REG_B|REG_A|REG_HL },
  { &NOOP,	REG_E|REG_D|REG_C|REG_B|REG_A|REG_HL },	// WRITA
  /* 40 */
  { &NOOP,	REG_E|REG_D|REG_IX },	// VBLANK
  { &NOOP,	REG_E|REG_D|REG_B|REG_HL },	// BLANK
  { &NOOP,	REG_B|REG_C|REG_DE|REG_HL },	// SAVE
  { &NOOP,	REG_DE|REG_HL },	// RESTORE
  { &NOOP,	REG_B|REG_C|REG_DE|REG_HL },	// SCROLL
  /* 50 */
  { &CHRDIS,	REG_E|REG_D|REG_C|REG_A },
  { &STRDIS,	REG_E|REG_D|REG_C|REG_HL },
  { &DISNUM,	REG_E|REG_D|REG_C|REG_B|REG_HL },
  { &NOOP,	REG_DE|REG_A },	// RELABS
  { &NOOP,	REG_E|REG_D|REG_A },	// RELAB1
  /* 60 */
  { &NOOP,	REG_IX|REG_HL|REG_C },	// VECTC
  { &NOOP,	REG_IX|REG_HL },	// VECT
  { &KCTASC,	0 },
  { &SENTRY, 	REG_DE },
  { &DOIT,	REG_HL },
  /* 70 */
  { &DOITB,	REG_HL },
  { &NOOP,	0 },	// PIZBRK
  { &NOOP,	REG_DE|REG_HL },	// MENU
  { &NOOP,	REG_BC|REG_HL },	// GETPAR
  { &NOOP,	REG_B|REG_C|REG_D|REG_E|REG_HL },	// GETNUM
  /* 80 */
  { &PAWS,	REG_B },
  { &NOOP,	REG_E|REG_D|REG_C },	// DISTIM
  { &NOOP,	REG_HL },	// INCSCR
  { &INDEXN,	REG_C|REG_HL },	// INDEXN
  { &NOOP,	REG_HL },	// STOREN
  /* 90 */
  { &INDEXW,	REG_A|REG_HL },	// INDEXW
  { &INDEXB,	REG_A|REG_HL },	// INDEXB
  { &MOVE,	REG_DE|REG_BC|REG_HL },
  { &NOOP,	0 },	// SHIFTU
  { &BCDADD,	REG_DE|REG_B|REG_HL },
  /* 100 */
  { &NOOP,	0 },	// BCDSUB
  { &NOOP,	0 },	// BCDMUL
  { &NOOP,	0 },	// BCDDIV
  { &NOOP,	0 },	// BCDCHS
  { &NOOP,	0 },	// BCDNEG
  /* 110 */
  { &NOOP,	0 },	// DADD
  { &NOOP,	0 },	// DSMG
  { &NOOP,	0 },	// DABS
  { &NOOP,	0 },	// NEGT
  { &RANGED,	REG_A },
  /* 120 */
  { &NOOP,	0 },	// QUIT
  { &NOOP,	REG_A|REG_HL },	// SETB
  { &NOOP,	REG_DE|REG_HL },	// SETW
  { &NOOP,	REG_C|REG_DE|REG_HL },	// MSKTD
};

void SYSCALL(ContextBlock *ctx) {
  byte op = *ctx->params++;
  byte argmask;
  SysRoutine* routine;
  // user-defined?
  if (op & 0x80) {
    argmask = UMARGT[op>>1];
    routine = (SysRoutine*) USERTB[op>>1];
  } else {
    const SysCallEntry* entry = &SYSCALL_TABLE[op>>1];
    argmask = entry->argmask;
    routine = entry->routine;
  }
  // suck params into context block?
  if (op & 1) {
    suckParams(ctx, argmask);
  }
  // call the routine
  routine(ctx);
}

void bios_init() {
  ContextBlock ctx;
  memset((void*)0x4fce, 0, 0x5000-0x4fce);
  ACTINT(0);
  hw_verbl = 96*2;
  hw_horcb = 41;
  hw_inmod = 0x8;
  // call SENTRY once to set current values
  // (context block doesn't matter)
  SENTRY(&ctx);
}
