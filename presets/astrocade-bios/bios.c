

#define TEST

#include <string.h>

typedef unsigned char byte;
typedef signed char sbyte;
typedef unsigned short word;
typedef signed short sword;

/// HARDWARE

__sfr __at(0x00) hw_col0r;	// palette 0
__sfr __at(0x01) hw_col1r;
__sfr __at(0x02) hw_col2r;
__sfr __at(0x03) hw_col3r;
__sfr __at(0x04) hw_col0l;
__sfr __at(0x05) hw_col1l;
__sfr __at(0x06) hw_col2l;
__sfr __at(0x07) hw_col3l;	// palette 7

__sfr __at(0x08) hw_intst;	// intercept test feedback
__sfr __at(0x09) hw_horcb;	// horiz color boundary
__sfr __at(0x0a) hw_verbl;	// vertical blanking line * 2
__sfr __at(0x0c) hw_magic;	// magic register
__sfr __at(0x0d) hw_infbk;	// interrupt feedback
__sfr __at(0x0e) hw_inmod;	// interrupt enable
__sfr __at(0x0f) hw_inlin;	// interrupt line
__sfr __at(0x19) hw_xpand;	// expander register

__sfr __at(0x10) hw_p1ctrl;	// player controls
__sfr __at(0x11) hw_p2ctrl;	// player controls
__sfr __at(0x12) hw_p3ctrl;	// player controls
__sfr __at(0x13) hw_p4ctrl;	// player controls

#define M_SHIFT0	0x00
#define M_SHIFT1	0x01
#define M_SHIFT2	0x02
#define M_SHIFT3	0x03
#define M_XPAND		0x08
#define M_MOVE		0x00
#define M_OR		0x10
#define M_XOR		0x20
#define M_FLOP		0x40
#define M_SHIFT(x)	((x)&3)
#define XPAND_COLORS(off,on) (((off)&3) | (((on)&3)<<2))

// font options
#define OPT_1x1		0x00
#define OPT_2x2		0x40
#define OPT_4x4		0x80
#define OPT_8x8		0xc0
#define OPT_XOR		0x20
#define OPT_OR		0x10
#define OPT_ON(n)	((n)<<2)
#define OPT_OFF(n)	((n))

// bcd options
#define DISBCD_SML	0x40
#define DISBCD_NOZERO	0x80

/// GRAPHICS FUNCTIONS

#define VHEIGHT 89	// number of scanlines
#define VBWIDTH 40	// number of bytes per scanline
#define PIXWIDTH 160	// 4 pixels per byte

//#define EXIT_CLIPDEST(addr) if ((((word)addr)&0xfff) >= 0xe10) return
#define EXIT_CLIPDEST(addr)

byte __at (0x0000) vmagic[VHEIGHT][VBWIDTH];
byte __at (0x4000) vidmem[VHEIGHT][VBWIDTH];

// start @ $4FCE
volatile word MUZPC;   // music PC
volatile word MUZSP;   // music SP
volatile byte PVOLAB;  // channels A and B volume
volatile byte PVOLMC;  // channel C volume and noise mask
volatile byte VOICES;  // voice smask

volatile byte CT[8];   // counter timers

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

#ifdef TEST
#define MAIN _main
#else
#define MAIN 0x2000
#endif

// start routine @ 0x0
void bios_start()  __naked {
__asm
  DI			; disable interrupts
  LD	HL,#MAIN
  LD	A,(HL)		; A <- mem[0x2000]
  CP	#0x55		; found sentinel byte? ($55)
  JP	Z,FoundSentinel	; yes, load program
  JP	MAIN
FoundSentinel:
  LD	SP,#0x4fce	; position stack below BIOS vars
  CALL	_bios_init	; misc. bios init routines
  LD	HL,#(MAIN+5)	; cartridge start vector
  LD	A,(HL)
  INC	HL
  LD	H,(HL)
  LD	L,A
  JP	(HL)		; jump to cart start vector
  .ds	0x38 - 0x1b	; eat up space until 0x38
__endasm;
}

void interrupt_0x38() __naked {
__asm
  push	hl
  push	af
  push	bc
  push	de
  push	ix
  push	iy
  ld	hl,#0
  add	hl,sp
  push	hl		; HL points to context block
  call	_SYSCALL	; syscall handler
  pop	hl
  pop	iy
  pop	ix
  pop	de
  pop	bc
  pop	af
  pop	hl
  ret
__endasm;
}

void _predope() __naked {
__asm
  .ds	0x200-0x52	; skip to 0x200
__endasm;
}

// DOPE vector @ 0x200
void DOPE()  __naked {
__asm
  JP	_STIMER
  JP	_CTIMER
  .db	0x20, 8, 8, 1, 7	; Font descriptor (big font)
  .dw	_BIGFONT
  .db	0xa0, 4, 6, 1, 5	; Font descriptor (small font)
  .dw	_SMLFONT
__endasm;
}

typedef struct {
  byte base_ch;
  byte frame_x;
  byte frame_y;
  byte pattern_x;
  byte pattern_y;
  const byte* chartab;
} FontDescriptor;

#define LOCHAR 0x20
#define HICHAR 0x63

extern const char BIGFONT[HICHAR-LOCHAR+1][7];
extern const char SMLFONT[HICHAR-LOCHAR+1][5];

const FontDescriptor __at(0x206) FNTSYS; // = { 0x20, 8, 8, 1, 7, (byte*)BIGFONT };
const FontDescriptor __at(0x20d) FNTSML; // = { 0xa0, 4, 6, 1, 5, (byte*)SMLFONT };

void hw_interrupt() __interrupt {
  CT[0]++;
  CT[1]++;
  CT[2]++;
  CT[3]++;
  if (++TMR60 == 60) {
    TMR60 = 0;
    if (++GTSECS == 60) {
      GTMINS++;
    }
  }
}

const void* const actint_vec = &hw_interrupt;

void STIMER() {
}

void CTIMER() {
}

///// INTERPRETER

typedef struct {
  union {
    struct {
      word iy,ix,de,bc,af,hl;
    } w;
    struct {
      byte iyl,iyh,ixl,ixh,e,d,c,b,f,a,l,h;
    } b;
  } regs;
  byte* params;
} ContextBlock;

#define REG_IY	0x1
#define REG_E	0x2
#define REG_D	0x4
#define REG_C	0x8
#define REG_B	0x10
#define REG_IX  0x20
#define REG_A	0x40
#define REG_HL	0x80
#define REG_DE	(REG_D|REG_E)
#define REG_BC	(REG_B|REG_C)

#define _IY	(ctx->regs.w.iy)
#define _IX	(ctx->regs.w.ix)
#define _DE	(ctx->regs.w.de)
#define _BC	(ctx->regs.w.bc)
#define _AF	(ctx->regs.w.af)
#define _HL	(ctx->regs.w.hl)
#define _IXL	(ctx->regs.b.ixl)
#define _IXH	(ctx->regs.b.ixh)
#define _IYL	(ctx->regs.b.iyl)
#define _IYH	(ctx->regs.b.iyh)
#define _E	(ctx->regs.b.e)
#define _D	(ctx->regs.b.d)
#define _C	(ctx->regs.b.c)
#define _B	(ctx->regs.b.b)
#define _A	(ctx->regs.b.a)
#define _L	(ctx->regs.b.l)
#define _H	(ctx->regs.b.h)

typedef void (Routine)();
typedef void (SysRoutine)(ContextBlock *ctx);

typedef struct {
  SysRoutine* routine;
  byte argmask;
} SysCallEntry;

void SYSCALL(ContextBlock *ctx);

void INTPC(ContextBlock *ctx) {
  while (ctx->params[0] != 2) { // 2 = exit
    SYSCALL(ctx);
  }
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
  ctx; // TODO
}

// exit MCALL loop
void MRET(ContextBlock *ctx) {
  ctx; // TODO
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

void ACTINT(ContextBlock *ctx) {
  ctx;
  hw_inlin = 200;
  hw_infbk = (byte) &actint_vec;
  hw_inmod = 8;
__asm
  LD	A,#0x2	; I = 0x200
  LD	I,A
  IM	2	; mode 2
  EI		; enable interrupts
__endasm;
}

// Outputs D to port 0A, B to port 09, A to port 0E.
void SETOUT(ContextBlock *ctx) {
  hw_verbl = _D;
  hw_horcb = _B;
  hw_inmod = _A;
}

// sets color palettes from (HL)
void COLSET(ContextBlock *ctx) {
  byte* palette = (byte*) _HL;
  hw_col3l = *palette++;
  hw_col2l = *palette++;
  hw_col1l = *palette++;
  hw_col0l = *palette++;
  hw_col3r = *palette++;
  hw_col2r = *palette++;
  hw_col1r = *palette++;
  hw_col0r = *palette++;
}

// Stores A in BC bytes starting at location DE.
void FILL(ContextBlock *ctx) {
  byte* dest = (byte*) _DE;
  word count = _BC;
  byte val = _A;
  memset(dest, val, count);
}

void hline(byte x1, byte x2, byte y, byte pattern) {
  byte xb1 = x1/4;
  byte xb2 = x2/4;
  byte* dest = &vmagic[y][xb1];
  signed char nbytes = xb2 - xb1;
  hw_magic = M_SHIFT(x1) | M_XOR;
  while (--nbytes > 0) {
    *dest++ = pattern;
  }
  if (x2&3) *dest = 0;
  // TODO
}

// Fill rect (E,D,C,B) color A
void RECTAN(const ContextBlock *ctx) {
  for (byte y=_D; y<_D+_B; y++) {
    hline(_E, _E+_C, y, _A);
  }
}

const char BIGFONT[HICHAR-LOCHAR+1][7] = {/*{count:68,w:8,h:7,brev:1}*/
{0x00,0x00,0x00,0x00,0x00,0x00,0x00},{0x20,0x20,0x20,0x20,0x00,0x00,0x20},{0x50,0x50,0x00,0x00,0x00,0x00,0x00},{0x48,0xFC,0x48,0x48,0x48,0xFC,0x48},{0x20,0x78,0x80,0x70,0x08,0xF0,0x20},{0x00,0x48,0x10,0x20,0x40,0x90,0x00},{0x60,0x90,0x60,0xA0,0xA8,0x90,0x68},{0x60,0x60,0x20,0x00,0x00,0x00,0x00},{0x20,0x40,0x40,0x40,0x40,0x40,0x20},{0x40,0x20,0x20,0x20,0x20,0x20,0x40},{0x00,0xA8,0x70,0xF8,0x70,0xA8,0x00},{0x00,0x20,0x20,0xF8,0x20,0x20,0x00},{0x00,0x00,0x00,0x00,0x60,0x20,0x40},{0x00,0x00,0x00,0xF0,0x00,0x00,0x00},{0x00,0x00,0x00,0x00,0x00,0x60,0x60},{0x00,0x08,0x10,0x20,0x40,0x80,0x00},{0x70,0x88,0x88,0xA8,0x88,0x88,0x70},{0x20,0x60,0x20,0x20,0x20,0x20,0x70},{0x70,0x88,0x08,0x30,0x40,0x80,0xF8},{0x70,0x88,0x08,0x70,0x08,0x88,0x70},{0x10,0x30,0x50,0x90,0xF8,0x10,0x10},{0xF8,0x80,0x80,0x70,0x08,0x88,0x70},{0x70,0x88,0x80,0xF0,0x88,0x88,0x70},{0xF8,0x88,0x10,0x20,0x20,0x20,0x20},{0x70,0x88,0x88,0x70,0x88,0x88,0x70},{0x70,0x88,0x88,0x78,0x08,0x88,0x70},{0x00,0x00,0x60,0x00,0x60,0x00,0x00},{0x00,0x00,0x60,0x00,0x60,0x20,0x40},{0x10,0x20,0x40,0x80,0x40,0x20,0x10},{0x00,0x00,0xF8,0x00,0xF8,0x00,0x00},{0x40,0x20,0x10,0x08,0x10,0x20,0x40},{0x70,0x08,0x08,0x30,0x20,0x00,0x20},{0x70,0x88,0xB8,0xA8,0x90,0x80,0x70},{0x70,0x88,0x88,0xF8,0x88,0x88,0x88},{0xF0,0x88,0x88,0xF0,0x88,0x88,0xF0},{0x70,0x88,0x80,0x80,0x80,0x88,0x70},{0xF0,0x88,0x88,0x88,0x88,0x88,0xF0},{0xF8,0x80,0x80,0xF0,0x80,0x80,0xF8},{0xF8,0x80,0x80,0xF0,0x80,0x80,0x80},{0x70,0x88,0x80,0xB0,0x88,0x88,0x70},{0x88,0x88,0x88,0xF8,0x88,0x88,0x88},{0x70,0x20,0x20,0x20,0x20,0x20,0x70},{0x08,0x08,0x08,0x08,0x88,0x88,0x70},{0x88,0x90,0xA0,0xC0,0xA0,0x90,0x88},{0x80,0x80,0x80,0x80,0x80,0x80,0xF8},{0x88,0xD8,0xA8,0x88,0x88,0x88,0x88},{0x88,0xC8,0xA8,0xA8,0x98,0x88,0x88},{0xF8,0x88,0x88,0x88,0x88,0x88,0xF8},{0xF0,0x88,0x88,0xF0,0x80,0x80,0x80},{0x70,0x88,0x88,0xA8,0xA8,0x90,0x68},{0xF0,0x88,0x88,0xF0,0x90,0x90,0x88},{0x70,0x88,0x80,0x70,0x08,0x88,0x70},{0xF8,0x20,0x20,0x20,0x20,0x20,0x20},{0x88,0x88,0x88,0x88,0x88,0x88,0x70},{0x88,0x88,0x88,0x88,0x88,0x50,0x20},{0x88,0x88,0x88,0x88,0xA8,0xD8,0x88},{0x88,0x88,0x50,0x20,0x50,0x88,0x88},{0x88,0x88,0x50,0x20,0x20,0x20,0x20},{0xF8,0x08,0x10,0x20,0x40,0x80,0xF8},{0x70,0x40,0x40,0x40,0x40,0x40,0x70},{0x00,0x80,0x40,0x20,0x10,0x08,0x00},{0x70,0x10,0x10,0x10,0x10,0x10,0x70},{0x20,0x70,0xA8,0x20,0x20,0x20,0x00},{0x00,0x20,0x40,0xF8,0x40,0x20,0x00},{0x00,0x20,0x20,0x20,0xA8,0x70,0x20},{0x00,0x20,0x10,0xF8,0x10,0x20,0x00},{0x00,0x88,0x50,0x20,0x50,0x88,0x00},{0x00,0x20,0x00,0xF8,0x00,0x20,0x00}};

const char SMLFONT[HICHAR-LOCHAR+1][5] = {/*{count:68,w:5,h:5,brev:1}*/
{ 0x00,0x00,0x00,0x00,0x00 },{ 0x40,0x40,0x00,0x40,0x00 },{ 0xA0,0xA0,0x00,0x00,0x00 },{ 0x60,0xF0,0xF0,0x60,0x00 },{ 0x40,0xE0,0xE0,0x40,0x00 },{ 0x90,0x20,0x40,0x90,0x00 },{ 0xC0,0xB0,0xE0,0xD0,0x00 },{ 0x20,0x40,0x00,0x00,0x00 },{ 0x20,0x40,0x40,0x20,0x00 },{ 0x40,0x20,0x20,0x40,0x00 },{ 0x40,0xE0,0x40,0xA0,0x00 },{ 0x00,0x40,0xE0,0x40,0x00 },{ 0x00,0x00,0x00,0x60,0x20 },{ 0x00,0x00,0xE0,0x00,0x00 },{ 0x00,0x00,0x00,0x40,0x00 },{ 0x20,0x20,0x40,0x40,0x00 },{ 0xE0,0xA0,0xA0,0xA0,0xE0 },{ 0xC0,0x40,0x40,0x40,0xE0 },{ 0xE0,0x20,0xE0,0x80,0xE0 },{ 0xE0,0x20,0x60,0x20,0xE0 },{ 0xA0,0xA0,0xE0,0x20,0x20 },{ 0xE0,0x80,0xE0,0x20,0xE0 },{ 0xE0,0x80,0xE0,0xA0,0xE0 },{ 0xE0,0x20,0x40,0x40,0x40 },{ 0xE0,0xA0,0xE0,0xA0,0xE0 },{ 0xE0,0xA0,0xE0,0x20,0xE0 },{ 0x00,0x40,0x00,0x40,0x00 },{ 0x00,0x40,0x00,0x60,0x20 },{ 0x00,0x20,0x40,0x20,0x00 },{ 0x00,0xE0,0x00,0xE0,0x00 },{ 0x00,0x40,0x20,0x40,0x00 },{ 0xE0,0x20,0x60,0x00,0x40 },{ 0xF0,0x90,0x10,0xD0,0xF0 },{ 0x60,0xA0,0xE0,0xA0,0x00 },{ 0xC0,0xE0,0xA0,0xE0,0x00 },{ 0x60,0x80,0x80,0xE0,0x00 },{ 0xC0,0xA0,0xA0,0xC0,0x00 },{ 0xE0,0xC0,0x80,0xE0,0x00 },{ 0xE0,0xC0,0x80,0x80,0x00 },{ 0x60,0x80,0xA0,0xE0,0x00 },{ 0xA0,0xA0,0xE0,0xA0,0x00 },{ 0xE0,0x40,0x40,0xE0,0x00 },{ 0x60,0x20,0xA0,0xE0,0x00 },{ 0xA0,0xC0,0xC0,0xA0,0x00 },{ 0x80,0x80,0x80,0xE0,0x00 },{ 0xE0,0xE0,0xE0,0xA0,0x00 },{ 0xE0,0xA0,0xA0,0xA0,0x00 },{ 0xE0,0xA0,0xA0,0xE0,0x00 },{ 0xE0,0xA0,0xE0,0x80,0x00 },{ 0xE0,0xA0,0xE0,0xF0,0x00 },{ 0xE0,0xA0,0xC0,0xA0,0x00 },{ 0xE0,0x80,0x60,0xE0,0x00 },{ 0xE0,0x40,0x40,0x40,0x00 },{ 0xA0,0xA0,0xA0,0xE0,0x00 },{ 0xA0,0xA0,0xC0,0x80,0x00 },{ 0xA0,0xE0,0xE0,0xE0,0x00 },{ 0xA0,0x40,0xA0,0xA0,0x00 },{ 0xA0,0xE0,0x40,0x40,0x00 },{ 0xE0,0x20,0x40,0xE0,0x00 },{ 0x60,0x40,0x40,0x60,0x00 },{ 0x40,0x40,0x20,0x20,0x00 },{ 0x60,0x20,0x20,0x60,0x00 },{ 0x40,0xA0,0x00,0x00,0x00 },{ 0x00,0x00,0x00,0x00,0xF0 },{ 0x80,0x40,0x00,0x00,0x00 },{ 0x00,0x60,0xA0,0xE0,0x00 },{ 0x80,0xE0,0xA0,0xE0,0x00 },{ 0x00,0x60,0x80,0xE0,0x00 }};

// draw a letter
byte draw_char(const FontDescriptor* font, byte ch, byte x, byte y, byte op) {
  const byte* src = font->chartab + (ch-font->base_ch)*font->pattern_y;
  byte* dest = &vmagic[y][x>>2];// destination address
  byte magic = M_SHIFT(x) | M_XPAND | (op & 0x30);
  // big sizes?
  if (op & 0xc0) {
    char buf[8];		// expansion buffer
    char* mbuf = (buf - 0x4000);// make it magic
    byte sc = 1 << (op >> 6); // 2x2 = 2, 4x4 = 4, 8x8 = 8
    for (byte i=0; i<font->pattern_y; i++) {
      // expand into magic buffer onto stack
      hw_magic = M_XPAND;
      hw_xpand = 0b1100;	// on = 11, off = 00
      // 2x2 size
      mbuf[1] = mbuf[0] = *src++;
      // 4x4 size
      if (op & 0x80) {
        byte b = buf[0];
        mbuf[3] = mbuf[2] = buf[1];
        mbuf[1] = mbuf[0] = b;
      }
      // 8x8 size
      if ((op & 0xc0) == 0xc0) {
        byte b = buf[0];
        mbuf[7] = mbuf[6] = buf[3];
        mbuf[5] = mbuf[4] = buf[2];
        mbuf[3] = mbuf[2] = buf[1];
        mbuf[1] = mbuf[0] = b;
      }
      // draw to screen (magic, again)
      hw_xpand = op & 0xf;
      for (byte j=0; j<sc; j++) {
        hw_magic = magic; // reset flip flop
        EXIT_CLIPDEST(dest);
        for (byte k=0; k<sc; k++) {
          byte b = buf[k];
          *dest++ = b;
          *dest++ = b;
        }
        dest += VBWIDTH-sc*2;
      }
    }
  } else {
    hw_xpand = op & 0xf;
    for (byte i=0; i<font->pattern_y; i++) {
      char b = *src++;
      EXIT_CLIPDEST(dest);
      hw_magic = magic; // reset flip flop
      *dest++ = b;	// expand lower nibble -> 1st byte
      *dest++ = b;	// expand upper nibble -> 2nd byte
      *dest++ = 0;	// leftover -> 3rd byte
      dest += VBWIDTH-3;	// we incremented 3 bytes for this line
    }
  }
  return font->frame_x << (op >> 6);
}

#define FONT_IX ((const FontDescriptor*)ctx->regs.w.ix)

void draw_string(ContextBlock *ctx, const char* str, byte x, byte y, byte op) {
  do {
    byte ch = *str++;
    if (!ch) {
      _E = x;
      break;
    }
    if (ch < 0x20) {
      x += draw_char(&FNTSYS, ' ', x, y, op); // TODO
    } else if (ch < 0x64) {
      x += draw_char(&FNTSYS, ch, x, y, op);
    } else if (ch >= 0x80) {
      x += draw_char(FONT_IX, ch, x, y, op);
    } else {
      /*
      if (ch & 0x10) {
        ctx->regs.b.ixl = *str++;
        ctx->regs.b.ixh = *str++;
      }
      if (ch & 0x1)
        _E = *str++;
      if (ch & 0x2)
        _D = *str++;
      if (ch & 0x4)
        _C = *str++;
      */
      // TODO: only can change font
    }
  } while (1);
}

// String display routine (pass pointer to string)
void STRDIS2(ContextBlock *ctx, char *str) {
  byte opts = _C;
  byte x = _E;
  byte y = _D;
  void* fontdesc = (void*) ctx->regs.w.ix;
  draw_string(ctx, str, x, y, opts); // TODO: opts
}

// String display routine
void STRDIS(ContextBlock *ctx) {
  char* str = (char*) _HL;
  STRDIS2(ctx, str);
}

// Character display routine
void CHRDIS(ContextBlock *ctx) {
  char chstr[2];
  chstr[0] = _A;
  chstr[1] = 0;
  STRDIS2(ctx, chstr);
}

// BCD routine
const char BCDTAB[17] = "0123456789*+,-./";

// DISNUM - (E.D) x/y (C) options (B) ext (HL) BCD-addr
void DISNUM(ContextBlock *ctx) {
  // TODO: options, B
  byte x = _E;
  byte y = _D;
  byte opt = _C;
  byte ext = _B;
  byte ndigits = ext & 63;
  const FontDescriptor* font = (ext&64) ? &FNTSML : &FNTSYS;
  byte add = (ext&64) ? 128 : 0;
  byte noleadingzero = ext & 128;
  byte* pbcd = (byte*) _HL;
  pbcd += (ndigits-1)/2;
  while (ndigits--) {
    byte val = *pbcd;
    if (ndigits & 1) {
      val >>= 4;
    } else {
      val &= 15;
      pbcd--;
    }
    x += draw_char(font, BCDTAB[val]+add, x, y, opt);
  }
}

typedef struct {
  sbyte xofs, yofs;
  byte xsize, ysize;
  byte pattern[0];
} PatternBlock;

// write pattern (E,D,C,B) magic A @ HL
void WRIT(ContextBlock *ctx) {
  byte x = _E;
  byte y = _D;
  byte w = _C;
  byte h = _B;
  byte* src = (byte*) _HL;
  byte* dest = &vmagic[y][x>>2];// destination address
  byte i,j;
  byte magic = _A;
  for (j=0; j<h; j++) {
    EXIT_CLIPDEST(dest);
    if ((hw_magic = magic) & M_XPAND) {
      for (i=0; i<w; i++) {
        byte b = *src++;
        *dest++ = b;
        *dest++ = b;
      }
      *dest = 0;
      dest += VBWIDTH-w*2;
    } else {
      for (i=0; i<w; i++) {
        *dest++ = *src++;
      }
      *dest = 0;
      dest += VBWIDTH-w;
    }
  }
}

// write sized pattern (E,D) magic A @ HL
void WRITP(ContextBlock *ctx) {
  byte* src = (byte*) _HL;
  // get size
  _C = *src++;
  _B = *src++;
  // update src
  _HL = (word) src;
  WRIT(ctx);
}

// write relative pattern (E,D) magic A @ HL
void WRITR(ContextBlock *ctx) {
  byte* src = (byte*) _HL;
  // sub offset
  _E -= *src++;
  _D -= *src++;
  // update src
  _HL = (word) src;
  WRITP(ctx);
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
  byte* dest = (byte*) _DE;
  const byte* src = (const byte*) _HL;
  word nb = _BC;
  memcpy(dest, src, nb);
}

word bcdadd8(byte a, byte b, byte c) {
  a;b;c;
__asm
  ld  a,6(ix)	; carry
  rrc a		; set carry bit
  ld  h,#0	; carry goes here
  ld  a,4(ix)	; a -> A
  adc a,5(ix)	; a + b -> A
  daa		; BCD conversion
  ld  l,a	; result -> L
  rl  h		; carry -> H
__endasm;
}

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
  { 0, 0 },
  { 0, 0 },
  /* 20 */
  { 0, 0 },
  { &SETOUT,	REG_D|REG_B|REG_A },
  { &COLSET,	REG_HL },
  { &FILL,	REG_A|REG_BC|REG_DE },
  { &RECTAN,	REG_A|REG_B|REG_C|REG_D|REG_E },
  /* 30 */
  { /*&VWRITR*/0, 0 },
  { &WRITR,  REG_E|REG_D|REG_A|REG_HL },
  { &WRITP,  REG_E|REG_D|REG_A|REG_HL },
  { &WRIT,   REG_E|REG_D|REG_C|REG_B|REG_A|REG_HL },
  { /*&WRITA*/0,  0 },
  /* 40 */
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  /* 50 */
  { &CHRDIS,	REG_E|REG_D|REG_C|REG_A },
  { &STRDIS,	REG_E|REG_D|REG_C|REG_HL },
  { &DISNUM,	REG_E|REG_D|REG_C|REG_B|REG_HL },
  { 0, 0 },
  { 0, 0 },
  /* 60 */
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  /* 70 */
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  /* 80 */
  { &PAWS,	REG_B },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  /* 90 */
  { 0, 0 },
  { 0, 0 },
  { &MOVE,	REG_DE|REG_BC|REG_HL },
  { 0, 0 },
  { &BCDADD,	REG_DE|REG_B|REG_HL },
  /* 100 */
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  /* 110 */
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { &RANGED,	REG_A },
  /* 120 */
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
  { 0, 0 },
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
  if (routine) {
    routine(ctx);
  }
}

void bios_init() {
  memset((void*)0x4fce, 0, 0x5000-0x4fce);
  ACTINT(0);
  hw_verbl = 96*2;
  hw_horcb = 41;
  hw_inmod = 0x8;
  // clear shifter
  hw_magic = 0;
  *((byte*)0x4fce) = 0;
  hw_magic = 0;
}

#ifdef TEST

void _main() {
__asm
#include "astrocade.inc"
#include "test3.s"
__endasm;
}

#else

void _biosend() __naked {
__asm
  ; eat up rest of space
  .ds	0x2000 - (. - __biosend)
__endasm;
}

#endif
