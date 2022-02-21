//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
//  Copyright (C) 2015 ronaldo / Fremos / Cheesetea / ByteRealms (@FranGallegoBR)
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

// Constant to set the number of VSYNCs to wait for as a delay between 
// each pair of strings drawn. This will let as see how they are
// drawn, making it a little bit slower.
// - WFRAMES = 3 (Work at 12.5 FPS (50/3))
#define WFRAMES  3

//
// Wait n complete screen frames of (1/50)s
//
void wait_frames(u16 nframes) {
   u16 i, j;   // frame counter and active wait loop counter

   // Loop for nframe times, waiting for VSYNC
   for (i=0; i < nframes; i++) {
      cpct_waitVSYNC();

      // VSYNC is usually active for ~1500 cycles, then we have to do 
      // something that takes approximately this amount of time before
      // waiting for the next VSYNC, or we will find the same VSYNC signal
      // This active wait loop will do at least 750 comparisons, what
      // is the same as 750*4 cycles (at least)
      for (j=0; j < 750; j++);
   }
}

//
// Strings Example: Main program
//
void main(void) {
   u8 *pvideomem;        // Pointer to the video memory location where strings will be drawn
   u8 times;             // Counter of number of times to draw 
   u8 colours[5] = {0};  // 5 Colour values, 1 for mode 2, 2 for mode 1 and 2 more for mode 0

   // First, disable firmware to prevent it from restoring video modes and 
   // interfering with drawString functions
   cpct_disableFirmware();

   // Loop forever showing characters on different modes and colours
   //
   while(1) {
      
      //
      // Show some strings in Mode 0, using different colours
      //

      // Clear Screen filling it up with 0's and set mode 0
      cpct_disableFirmware();
      cpct_disableUpperROM();
      cpct_clearScreen(0);
      cpct_setVideoMode(0);

      // Let's start drawing strings at the start of video memory (0xC000)
      pvideomem = CPCT_VMEM_START;

      // Draw 25 strings, 1 for each character line on the screen
      for (times=0; times < 25; times++) {
         // Pick up the next foreground colour available for next string
         // rotating colours when the 16 available have been used
         // We use module 16 (AND 0x0F) for faster calculations
         colours[0] = ++colours[0] & 15;
         
         // Draw the string and wait for some VSYNCs
         cpct_drawStringM0("$ Mode 0 string $", pvideomem, colours[0], colours[3]);
         wait_frames(WFRAMES);

         // Point to the start of the next character line on screen (80 bytes away)
         pvideomem += 0x50;
      }
      // Rotate background colour for next time we draw Mode 0 strings
      colours[3] = ++colours[3] & 15;

      //
      // Show some strings in Mode 1, using different colours
      //

      // Clear Screen filling it up with 0's and set mode 1
      cpct_clearScreen(0);
      cpct_setVideoMode(1);
      
      // Let's start drawing strings at the start of video memory (0xC000)
      pvideomem = CPCT_VMEM_START;

      // Draw 25 strings, 1 for each character line on the screen    
      for (times=0; times < 25; times++) {

         // Rotate foreground colour using module 4 (AND 0x03)
         colours[1] = ++colours[1] & 3;

         // Draw a string using normal drawString function for mode 1
         cpct_drawStringM1("Mode 1 string :D", pvideomem, colours[1], colours[4]);

         // Rotate foreground colour again
         colours[1] = ++colours[1] & 3;

         // Draw a string using fast drawString function for mode 1 (in a column 38 bytes to the right)
         cpct_drawStringM1_f("Mode 1 string (Fast)", pvideomem + 38, colours[1], colours[4]);

         // Rotate foreground colour another time and wait for a few VSYNCs
         colours[1] = ++colours[1] & 3;
         wait_frames(WFRAMES);

         // Point to the start of the next character line on screen (80 bytes away)
         pvideomem += 0x50;
      }
      colours[4] = ++colours[4] & 3;

      //
      // Show some strings in Mode 2, using different colours
      //

      // Clear Screen filling it up with 0's and set mode 2
      cpct_clearScreen(0);
      cpct_setVideoMode(2);

      // Let's start drawing strings at the start of video memory (0xC000)    
      pvideomem = CPCT_VMEM_START;

      // Draw 25 strings, 1 for each character line on the screen    
      for (times=0; times < 25; times++) {
         // Alternate between foreground colour or inverse colour (the only 2 
         // available on mode 2) using an XOR 1 operation that alternates the
         // value between 0 and 1
         colours[2] ^= 1;
         
         // Draw string on the screen using current colour and wait for a few VSYNCs
         cpct_drawStringM2("And, finally, this is a long mode 2 string!!", pvideomem, colours[2]);
         wait_frames(WFRAMES);

         // Point to the start of the next character line on screen (80 bytes away)
         pvideomem += 0x50;
      }
   }
}
