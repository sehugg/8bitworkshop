#ifndef _ATARI7800
#define _ATARI7800

// define basic types for convenience
typedef unsigned char byte;	// 8-bit unsigned
typedef signed char sbyte;	// 8-bit signed
typedef unsigned short word;	// 16-bit signed
typedef enum { false, true } bool;	// boolean

/// MEMORY MAPS

typedef struct t_TIA {
    byte _00;
    byte VBLANK;	// input port control
    byte _02_07[6];
    byte INPT0; // PADDLE CONTROL INPUT 0                WO
    byte INPT1; // PADDLE CONTROL INPUT 1                WO
    byte INPT2; // PADDLE CONTROL INPUT 2                WO
    byte INPT3; // PADDLE CONTROL INPUT 3                WO
    byte INPT4; // PLAYER 0 FIRE BUTTON INPUT            WO
    byte INPT5; // PLAYER 1 FIRE BUTTON INPUT            WO
    byte _0e_14[7];
    byte AUDC0; // AUDIO CONTROL CHANNEL 0               WO
    byte AUDC1; // AUDIO CONTROL CHANNEL 1               WO
    byte AUDF0; // AUDIO FREQUENCY CHANNEL 0             WO
    byte AUDF1; // AUDIO FREQUENCY CHANNEL 1             WO
    byte AUDV0; // AUDIO VOLUME CHANNEL 0                WO
    byte AUDV1; // AUDIO VOLUME CHANNEL 1                WO
} t_TIA;

typedef struct t_MARIA {
    byte BACKGRND  ;// X '20' BACKGROUND COLOR                      R/W
    byte P0C1      ;// X '21' PALETTE 0 - COLOR 1                   R/W
    byte P0C2      ;// X '22'           - COLOR 2                   R/W
    byte P0C3      ;// X '23'           - COLOR 3                   R/W
    byte WSYNC     ;// X '24' WAIT FOR SYNC                       STROBE
    byte P1C1      ;// X '25' PALETTE 1 - COLOR 1                   R/W
    byte P1C2      ;// X '26'           - COLOR 2                   R/W
    byte P1C3      ;// X '27'           - COLOR 3                   R/W
    byte MSTAT     ;// X '28' MARIA STATUS                          RO
    byte P2C1      ;// X '29' PALETTE 2 - COLOR 1                   R/W
    byte P2C2      ;// X '2A'           - COLOR 2                   R/W
    byte P2C3      ;// X '2B'           - COLOR 3                   R/W
    byte DPPH      ;// X '2C' DISPLAY LIST LIST POINT HIGH          WO
    byte P3C1      ;// X '2D' PALETTE 3 - COLOR 1                   R/W
    byte P3C2      ;// X '2E'           - COLOR 2                   R/W
    byte P3C3      ;// X '2F'           - COLOR 3                   R/W
    byte DPPL      ;// X '30' DISPLAY LIST LIST POINT LOW           WO
    byte P4C1      ;// X '31' PALETTE 4 - COLOR 1                   R/W
    byte P4C2      ;// X '32'           - COLOR 2                   R/W
    byte P4C3      ;// X '33'           - COLOR 3                   R/W
    byte CHARBASE  ;// X '34' CHARACTER BASE ADDRESS                WO
    byte P5C1      ;// X '35' PALETTE 5 - COLOR 1                   R/W
    byte P5C2      ;// X '36'           - COLOR 2                   R/W
    byte P5C3      ;// X '37'           - COLOR 3                   R/W
    byte OFFSET    ;// X '38' FOR FUTURE EXPANSION -STORE ZERO HERE R/W
    byte P6C1      ;// X '39' PALETTE 6 - COLOR 1                   R/W
    byte P6C2      ;// X '3A'           - COLOR 2                   R/W
    byte P6C3      ;// X '3B'           - COLOR 3                   R/W
    byte CTRL      ;// X '3C' MARIA CONTROL REGISTER                WO
    byte P7C1      ;// X '3D' PALETTE 7 - COLOR 1                   R/W
    byte P7C2      ;// X '3E'           - COLOR 2                   R/W
    byte P7C3      ;// X '3F'           - COLOR 3                   R/W
} t_MARIA;

typedef struct t_P6532 {
    byte SWCHA;		// P0,P1 JOYSTICK DIRECTIONAL INPUT      R/W
    byte CTLSWA;	// CONSOLE SWITCHES                      RO
    byte SWCHB;		// I/O CONTROL FOR SWCHA                 R/W
    byte CTLSWB;	// I/O CONTROL FOR SWCHB                 R/W
} t_P6532;

typedef struct DLLEntry {
    byte offset_flags;
    /*
    unsigned int offset:4;
    unsigned int _unused:1;
    unsigned int h8:1;
    unsigned int h16:1;
    unsigned int dli:1;
    */
    byte dl_hi;
    byte dl_lo;
} DLLEntry;

typedef struct DL4Entry {
    byte data_lo;
    byte width_pal;
    /*
    unsigned int width:5;
    unsigned int palette:3;
    */
    byte data_hi;
    byte xpos;
} DL4Entry;

typedef struct DL5Entry {
    byte data_lo;
    byte flags;
    byte data_hi;
    byte width_pal;
    /*
    unsigned int width:5;
    unsigned int palette:3;
    */
    byte xpos;
} DL5Entry;

/// CONSTANTS

#define DLL_DLI		0x80	// Display List Interrupt flag
#define DLL_H16		0x40	// Holey DMA 4k flag
#define DLL_H8		0x20	// Holey DMA 2k flag

#define DL5_WM		0x80	// Write Mode
#define DL5_DIRECT	0x40	// Direct Mode
#define DL5_INDIRECT	0x60	// Indirect Mode

#define DL_WIDTH(x)	(32-(x))	// for width_pal
#define DL_PAL(x)	((x)<<5)	// OR them together
#define DL_WP(w,p)	(DL_WIDTH(w)|DL_PAL(p))

#define CTRL_COLORKILL	0x80
#define CTRL_DMA_ON	0x40
#define CTRL_DMA_OFF	0x60
#define CTRL_DBLBYTE	0x10
#define CTRL_BLKBORDER	0x08
#define CTRL_KANGAROO	0x04
#define CTRL_160AB	0x00
#define CTRL_320BD	0x02
#define CTRL_320AC	0x03

#define MSTAT_VBLANK	0x80

/// GLOBALS

#define TIA		(*((t_TIA*) 0x00))
#define MARIA		(*((t_MARIA*) 0x20))
#define P6532		(*((t_P6532*) 0x280))

/// MACROS

#define STROBE(addr)	__asm__ ("sta %w", addr)
#define WSYNC()		STROBE(0x24)

#endif
