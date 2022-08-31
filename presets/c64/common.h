#ifndef _COMMON_H
#define _COMMON_H

#include <conio.h>
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <peekpoke.h>
#include <string.h>
#include <c64.h>
#include <joystick.h>

typedef uint8_t byte;	// 8-bit unsigned
typedef int8_t sbyte;	// 8-bit signed
typedef uint16_t word;	// 16-bit unsigned
typedef enum { false, true } bool; // boolean

#define COLS 40		// total # of columns
#define ROWS 25		// total # of rows


///// MACROS /////

// lookup screen address macro
#define SCRNADR(base,col,row) ((base)+(col)+(row)*40)

// default screen base address on startup
#define DEFAULT_SCREEN ((void*)0x400)

// wait until next frame, same as waitvsync()
#define wait_vblank waitvsync
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
  VIC.ctrl1 = (VIC.ctrl1 & 0xf8) | (_y);

#define SET_SCROLL_X(_x) \
  VIC.ctrl2 = (VIC.ctrl2 & 0xf8) | (_x);


// enable RAM from 0xa000-0xffff, disable interrupts
#define ENABLE_HIMEM() \
  asm("php"); \
  asm("sei"); \
  POKE(1, PEEK(1) & ~0b111);

// enable ROM and interrupts
#define DISABLE_HIMEM() \
  POKE(1, PEEK(1) | 0b111); \
  asm("plp");

///// FUNCTIONS /////

// wait until specific raster line
void raster_wait(byte line);

// get current VIC bank start address
char* get_vic_bank_start();

// get current screen memory address
char* get_screen_memory();

// return key in buffer, or 0 if none (BIOS call)
char __fastcall__ poll_keyboard();

#endif
