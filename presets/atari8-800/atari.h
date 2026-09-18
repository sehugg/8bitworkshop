/*****************************************************************************/
/*                                                                           */
/*                                 atari.h                                   */
/*                                                                           */
/*                      Atari system specific definitions                    */
/*                                                                           */
/*                                                                           */
/*                                                                           */
/* (C) 2000-2021 Mark Keates <markk@dendrite.co.uk>                          */
/*               Freddy Offenga <taf_offenga@yahoo.com>                      */
/*               Christian Groessler <chris@groessler.org>                   */
/*               Bill Kendrick <nbs@sonic.net>                               */
/*               et al.                                                      */
/*                                                                           */
/*                                                                           */
/* This software is provided 'as-is', without any expressed or implied       */
/* warranty.  In no event will the authors be held liable for any damages    */
/* arising from the use of this software.                                    */
/*                                                                           */
/* Permission is granted to anyone to use this software for any purpose,     */
/* including commercial applications, and to alter it and redistribute it    */
/* freely, subject to the following restrictions:                            */
/*                                                                           */
/* 1. The origin of this software must not be misrepresented; you must not   */
/*    claim that you wrote the original software. If you use this software   */
/*    in a product, an acknowledgment in the product documentation would be  */
/*    appreciated but is not required.                                       */
/* 2. Altered source versions must be plainly marked as such, and must not   */
/*    be misrepresented as being the original software.                      */
/* 3. This notice may not be removed or altered from any source              */
/*    distribution.                                                          */
/*                                                                           */
/*****************************************************************************/



#ifndef _ATARI_H
#define _ATARI_H


/* Check for errors */
#if !defined(__ATARI__)
#  error This module may only be used when compiling for the Atari!
#endif

// cc65 compatability
#define __fastcall__

/*****************************************************************************/
/* Character codes                                                           */
/*****************************************************************************/

#define CH_DELCHR       0xFE   /* delete char under the cursor */
#define CH_ENTER        0x9B
#define CH_ESC          0x1B
#define CH_CURS_UP      28
#define CH_CURS_DOWN    29
#define CH_CURS_LEFT    30
#define CH_CURS_RIGHT   31

#define CH_TAB          0x7F   /* tabulator */
#define CH_EOL          0x9B   /* end-of-line marker */
#define CH_CLR          0x7D   /* clear screen */
#define CH_BEL          0xFD   /* bell */
#define CH_DEL          0x7E   /* back space (delete char to the left) */
#define CH_RUBOUT       0x7E   /* back space (old, deprecated) */
#define CH_DELLINE      0x9C   /* delete line */
#define CH_INSLINE      0x9D   /* insert line */

/* These are defined to be Atari + NumberKey */
#define CH_F1           177
#define CH_F2           178
#define CH_F3           179
#define CH_F4           180
#define CH_F5           181
#define CH_F6           182
#define CH_F7           183
#define CH_F8           184
#define CH_F9           185
#define CH_F10          176

#define CH_ULCORNER     0x11
#define CH_URCORNER     0x05
#define CH_LLCORNER     0x1A
#define CH_LRCORNER     0x03
#define CH_TTEE         0x17
#define CH_BTEE         0x18
#define CH_LTEE         0x01
#define CH_RTEE         0x04
#define CH_CROSS        0x13
#define CH_HLINE        0x12
#define CH_VLINE        0x7C


/*****************************************************************************/
/* Masks for joy_read                                                        */
/*****************************************************************************/

#define JOY_UP_MASK     0x01
#define JOY_DOWN_MASK   0x02
#define JOY_LEFT_MASK   0x04
#define JOY_RIGHT_MASK  0x08
#define JOY_BTN_1_MASK  0x10

#define JOY_FIRE_MASK   JOY_BTN_1_MASK
#define JOY_FIRE(v)     ((v) & JOY_FIRE_MASK)


/*****************************************************************************/
/* Keyboard values returned by kbcode / CH                                   */
/*****************************************************************************/

#define KEY_NONE        ((unsigned char) 0xFF)

#define KEY_0           ((unsigned char) 0x32)
#define KEY_1           ((unsigned char) 0x1F)
#define KEY_2           ((unsigned char) 0x1E)
#define KEY_3           ((unsigned char) 0x1A)
#define KEY_4           ((unsigned char) 0x18)
#define KEY_5           ((unsigned char) 0x1D)
#define KEY_6           ((unsigned char) 0x1B)
#define KEY_7           ((unsigned char) 0x33)
#define KEY_8           ((unsigned char) 0x35)
#define KEY_9           ((unsigned char) 0x30)

#define KEY_A           ((unsigned char) 0x3F)
#define KEY_B           ((unsigned char) 0x15)
#define KEY_C           ((unsigned char) 0x12)
#define KEY_D           ((unsigned char) 0x3A)
#define KEY_E           ((unsigned char) 0x2A)
#define KEY_F           ((unsigned char) 0x38)
#define KEY_G           ((unsigned char) 0x3D)
#define KEY_H           ((unsigned char) 0x39)
#define KEY_I           ((unsigned char) 0x0D)
#define KEY_J           ((unsigned char) 0x01)
#define KEY_K           ((unsigned char) 0x05)
#define KEY_L           ((unsigned char) 0x00)
#define KEY_M           ((unsigned char) 0x25)
#define KEY_N           ((unsigned char) 0x23)
#define KEY_O           ((unsigned char) 0x08)
#define KEY_P           ((unsigned char) 0x0A)
#define KEY_Q           ((unsigned char) 0x2F)
#define KEY_R           ((unsigned char) 0x28)
#define KEY_S           ((unsigned char) 0x3E)
#define KEY_T           ((unsigned char) 0x2D)
#define KEY_U           ((unsigned char) 0x0B)
#define KEY_V           ((unsigned char) 0x10)
#define KEY_W           ((unsigned char) 0x2E)
#define KEY_X           ((unsigned char) 0x16)
#define KEY_Y           ((unsigned char) 0x2B)
#define KEY_Z           ((unsigned char) 0x17)

#define KEY_COMMA       ((unsigned char) 0x20)
#define KEY_PERIOD      ((unsigned char) 0x22)
#define KEY_SLASH       ((unsigned char) 0x26)
#define KEY_SEMICOLON   ((unsigned char) 0x02)
#define KEY_PLUS        ((unsigned char) 0x06)
#define KEY_ASTERISK    ((unsigned char) 0x07)
#define KEY_DASH        ((unsigned char) 0x0E)
#define KEY_EQUALS      ((unsigned char) 0x0F)
#define KEY_LESSTHAN    ((unsigned char) 0x36)
#define KEY_GREATERTHAN ((unsigned char) 0x37)

#define KEY_ESC         ((unsigned char) 0x1C)
#define KEY_TAB         ((unsigned char) 0x2C)
#define KEY_SPACE       ((unsigned char) 0x21)
#define KEY_RETURN      ((unsigned char) 0x0C)
#define KEY_DELETE      ((unsigned char) 0x34)
#define KEY_CAPS        ((unsigned char) 0x3C)
#define KEY_INVERSE     ((unsigned char) 0x27)
#define KEY_HELP        ((unsigned char) 0x11)

/* Function keys only exist on the 1200XL model. */
#define KEY_F1          ((unsigned char) 0x03)
#define KEY_F2          ((unsigned char) 0x04)
#define KEY_F3          ((unsigned char) 0x13)
#define KEY_F4          ((unsigned char) 0x14)

/* N.B. Cannot read Ctrl key alone */
#define KEY_CTRL        ((unsigned char) 0x80)

/* N.B. Cannot read Shift key alone via KBCODE;
** instead, check "Shfit key press" bit of SKSTAT register.
** Also, no way to tell left Shift from right Shift.
*/
#define KEY_SHIFT       ((unsigned char) 0x40)


/* Composed keys
** (Other combinations are possible, including Shift+Ctrl+key,
** though not all such combinations are available.)
*/

#define KEY_EXCLAMATIONMARK     (KEY_1 | KEY_SHIFT)
#define KEY_QUOTE               (KEY_2 | KEY_SHIFT)
#define KEY_HASH                (KEY_3 | KEY_SHIFT)
#define KEY_DOLLAR              (KEY_4 | KEY_SHIFT)
#define KEY_PERCENT             (KEY_5 | KEY_SHIFT)
#define KEY_AMPERSAND           (KEY_6 | KEY_SHIFT)
#define KEY_APOSTROPHE          (KEY_7 | KEY_SHIFT)
#define KEY_AT                  (KEY_8 | KEY_SHIFT)
#define KEY_OPENINGPARAN        (KEY_9 | KEY_SHIFT)
#define KEY_CLOSINGPARAN        (KEY_0 | KEY_SHIFT)
#define KEY_UNDERLINE           (KEY_DASH | KEY_SHIFT)
#define KEY_BAR                 (KEY_EQUALS | KEY_SHIFT)
#define KEY_COLON               (KEY_SEMICOLON | KEY_SHIFT)
#define KEY_BACKSLASH           (KEY_PLUS | KEY_SHIFT)
#define KEY_CIRCUMFLEX          (KEY_ASTERISK | KEY_SHIFT)
#define KEY_OPENINGBRACKET      (KEY_COMMA | KEY_SHIFT)
#define KEY_CLOSINGBRACKET      (KEY_PERIOD | KEY_SHIFT)
#define KEY_QUESTIONMARK        (KEY_SLASH | KEY_SHIFT)
#define KEY_CLEAR               (KEY_LESSTHAN | KEY_SHIFT)
#define KEY_INSERT              (KEY_GREATERTHAN | KEY_SHIFT)

#define KEY_UP      (KEY_DASH | KEY_CTRL)
#define KEY_DOWN    (KEY_EQUALS | KEY_CTRL)
#define KEY_LEFT    (KEY_PLUS | KEY_CTRL)
#define KEY_RIGHT   (KEY_ASTERISK | KEY_CTRL)

/*****************************************************************************/
/* Color register functions                                                  */
/*****************************************************************************/

void __fastcall__ _setcolor     (unsigned char color_reg, unsigned char hue, unsigned char luminance);
void __fastcall__ _setcolor_low (unsigned char color_reg, unsigned char color_value);
unsigned char __fastcall__ _getcolor (unsigned char color_reg);

/*****************************************************************************/
/* Other screen functions                                                    */
/*****************************************************************************/

void waitvsync (void);                            /* wait for start of next frame */
int  __fastcall__ _graphics (unsigned char mode); /* mode value same as in BASIC */
void __fastcall__ _scroll (signed char numlines);
                                          /* numlines > 0  scrolls up */
                                          /* numlines < 0  scrolls down */


/*****************************************************************************/
/*    Sound function                                                         */
/*****************************************************************************/

void  __fastcall__ _sound (unsigned char voice, unsigned char frequency, unsigned char distortion, unsigned char volume);

/*****************************************************************************/
/* Misc. functions                                                           */
/*****************************************************************************/

unsigned char get_ostype(void);       /* get ROM version */
unsigned char get_tv(void);           /* get TV system */
void _save_vecs(void);                /* save system vectors */
void _rest_vecs(void);                /* restore system vectors */
char *_getdefdev(void);               /* get default floppy device */
unsigned char _is_cmdline_dos(void);  /* does DOS support command lines */


/*****************************************************************************/
/* Global variables                                                          */
/*****************************************************************************/

extern unsigned char _dos_type;         /* the DOS flavour */

/*****************************************************************************/
/* get_ostype return value defines (for explanation, see ostype.s)           */
/*****************************************************************************/

/* masks */
#define AT_OS_TYPE_MAIN  7
#define AT_OS_TYPE_MINOR (7 << 3)
/* AT_OS_TYPE_MAIN values */
#define AT_OS_UNKNOWN  0
#define AT_OS_400800   1
#define AT_OS_1200XL   2
#define AT_OS_XLXE     3
/* AS_OS_TYPE_MINOR values */
/* for 400/800 remember this are the ROM versions */
/* to check whether the hw is PAL or NTSC, use get_tv() */
#define AT_OS_400800PAL_A  1
#define AT_OS_400800PAL_B  2
#define AT_OS_400800NTSC_A 1
#define AT_OS_400800NTSC_B 2
#define AT_OS_1200_10  1
#define AT_OS_1200_11  2
#define AT_OS_XLXE_1   1
#define AT_OS_XLXE_2   2
#define AT_OS_XLXE_3   3
#define AT_OS_XLXE_4   4


/*****************************************************************************/
/* get_tv return values                                                      */
/*****************************************************************************/

#define AT_NTSC     0
#define AT_PAL      1


/*****************************************************************************/
/* valid _dos_type values                                                    */
/*****************************************************************************/

#define SPARTADOS   0
#define REALDOS     1
#define BWDOS       2
#define OSADOS      3
#define XDOS        4
#define ATARIDOS    5
#define MYDOS       6
#define NODOS       255


/*****************************************************************************/
/* Define hardware and where they're mapped in memory                        */
/*****************************************************************************/

/*****************************************************************************/
/*                                                                           */
/*                  _atarios.h                                               */
/*                                                                           */
/*            Internal include file, do not use directly                     */
/*                                                                           */
/*                                                                           */
/* This software is provided 'as-is', without any expressed or implied       */
/* warranty.  In no event will the authors be held liable for any damages    */
/* arising from the use of this software.                                    */
/*                                                                           */
/* Permission is granted to anyone to use this software for any purpose,     */
/* including commercial applications, and to alter it and redistribute it    */
/* freely, subject to the following restrictions:                            */
/*                                                                           */
/* 1. The origin of this software must not be misrepresented; you must not   */
/*    claim that you wrote the original software. If you use this software   */
/*    in a product, an acknowledgment in the product documentation would be  */
/*    appreciated but is not required.                                       */
/* 2. Altered source versions must be plainly marked as such, and must not   */
/*    be misrepresented as being the original software.                      */
/* 3. This notice may not be removed or altered from any source              */
/*    distribution.                                                          */
/*                                                                           */
/*****************************************************************************/

#ifndef __ATARIOS_H
#define __ATARIOS_H


/* IOCB Command Codes */

#define IOCB_OPEN        0x03  /* open */
#define IOCB_GETREC      0x05  /* get record */
#define IOCB_GETCHR      0x07  /* get character(s) */
#define IOCB_PUTREC      0x09  /* put record */
#define IOCB_PUTCHR      0x0B  /* put character(s) */
#define IOCB_CLOSE       0x0C  /* close */
#define IOCB_STATIS      0x0D  /* status */
#define IOCB_SPECIL      0x0E  /* special */
#define IOCB_DRAWLN      0x11  /* draw line */
#define IOCB_FILLIN      0x12  /* draw line with right fill */
#define IOCB_RENAME      0x20  /* rename disk file */
#define IOCB_DELETE      0x21  /* delete disk file */
#define IOCB_LOCKFL      0x23  /* lock file (set to read-only) */
#define IOCB_UNLOCK      0x24  /* unlock file */
#define IOCB_POINT       0x25  /* point sector */
#define IOCB_NOTE        0x26  /* note sector */
#define IOCB_GETFL       0x27  /* get file length */
#define IOCB_CHDIR_MYDOS 0x29  /* change directory (MyDOS) */
#define IOCB_MKDIR       0x2A  /* make directory (MyDOS/SpartaDOS) */
#define IOCB_RMDIR       0x2B  /* remove directory (SpartaDOS) */
#define IOCB_CHDIR_SPDOS 0x2C  /* change directory (SpartaDOS) */
#define IOCB_GETCWD      0x30  /* get current directory (MyDOS/SpartaDOS) */
#define IOCB_FORMAT      0xFE  /* format */


/* Device control block */

struct __dcb {
    unsigned char ddevic;           /* device id */
    unsigned char dunit;            /* unit number */
    unsigned char dcomnd;           /* command */
    unsigned char dstats;           /* command type / status return */
    void          *dbuf;            /* pointer to buffer */
    unsigned char dtimlo;           /* device timeout in seconds */
    unsigned char dunuse;           /* - unused - */
    unsigned int  dbyt;             /* # of bytes to transfer */
    union {
        struct {
            unsigned char daux1;    /* 1st command auxiliary byte */
            unsigned char daux2;    /* 2nd command auxiliary byte */
        } _sdaux;
        unsigned int daux;          /* auxiliary as word */
    } _udaux;
};

typedef struct __dcb dcb_t;


/* I/O control block */

struct __iocb {
    unsigned char   handler;    /* handler index number (0xff free) */
    unsigned char   drive;      /* device number (drive) */
    unsigned char   command;    /* command */
    unsigned char   status;     /* status of last operation */
    void*           buffer;     /* pointer to buffer */
    void*           put_byte;   /* pointer to device's PUT BYTE routine */
    unsigned int    buflen;     /* length of buffer */
    unsigned char   aux1;       /* 1st auxiliary byte */
    unsigned char   aux2;       /* 2nd auxiliary byte */
    unsigned char   aux3;       /* 3rd auxiliary byte */
    unsigned char   aux4;       /* 4th auxiliary byte */
    unsigned char   aux5;       /* 5th auxiliary byte */
    unsigned char   spare;      /* spare byte */
};

typedef struct __iocb iocb_t;


/* DOS 2.x zeropage variables */

struct __dos2x {
    unsigned char*  zbufp;      /* points to user filename */
    unsigned char*  zdrva;      /* points to serveral buffers (mostly VTOC) */
    unsigned char*  zsba;       /* points to sector buffer */
    unsigned char   errno;      /* number of occurred error */
};

typedef struct __dos2x dos2x_t;


/* A single device handler formed by it's routines */

struct __devhdl {
    void *open;                 /* address of OPEN routine -1 */
    void *close;                /* address of CLOSE routine -1 */
    void *get;                  /* address of GET BYTE routine -1 */
    void *put;                  /* address of PUT BYTE routine -1 */
    void *status;               /* address of GET STATUS routine -1 */
    void *special;              /* address od SPECIAL routine -1 */
    unsigned char jmp_inst;     /* a "JMP" byte, should be $4C */
    void (*init)(void);         /* init routine (JMP INIT) */
    unsigned char reserved;     /* unused */
};

typedef struct __devhdl devhdl_t;


/* List of device handlers, as managed in HATABS */

struct __hatabs {
    unsigned char   id;         /* ATASCII code of handler e.g. 'C','D','E','K','P','S','R' */
    devhdl_t*       devhdl;     /* Pointer to routines of device */
};

typedef struct __hatabs hatabs_t;


/* Floating point register */

struct __fpreg {
#ifdef OS_REV2
    unsigned char fr;
    unsigned char frm[5];       /* 5-byte register mantissa */
#else
    unsigned char fr[6];        /* 6 bytes for single register */
#endif
};

typedef struct __fpreg fpreg_t;

enum {                          /* enum for access of floating point registers */
    FPIDX_R0 = 0,               /* (to use as index) */
    FPIDX_RE = 1,
    FPIDX_R1 = 2,
    FPIDX_R2 = 3
};


/* Define a structure with atari os register offsets */

struct __os {

    // --- Zero-Page ---

#ifdef OSA
    unsigned char*  linzbs;                 // = $00/$01        LINBUG RAM (WILL BE REPLACED BY MONITOR RAM)
#else
    unsigned char   linflg;                 // = $00            LNBUG FLAG (0 = NOT LNBUG)
    unsigned char   ngflag;                 // = $01            MEMORY STATUS (0 = FAILURE)
#endif
    unsigned char*  casini;                 // = $02/$03        CASSETTE INIT LOCATION
    unsigned char*  ramlo;                  // = $04/$05        RAM POINTER FOR MEMORY TEST

#ifdef OSA
    unsigned char   tramsz;                 // = $06            FLAG FOR LEFT CARTRIDGE
    unsigned char   tstdat;                 // = $07            FLAG FOR RIGHT CARTRIDGE
#else
    unsigned char   trnsmz;                 // = $06            TEMPORARY REGISTER FOR RAM SIZE
    unsigned char   tstdat;                 // = $07            UNUSED (NOT TOUCHED DURING RESET/COLD START)
#endif

    // Cleared upon Coldstart only

    unsigned char   warmst;                 // = $08            WARM START FLAG
    unsigned char   bootq;                  // = $09            SUCCESSFUL BOOT FLAG
    void (*dosvec)(void);                   // = $0A/$0B        DISK SOFTWARE START VECTOR
    void (*dosini)(void);                   // = $0C/$0D        DISK SOFTWARE INIT ADDRESS
    unsigned char*  appmhi;                 // = $0E/$0F        APPLICATIONS MEMORY HI LIMIT

    // Cleared upon Coldstart or Warmstart

    unsigned char   pokmsk;                 // = $10            SYSTEM MASK FOR POKEY IRQ ENABLE
    unsigned char   brkkey;                 // = $11            BREAK KEY FLAG
    unsigned char   rtclok[3];              // = $12-$14        REAL TIME CLOCK (IN 16 MSEC UNITS)
    unsigned char*  bufadr;                 // = $15/$16        INDIRECT BUFFER ADDRESS REGISTER
    unsigned char   iccomt;                 // = $17            COMMAND FOR VECTOR
    unsigned char*  dskfms;                 // = $18/$19        DISK FILE MANAGER POINTER
    unsigned char*  dskutl;                 // = $1A/$1B        DISK UTILITIES POINTER
#ifdef OSA
    unsigned char   ptimot;                 // = $1C            PRINTER TIME OUT REGISTER
    unsigned char   pbpnt;                  // = $1D            PRINT BUFFER POINTER
    unsigned char   pbufsz;                 // = $1E            PRINT BUFFER SIZE
    unsigned char   ptemp;                  // = $1F            TEMPORARY REGISTER
#else
    unsigned char   abufpt[4];              // = $1C-$1F        ACMI BUFFER POINTER AREA
#endif
    iocb_t          ziocb;                  // = $20-$2F        ZERO PAGE I/O CONTROL BLOCK

    unsigned char   status;                 // = $30            INTERNAL STATUS STORAGE
    unsigned char   chksum;                 // = $31            CHECKSUM (SINGLE BYTE SUM WITH CARRY)
    unsigned char*  bufr;                   // = $32/$33        POINTER TO DATA BUFFER
    unsigned char*  bfen;                   // = $34/$35        NEXT BYTE PAST END OF THE DATA BUFFER LO
#ifdef OSA
    unsigned char   cretry;                 // = $36            NUMBER OF COMMAND FRAME RETRIES
    unsigned char   dretry;                 // = $37            NUMBER OF DEVICE RETRIES
#else
    unsigned int    ltemp;                  // = $36/$37        LOADER TEMPORARY
#endif
    unsigned char   bufrfl;                 // = $38            DATA BUFFER FULL FLAG
    unsigned char   recvdn;                 // = $39            RECEIVE DONE FLAG
    unsigned char   xmtdon;                 // = $3A            TRANSMISSION DONE FLAG
    unsigned char   chksnt;                 // = $3B            CHECKSUM SENT FLAG
    unsigned char   nocksm;                 // = $3C            NO CHECKSUM FOLLOWS DATA FLAG
    unsigned char   bptr;                   // = $3D            CASSETTE BUFFER POINTER
    unsigned char   ftype;                  // = $3E            CASSETTE IRG TYPE
    unsigned char   feof;                   // = $3F            CASSETTE EOF FLAG (0 // = QUIET)

    unsigned char   freq;                   // = $40            CASSETTE BEEP COUNTER
    unsigned char   soundr;                 // = $41            NOISY I/0 FLAG. (ZERO IS QUIET)
    unsigned char   critic;                 // = $42            DEFINES CRITICAL SECTION (CRITICAL IF NON-Z)
    dos2x_t         fmszpg;                 // = $43-$49        DISK FILE MANAGER SYSTEM ZERO PAGE
#ifdef OSA
    unsigned char   ckey;                   // = $4A            FLAG SET WHEN GAME START PRESSED
    unsigned char   cassbt;                 // = $4B            CASSETTE BOOT FLAG
#else
    void*           zchain;                 // = $4A/$4B        HANDLER LINKAGE CHAIN POINTER
#endif
    unsigned char   dstat;                  // = $4C            DISPLAY STATUS
    unsigned char   atract;                 // = $4D            ATRACT FLAG
    unsigned char   drkmsk;                 // = $4E            DARK ATRACT MASK
    unsigned char   colrsh;                 // = $4F            ATRACT COLOR SHIFTER (EOR'ED WITH PLAYFIELD

    unsigned char   tmpchr;                 // = $50            TEMPORARY CHARACTER
    unsigned char   hold1;                  // = $51            TEMPORARY
    unsigned char   lmargn;                 // = $52            LEFT MARGIN (NORMALLY 2, CC65 C STARTUP CODE SETS IT TO 0)
    unsigned char   rmargn;                 // = $53            RIGHT MARGIN (NORMALLY 39 IF NO XEP80 IS USED)
    unsigned char   rowcrs;                 // = $54            1CURSOR ROW
    unsigned int    colcrs;                 // = $55/$56        CURSOR COLUMN
    unsigned char   dindex;                 // = $57            DISPLAY MODE
    unsigned char*  savmsc;                 // = $58/$59        SAVED MEMORY SCAN COUNTER
    unsigned char   oldrow;                 // = $5A            PRIOR ROW
    unsigned int    oldcol;                 // = $5B/$5C        PRIOR COLUMN
    unsigned char   oldchr;                 // = $5D            DATA UNDER CURSOR
    unsigned char*  oldadr;                 // = $5E/$5F        SAVED CURSOR MEMORY ADDRESS

#ifdef OSA
    unsigned char   newrow;                 // = $60            POINT DRAW GOES TO
    unsigned int    newcol;                 // = $61/$62        COLUMN DRAW GOES TO
#else
    unsigned char*  fkdef;                  // = $60/$61        FUNCTION KEY DEFINITION TABLE
    unsigned char   palnts;                 // = $62            PAL/NTSC INDICATOR (0 // = NTSC)
#endif
    unsigned char   logcol;                 // = $63            POINTS AT COLUMN IN LOGICAL LINE
    unsigned char*  adress;                 // = $64/$65        TEMPORARY ADDRESS
    unsigned int    mlttmp;                 // = $66/$67        TEMPORARY / FIRST BYTE IS USED IN OPEN AS TEMP
    unsigned int    savadr;                 // = $68/$69        SAVED ADDRESS
    unsigned char   ramtop;                 // = $6A            RAM SIZE DEFINED BY POWER ON LOGIC
    unsigned char   bufcnt;                 // = $6B            BUFFER COUNT
    unsigned char*  bufstr;                 // = $6C/$6D        EDITOR GETCH POINTER
    unsigned char   bitmsk;                 // = $6E            BIT MASK
    unsigned char   shfamt;                 // = $6F            SHIFT AMOUNT FOR PIXEL JUSTIFUCATION

    unsigned int    rowac;                  // = $70/$71        DRAW WORKING ROW
    unsigned int    colac;                  // = $72/$73        DRAW WORKING COLUMN
    unsigned char*  endpt;                  // = $74/$75        END POINT
    unsigned char   deltar;                 // = $76            ROW DIFFERENCE
    unsigned int    deltac;                 // = $77/$78        COLUMN DIFFERENCE
#ifdef OSA
    unsigned char   rowinc;                 // = $79            ROWINC
    unsigned char   colinc;                 // = $7A            COLINC
#else
    unsigned char*  keydef;                 // = $79/$7A        2-BYTE KEY DEFINITION TABLE ADDRESS
#endif
    unsigned char   swpflg;                 // = $7B            NON-0 1F TXT AND REGULAR RAM IS SWAPPED
    unsigned char   holdch;                 // = $7C            CH IS MOVED HERE IN KGETCH BEFORE CNTL & SH
    unsigned char   insdat;                 // = $7D            1-BYTE TEMPORARY
    unsigned int    countr;                 // = $7E/$7F        2-BYTE DRAW ITERATION COUNT

    unsigned char   _free_1[0xD4-0x7F-1];   // USER SPACE

                                            // Floating Point Package Page Zero Address Equates
    fpreg_t         fpreg[4];               // = $D4-$EB        4 REGSITERS, ACCCESS LIKE "fpreg[FPIDX_R0].fr"
    unsigned char   frx;                    // = $EC            1-BYTE TEMPORARY
    unsigned char   eexp;                   // = $ED            VALUE OF EXP
#ifdef OS_REV2
    unsigned char   frsign;                 // = $EE            ##REV2## 1-BYTE FLOATING POINT SIGN
    unsigned char   plycnt;                 // = $EF            ##REV2## 1-BYTE POLYNOMIAL DEGREE
    unsigned char   sgnflg;                 // = $F0            ##REV2## 1-BYTE SIGN FLAG
    unsigned char   xfmflg;                 // = $F1            ##REV2## 1-BYTE TRANSFORM FLAG
#else
    unsigned char   nsign;                  // = $EE            SIGN OF #
    unsigned char   esign;                  // = $EF            SIGN OF EXPONENT
    unsigned char   fchrflg;                // = $F0            1ST CHAR FLAG
    unsigned char   digrt;                  // = $F1            # OF DIGITS RIGHT OF DECIMAL
#endif
    unsigned char   cix;                    // = $F2            CURRENT INPUT INDEX
    unsigned char*  inbuff;                 // = $F3/$F4        POINTS TO USER'S LINE INPUT BUFFER
    unsigned int    ztemp1;                 // = $F5/$F6        2-BYTE TEMPORARY
    unsigned int    ztemp4;                 // = $F7/$F8        2-BYTE TEMPORARY
    unsigned int    ztemp3;                 // = $F9/$FA        2-BYTE TEMPORARY

    union {
        unsigned char   degflg;             // = $FB            ##OLD## SAME AS RADFLG
        unsigned char   radflg;             // = $FB            ##OLD## 0=RADIANS, 6=DEGREES
    } _uflg;

    fpreg_t*        flptr;                  // = $FC/$FD        2-BYTE FLOATING POINT NUMBER POINTER
    fpreg_t*        fptr2;                  // = $FE/$FF        2-BYTE FLOATING POINT NUMBER POINTER

    // --- Page 1 ---

    unsigned char   stack[0x100];           // STACK

    // --- Page 2 ---

    void (*vdslst)(void);                   // = $0200/$0201    DISPLAY LIST NMI VECTOR
    void (*vprced)(void);                   // = $0202/$0203    PROCEED LINE IRQ VECTOR
    void (*vinter)(void);                   // = $0204/$0205    INTERRUPT LINE IRQ VECTOR
    void (*vbreak)(void);                   // = $0206/$0207    SOFTWARE BREAK (00) INSTRUCTION IRQ VECTOR
    void (*vkeybd)(void);                   // = $0208/$0209    POKEY KEYBOARD IRQ VECTOR
    void (*vserin)(void);                   // = $020A/$020B    POKEY SERIAL INPUT READY IRQ
    void (*vseror)(void);                   // = $020C/$020D    POKEY SERIAL OUTPUT READY IRQ
    void (*vseroc)(void);                   // = $020E/$020F    POKEY SERIAL OUTPUT COMPLETE IRQ
    void (*vtimr1)(void);                   // = $0210/$0211    POKEY TIMER 1 IRQ
    void (*vtimr2)(void);                   // = $0212/$0213    POKEY TIMER 2 IRQ
    void (*vtimr4)(void);                   // = $0214/$0215    POKEY TIMER 4 IRQ
    void (*vimirq)(void);                   // = $0216/$0217    IMMEDIATE IRQ VECTOR
    unsigned int cdtmv1;                    // = $0218/$0219    COUNT DOWN TIMER 1
    unsigned int cdtmv2;                    // = $021A/$021B    COUNT DOWN TIMER 2
    unsigned int cdtmv3;                    // = $021C/$021D    COUNT DOWN TIMER 3
    unsigned int cdtmv4;                    // = $021E/$021F    COUNT DOWN TIMER 4
    unsigned int cdtmv5;                    // = $0220/$0221    COUNT DOWN TIMER 5
    void (*vvblki)(void);                   // = $0222/$0223    IMMEDIATE VERTICAL BLANK NMI VECTOR
    void (*vvblkd)(void);                   // = $0224/$0225    DEFERRED VERTICAL BLANK NMI VECTOR
    void (*cdtma1)(void);                   // = $0226/$0227    COUNT DOWN TIMER 1 JSR ADDRESS
    void (*cdtma2)(void);                   // = $0228/$0229    COUNT DOWN TIMER 2 JSR ADDRESS
    unsigned char cdtmf3;                   // = $022A          COUNT DOWN TIMER 3 FLAG
    unsigned char srtimr;                   // = $022B          SOFTWARE REPEAT TIMER
    unsigned char cdtmf4;                   // = $022C          COUNT DOWN TIMER 4 FLAG
    unsigned char intemp;                   // = $022D          IAN'S TEMP
    unsigned char cdtmf5;                   // = $022E          COUNT DOWN TIMER FLAG 5
    unsigned char sdmctl;                   // = $022F          SAVE DMACTL REGISTER
    union {
        struct {
            unsigned char stl;           // = $0230          SAVE DISPLAY LIST LOW BYTE
            unsigned char sth;           // = $0231          SAVE DISPLAY LIST HI BYTE
        } _st;
        void*   sdlst;                      // = $0230/$0231    (same as above as pointer)
    } _sdl;
    unsigned char sskctl;                   // = $0232          SKCTL REGISTER RAM
#ifdef OSA
    unsigned char _spare_1;                 // = $0233          No OS use.
#else
    unsigned char lcount;                   // = $0233          ##1200xl## 1-byte relocating loader record
#endif
    unsigned char lpenh;                    // = $0234          LIGHT PEN HORIZONTAL VALUE
    unsigned char lpenv;                    // = $0235          LIGHT PEN VERTICAL VALUE
    void (*brkky)(void);                    // = $0236/$0237    BREAK KEY VECTOR
#ifdef OSA
    unsigned char spare2[2];                // = $0238/$0239    No OS use.
#else
    void (*vpirq)(void);                    // = $0238/$0239    ##rev2## 2-byte parallel device IRQ vector
#endif
    unsigned char cdevic;                   // = $023A          COMMAND FRAME BUFFER - DEVICE
    unsigned char ccomnd;                   // = $023B          COMMAND
    union {
        struct {
            unsigned char caux1;            // = $023C          COMMAND AUX BYTE 1
            unsigned char caux2;            // = $023D          COMMAND AUX BYTE 2
        } _scaux;
        unsigned int caux;                  // = $023C/$023D    (same as above as word)
    } _ucaux;
    unsigned char temp;                     // = $023E          TEMPORARY RAM CELL
    unsigned char errflg;                   // = $023F          ERROR FLAG - ANY DEVICE ERROR EXCEPT TIME OUT
    unsigned char dflags;                   // = $0240          DISK FLAGS FROM SECTOR ONE
    unsigned char dbsect;                   // = $0241          NUMBER OF DISK BOOT SECTORS
    unsigned char* bootad;                  // = $0242/$0243    ADDRESS WHERE DISK BOOT LOADER WILL BE PUT
    unsigned char coldst;                   // = $0244          COLDSTART FLAG (1=IN MIDDLE OF COLDSTART>
#ifdef OSA
    unsigned char spare3;                   // = $0245          No OS use.
#else
    unsigned char reclen;                   // = $0245          ##1200xl## 1-byte relocating loader record length
#endif
    unsigned char dsktim;                   // = $0246          DISK TIME OUT REGISTER
#ifdef OSA
    unsigned char linbuf[40];               // = $0247-$026E    ##old## CHAR LINE BUFFER
#else
    unsigned char pdvmsk;                   // = $0247          ##rev2## 1-byte parallel device selection mask
    unsigned char shpdvs;                   // = $0248          ##rev2## 1-byte PDVS (parallel device select)
    unsigned char pdimsk;                   // = $0249          ##rev2## 1-byte parallel device IRQ selection
    unsigned int  reladr;                   // = $024A/$024B    ##rev2## 2-byte relocating loader relative adr.
    unsigned char pptmpa;                   // = $024C          ##rev2## 1-byte parallel device handler temporary
    unsigned char pptmpx;                   // = $024D          ##rev2## 1-byte parallel device handler temporary
    unsigned char _reserved_1[29];          // = $024E-$026A    RESERVED
    unsigned char chsalt;                   // = $026B          ##1200xl## 1-byte character set alternate
    unsigned char vsflag;                   // = $026C          ##1200xl## 1-byte fine vertical scroll count
    unsigned char keydis;                   // = $026D          ##1200xl## 1-byte keyboard disable
    unsigned char fine;                     // = $026E          ##1200xl## 1-byte fine scrolling mode
#endif
    unsigned char gprior;                   // = $026F          GLOBAL PRIORITY CELL
    unsigned char paddl0;                   // = $0270          1-BYTE POTENTIOMETER 0
    unsigned char paddl1;                   // = $0271          1-BYTE POTENTIOMETER 1
    unsigned char paddl2;                   // = $0272          1-BYTE POTENTIOMETER 2
    unsigned char paddl3;                   // = $0273          1-BYTE POTENTIOMETER 3
    unsigned char paddl4;                   // = $0274          1-BYTE POTENTIOMETER 4
    unsigned char paddl5;                   // = $0275          1-BYTE POTENTIOMETER 5
    unsigned char paddl6;                   // = $0276          1-BYTE POTENTIOMETER 6
    unsigned char paddl7;                   // = $0277          1-BYTE POTENTIOMETER 7
    unsigned char stick0;                   // = $0278          1-byte joystick 0
    unsigned char stick1;                   // = $0279          1-byte joystick 1
    unsigned char stick2;                   // = $027A          1-byte joystick 2
    unsigned char stick3;                   // = $027B          1-byte joystick 3
    unsigned char ptrig0;                   // = $027C          1-BYTE PADDLE TRIGGER 0
    unsigned char ptrig1;                   // = $027D          1-BYTE PADDLE TRIGGER 1
    unsigned char ptrig2;                   // = $027E          1-BYTE PADDLE TRIGGER 2
    unsigned char ptrig3;                   // = $027F          1-BYTE PADDLE TRIGGER 3
    unsigned char ptrig4;                   // = $0280          1-BYTE PADDLE TRIGGER 4
    unsigned char ptrig5;                   // = $0281          1-BYTE PADDLE TRIGGER 5
    unsigned char ptrig6;                   // = $0281          1-BYTE PADDLE TRIGGER 6
    unsigned char ptrig7;                   // = $0283          1-BYTE PADDLE TRIGGER 7
    unsigned char strig0;                   // = $0284          1-BYTE JOYSTICK TRIGGER 0
    unsigned char strig1;                   // = $0285          1-BYTE JOYSTICK TRIGGER 1
    unsigned char strig2;                   // = $0286          1-BYTE JOYSTICK TRIGGER 2
    unsigned char strig3;                   // = $0287          1-BYTE JOYSTICK TRIGGER 3
#ifdef OSA
    unsigned char cstat;                    // = $0288          ##old## cassette status register
#else
    unsigned char hibyte;                   // = $0288          ##1200xl## 1-byte relocating loader high byte
#endif
    unsigned char wmode;                    // = $0289          1-byte cassette WRITE mode
    unsigned char blim;                     // = $028A          1-byte cassette buffer limit
#ifdef OSA
    unsigned char _reserved_2[5];           // = $028B-$028F    RESERVED
#else
    unsigned char imask;                    // = $028B          ##rev2## (not used)
    void (*jveck)(void);                    // = $028C/$028D    2-byte jump vector
    unsigned newadr;                        // = $028E/028F     ##1200xl## 2-byte relocating address
#endif
    unsigned char txtrow;                   // = $0290          TEXT ROWCRS
    unsigned txtcol;                        // = $0291/$0292    TEXT COLCRS
    unsigned char tindex;                   // = $0293          TEXT INDEX
    unsigned char* txtmsc;                  // = $0294/$0295    FOOLS CONVRT INTO NEW MSC
    unsigned char txtold[6];                // = $0296-$029B    OLDROW & OLDCOL FOR TEXT (AND THEN SOME)
#ifdef OSA
    unsigned char tmpx1;                    // = $029C          ##old## 1--byte temporary register
#else
    unsigned char cretry;                   // = $029C          ##1200xl## 1-byte number of command frame retries
#endif
    unsigned char hold3;                    // = $029D          1-byte temporary
    unsigned char subtmp;                   // = $029E          1-byte temporary
    unsigned char hold2;                    // = $029F          1-byte (not used)
    unsigned char dmask;                    // = $02A0          1-byte display (pixel location) mask
    unsigned char tmplbt;                   // = $02A1          1-byte (not used)
    unsigned char escflg;                   // = $02A2          ESCAPE FLAG
    unsigned char tabmap[15];               // = $02A3-$02B1    15-byte (120 bit) tab stop bit map
    unsigned char logmap[4];                // = $02B2-$02B5    LOGICAL LINE START BIT MAP
    unsigned char invflg;                   // = $02B6          INVERSE VIDEO FLAG (TOGGLED BY ATARI KEY)
    unsigned char filflg;                   // = $02B7          RIGHT FILL FLAG FOR DRAW
    unsigned char tmprow;                   // = $02B8          1-byte temporary row
    unsigned tmpcol;                        // = $02B9/$02BA    2-byte temporary column
    unsigned char scrflg;                   // = $02BB          SET IF SCROLL OCCURS
    unsigned char hold4;                    // = $02BC          TEMP CELL USED IN DRAW ONLY
#ifdef OSA
    unsigned char hold5;                    // = $02BD          ##old## DITTO
#else
    unsigned char dretry;                   // = $02BD          ##1200xl## 1-byte number of device retries
#endif
    unsigned char shflok;                   // = $02BE          1-byte shift/control lock flags
    unsigned char botscr;                   // = $02BF          BOTTOM OF SCREEN   24 NORM 4 SPLIT
    unsigned char pcolr0;                   // = $02C0          1-byte player-missile 0 color/luminance
    unsigned char pcolr1;                   // = $02C1          1-byte player-missile 1 color/luminance
    unsigned char pcolr2;                   // = $02C2          1-byte player-missile 2 color/luminance
    unsigned char pcolr3;                   // = $02C3          1-byte player-missile 3 color/luminance
    unsigned char color0;                   // = $02C4          1-byte playfield 0 color/luminance
    unsigned char color1;                   // = $02C5          1-byte playfield 1 color/luminance
    unsigned char color2;                   // = $02C6          1-byte playfield 2 color/luminance
    unsigned char color3;                   // = $02C7          1-byte playfield 3 color/luminance
    unsigned char color4;                   // = $02C8          1-byte background color/luminance
#ifdef OSA
    unsigned char _spare_2[23];             // = $02C9-$02DF    No OS use.
#else
    union {
        unsigned char parmbl[6];            // = $02C9          ##rev2## 6-byte relocating loader parameter
        struct {
            void (*runadr)(void);           // = $02C9          ##1200xl## 2-byte run address
            unsigned int hiused;            // = $02CB          ##1200xl## 2-byte highest non-zero page address
            unsigned int zhiuse;            // = $02CD          ##1200xl## 2-byte highest zero page address
        } _sused;
    } _uused;
    union {
        unsigned char oldpar[6];            // = $02CF          ##rev2## 6-byte relocating loader parameter
        struct {
            void (*gbytea)(void);           // = $02CF          ##1200xl## 2-byte GET-BYTE routine address
            unsigned int loadad;            // = $02D1          ##1200xl## 2-byte non-zero page load address
            unsigned int zloada;            // = $02D3          ##1200xl## 2-byte zero page load address
        };
    };
    unsigned int dsctln;                    // = $02D5          ##1200xl## 2-byte disk sector length
    unsigned int acmisr;                    // = $02D7          ##1200xl## 2-byte ACMI interrupt service routine
    unsigned char krpdel;                   // = $02D9          ##1200xl## 1-byte auto-repeat delay
    unsigned char keyrep;                   // = $02DA          ##1200xl## 1-byte auto-repeat rate
    unsigned char noclik;                   // = $02DB          ##1200xl## 1-byte key click disable
    unsigned char helpfg;                   // = $02DC          ##1200xl## 1-byte HELP key flag (0 = no HELP)
    unsigned char dmasav;                   // = $02DD          ##1200xl## 1-byte SDMCTL save/restore
    unsigned char pbpnt;                    // = $02DE          ##1200xl## 1-byte printer buffer pointer
    unsigned char pbufsz;                   // = $02DF          ##1200xl## 1-byte printer buffer size
#endif
    union {
        unsigned char glbabs[4];            // = $02E0-$02E3    byte global variables for non-DOS users
        struct {
            void (*runad)(void);            // = $02E0          ##map## 2-byte binary file run address
            void (*initad)(void);           // = $02E2          ##map## 2-byte binary file initialization address
        } _sad;
    } _uglb;
    unsigned char ramsiz;                   // = $02E4          RAM SIZE (HI BYTE ONLY)
    void* memtop;                           // = $02E5          TOP OF AVAILABLE USER MEMORY
    void* memlo;                            // = $02E7          BOTTOM OF AVAILABLE USER MEMORY
#ifdef OSA
    unsigned char _spare_3;                 // = $02E9          No OS use.
#else
    unsigned char hndlod;                   // = $02E9          ##1200xl## 1-byte user load flag
#endif
    unsigned char dvstat[4];                // = $02EA-$02ED    STATUS BUFFER
    union {
        unsigned int cbaud;                 // = $02EE/$02EF    2-byte cassette baud rate
        struct {
            unsigned char cbaudl;           // = $02EE          1-byte low cassette baud rate
            unsigned char cbaudh;           // = $02EF          1-byte high cassette baud rate
        } _sbaud;
    } _ubaud;
    unsigned char crsinh;                   // = $02F0          CURSOR INHIBIT (00 = CURSOR ON)
    unsigned char keydel;                   // = $02F1          KEY DELAY
    unsigned char ch1;                      // = $02F2          1-byte prior keyboard character
    unsigned char chact;                    // = $02F3          CHACTL REGISTER RAM
    unsigned char chbas;                    // = $02F4          CHBAS REGISTER RAM
#ifdef OSA
    unsigned char _spare_4[5];              // = $02F5-$02F9    No OS use.
#else
    unsigned char newrow;                   // = $02F5          ##1200xl## 1-byte draw destination row
    unsigned int  newcol;                   // = $02F6/$02F7    ##1200xl## 2-byte draw destination column
    unsigned char rowinc;                   // = $02F8          ##1200xl## 1-byte draw row increment
    unsigned char colinc;                   // = $02F9          ##1200xl## 1-byte draw column increment
#endif
    unsigned char char_;                    // = $02FA          1-byte internal character (naming changed due to do keyword conflict)
    unsigned char atachr;                   // = $02FB          ATASCII CHARACTER
    unsigned char ch;                       // = $02FC          GLOBAL VARIABLE FOR KEYBOARD
    unsigned char fildat;                   // = $02FD          RIGHT FILL DATA <DRAW>
    unsigned char dspflg;                   // = $02FE          DISPLAY FLAG   DISPLAY CNTLS IF NON-ZERO
    unsigned char ssflag;                   // = $02FF          START/STOP FLAG FOR PAGING (CNTL 1). CLEARE

    // --- Page 3 ---

    dcb_t dcb;                              // = $0300-$030B    DEVICE CONTROL BLOCK
    unsigned int timer1;                    // = $030C/$030D    INITIAL TIMER VALUE
#ifdef OSA
    unsigned char addcor;                   // = $030E          ##old## ADDITION CORRECTION
#else
    unsigned char jmpers;                   // = $030E          ##1200xl## 1-byte jumper options
#endif
    unsigned char casflg;                   // = $030F          CASSETTE MODE WHEN SET
    unsigned int  timer2;                   // = $0310/$0311    2-byte final baud rate timer value
    unsigned char temp1;                    // = $0312          TEMPORARY STORAGE REGISTER
#ifdef OSA
    unsigned char _spare_5;                 // = $0313          unused
    unsigned char temp2;                    // = $0314          ##old## TEMPORARY STORAGE REGISTER
#else
    unsigned char temp2;                    // = $0313          ##1200xl## 1-byte temporary
    unsigned char ptimot;                   // = $0314          ##1200xl## 1-byte printer timeout
#endif
    unsigned char temp3;                    // = $0315          TEMPORARY STORAGE REGISTER
    unsigned char savio;                    // = $0316          SAVE SERIAL IN DATA PORT
    unsigned char timflg;                   // = $0317          TIME OUT FLAG FOR BAUD RATE CORRECTION
    unsigned char stackp;                   // = $0318          SIO STACK POINTER SAVE CELL
    unsigned char tstat;                    // = $0319          TEMPORARY STATUS HOLDER
#ifdef OSA
    hatabs_t      hatabs[12];               // = $031A-$033D    handler address table
    unsigned int  zeropad;                  // = $033E/$033F    zero padding
#else
    hatabs_t      hatabs[11];               // = $031A-$033A    handler address table
    unsigned int  zeropad;                  // = $033B/$033C    zero padding
    unsigned char pupbt1;                   // = $033D          ##1200xl## 1-byte power-up validation byte 1
    unsigned char pupbt2;                   // = $033E          ##1200xl## 1-byte power-up validation byte 2
    unsigned char pupbt3;                   // = $033F          ##1200xl## 1-byte power-up validation byte 3
#endif

    iocb_t        iocb[8];                  // = $0340-$03BF    8 I/O Control Blocks
    unsigned char prnbuf[40];               // = $03C0-$3E7     PRINTER BUFFER
#ifdef OSA
    unsigned char _spare_6[151];            // = $03E8-$047F    unused
#else
    unsigned char superf;                   // = $03E8          ##1200xl## 1-byte editor super function flag
    unsigned char ckey;                     // = $03E9          ##1200xl## 1-byte cassette boot request flag
    unsigned char cassbt;                   // = $03EA          ##1200xl## 1-byte cassette boot flag
    unsigned char cartck;                   // = $03EB          ##1200xl## 1-byte cartridge equivalence check
    unsigned char derrf;                    // = $03EC          ##rev2## 1-byte screen OPEN error flag
    unsigned char acmvar[11];               // = $03ED-$03F7    ##1200xl## reserved for ACMI, not cleared upon reset
    unsigned char basicf;                   // = $03F8          ##rev2## 1-byte BASIC switch flag
    unsigned char mintlk;                   // = $03F9          ##1200xl## 1-byte ACMI module interlock
    unsigned char gintlk;                   // = $03FA          ##1200xl## 1-byte cartridge interlock
    void*         chlink;                   // = $03FB/$03FC    ##1200xl## 2-byte loaded handler chain link
    unsigned char casbuf[131];              // = $03FD-$047F    CASSETTE BUFFER
#endif

    // --- Page 4 ---

    unsigned char usarea[128];              // = $0480          128 bytes reserved for application

    // --- Page 5 ---

    unsigned char _spare_7[126];            // = $0500-$057D    reserved for FP package / unused
    unsigned char lbpr1;                    // = $057E          LBUFF PREFIX 1
    unsigned char lbpr2;                    // = $057F          LBUFF PREFIX 2
    unsigned char lbuff[128];               // = $0580-$05FF    128-byte line buffer
};


/* Define a structure with the zero page atari basic register offsets */

struct __basic {
    void*         lowmem;                   // = $80/$81        POINTER TO BASIC'S LOW MEMORY
    void*         vntp;                     // = $82/$83        BEGINNING ADDRESS OF THE VARIABLE NAME TABLE
    void*         vntd;                     // = $84/$85        POINTER TO THE ENDING ADDRESS OF THE VARIABLE NAME TABLE PLUS ONE
    void*         vvtp;                     // = $86/$87        ADDRESS FOR THE VARIABLE VALUE TABLE
    void*         stmtab;                   // = $88/$89        ADDRESS OF THE STATEMENT TABLE
    void*         stmcur;                   // = $8A/$8B        CURRENT BASIC STATEMENT POINTER
    void*         starp;                    // = $8C/$8D        ADDRESS FOR THE STRING AND ARRAY TABLE
    void*         runstk;                   // = $8E/$8F        ADDRESS OF THE RUNTIME STACK
    void*         memtop;                   // = $90/$91        POINTER TO THE TOP OF BASIC MEMORY

    unsigned char   _internal_1[0xBA-0x91-1];  // INTERNAL DATA

    unsigned int  stopln;                   // = $BA/$BB        LINE WHERE A PROGRAM WAS STOPPED

    unsigned char   _internal_2[0xC3-0xBB-1];   // INTERNAL DATA

    unsigned char errsav;                   // = $C3            NUMBER OF THE ERROR CODE

    unsigned char   _internal_3[0xC9-0xC3-1];   // INTERNAL DATA

    unsigned char ptabw;                    // = $C9            NUMBER OF COLUMNS BETWEEN TAB STOPS
    unsigned char loadflg;                  // = $CA            LIST PROTECTION

    unsigned char   _internal_4[0xD4-0xCA-1];   // INTERNAL DATA

    unsigned int  binint;                   // = $D4/$D5        USR-CALL RETURN VALUE
};

#endif

#define OS (*(struct __os*)0x0000)
#define BASIC (*(struct __basic*)0x0080)

/*****************************************************************************/
/*                                                                           */
/*                                 _gtia.h                                   */
/*                                                                           */
/*                  Internal include file, do not use directly               */
/*                                                                           */
/* "GTIA, Graphic Television Interface Adaptor, is a custom chip used in the */
/* Atari 8-bit family of computers and in the Atari 5200 console. In these   */
/* systems, GTIA chip works together with ANTIC to produce video display.    */
/* ANTIC generates the playfield graphics (text and bitmap) while GTIA       */
/* provides the color for the playfield and adds overlay objects known as    */
/* player/missile graphics (sprites)" - Wikipedia article on "GTIA"          */
/*                                                                           */
/*                                                                           */
/* (C) 2000 Freddy Offenga <taf_offenga@yahoo.com>                           */
/* 2019-01-16: Bill Kendrick <nbs@sonic.net>: More defines for registers     */
/*                                                                           */
/*                                                                           */
/* This software is provided 'as-is', without any expressed or implied       */
/* warranty.  In no event will the authors be held liable for any damages    */
/* arising from the use of this software.                                    */
/*                                                                           */
/* Permission is granted to anyone to use this software for any purpose,     */
/* including commercial applications, and to alter it and redistribute it    */
/* freely, subject to the following restrictions:                            */
/*                                                                           */
/* 1. The origin of this software must not be misrepresented; you must not   */
/*    claim that you wrote the original software. If you use this software   */
/*    in a product, an acknowledgment in the product documentation would be  */
/*    appreciated but is not required.                                       */
/* 2. Altered source versions must be plainly marked as such, and must not   */
/*    be misrepresented as being the original software.                      */
/* 3. This notice may not be removed or altered from any source              */
/*    distribution.                                                          */
/*                                                                           */
/*****************************************************************************/


#ifndef __GTIA_H
#define __GTIA_H

/*****************************************************************************/
/* Define a structure with the GTIA register offsets for write (W)           */
/*****************************************************************************/

struct __gtia_write {
    unsigned char   hposp0; /* 0x00: horizontal position of player 0 */
    unsigned char   hposp1; /* 0x01: horizontal position of player 1 */
    unsigned char   hposp2; /* 0x02: horizontal position of player 2 */
    unsigned char   hposp3; /* 0x03: horizontal position of player 3 */
    unsigned char   hposm0; /* 0x04: horizontal position of missile 0 */
    unsigned char   hposm1; /* 0x05: horizontal position of missile 1 */
    unsigned char   hposm2; /* 0x06: horizontal position of missile 2 */
    unsigned char   hposm3; /* 0x07: horizontal position of missile 3 */

    unsigned char   sizep0; /* 0x08: size of player 0 */
    unsigned char   sizep1; /* 0x09: size of player 1 */
    unsigned char   sizep2; /* 0x0A: size of player 2 */
    unsigned char   sizep3; /* 0x0B: size of player 3 */
    unsigned char   sizem;  /* 0x0C: size of missiles */

    unsigned char   grafp0; /* 0x0D: graphics shape player 0 (used when ANTIC is not instructed to use DMA; see DMACTL) */
    unsigned char   grafp1; /* 0x0E: graphics shape player 1 */
    unsigned char   grafp2; /* 0x0F: graphics shape player 2 */
    unsigned char   grafp3; /* 0x10: graphics shape player 3 */
    unsigned char   grafm;  /* 0x11: graphics shape missiles */

    unsigned char   colpm0; /* 0x12: color player and missile 0 */
    unsigned char   colpm1; /* 0x13: color player and missile 1 */
    unsigned char   colpm2; /* 0x14: color player and missile 2 */
    unsigned char   colpm3; /* 0x15: color player and missile 3 */
    unsigned char   colpf0; /* 0x16: color playfield 0 */
    unsigned char   colpf1; /* 0x17: color playfield 1 */
    unsigned char   colpf2; /* 0x18: color playfield 2 */
    unsigned char   colpf3; /* 0x19: color playfield 3 */
    unsigned char   colbk;  /* 0x1A: color background */

    unsigned char   prior;  /* 0x1B: priority selection */

    unsigned char   vdelay;
    /* 0x1C: vertical delay -- one-line resolution movement of
    ** vertical position of an object when two line resolution display is enabled
    */

    unsigned char   gractl; /* 0x1D: stick/paddle latch, p/m control */

    unsigned char   hitclr; /* 0x1E: clear p/m collision */
    unsigned char   consol; /* 0x1F: builtin speaker */
};


/*****************************************************************************/
/* (W) Values for SIZEP0-SIZEP3 and SIZEM registers:                         */
/*****************************************************************************/

#define PMG_SIZE_NORMAL 0x0 /* one color clock per pixel */
#define PMG_SIZE_DOUBLE 0x1 /* two color clocks per pixel */
#define PMG_SIZE_QUAD   0x3 /* four color clocks per pixel */


/* COLPM0-COLPM3, COLPF0-COLPF3, COLBK color registers */

/*****************************************************************************/
/* Color definitions                                                         */
/*****************************************************************************/

/* Make a GTIA color value */
#define _gtia_mkcolor(hue,lum) (((hue) << 4) | ((lum) << 1))

/* Luminance values go from 0 (black) to 7 (white) */

/* Hue values */
/* (These can vary depending on TV standard (NTSC vs PAL),
** tint potentiometer settings, TV tint settings, emulator palette, etc.)
*/
#define HUE_GREY        0
#define HUE_GOLD        1
#define HUE_GOLDORANGE  2
#define HUE_REDORANGE   3
#define HUE_ORANGE      4
#define HUE_MAGENTA     5
#define HUE_PURPLE      6
#define HUE_BLUE        7
#define HUE_BLUE2       8
#define HUE_CYAN        9
#define HUE_BLUEGREEN   10
#define HUE_BLUEGREEN2  11
#define HUE_GREEN       12
#define HUE_YELLOWGREEN 13
#define HUE_YELLOW      14
#define HUE_YELLOWRED   15

/* Color defines, similar to c64 colors (untested) */
/* Hardware palette values (for GTIA colxxx registers) */
#define GTIA_COLOR_BLACK             _gtia_mkcolor(HUE_GREY,0)
#define GTIA_COLOR_WHITE             _gtia_mkcolor(HUE_GREY,7)
#define GTIA_COLOR_RED               _gtia_mkcolor(HUE_REDORANGE,1)
#define GTIA_COLOR_CYAN              _gtia_mkcolor(HUE_CYAN,3)
#define GTIA_COLOR_VIOLET            _gtia_mkcolor(HUE_PURPLE,4)
#define GTIA_COLOR_GREEN             _gtia_mkcolor(HUE_GREEN,2)
#define GTIA_COLOR_BLUE              _gtia_mkcolor(HUE_BLUE,2)
#define GTIA_COLOR_YELLOW            _gtia_mkcolor(HUE_YELLOW,7)
#define GTIA_COLOR_ORANGE            _gtia_mkcolor(HUE_ORANGE,5)
#define GTIA_COLOR_BROWN             _gtia_mkcolor(HUE_YELLOW,2)
#define GTIA_COLOR_LIGHTRED          _gtia_mkcolor(HUE_REDORANGE,6)
#define GTIA_COLOR_GRAY1             _gtia_mkcolor(HUE_GREY,2)
#define GTIA_COLOR_GRAY2             _gtia_mkcolor(HUE_GREY,3)
#define GTIA_COLOR_LIGHTGREEN        _gtia_mkcolor(HUE_GREEN,6)
#define GTIA_COLOR_LIGHTBLUE         _gtia_mkcolor(HUE_BLUE,6)
#define GTIA_COLOR_GRAY3             _gtia_mkcolor(HUE_GREY,5)


/*****************************************************************************/
/* (W) PRIOR register values                                                 */
/*****************************************************************************/

#define PRIOR_P03_PF03          0x01 /* Players 0-3, then Playfields 0-3, then background */
#define PRIOR_P01_PF03_P23      0x02 /* Players 0-1, then Playfields 0-3, then Players 2-3, then background */
#define PRIOR_PF03_P03          0x04 /* Playfields 0-3, then Players 0-3, then background */
#define PRIOR_PF01_P03_PF23     0x08 /* Playfields 0-1, then Players 0-3, then Playfields 2-3, then background */

#define PRIOR_5TH_PLAYER        0x10 /* Four missiles combine to be a 5th player (uses COLPF3) */

/* Causes overlap of players 0 & 1 and of players 2 & 3 to result in a third color,
** the logical OR of the two players' colors, and other overlaps (e.g., players 0 and 2)
** to result in black (0x00).
*/
#define PRIOR_OVERLAP_3RD_COLOR 0x20


/*****************************************************************************/
/* (W) GTIA special graphics mode options for GPRIOR                         */
/*****************************************************************************/

/* Pixels are 2 color clocks wide, and one scanline tall
** (so 80x192 in normal playfield width).
** May be used with both bitmap and character modelines.
*/

/* 16 shade shades of the background (COLBK) hue;
** Note: brightnesses other than 0 (darkest) in COLBK cause additional effects
*/
#define PRIOR_GFX_MODE_9        0x40

/* 9 color palette mode;
** COLPM0 (acts as background) thru COLPM3, followed by COLPF0 thru COLPF3, and COLBK
*/
#define PRIOR_GFX_MODE_10       0x80

/* 16 hues of the background (COLBK) brightness;
** Note: hues other than 0 (greys) in COLBK caus additional effects
*/
#define PRIOR_GFX_MODE_11       0xC0


/*****************************************************************************/
/* (W) VDELAY register values                                                */
/*****************************************************************************/

#define VDELAY_MISSILE0 0x01
#define VDELAY_MISSILE1 0x02
#define VDELAY_MISSILE2 0x04
#define VDELAY_MISSILE3 0x08
#define VDELAY_PLAYER0  0x10
#define VDELAY_PLAYER1  0x20
#define VDELAY_PLAYER2  0x40
#define VDELAY_PLAYER3  0x80


/*****************************************************************************/
/* (W) GRACTL register values                                                */
/*****************************************************************************/

#define GRACTL_MISSLES              0x01 /* enable missiles */
#define GRACTL_PLAYERS              0x02 /* enable players */

/* "Latch" triggers; once pressed, will give a continuous
** pressed input until this bit is cleared
*/
#define GRACTL_LATCH_TRIGGER_INPUTS 0x04


/*****************************************************************************/
/* Define a structure with the GTIA register offsets for read (R)            */
/*****************************************************************************/

struct __gtia_read {
    unsigned char   m0pf;       /* 0x00: missile 0 to playfield collision */
    unsigned char   m1pf;       /* 0x01: missile 1 to playfield collision */
    unsigned char   m2pf;       /* 0x02: missile 2 to playfield collision */
    unsigned char   m3pf;       /* 0x03: missile 3 to playfield collision */
    unsigned char   p0pf;       /* 0x04: player 0 to playfield collision */
    unsigned char   p1pf;       /* 0x05: player 1 to playfield collision */
    unsigned char   p2pf;       /* 0x06: player 2 to playfield collision */
    unsigned char   p3pf;       /* 0x07: player 3 to playfield collision */
    unsigned char   m0pl;       /* 0x08: missile 0 to player collision */
    unsigned char   m1pl;       /* 0x09: missile 1 to player collision */
    unsigned char   m2pl;       /* 0x0A: missile 2 to player collision */
    unsigned char   m3pl;       /* 0x0B: missile 3 to player collision */
    unsigned char   p0pl;       /* 0x0C: player 0 to player collision */
    unsigned char   p1pl;       /* 0x0D: player 1 to player collision */
    unsigned char   p2pl;       /* 0x0E: player 2 to player collision */
    unsigned char   p3pl;       /* 0x0F: player 3 to player collision */

    unsigned char   trig0;      /* 0x10: joystick trigger 0 (0=pressed, 1=released) */
    unsigned char   trig1;      /* 0x11: joystick trigger 1 */
    unsigned char   trig2;      /* 0x12: joystick trigger 2 */
    unsigned char   trig3;      /* 0x13: joystick trigger 3 */

    unsigned char   pal;        /* 0x14: pal/ntsc flag */

    unsigned char   unused[10];

    unsigned char   consol;     /* 0x1F: console buttons */
};


/*****************************************************************************/
/* (R) PAL register possible values                                          */
/*****************************************************************************/

/* Note: This only tells you whether the GTIA is PAL or NTSC; some NTSC
** systems are modded with PAL ANTIC chips; testing VCOUNT limits can be
** done to check for that.  Seems like it's not possible to test for SECAM
*/

#define TV_STD_PAL  0x1
#define TV_STD_NTSC 0xE


/*****************************************************************************/
/* Macros for reading console keys (Start/Select/Option) via CONSOL register */
/*****************************************************************************/

#define CONSOL_START(x)     !((unsigned char)((x) & 1)) /* true if Start pressed */
#define CONSOL_SELECT(x)    !((unsigned char)((x) & 2)) /* true if Select pressed */
#define CONSOL_OPTION(x)    !((unsigned char)((x) & 4)) /* true if Option pressed */


/* End of _gtia.h */
#endif /* #ifndef __GTIA_H */

#define GTIA_READ  (*(struct __gtia_read*)0xD000)
#define GTIA_WRITE (*(struct __gtia_write*)0xD000)

/*****************************************************************************/
/*                                                                           */
/*                                  _pbi.h                                   */
/*                                                                           */
/*                  Internal include file, do not use directly               */
/*                                                                           */
/*                                                                           */
/*                                                                           */
/* (C) 2000 Freddy Offenga <taf_offenga@yahoo.com>                           */
/*                                                                           */
/*                                                                           */
/* This software is provided 'as-is', without any expressed or implied       */
/* warranty.  In no event will the authors be held liable for any damages    */
/* arising from the use of this software.                                    */
/*                                                                           */
/* Permission is granted to anyone to use this software for any purpose,     */
/* including commercial applications, and to alter it and redistribute it    */
/* freely, subject to the following restrictions:                            */
/*                                                                           */
/* 1. The origin of this software must not be misrepresented; you must not   */
/*    claim that you wrote the original software. If you use this software   */
/*    in a product, an acknowledgment in the product documentation would be  */
/*    appreciated but is not required.                                       */
/* 2. Altered source versions must be plainly marked as such, and must not   */
/*    be misrepresented as being the original software.                      */
/* 3. This notice may not be removed or altered from any source              */
/*    distribution.                                                          */
/*                                                                           */
/*****************************************************************************/

#ifndef __PBI_H
#define __PBI_H

/* parallel bus interface area */
#define PBI             ((unsigned char*)0xD100)

/* parallel device IRQ status */
#define PDVI            ((unsigned char*)0xD1FF)

/* parallel device select */
#define PDVS            ((unsigned char*)0xD1FF)

/* parallel bus interface RAM area */
#define PBIRAM          ((unsigned char*)0xD600)

/* parallel device ID 1 */
#define PDID1           ((unsigned char*)0xD803)

/* parallel device I/O vector */
#define PDIDV           ((unsigned char*)0xD805)

/* parallel device IRQ vector */
#define PDIRQV          ((unsigned char*)0xD808)

/* parallel device ID 2 */
#define PDID2           ((unsigned char*)0xD80B)

/* parallel device vector table */
#define PDVV            ((unsigned char*)0xD80D)

/* End of _pbi.h */
#endif /* #ifndef __PBI_H */


/*****************************************************************************/
/*                                                                           */
/*                                 _pokey.h                                  */
/*                                                                           */
/*                Internal include file, do not use directly                 */
/*                                                                           */
/* POKEY, Pot Keyboard Integrated Circuit, is a digital I/O chip designed    */
/* for the Atari 8-bit family of home computers; it combines functions for   */
/* sampling (ADC) potentiometers (such as game paddles) and scan matrices of */
/* switches (such as a computer keyboard) as well as sound generation.       */
/* It produces four voices of distinctive square wave sound, either as clear */
/* tones or modified with a number of distortion settings. - Wikipedia       */
/* "POKEY" article.                                                          */
/*                                                                           */
/*                                                                           */
/* (C) 2000 Freddy Offenga <taf_offenga@yahoo.com>                           */
/* 2019-01-16: Bill Kendrick <nbs@sonic.net>: More defines for registers     */
/*                                                                           */
/*                                                                           */
/* This software is provided 'as-is', without any expressed or implied       */
/* warranty.  In no event will the authors be held liable for any damages    */
/* arising from the use of this software.                                    */
/*                                                                           */
/* Permission is granted to anyone to use this software for any purpose,     */
/* including commercial applications, and to alter it and redistribute it    */
/* freely, subject to the following restrictions:                            */
/*                                                                           */
/* 1. The origin of this software must not be misrepresented; you must not   */
/*    claim that you wrote the original software. If you use this software   */
/*    in a product, an acknowledgment in the product documentation would be  */
/*    appreciated but is not required.                                       */
/* 2. Altered source versions must be plainly marked as such, and must not   */
/*    be misrepresented as being the original software.                      */
/* 3. This notice may not be removed or altered from any source              */
/*    distribution.                                                          */
/*                                                                           */
/*****************************************************************************/



#ifndef __POKEY_H
#define __POKEY_H



/*****************************************************************************/
/* Define a structure with the POKEY register offsets for write (W)          */
/*****************************************************************************/

struct __pokey_write {
    unsigned char   audf1;  /* audio channel #1 frequency */
    unsigned char   audc1;  /* audio channel #1 control */
    unsigned char   audf2;  /* audio channel #2 frequency */
    unsigned char   audc2;  /* audio channel #2 control */
    unsigned char   audf3;  /* audio channel #3 frequency */
    unsigned char   audc3;  /* audio channel #3 control */
    unsigned char   audf4;  /* audio channel #4 frequency */
    unsigned char   audc4;  /* audio channel #4 control */
    unsigned char   audctl; /* audio control */
    unsigned char   stimer; /* start pokey timers */

    unsigned char   skrest;
    /* reset serial port status reg.;
    ** Reset BITs 5 - 7 of the serial port status register (SKCTL) to "1"
    */

    unsigned char   potgo;  /* start paddle scan sequence (see "ALLPOT") */
    unsigned char   unuse1; /* unused */
    unsigned char   serout; /* serial port data output */
    unsigned char   irqen;  /* interrupt request enable */
    unsigned char   skctl;  /* serial port control */
};


/*****************************************************************************/
/* (W) AUDC1-4 register values                                               */
/*****************************************************************************/

/* Meaningful values for the distortion bits.
** The first process is to divide the clock value by the frequency,
** then mask the output using the polys in the order below;
** finally, the result is divided by two.
*/
#define AUDC_POLYS_5_17  0x00
#define AUDC_POLYS_5     0x20 /* Same as 0x60 */
#define AUDC_POLYS_5_4   0x40
#define AUDC_POLYS_17    0x80
#define AUDC_POLYS_NONE  0xA0 /* Same as 0xE0 */
#define AUDC_POLYS_4     0xC0

/* When set, the volume value in AUDC1-4 bits 0-3 is sent directly to the speaker;
** it is not modulated with the frequency specified in the AUDF1-4 registers.
** (See "De Re Atari" Chapter 7: Sound)
*/
#define AUDC_VOLUME_ONLY 0x10


/*****************************************************************************/
/* (W) AUDCTL register values                                                */
/*****************************************************************************/

#define AUDCTL_CLOCKBASE_15HZ     0x01 /* Switch main clock base from 64 KHz to 15 KHz */
#define AUDCTL_HIGHPASS_CHAN2     0x02 /* Insert high pass filter into channel two, clocked by channel four */
#define AUDCTL_HIGHPASS_CHAN1     0x04 /* Insert high pass filter into channel one, clocked by channel two */
#define AUDCTL_JOIN_CHAN34        0x08 /* Join channels four and three (16 bit) */
#define AUDCTL_JOIN_CHAN12        0x10 /* Join channels two and one (16 bit) */
#define AUDCTL_CLOCK_CHAN3_179MHZ 0x20 /* Clock channel three with 1.79 MHz */
#define AUDCTL_CLOCK_CHAN1_179MHZ 0x40 /* Clock channel one with 1.79 MHz */
#define AUDCTL_9BIT_POLY          0x80 /* Makes the 17 bit poly counter into nine bit poly (see also: RANDOM) */


/*****************************************************************************/
/* (W) IRQEN register values                                                 */
/*****************************************************************************/

#define IRQEN_TIMER_1                  0x01 /* The POKEY timer one interrupt is enabled */
#define IRQEN_TIMER_2                  0x02 /* The POKEY timer two interrupt is enabled */
#define IRQEN_TIMER_4                  0x04 /* The POKEY timer four interrupt is enabled */
#define IRQEN_SERIAL_TRANS_FINISHED    0x08 /* The serial out transmission finished interrupt is enabled */
#define IRQEN_SERIAL_OUT_DATA_REQUIRED 0x10 /* The serial output data required interrupt is enabled */
#define IRQEN_SERIAL_IN_DATA_READY     0x20 /* The serial input data ready interrupt is enabled. */
#define IRQEN_OTHER_KEY                0x40 /* The "other key" interrupt is enabled */
#define IRQEN_BREAK_KEY                0x80 /* The BREAK key is enabled */


/*****************************************************************************/
/* (W) SKCTL register values                                                 */
/*****************************************************************************/

#define SKCTL_KEYBOARD_DEBOUNCE 0x01 /* Enable keyboard debounce circuits */
#define SKCTL_KEYBOARD_SCANNING 0x02 /* Enable keyboard scanning circuit */

/* Fast pot scan
** The pot scan counter completes its sequence in two TV line times instead of
** one frame time (228 scan lines). Not as accurate as the normal pot scan
*/
#define SKCTL_FAST_POT_SCAN     0x04

/* POKEY two-tone mode
** Serial output is transmitted as a two-tone signal rather than a logic true/false.
*/
#define SKCTL_TWO_TONE_MODE     0x08

/* Force break (serial output to zero) */
#define SKCTL_FORCE_BREAK       0x80


/* Bits 4, 5, and 6 of SKCTL set Serial Mode Control: */

/* Trans. & Receive rates set by external clock; Also internal clock phase reset to zero. */
#define SKCTL_SER_MODE_TX_EXT_RX_EXT       0x00

/* Trans. rate set by external clock; Receive asynch. (ch. 4) (CH3 and CH4). */
#define SKCTL_SER_MODE_TX_EXT_RX_ASYNC     0x10

/* Trans. & Receive rates set by Chan. 4; Chan. 4 output on Bi-Direct. clock line. */
#define SKCTL_SER_MODE_TX_CH4_RX_CH4_BIDIR 0x20

/* N.B.: Bit combination 0,1,1 not useful */

/* Trans. rate set by Chan. 4; Receive rate set by external clock. */
#define SKCTL_SER_MODE_TX_CH4_RX_EXT       0x40

/* N.B.: Bit combination 1,0,1 not useful */

/* Trans. rate set by Chan. 2; Receive rate set by Chan. 4; Chan. 4 out on Bi-Direct. clock line. */
#define SKCTL_SER_MODE_TX_CH2_RX_CH4_BIDIR 0x60

/* Trans. rate set by Chan. 2; Receive asynch. (chan 3 & 4); Bi-Direct. clock not used (tri-state condition). */
#define SKCTL_SER_MODE_TX_CH4_RX_ASYNC     0x70


/*****************************************************************************/
/* Define a structure with the POKEY register offsets for read (R)           */
/*****************************************************************************/

struct __pokey_read {
    unsigned char   pot0;   /* paddle 0 value */
    unsigned char   pot1;   /* paddle 1 value */
    unsigned char   pot2;   /* paddle 2 value */
    unsigned char   pot3;   /* paddle 3 value */
    unsigned char   pot4;   /* paddle 4 value */
    unsigned char   pot5;   /* paddle 5 value */
    unsigned char   pot6;   /* paddle 6 value */
    unsigned char   pot7;   /* paddle 7 value */
    unsigned char   allpot; /* eight paddle port status (see "POTGO") */
    unsigned char   kbcode; /* keyboard code */
    unsigned char   random; /* random number generator */
    unsigned char   unuse2; /* unused */
    unsigned char   unuse3; /* unused */
    unsigned char   serin;  /* serial port input */
    unsigned char   irqst;  /* interrupt request status */
    unsigned char   skstat; /* serial port status */
};


/*****************************************************************************/
/* (R) SKSTAT register values                                                */
/*****************************************************************************/

#define SKSTAT_SERIN_SHIFTREG_BUSY         0x02 /* Serial input shift register busy */
#define SKSTAT_LASTKEY_PRESSED             0x04 /* the last key is still pressed */
#define SKSTAT_SHIFTKEY_PRESSED            0x08 /* the [Shift] key is pressed */
#define SKSTAT_DATA_READ_INGORING_SHIFTREG 0x10 /* Data can be read directly from the serial input port, ignoring the shift register. */
#define SKSTAT_KEYBOARD_OVERRUN            0x20 /* Keyboard over-run; Reset BITs 7, 6 and 5 (latches) to 1, using SKREST */
#define SKSTAT_INPUT_OVERRUN               0x40 /* Serial data input over-run. Reset latches as above. */
#define SKSTAT_INPUT_FRAMEERROR            0x80 /* Serial data input frame error caused by missing or extra bits. Reset latches as above. */


/* KBCODE, internal keyboard codes for Atari 8-bit computers,
** are #defined as "KEY_..." in "atari.h".
** Note some keys are not read via KBCODE:
** - Reset
** - Start, Select, and Option; see CONSOL in "gtia.h"
** - Break
*/


/* End of _pokey.h */
#endif /* #ifndef __POKEY_H */

#define POKEY_READ  (*(struct __pokey_read*)0xD200)
#define POKEY_WRITE (*(struct __pokey_write*)0xD200)

/*****************************************************************************/
/*                                                                           */
/*                                  _pia.h                                   */
/*                                                                           */
/*                Internal include file, do not use directly                 */
/*                                                                           */
/* The Peripheral Interface Adapter (PIA) chip (a 6520 or 6820) provides     */
/* parallel I/O interfacing; it was used in Atari 400/800 and Commodore PET  */
/* family of computers, for joystick and some interrupts.                    */
/* Sources; various + Wikpedia article on "Peripheral Interface Adapter".    */
/*                                                                           */
/*                                                                           */
/* (C) 2000 Freddy Offenga <taf_offenga@yahoo.com>                           */
/*                                                                           */
/*                                                                           */
/* This software is provided 'as-is', without any expressed or implied       */
/* warranty.  In no event will the authors be held liable for any damages    */
/* arising from the use of this software.                                    */
/*                                                                           */
/* Permission is granted to anyone to use this software for any purpose,     */
/* including commercial applications, and to alter it and redistribute it    */
/* freely, subject to the following restrictions:                            */
/*                                                                           */
/* 1. The origin of this software must not be misrepresented; you must not   */
/*    claim that you wrote the original software. If you use this software   */
/*    in a product, an acknowledgment in the product documentation would be  */
/*    appreciated but is not required.                                       */
/* 2. Altered source versions must be plainly marked as such, and must not   */
/*    be misrepresented as being the original software.                      */
/* 3. This notice may not be removed or altered from any source              */
/*    distribution.                                                          */
/*                                                                           */
/*****************************************************************************/



#ifndef __PIA_H
#define __PIA_H


/* Define a structure with the PIA register offsets */
struct __pia {
    unsigned char   porta;  /* port A data r/w */
    unsigned char   portb;  /* port B data r/w */
    unsigned char   pactl;  /* port A control */
    unsigned char   pbctl;  /* port B control */
};

/* (Some specific register values for Atari defined in atari.h) */

/* End of _pia.h */
#endif

#define PIA (*(struct __pia*)0xD300)

/*****************************************************************************/
/*                                                                           */
/*                                _antic.h                                   */
/*                                                                           */
/*                  Internal include file, do not use directly               */
/*                                                                           */
/*                                                                           */
/* "ANTIC, Alphanumeric Television Interface Controller, is responsible for  */
/* the generation of playfield graphics which is delivered as a datastream   */
/* to the related CTIA/GTIA chip. The CTIA/GTIA provides the coloring of the */
/* playfield graphics, and is responsible for adding overlaid sprite         */
/* (referred to as "Player/Missile graphics" by Atari).  Atari advertised it */
/* as a true microprocessor, in that it has an instruction set to run        */
/* programs (called display lists) to process data.  ANTIC has no capacity   */
/* for writing back computed values to memory, it merely reads data from     */
/* memory and processes it for output to the screen, therefore it is not     */
/* Turing complete." - Wikipedia article on "ANTIC" (with edits)             */
/*                                                                           */
/* (C) 2000 Freddy Offenga <taf_offenga@yahoo.com>                           */
/* 24-Jan-2011: Christian Krueger: Added defines for Antic instruction set   */
/* 2019-01-16: Bill Kendrick <nbs@sonic.net>: More defines for registers     */
/*                                                                           */
/*                                                                           */
/* This software is provided 'as-is', without any expressed or implied       */
/* warranty.  In no event will the authors be held liable for any damages    */
/* arising from the use of this software.                                    */
/*                                                                           */
/* Permission is granted to anyone to use this software for any purpose,     */
/* including commercial applications, and to alter it and redistribute it    */
/* freely, subject to the following restrictions:                            */
/*                                                                           */
/* 1. The origin of this software must not be misrepresented; you must not   */
/*    claim that you wrote the original software. If you use this software   */
/*    in a product, an acknowledgment in the product documentation would be  */
/*    appreciated but is not required.                                       */
/* 2. Altered source versions must be plainly marked as such, and must not   */
/*    be misrepresented as being the original software.                      */
/* 3. This notice may not be removed or altered from any source              */
/*    distribution.                                                          */
/*                                                                           */
/*****************************************************************************/


#ifndef __ANTIC_H
#define __ANTIC_H

/*****************************************************************************/
/* Define a structure with the ANTIC coprocessor's register offsets          */
/*****************************************************************************/

struct __antic {
    unsigned char   dmactl; /* (W) direct memory access control */
    unsigned char   chactl; /* (W) character mode control */
    unsigned char   dlistl; /* display list pointer low-byte */
    unsigned char   dlisth; /* display list pointer high-byte */
    unsigned char   hscrol; /* (W) horizontal scroll enable */
    unsigned char   vscrol; /* (W) vertical scroll enable */
    unsigned char   unuse0; /* unused */
    unsigned char   pmbase; /* (W) msb of p/m base address (for when DMACTL has player and/or missile DMA enabled) */
    unsigned char   unuse1; /* unused */
    unsigned char   chbase; /* (W) msb of character set base address */
    unsigned char   wsync;  /* (W) wait for horizontal synchronization */
    unsigned char   vcount; /* (R) vertical line counter */
    unsigned char   penh;   /* (R) light pen horizontal position */
    unsigned char   penv;   /* (R) light pen vertical position */
    unsigned char   nmien;  /* (W) non-maskable interrupt enable */
    union {
        /* (W) ("NMIRES") nmi reset -- clears the interrupt request register;
        ** resets all of the NMI status together
        */
        unsigned char   nmires;

        /* (R) ("NMIST") nmi status -- holds cause for the NMI interrupt */
        unsigned char   nmist;
    };
};


/*****************************************************************************/
/* DMACTL register options                                                   */
/*****************************************************************************/

/* Initialized to 0x22: DMA fetch, normal playfield, no PMG DMA, double-line PMGs */

/* Playfield modes: */
#define DMACTL_PLAYFIELD_NONE     0x00
#define DMACTL_PLAYFIELD_NARROW   0x01 /* e.g., 32 bytes per scanline with thick borders */
#define DMACTL_PLAYFIELD_NORMAL   0x02 /* e.g., 40 bytes per scanline with normal borders */
#define DMACTL_PLAYFIELD_WIDE     0x03 /* e.g., 48 bytes per scanline with no borders (overscan) */

/* Other options: */

/* If not set, GTIA's GRAFP0 thru GRAFP3, and/or GRAFM registers are used for
** player & missile shapes, respectively.  (Modify the registers during the horizontal blank
** (Display List Interrupt), a la "racing the beam" on an Atari VCS/2600, )
** if set, ANTIC's PMBASE will be used to fetch shapes from memory via DMA.
*/
#define DMACTL_DMA_MISSILES    0x04
#define DMACTL_DMA_PLAYERS     0x08

/* Unless set, PMGs (as fetched via DMA) will be double-scanline resolution */
#define DMACTL_PMG_SINGLELINE  0x10

/* Unless set, ANTIC operation is disabled, since it cannot fetch
** Display List instructions
*/
#define DMACTL_DMA_FETCH       0x20


/*****************************************************************************/
/* CHACTL register options                                                   */
/*****************************************************************************/

/* Initialized to 2 (CHACTL_CHAR_NORMAL | CHACTL_INV_PRESENT) */

/* Inverted (upside-down) characters */
#define CHACTL_CHAR_NORMAL    0x00
#define CHACTL_CHAR_INVERTED  0x04

/* Inverse (reverse-video) characters */
#define CHACTL_INV_TRANS      0x00 /* chars with high-bit shown */
#define CHACTL_INV_OPAQUE     0x01 /* chars with high-bit appear as space */
#define CHACTL_INV_PRESENT    0x02 /* chars with high-bit are reverse-video */


/*****************************************************************************/
/* Values for NMIEN (enabling interrupts) & NMIST (cause for the interrupt)  */
/*****************************************************************************/

/* Display List Interrupts
** Called on a modeline when "DL_DLI" bit is set the ANTIC instruction,
** and jumps through VDSLST vector.
*/
#define NMIEN_DLI   0x80

/* Vertical Blank Interrupt
** Called during every vertical blank; see SYSVBV, VVBLKI, CRITIC, and VVBLKD,
** as well as the SETVBV routine.
*/
#define NMIEN_VBI   0x40

/* [Reset] key pressed */
#define NMIEN_RESET 0x20


/*****************************************************************************/
/* ANTIC instruction set                                                     */
/*****************************************************************************/

/* Absolute instructions (non mode lines) */
#define DL_JMP  ((unsigned char) 1)
#define DL_JVB  ((unsigned char) 65)

#define DL_BLK1 ((unsigned char) 0)   /* 1 blank scanline */
#define DL_BLK2 ((unsigned char) 16)  /* 2 blank scanlines */
#define DL_BLK3 ((unsigned char) 32)  /* ...etc. */
#define DL_BLK4 ((unsigned char) 48)
#define DL_BLK5 ((unsigned char) 64)
#define DL_BLK6 ((unsigned char) 80)
#define DL_BLK7 ((unsigned char) 96)
#define DL_BLK8 ((unsigned char) 112)


/* Absolute instructions (mode lines) */

/* Note: Actual width varies (e.g., 40 vs 32 vs 48) depending on
** normal vs narrow vs wide (overscan) playfield setting; see DMACTL
*/

/* Character modes (text, tile graphics, etc.) */

/* monochrome, 40 character & 8 scanlines per mode line (aka Atari BASIC GRAPHICS 0 via OS's CIO routines) */
#define DL_CHR40x8x1    ((unsigned char) 2)

/* monochrome, 40 character & 10 scanlines per mode line (like GR. 0, with descenders) */
#define DL_CHR40x10x1   ((unsigned char) 3)

/* colour, 40 character & 8 scanlines per mode line (GR. 12) */
#define DL_CHR40x8x4    ((unsigned char) 4)

/* colour, 40 character & 16 scanlines per mode line (GR. 13) */
#define DL_CHR40x16x4   ((unsigned char) 5)

/* colour (duochrome per character), 20 character & 8 scanlines per mode line (GR. 1) */
#define DL_CHR20x8x2    ((unsigned char) 6)

/* colour (duochrome per character), 20 character & 16 scanlines per mode line (GR. 2) */
#define DL_CHR20x16x2   ((unsigned char) 7)


/* Bitmap modes */

/* colour, 40 pixel & 8 scanlines per mode line (GR. 3) */
#define DL_MAP40x8x4    ((unsigned char) 8)

/* 'duochrome', 80 pixel & 4 scanlines per mode line (GR.4) */
#define DL_MAP80x4x2    ((unsigned char) 9)

/* colour, 80 pixel & 4 scanlines per mode line (GR.5) */
#define DL_MAP80x4x4    ((unsigned char) 10)

/* 'duochrome', 160 pixel & 2 scanlines per mode line (GR.6) */
#define DL_MAP160x2x2   ((unsigned char) 11)

/* 'duochrome', 160 pixel & 1 scanline per mode line (GR.14) */
#define DL_MAP160x1x2   ((unsigned char) 12)

/* 4 colours, 160 pixel & 2 scanlines per mode line (GR.7) */
#define DL_MAP160x2x4   ((unsigned char) 13)

/* 4 colours, 160 pixel & 1 scanline per mode line (GR.15) */
#define DL_MAP160x1x4   ((unsigned char) 14)

/* monochrome, 320 pixel & 1 scanline per mode line (GR.8) */
#define DL_MAP320x1x1   ((unsigned char) 15)


/* Equivalents, for people familiar with Atari 8-bit OS */

#define DL_GRAPHICS0    DL_CHR40x8x1
#define DL_GRAPHICS1    DL_CHR20x8x2
#define DL_GRAPHICS2    DL_CHR20x16x2
#define DL_GRAPHICS3    DL_MAP40x8x4
#define DL_GRAPHICS4    DL_MAP80x4x2
#define DL_GRAPHICS5    DL_MAP80x4x4
#define DL_GRAPHICS6    DL_MAP160x2x2
#define DL_GRAPHICS7    DL_MAP160x2x4
#define DL_GRAPHICS8    DL_MAP320x1x1
#define DL_GRAPHICS9    DL_MAP320x1x1  /* N.B.: GRAPHICS 9, 10, and 11 also involve GTIA's PRIOR register */
#define DL_GRAPHICS10   DL_MAP320x1x1
#define DL_GRAPHICS11   DL_MAP320x1x1
#define DL_GRAPHICS12   DL_CHR40x8x4   /* N.B.: Atari 400/800 OS didn't have GRAPHICS 12 or 13 */
#define DL_GRAPHICS13   DL_CHR40x16x4
#define DL_GRAPHICS14   DL_MAP160x1x2
#define DL_GRAPHICS15   DL_MAP160x1x4

/* Atari 400/800 OS didn't have GRAPHICS 14 or 15, so they were known by "6+" and "7+" */
#define DL_GRAPHICS6PLUS DL_GRAPHICS14
#define DL_GRAPHICS7PLUS DL_GRAPHICS15

/* Neither Atari 400/800 nor XL OS supported 10-scanline (descenders) text mode via CIO */
#define DL_GRAPHICS0_DESCENDERS  DL_CHR40x10x1

/* Modifiers to mode lines */
#define DL_HSCROL(x)    ((unsigned char)((x) | 16)) /* enable smooth horizontal scrolling on this line; see HSCROL */
#define DL_VSCROL(x)    ((unsigned char)((x) | 32)) /* enable smooth vertical scrolling on this line; see VSCROL */
#define DL_LMS(x)       ((unsigned char)((x) | 64)) /* Load Memory Scan (next two bytes must be the LSB/MSB of the data to load) */

/* General modifier */
#define DL_DLI(x)       ((unsigned char)((x) | 128)) /* enable Display List Interrupt on this mode line */


/* End of _antic.h */
#endif /* #ifndef __ANTIC_H */

#define ANTIC (*(struct __antic*)0xD400)


/*****************************************************************************/
/* conio and TGI color defines                                               */
/*****************************************************************************/

/* Note that the conio color implementation is monochrome
** (textcolor just sets text brightness low or high, depending on background
** color)
** These values can be used with bordercolor(), bgcolor(), and _setcolor_low()
*/
#define COLOR_BLACK      GTIA_COLOR_BLACK
#define COLOR_WHITE      GTIA_COLOR_WHITE
#define COLOR_RED        GTIA_COLOR_RED
#define COLOR_CYAN       GTIA_COLOR_CYAN
#define COLOR_PURPLE     GTIA_COLOR_VIOLET
#define COLOR_GREEN      GTIA_COLOR_GREEN
#define COLOR_BLUE       GTIA_COLOR_BLUE
#define COLOR_YELLOW     GTIA_COLOR_YELLOW
#define COLOR_ORANGE     GTIA_COLOR_ORANGE
#define COLOR_BROWN      GTIA_COLOR_BROWN
#define COLOR_LIGHTRED   GTIA_COLOR_LIGHTRED
#define COLOR_GRAY1      GTIA_COLOR_GRAY1
#define COLOR_GRAY2      GTIA_COLOR_GRAY2
#define COLOR_LIGHTGREEN GTIA_COLOR_LIGHTGREEN
#define COLOR_LIGHTBLUE  GTIA_COLOR_LIGHTBLUE
#define COLOR_GRAY3      GTIA_COLOR_GRAY3

/* TGI color defines */
#define TGI_COLOR_BLACK      COLOR_BLACK
#define TGI_COLOR_WHITE      COLOR_WHITE
#define TGI_COLOR_RED        COLOR_RED
#define TGI_COLOR_CYAN       COLOR_CYAN
#define TGI_COLOR_PURPLE     COLOR_PURPLE
#define TGI_COLOR_GREEN      COLOR_GREEN
#define TGI_COLOR_BLUE       COLOR_BLUE
#define TGI_COLOR_YELLOW     COLOR_YELLOW
#define TGI_COLOR_ORANGE     COLOR_ORANGE
#define TGI_COLOR_BROWN      COLOR_BROWN
#define TGI_COLOR_LIGHTRED   COLOR_LIGHTRED
#define TGI_COLOR_GRAY1      COLOR_GRAY1
#define TGI_COLOR_GRAY2      COLOR_GRAY2
#define TGI_COLOR_LIGHTGREEN COLOR_LIGHTGREEN
#define TGI_COLOR_LIGHTBLUE  COLOR_LIGHTBLUE
#define TGI_COLOR_GRAY3      COLOR_GRAY3


/*****************************************************************************/
/* PIA PORTA and PORTB register bits                                         */
/*****************************************************************************/

/* See also: "JOY_xxx_MASK" in "atari.h" */

/* Paddle 0-3 triggers (per PORTA bits) */
#define PORTA_PTRIG3 0x80
#define PORTA_PTRIG2 0x40
#define PORTA_PTRIG1 0x08
#define PORTA_PTRIG0 0x04


/* On the Atari 400/800, PORTB is the same as PORTA, but for controller ports 3 & 4. */

/* Paddle 4-7 triggers (per PORTB bits); only 400/800 had four controller ports */
#define PORTB_PTRIG7 0x80
#define PORTB_PTRIG6 0x40
#define PORTB_PTRIG5 0x08
#define PORTB_PTRIG4 0x04


/* On the XL series of computers, PORTB has been changed to a memory and
** LED control (1200XL model only) register (read/write):
*/

/* If set, the built-in OS is enabled, and occupies the address range $C000-$FFFF
** (except that the area $D000-$D7FF will only access the hardware registers.)
** If clear, RAM is enabled in this area (again, save for the hole.)
*/
#define PORTB_OSROM            0x01

/* If set, RAM is enabled for the address range $A000-$BFFF.
** If clear, the built-in BASIC ROM is enabled at this address.
** And if there is a cartridge installed in the computer, it makes no difference.
*/
#define PORTB_BASICROM         0x02

/* If set, the corresponding LED is turned off. If clear, the LED will be on.
** (1200XL only)
*/
#define PORTB_LED1             0x04
#define PORTB_LED2             0x08


/* On the XE series of computers, PORTB is a bank-selected memory control register (read/write): */

/* These bits determine which memory bank is visible to the CPU and/or ANTIC chip
** when their Bank Switch bit is set. There are four possible banks of 16KB each.
*/
#define PORTB_BANKSELECT1      0x00
#define PORTB_BANKSELECT2      0x04
#define PORTB_BANKSELECT3      0x08
#define PORTB_BANKSELECT4      0x0C

/* If set, the CPU and/or ANTIC chip will access bank-switched memory mapped to the
** address range $4000-$7FFF.
** If clear, the CPU and/or ANTIC will see normal memory in this region.
*/
#define PORTB_BANKSWITCH_CPU   0x10
#define PORTB_BANKSWITCH_ANTIC 0x20

/* If set, RAM is enabled for the address range $5000-$57FF.
** If clear, the self-test ROM (physically located at $D000-$D7FF, under the hardware registers)
** is remapped to this memory area.
*/
#define PORTB_SELFTEST         0x80


/*****************************************************************************/
/* PACTL and PBCTL register bits                                             */
/*****************************************************************************/

/* (W) Peripheral PA1/PB1 interrupt (IRQ) ("peripheral proceed line available") enable.
** One equals enable. Set by the OS but available to the user; reset on powerup.
** (PxCTL_IRQ_STATUS (R) bit will get set upon interrupt occurance)
*/
#define PxCTL_IRQ_ENABLE         0x01 /* bit 0 */

/* Note: Bit 1 is always set to */

/* (W) Controls PORTA/PORTB addressing
** 1 = PORTA/PORTB register; read/write to controller port
** 0 = direction control register; write to direction controls
**     (allows setting data flow; write 0s & 1s to PORTA/PORTB bits
**     to set which port's pins are read (input), or write (output),
**     respectively)
*/
#define PxCTL_ADDRESSING         0x04 /* bit 2 */

/* (W) Peripheral motor control line; Turn the cassette on or off
** (PACTL-specific register bit)
** 0 = on
** 1 = off
*/
#define PACTL_MOTOR_CONTROL      0x08 /* bit 3 */

/* Peripheral command identification (serial bus command line)
** (PBCTL-specific register bit)
*/
#define PBCTL_PERIPH_CMD_IDENT   0x08 /* bit 3 */

/* Note: Bits 4 & 5 are always set to 1 */

/* Note: Bit 6 is always set to 0 */

/* (R) Peripheral interrupt (IRQ) status bit.
** Set by Peripherals (PORTA / PORTB).  Reset by reading from PORTA / PORTB.
** PACTL's is interrupt status of PROCEED
** PBCTL's is interrupt status of SIO
*/
#define PxCTL_IRQ_STATUS         0x80


/* The following #define will cause the matching function calls in conio.h
** to be overlaid by macros with the same names, saving the function call
** overhead.
*/
#define _textcolor(color)        COLOR_WHITE

/* End of atari.h */
#endif
