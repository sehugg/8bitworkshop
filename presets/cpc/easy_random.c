//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
//  Copyright (C) 2016 ronaldo / Fremos / Cheesetea / ByteRealms (@FranGallegoBR)
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
#include <stdio.h>

// Total random numbers to show (up to 255)
#define N_RND_NUMBERS   50

//////////////////////////////////////////////////////////////////
// wait4UserKeypress
//    Waits till the user presses a key, counting the number of
// loop iterations passed.
//
// Returns:
//    <u32> Number of iterations passed
//
u32 wait4UserKeypress() {
   u32 c = 0;     // Count the number of cycles passed till user k

   // Wait 'till the user presses a key, counting loop iterations
   do {
      c++;                       // One more cycle
      cpct_scanKeyboard_f();     // Scan the scan the keyboard
   } while ( ! cpct_isAnyKeyPressed_f() );

   return c;
}

//////////////////////////////////////////////////////////////////
// initialize
//    Shows introductory messages and initializes the pseudo-random
// number generator
//
void initialize() {
   u32 seed;    // Value to initialize the random seed

   // Introductory message
   printf("\017\003========= BASIC RANDOM NUMBERS =========\n\n\r");
   printf("\017\002Press any key to generate random numbers\n\n\r");

   // Wait till the users presses a key and use the number of
   // passed cycles as random seed for the Random Number Generator
   seed = wait4UserKeypress();

   // Random seed may never be 0, so check first and add 1 if it was 0
   if (!seed)
      seed++;

   // Print the seed and seed the random number generator
   printf("\017\003Selected seed: \017\002%d\n\r", seed);
   cpct_srand8(seed);
}

//////////////////////////////////////////////////////////////////
// printRandomNumbers
//    Prints some random numbers in the screen, as requested.
// INPUT:
//    nNumbers - Total amount of pseudo-random numbers to print
//
void printRandomNumbers(u8 nNumbers) {
   // Anounce numbers
   printf("\017\003Generating \017\002%d\017\003 random numbers\n\n\r\017\001", N_RND_NUMBERS);

   // Count from nNumbers to 0, printing random numbers
   while (nNumbers--) {
      u8 random_number = cpct_rand();  // Get next random number
      printf("%d ", random_number);    // Print it 
   }

   // End printing with newlines
   printf("\n\n\r");
}

//////////////////////////////////////////////////////////////////
// MAIN ENTRY POINT OF THE APPLICATION
//
void main(void) {
   // Loop forever
   while (1) {
      // Initialize everything and print some random numbers
      initialize();  
      printRandomNumbers(N_RND_NUMBERS);

      // Wait 'till the user stops pressing a key
      do { cpct_scanKeyboard_f(); } while ( cpct_isAnyKeyPressed_f() );
   }
}
