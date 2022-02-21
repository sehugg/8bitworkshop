#ifndef _DLL_H
#define _DLL_H

#include "atari7800.h"

#define DLL_FLAGS DLL_H16	// 4k DMA holes
#define SLOTHEIGHT 16		// lines per display list
#define SLOTSIZE 32		// bytes per display list
#define SLOTSPERPAGE 16		// display lists per page
#define DOUBLEBUFFER		// double buffer (2 pages)
#define DLSAVE			// enable save buffer

#ifdef DOUBLEBUFFER
#define NUMPAGES 2
#else
#define NUMPAGES 1
#endif
#define NUMSLOTS (SLOTSPERPAGE*NUMPAGES)

extern DLLEntry DLL[NUMSLOTS];		// display list list
extern byte DL[NUMSLOTS][SLOTSIZE];	// display list slots
extern byte DL_len[NUMSLOTS];		// current bytes in each slot
#ifdef DLSAVE
extern byte DL_save[NUMSLOTS];		// save lengths of each slot
#endif

// set current page (0 or 1)
#define dll_page(page) (slot0 = (page)*SLOTSPERPAGE)

extern byte slot0;

void dll_setup(void);
void dll_add_string(const char* str, byte x, byte y, byte wpal);
void dll_add_sprite(word addr, byte x, byte y, byte wpal);
sbyte dll_bytesleft(byte slot);
void* dll_alloc(byte slot, byte len);
void dll_set_scroll(byte y);
void dll_save(void);
void dll_restore(void);
void dll_restore_all(void);
void dll_clear(void);

void dll_swap(void);
void dll_copy(void);

#endif
