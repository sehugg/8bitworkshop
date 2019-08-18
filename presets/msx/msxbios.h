#ifndef _MSXBIOS_H
#define _MSXBIOS_H

#include <stdint.h>

#define MSXUSR(pc)		__asm__("call "#pc);

/// VARIABLES

const uint8_t* __at(0x0004) MSX_charset;
const uint8_t __at(0x0006) MSX_vdp_port_read;
const uint8_t __at(0x0007) MSX_vdp_port_write;
const uint8_t __at(0x002d) MSX_version;

// F3AE: # of positions on a line in SCREEN 0 (ini:39)
uint8_t __at(0xf3ae) LINL40;
// F3AF: # of positions on a line in SCREEN 1 (ini:29)
uint8_t __at(0xf3af) LINL32;
// F3B0: # of actually used positions in the current screenmodus (ini:39)
uint8_t __at(0xf3b0) LINLEN;
// F3B1: # of used lines on screen (ini:24)
uint8_t __at(0xf3b1) CRTCNT;
// F3B2: # of positions within a tabulator-column (ini:14)
uint8_t __at(0xf3b1) CLMLST;

typedef struct {
  uint16_t name;
  uint16_t color;
  uint16_t pattern;
  uint16_t sprite_attribute;
  uint16_t sprite_pattern;
} MSXVDPModeData;

MSXVDPModeData __at(0xf3b3) MSX_modedata_screen0;
MSXVDPModeData __at(0xf3bd) MSX_modedata_screen1;
MSXVDPModeData __at(0xf3c7) MSX_modedata_screen2;
MSXVDPModeData __at(0xf3d1) MSX_modedata_screen3;

// F3DC: line where the cursor is located
uint8_t __at(0xf3dc) CSRY;
// F3DD: column where the cursor is located
uint8_t __at(0xf3dd) CSRX;
// F3DE: function key definition shown: 0: no, -1: yes
uint8_t __at(0xf3de) CNSDFG;
// F3DF-D3E6: storage for the last written value towards VDP registers 0 till 7
uint8_t __at(0xf3df) MSX_vdp_regs[8];
// F3E7: last read value of VDP register 8
uint8_t __at(0xf3e7) STATFL;
// F3E8: information about the joystick and space bar
// 7 6 5 4 3 2 1 0
// | | | |       +-- Space bar, trig(0) (0 = pressed)
// | | | +---------- Stick 1, Trigger 1 (0 = pressed)
// | | +------------ Stick 1, Trigger 2 (0 = pressed)
// | +-------------- Stick 2, Trigger 1 (0 = pressed)
// +---------------- Stick 2, Trigger 2 (0 = pressed)
uint8_t __at(0xf3e8) TRGFLG;

// F3E9: code for the standard foreground color (ini:15)
uint8_t __at(0xf3e9) FORCLR;
// F3EA: code for the standard background color (ini:4)
uint8_t __at(0xf3ea) BAKCLR;
// F3EB: code for the standard border color (ini:7)
uint8_t __at(0xf3eb) BDRCLR;

//Pixel lcocation
uint16_t __at(0xf92a) CLOC;
//Pixel mask
uint8_t __at(0xf92c) CMASK;
//Attribute byte for SETC
uint8_t __at(0xf3f2) ATRBYT;
//Key scan timing
uint8_t __at(0xf3f6) SCNCNT;
//Key repeat timer
uint8_t __at(0xf3f7) REPCNT;
//Address in the keyboard buffer where a character will be written
uint8_t* __at(0xf3f8) PUTPNT;
//Address in the keyboard buffer where the next character is read
uint8_t* __at(0xf3fa) GETPNT;

/// FUNCTIONS

// Reads the value of an address in another slot
void RDSLT(uint8_t slot, uint16_t addr);
// Writes a value to an address in another slot.
void WRSLT(uint8_t slot, uint16_t addr, uint8_t value);
// inhibits the screen display
void DISSCR() __z88dk_fastcall;
// displays the screen
void ENASCR() __z88dk_fastcall;
// write data in the VDP-register
void WRTVDP(uint16_t reg_data) __z88dk_fastcall;
// Reads the content of VRAM
uint8_t RDVRM(uint16_t addr) __z88dk_fastcall;
// Writes data in VRAM
void WRTVRM(uint16_t addr, uint8_t data);
// Enable VDP to read
void SETRD();
// Enable VDP to write
void SETWRT();
// fill VRAM with value
void FILVRM(uint16_t start, uint16_t len, uint8_t data);
// Block transfer to memory from VRAM
void LDIRMV(uint8_t* mdest, uint16_t vsrc, uint16_t count);
// Block transfer to VRAM from memory
void LDIRVM(uint16_t vdest, const uint8_t* msrc, uint16_t count);
// Switches to given screenmode
void CHGMOD(uint8_t mode) __z88dk_fastcall;
// Changes the screencolors
void CHGCLR() __z88dk_fastcall;
// Initialises all sprites
void CLRSPR() __z88dk_fastcall;
// Switches to SCREEN 0 (40x24 text mode)
void INITXT() __z88dk_fastcall;
// Switches to SCREEN 1 (text screen with 32*24 characters)
void INIT32() __z88dk_fastcall;
// Switches to SCREEN 2 (high resolution screen with 256*192 pixels)
void INIGRP() __z88dk_fastcall;
// Switches to SCREEN 3 (multi-color screen 64*48 pixels)
void INIMLT() __z88dk_fastcall;
// Returns the address of the sprite pattern table
uint16_t CALPAT() __z88dk_fastcall;
// Returns the address of the sprite attribute table
uint16_t CALATR() __z88dk_fastcall;
// Returns current sprite size
uint16_t GSPSIZ() __z88dk_fastcall;
// Displays a character on the graphic screen
uint16_t GRPPRT(char ch) __z88dk_fastcall;
// Initialises PSG and sets initial value for the PLAY statement
uint16_t GICINI() __z88dk_fastcall;
// Writes data to PSG-register
uint16_t WRTPSG(uint16_t reg_data) __z88dk_fastcall;
// Tests the status of the keyboard buffer
uint8_t CHSNS() __z88dk_fastcall;
// One character input (waiting)
char CHGET() __z88dk_fastcall;
// Displays one character
void CHPUT(char ch) __z88dk_fastcall;
// Sends one character to printer
void LPTOUT(char ch) __z88dk_fastcall;
// Beeps
void BEEP() __z88dk_fastcall;
// Clears the screen
void CLS() __z88dk_fastcall;
// Sets cursor X/Y position
void POSIT(uint16_t yx) __z88dk_fastcall;
// Forces the screen to be in the text mode
void TOTEXT() __z88dk_fastcall;
// Returns the joystick status
uint8_t GTSTCK(uint8_t index) __z88dk_fastcall;
// Returns current trigger status
uint8_t GTTRIG(uint8_t index) __z88dk_fastcall;
// Returns current touch pad status
uint8_t GTPAD(uint8_t index) __z88dk_fastcall;
// Returns currenct value of paddle
uint8_t GTPDL(uint8_t index) __z88dk_fastcall;

/*
void RIGHTC() __z88dk_fastcall;
void LEFTC() __z88dk_fastcall;
void UPC() __z88dk_fastcall;
uint8_t TUPC() __z88dk_fastcall;
void DOWNC() __z88dk_fastcall;
uint8_t TDOWNC() __z88dk_fastcall;
void SCALXY() __z88dk_fastcall;
*/
void MAPXY() __z88dk_fastcall;
uint16_t FETCHC_ADDR() __z88dk_fastcall;
/*
void STOREC(uint16_t addr, uint8_t mask);
void SETATR(uint8_t attr) __z88dk_fastcall;
uint8_t READC() __z88dk_fastcall;
void SETC() __z88dk_fastcall;
void NSETCX(uint16_t fillcount) __z88dk_fastcall;
*/
uint8_t RDVDP() __z88dk_fastcall;
uint8_t SNSMAT(uint8_t row) __z88dk_fastcall;
void KILBUF() __z88dk_fastcall;

// VDP colors for TMS9918A

enum MSX1_Color {
  COLOR_TRANSPARENT = 0x0,
  COLOR_BLACK = 0x1,
  COLOR_GREEN = 0x2,
  COLOR_LIGHT_GREEN = 0x3,
  COLOR_BLUE = 0x4,
  COLOR_LIGHT_BLUE = 0x5,
  COLOR_DARK_RED = 0x6,
  COLOR_CYAN = 0x7,
  COLOR_RED = 0x8,
  COLOR_LIGHT_RED = 0x9,
  COLOR_YELLOW = 0xa,
  COLOR_LIGHT_YELLOW = 0xb,
  COLOR_DARK_GREEN = 0xc,
  COLOR_MAGENTA = 0xd,
  COLOR_GRAY = 0xe,
  COLOR_WHITE = 0xf
};

// joystick positions for GTSTCK
typedef enum GTSTCK_Direction {
  STCK_none = 0,
  STCK_N,
  STCK_NE,
  STCK_E,
  STCK_SE,
  STCK_S,
  STCK_SW,
  STCK_W,
  STCK_NW
};

// parameter for GTSTCK
typedef enum GTSTCK_Param {
  STCK_Cursors,
  STCK_Joy1,
  STCK_Joy2
};

// parameter for GTTRIG
typedef enum GTTRIG_Param {
  TRIG_Spacebar,
  TRIG_Joy1_A,
  TRIG_Joy2_A,
  TRIG_Joy1_B,
  TRIG_Joy2_B
};

#define VSYNC() __asm__("HALT");

#endif
