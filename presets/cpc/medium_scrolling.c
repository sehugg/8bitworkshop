//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
//  Copyright (C) 2015 ronaldo / Fremos / Cheesetea / ByteRealms (@FranGallegoBR)
//  Created in collaboration with Roald Strauss (aka mr_lou / CPCWiki)
//
//  This program is free software: you can redistribute it and/or modify
//  it under the terms of the GNU Lesser General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU Lesser General Public License for more details.
//
//  You should have received a copy of the GNU Lesser General Public License
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.
//------------------------------------------------------------------------------

#include "cpctelera.h"
#include <string.h>

// Useful constants
//  * Start of screen video memory
//  * Size in bytes of a complete screen video pixel line
//  * Offset from the start of a pixel line to the start of the next (inside same group of 8 pixel lines)
//  * Screen character line to be used for scrolling (0-24)
#define PIXEL_LINE_SIZE   0x0050
#define PIXEL_LINE_OFFSET 0x0800
#define CHARLINE          12

//
// Waits n times for a VSYNC signal (1/50s). After each VSYNC signal,
// if waits for 2 interrupts (using HALT 2 times) to ensure that VSYNC
// stops being active until looking for the next VSYNC signal.
//
void wait_n_VSYNCs(u8 n) {
   do {
      // Wait for 1 VSYNC signal
      cpct_waitVSYNC();

      // If we still have to wait for more VSYNC signals, wait first
      // for this present VSYNC signal to become inactive. For that,
      // wait for 2 system interrupts using ASM halt instruction.
      if (--n) {
         __asm__("halt");
         __asm__("halt");
      }
   } while(n);
}

//
// Scrolls a Character line (8 pixel lines) 1 byte to the left. To do
// this, it goes byte by byte copying the next byte (the one to the right)
//   pCharline: pointer to the first byte of the character line (the 8 pixel lines)
//   lineSize:  number of total bytes a pixel line has
//
void scrollLine(u8* pCharline, u16 lineSize) {
   // Scroll 8 pixel lines. This loop is executed 8 times: when pCharline is incremented
   // the 9th time, it will overflow (will be greater than 0xFFFF, cycling through 0x0000)
   // and will be lower than 0xC000.
   for (; pCharline > CPCT_VMEM_START; pCharline += PIXEL_LINE_OFFSET)
      cpct_memcpy(pCharline, pCharline+1, lineSize);
}

//
// MAIN LOOP
//
void main(void) {
  
   // Test to be used for scrolling (declared constant as it won't be modified,
   // and that prevents compiler from generating code for initializing it)
   const u8 *text="This is a simple software scrolling mode 1 text. Not really smooth, but easy to understand.     ";

   // Pointer to the first byte of the screen character line
   // (8 pixel lines) to be scrolled. First 25 pixel lines of screen
   // video memory are the 25 pixel 0 lines of each screen character line
   // (group of 8 pixel lines), hence this calculation.
   u8* pCharline_start = CPCT_VMEM_START + (PIXEL_LINE_SIZE * CHARLINE);

   // Pointer to the first byte of the last screen character of the
   // character line (last 2 bytes of the 8 pixel lines)
   const u8* pNextCharLocation = pCharline_start + PIXEL_LINE_SIZE - 2;

   const u8 textlen=strlen(text);  // Save the lenght of the text for later use
   u8 nextChar=0;                  // Next character of the text to be drawn on the screen
   u8 penColour=1;                 // Pen colour for the characters

   cpct_disableFirmware ();
   cpct_disableUpperROM ();

   // Infinite scrolling loop
   cpct_drawStringM1("Hold any key to pause scroll", CPCT_VMEM_START, 1, 3);
   while (1) {
      // When holding a key, wait for release (Loop scanning the keyboard
      // until no single key is pressed)
      do { cpct_scanKeyboard_f(); } while( cpct_isAnyKeyPressed_f() );

      // Draw next character at the rightmost character location of the
      // character line being scrolled
      cpct_drawCharM1_f(pNextCharLocation, penColour, 0, text[nextChar]);

      // nextChar will hold the index of the next Character, returning to
      // the first one when there are no more characters left, and changing
      // Pen colour for next sentence
      if (++nextChar == textlen) {
         nextChar = 0;
         if (++penColour > 3) penColour = 1;
      }

      // Scroll character line 2 times, as each scroll call will move
      // the pixels 1 byte = 4 pixels. So, 2 times = 8 pixels = 1 Character
      // Sinchronyze with VSYNC previous to each call to make it smooth
      wait_n_VSYNCs(2);
      scrollLine(pCharline_start, PIXEL_LINE_SIZE);
      wait_n_VSYNCs(2);
      scrollLine(pCharline_start, PIXEL_LINE_SIZE);
   }
}
