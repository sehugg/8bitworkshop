#ifndef _COMMON_H
#define _COMMON_H

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <peekpoke.h>
#include <string.h>
#include <c64.h>

#ifdef __CC65__
#include <conio.h>
#include <joystick.h>
#endif

typedef uint8_t byte;	// 8-bit unsigned
typedef int8_t sbyte;	// 8-bit signed
typedef uint16_t word;	// 16-bit unsigned
typedef enum { false, true } bool; // boolean

#define COLS 40		// total # of columns
#define ROWS 25		// total # of rows


///// MACROS /////

// VIC Control Register 1 Flags
#define VIC_CTRL1_RST8	0x80          // Bit 8 of RASTER (read) or raster line interrupt set (write)
#define VIC_CTRL1_ECM	0x40          // Extended Color Mode
#define VIC_CTRL1_BMM	0x20          // Bitmap Mode
#define VIC_CTRL1_DEN	0x10          // Display Enable
#define VIC_CTRL1_RSEL	0x08          // Row Select (25 or 24 rows)
#define VIC_CTRL1_YSCROLL_MASK	0x07  // Vertical Fine Scrolling

// VIC Control Register 2 Flags
#define VIC_CTRL2_RES	0x20          // Chip reset
#define VIC_CTRL2_MCM	0x10          // Multicolor Mode Enable
#define VIC_CTRL2_CSEL	0x08          // Column Select (40 or 38 columns)
#define VIC_CTRL2_XSCROLL_MASK	0x07  // Horizontal Fine Scrolling

// VIC Memory Control Register Flags
#define VIC_ADDR_VM_MASK	0xf0      // Video Matrix Base Address Mask (character data)
#define VIC_ADDR_CB_MASK	0x0e      // Character Bank Base Address Mask (screen memory)

// VIC Interrupt Register Flags
#define VIC_IRR_IRQ	0x80             // Interrupt Request
#define VIC_IRR_ILP	0x08             // Light Pen Interrupt
#define VIC_IRR_IMMC	0x04             // Sprite-Sprite Collision Interrupt
#define VIC_IRR_IMBC	0x02             // Sprite-Background Collision Interrupt
#define VIC_IRR_IRST	0x01             // Raster Line Interrupt

// VIC Interrupt Mask Register Flags
#define VIC_IMR_ELP	0x08             // Enable Light Pen Interrupt
#define VIC_IMR_EMMC	0x04             // Enable Sprite-Sprite Collision Interrupt
#define VIC_IMR_EMBC	0x02             // Enable Sprite-Background Collision Interrupt
#define VIC_IMR_ERST	0x01             // Enable Raster Interrupt

// lookup screen address macro
#define SCRNADR(base,col,row) ((base)+(col)+(row)*40)

// default screen base address on startup
#define DEFAULT_SCREEN ((void*)0x400)

// is raster line > 255?
#define RASTER_HIBIT  (VIC.ctrl1 & 0x80)

// set VIC Bank (given the start address)
#define SET_VIC_BANK(_addr) \
  CIA2.pra = (CIA2.pra & ~3) | (((((_addr)>>8)&0xc0)>>6)^3);

// set VIC character memory (given the start address)
#define SET_VIC_BITMAP(_addr) \
  VIC.addr = (VIC.addr & 0b11110001) | ((((_addr)>>8)&0x38)>>2);

// set VIC screen memory (given the start address)
#define SET_VIC_SCREEN(_addr) \
  VIC.addr = (VIC.addr & 0b00001111) | ((((_addr)>>8)&0x3c)<<2);

// set scrolling registers
#define SET_SCROLL_Y(_y) \
  VIC.ctrl1 = (VIC.ctrl1 & 0xf8) | (_y & 7);

#define SET_SCROLL_X(_x) \
  VIC.ctrl2 = (VIC.ctrl2 & 0xf8) | (_x & 7);


// enable RAM from 0xa000-0xffff, disable interrupts
#define ENABLE_HIMEM() \
  asm("php"); \
  asm("sei"); \
  POKE(1, PEEK(1) & ~0b111);

// enable ROM and interrupts
#define DISABLE_HIMEM() \
  POKE(1, PEEK(1) | 0b110); \
  asm("plp");

// are we on a PAL system?
#define IS_PAL() (PEEK(0x2a6) != 0)

///// FUNCTIONS /////

// wait until specific raster line
void raster_wait(byte line);

// wait until end of frame
void wait_vblank();

// get current VIC bank start address
char* get_vic_bank_start();

// get current screen memory address
char* get_screen_memory();

// read joystick fast
#define READ_STICK(index) ~PEEK(0xdc01-(index))

#define STICK_UP(joy)     ((joy & 0x1) != 0)
#define STICK_DOWN(joy)   ((joy & 0x2) != 0)
#define STICK_LEFT(joy)   ((joy & 0x4) != 0)
#define STICK_RIGHT(joy)  ((joy & 0x8) != 0)
#define STICK_BUTTON(joy) ((joy & 0x10) != 0)
#define STICK_MOVED(joy)  ((joy & 0x1f) != 0)

#ifdef __CC65__
// return key in buffer, or 0 if none (BIOS call)
char __fastcall__ poll_keyboard();
#endif

#ifndef __CC65__
inline void clrscr() {
    __asm__ volatile ("jsr $E544" : : : "a","x","y"); // regs clobbered
}
inline void waitvsync() {
  raster_wait(255);
}
#endif

// for use with set_irq()
// sets up the VIC to send raster interrupts
// and disables CIA interrupts
void set_raster_irq(char scanline);

#endif
