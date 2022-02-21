
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
__sfr __at(0x14) hw_keypad0;
__sfr __at(0x15) hw_keypad1;
__sfr __at(0x16) hw_keypad2;
__sfr __at(0x17) hw_keypad3;
__sfr __at(0x1c) hw_p1pot;	// player pot
__sfr __at(0x1d) hw_p2pot;	// player pot
__sfr __at(0x1e) hw_p3pot;	// player pot
__sfr __at(0x1f) hw_p4pot;	// player pot

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

#define VHEIGHT 102	// number of scanlines
#define VBWIDTH 40	// number of bytes per scanline
#define PIXWIDTH 160	// 4 pixels per byte

//#define EXIT_CLIPDEST(addr) if ((((word)addr)&0xfff) >= 0xe10) return
#define EXIT_CLIPDEST(addr)

byte __at (0x0000) vmagic[VHEIGHT][VBWIDTH];
byte __at (0x4000) vidmem[VHEIGHT][VBWIDTH];

typedef enum {
  SNUL,
  SCT0,SCT1,SCT2,SCT3,SCT4,SCT5,SCT6,SCT7,
  SF0,SF1,SF2,SF3,SF4,SF5,SF6,SF7,
  SSEC,
  SKYU,SKYD,
  ST0,SJ0,ST1,SJ1,ST2,SJ2,ST3,SJ3,
  SP0,SP1,SP2,SP3
} SENTRYCode;

typedef struct {
  byte base_ch;		// first char
  byte frame_x;		// frame width
  byte frame_y;		// frame height
  byte pattern_x;	// pattern width
  byte pattern_y;	// pattern height
  const byte* chartab;	// pointer to char data
} FontDescriptor;

typedef struct {
  sbyte xofs, yofs;
  byte xsize, ysize;
  byte pattern[0];
} PatternBlock;

const FontDescriptor __at(0x206) FNTSYS; // = { 0x20, 8, 8, 1, 7, (byte*)BIGFONT };
const FontDescriptor __at(0x20d) FNTSML; // = { 0xa0, 4, 6, 1, 5, (byte*)SMLFONT };

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

