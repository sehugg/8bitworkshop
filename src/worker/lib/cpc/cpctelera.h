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
//-------------------------------------------------------------------------------

#ifndef CPCTELERA_TYPES_H
#define CPCTELERA_TYPES_H

///
/// Types: Aliases for builtin types
///
///		CPCtelera's short useful aliases for standard SDCC built-in types.
///
///		u8  - unsigned char      (u8  = unsigned  8-bits, 1 byte )
///		i8  - signed char        (i8  = integer   8-bits, 1 byte )
///		u16 - unsigned int       (u16 = unsigned 16-bits, 2 bytes)
///		i16 - signed int         (i16 = integer  16-bits, 2 bytes)
///		u32 - unsigned long      (u32 = unsigned 32-bits, 4 bytes)
///		i32 - signed long        (i32 = integer  32-bits, 4 bytes)
///		u64 - unsigned long long (u32 = unsigned 64-bits, 8 bytes)
///		i64 - signed long long   (i32 = integer  64-bits, 8 bytes)
///		f32 - float              (f32 = float    32-bits, 4 bytes)
///
typedef unsigned char       u8; 
typedef signed char         i8;
typedef unsigned int       u16;
typedef signed int         i16;
typedef unsigned long      u32;
typedef signed long        i32;
typedef unsigned long long u64;
typedef signed long long   i64;
typedef float              f32;

#endif
//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
//  Copyright (C) 2014 ronaldo / Fremos / Cheesetea / ByteRealms (@FranGallegoBR)
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
//-------------------------------------------------------------------------------
//#####################################################################
//### MODULE: Firmware and ROM routines                             ###
//#####################################################################
//### Routines to disable CPC Firmware and reenable it when needed, ###
//### and managing Upper and Lower ROMs.                            ###
//#####################################################################
//
#ifndef CPCT_FIRMWARE_ED_H
#define CPCT_FIRMWARE_ED_H

// Enabling and disabling Firmware
extern void cpct_reenableFirmware(u16 firmware_ROM_code) __z88dk_fastcall;
extern  u16 cpct_disableFirmware();

// Setting a user defined interrupt handler routine
extern void cpct_setInterruptHandler( void(*intHandler)(void) ) __z88dk_fastcall;

// Upper and Lower ROM control
extern void cpct_enableLowerROM();
extern void cpct_disableLowerROM();
extern void cpct_enableUpperROM();
extern void cpct_disableUpperROM();

#endif
//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
 //  Copyright (C) 2014 - 2015 ronaldo / Fremos / Cheesetea / ByteRealms (@FranGallegoBR)
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
//-------------------------------------------------------------------------------

//
//#####################################################################
//### MODULE Keyboard                                               ###
//#####################################################################
//### Routines control and check keyboard status, keys and joystick ###
//#####################################################################
//

//
// Title: Keyboard Mappings&Constants
//

#ifndef CPCT_KEYBOARD_H
#define CPCT_KEYBOARD_H

//#include <types.h>

//
// Declare type for CPC keys
//
        enum cpct_e_keyID;
typedef enum cpct_e_keyID cpct_keyID;

///
/// Function Declarations
///
extern void cpct_scanKeyboard     ();
extern void cpct_scanKeyboard_i   ();
extern void cpct_scanKeyboard_f   ();
extern void cpct_scanKeyboard_if  ();
extern   u8 cpct_isKeyPressed     (cpct_keyID key) __z88dk_fastcall;
extern   u8 cpct_isAnyKeyPressed  ();
extern   u8 cpct_isAnyKeyPressed_f();

//
// Array: cpct_keyboardStatusBuffer
//
//    10-bytes (80-bits) array containing pressed / not pressed status of 
// all the keys / buttons the Amstrad CPC can manage (up to 80). Each bit 
// represents 1 key, with the meaning 0=pressed, 1=not pressed. This array
// is filled up using <cpct_scanKeyboard> or <cpct_scanKeyboard_f> functions,
// and then it can be easily read with <cpct_isKeyPressed> function.
// To know more about how this 10 bytes are distributed, consult <Keyboard>
// and <cpct_scanKeyboard> 
//
extern u8 cpct_keyboardStatusBuffer[10];

//
// Enum: cpct_keyID
// 
//    Enumerated type with symbols for all the 80 possible Key/Joy definitions.
//
// Details:
//    Figure 1 shows the layout for an Amstrad CPC Keyboard, along with
// its firmware Key Codes. Firmware Key Codes (FKCs) are used in table 1 to map them
// to <cpct_keyID> enum values. Please, take into account that FKCs are not used
// in CPCtelera. Do not make comparisons or store values based on firmware values
// unless you know what you are doing. To check key / joy statuses, you should
// use <cpct_keyID> enum values from table 1.
//
// (start code)
//                                                      __
//                                                     | 0|
//                                          ENC*     —— —— ——
//   AMSTRAD                   CPC464 RGB color     | 8| 9| 1|
//                                                   —— —— ——
//  __ __ __ __ __ __ __ __ __ __ __ __ __ __ ___      | 2|
// |66|64|65|57|56|49|48|41|40|33|32|25|24|16|79 |      ——
//  —— —— —— —— —— —— —— —— —— —— —— —— —— —— ———    —— —— ——
// |68 |67|59|58|50|51|43|42|35|34|27|26|17|     |  |10|11| 3|
//  ——— —— —— —— —— —— —— —— —— —— —— —— —— = 18 |   —— —— ——
// | 70 |69|60|61|53|52|44|45|37|36|29|28|19|    |  |20|12| 4|
//  ———— —— —— —— —— —— —— —— —— —— —— —— —— ————    —— —— ——
// | 21  |71|63|62|55|54|46|38|39|31|30|22|  21  |  |13|14| 5|
//  ————— —— —— —— —— —— —— —— —— —— —— —— ——————    —— —— ——
//          |            47            |23|         |15| 7| 6|
//           —————————————————————————— ——           —— —— ——
//      JOY 0   ___               JOY 1   ___        
//             | 72|                     | 48|       
//         ——|———————|——             ——|———————|——   
//        |74| 76| 77|75|           |50| 52| 53|51|  
//         ——|———————|——             ——|———————|——   
//             | 73|                     | 49|       
//              ———                       ———        
// ====================================================================
//  Figure 1. Amstrad CPC Keyoard Layout with Firmware Key Codes (FKCs)
// (end)
//
// (start code)
//  FKC | cpct_keyID      || FKC  | cpct_keyID    ||  FKC  |  cpct_keyID   
// --------------------------------------------------------------------
//    0 | Key_CursorUp    ||  27  | Key_P         ||   54  |  Key_B
//      |                 ||      |               ||       |  Joy1_Fire3
//    1 | Key_CursorRight ||  28  | Key_SemiColon ||   55  |  Key_V
//    2 | Key_CursorDown  ||  29  | Key_Colon     ||   56  |  Key_4
//    3 | Key_F9          ||  30  | Key_Slash     ||   57  |  Key_3
//    4 | Key_F6          ||  31  | Key_Dot       ||   58  |  Key_E
//    5 | Key_F3          ||  32  | Key_0         ||   59  |  Key_W
//    6 | Key_Enter       ||  33  | Key_9         ||   60  |  Key_S
//    7 | Key_FDot        ||  34  | Key_O         ||   61  |  Key_D
//    8 | Key_CursorLeft  ||  35  | Key_I         ||   62  |  Key_C
//    9 | Key_Copy        ||  36  | Key_L         ||   63  |  Key_X
//   10 | Key_F7          ||  37  | Key_K         ||   64  |  Key_1
//   11 | Key_F8          ||  38  | Key_M         ||   65  |  Key_2
//   12 | Key_F5          ||  39  | Key_Comma     ||   66  |  Key_Esc
//   13 | Key_F1          ||  40  | Key_8         ||   67  |  Key_Q
//   14 | Key_F2          ||  41  | Key_7         ||   68  |  Key_Tab
//   15 | Key_F0          ||  42  | Key_U         ||   69  |  Key_A
//   16 | Key_Clr         ||  43  | Key_Y         ||   70  |  Key_CapsLock
//   17 | Key_OpenBracket ||  44  | Key_H         ||   71  |  Key_Z
//   18 | Key_Return      ||  45  | Key_J         ||   72  |  Joy0_Up
//   19 | Key_CloseBracket||  46  | Key_N         ||   73  |  Joy0_Down
//   20 | Key_F4          ||  47  | Key_Space     ||   74  |  Joy0_Left
//   21 | Key_Shift       ||  48  | Key_6         ||   75  |  Joy0_Right
//      |                 ||      | Joy1_Up       ||
//   22 | Key_BackSlash   ||  49  | Key_5         ||   76  |  Joy0_Fire1
//      |                 ||      | Joy1_Down     ||
//   23 | Key_Control     ||  50  | Key_R         ||   77  |  Joy0_Fire2
//      |                 ||      | Joy1_Left     ||       |
//   24 | Key_Caret       ||  51  | Key_T         ||   78  |  Joy0_Fire3
//      |                 ||      | Joy1 Right    ||
//   25 | Key_Hyphen      ||  52  | Key_G         ||   79  |  Key_Del
//      |                 ||      | Joy1_Fire1    ||
//   26 | Key_At          ||  53  | Key_F         ||
//      |                 ||      | Joy1_Fire2    ||
// --------------------------------------------------------------------
//  Table 1. cpct_keyIDs defined for each possible key, ordered by FKCs
// (end)
//
enum cpct_e_keyID
{
  // Matrix Line 00h
  Key_CursorUp     = (i16)0x0100,  // Bit 0 (01h) => | 0000 0001 |
  Key_CursorRight  = (i16)0x0200,  // Bit 1 (02h) => | 0000 0010 |
  Key_CursorDown   = (i16)0x0400,  // Bit 2 (04h) => | 0000 0100 |
  Key_F9           = (i16)0x0800,  // Bit 3 (08h) => | 0000 1000 |
  Key_F6           = (i16)0x1000,  // Bit 4 (10h) => | 0001 0000 |
  Key_F3           = (i16)0x2000,  // Bit 5 (20h) => | 0010 0000 |
  Key_Enter        = (i16)0x4000,  // Bit 6 (40h) => | 0100 0000 |
  Key_FDot         = (i16)0x8000,  // Bit 7 (80h) => | 1000 0000 |

  // Matrix Line 01h
  Key_CursorLeft   = (i16)0x0101,
  Key_Copy         = (i16)0x0201,
  Key_F7           = (i16)0x0401,
  Key_F8           = (i16)0x0801,
  Key_F5           = (i16)0x1001,
  Key_F1           = (i16)0x2001,
  Key_F2           = (i16)0x4001,
  Key_F0           = (i16)0x8001,

  // Matrix Line 02h
  Key_Clr          = (i16)0x0102,
  Key_OpenBracket  = (i16)0x0202,
  Key_Return       = (i16)0x0402,
  Key_CloseBracket = (i16)0x0802,
  Key_F4           = (i16)0x1002,
  Key_Shift        = (i16)0x2002,
  Key_BackSlash    = (i16)0x4002,
  Key_Control      = (i16)0x8002,

  // Matrix Line 03h
  Key_Caret        = (i16)0x0103,
  Key_Hyphen       = (i16)0x0203,
  Key_At           = (i16)0x0403,
  Key_P            = (i16)0x0803,
  Key_SemiColon    = (i16)0x1003,
  Key_Colon        = (i16)0x2003,
  Key_Slash        = (i16)0x4003,
  Key_Dot          = (i16)0x8003,

  // Matrix Line 04h
  Key_0            = (i16)0x0104,
  Key_9            = (i16)0x0204,
  Key_O            = (i16)0x0404,
  Key_I            = (i16)0x0804,
  Key_L            = (i16)0x1004,
  Key_K            = (i16)0x2004,
  Key_M            = (i16)0x4004,
  Key_Comma        = (i16)0x8004,

  // Matrix Line 05h
  Key_8            = (i16)0x0105,
  Key_7            = (i16)0x0205,
  Key_U            = (i16)0x0405,
  Key_Y            = (i16)0x0805,
  Key_H            = (i16)0x1005,
  Key_J            = (i16)0x2005,
  Key_N            = (i16)0x4005,
  Key_Space        = (i16)0x8005,

  // Matrix Line 06h
  Key_6            = (i16)0x0106,
  Joy1_Up          = (i16)0x0106,
  Key_5            = (i16)0x0206,
  Joy1_Down        = (i16)0x0206,
  Key_R            = (i16)0x0406,
  Joy1_Left        = (i16)0x0406,
  Key_T            = (i16)0x0806,
  Joy1_Right       = (i16)0x0806,
  Key_G            = (i16)0x1006,
  Joy1_Fire1       = (i16)0x1006,
  Key_F            = (i16)0x2006,
  Joy1_Fire2       = (i16)0x2006,
  Key_B            = (i16)0x4006,
  Joy1_Fire3       = (i16)0x4006,
  Key_V            = (i16)0x8006,

  // Matrix Line 07h
  Key_4            = (i16)0x0107,
  Key_3            = (i16)0x0207,
  Key_E            = (i16)0x0407,
  Key_W            = (i16)0x0807,
  Key_S            = (i16)0x1007,
  Key_D            = (i16)0x2007,
  Key_C            = (i16)0x4007,
  Key_X            = (i16)0x8007,

  // Matrix Line 08h
  Key_1            = (i16)0x0108,
  Key_2            = (i16)0x0208,
  Key_Esc          = (i16)0x0408,
  Key_Q            = (i16)0x0808,
  Key_Tab          = (i16)0x1008,
  Key_A            = (i16)0x2008,
  Key_CapsLock     = (i16)0x4008,
  Key_Z            = (i16)0x8008,

  // Matrix Line 09h
  Joy0_Up          = (i16)0x0109,
  Joy0_Down        = (i16)0x0209,
  Joy0_Left        = (i16)0x0409,
  Joy0_Right       = (i16)0x0809,
  Joy0_Fire1       = (i16)0x1009,
  Joy0_Fire2       = (i16)0x2009,
  Joy0_Fire3       = (i16)0x4009,
  Key_Del          = (i16)0x8009
};

#endif
//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
//  Copyright (C) 2015-2016 ronaldo / Fremos / Cheesetea / ByteRealms (@FranGallegoBR)
//  Copyright (C) 2015 Alberto García García
//  Copyright (C) 2015 Pablo Martínez González
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
//-------------------------------------------------------------------------------
//######################################################################
//### MODULE: Bit Array                                              ###
//### Developed by Alberto García García and Pablo Martínez González ###
//### Reviewed and optimized by ronaldo / Cheesetea                  ###
//######################################################################
//### This module contains functions to get and set groups of 1, 2   ###
//### and 4 bit in a char array. So data in arrays can be compressed ###
//### in a transparent way to the programmer.                        ###
//######################################################################
//
#ifndef CPCT_BITARRAY_H
#define CPCT_BITARRAY_H

//#include <types.h>

//#include "bitarray_macros.h"
//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
//  Copyright (C) 2015-2016 ronaldo / Fremos / Cheesetea / ByteRealms (@FranGallegoBR)
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
//-------------------------------------------------------------------------------

#ifndef CPCT_BITARRAY_MACROS_H
#define CPCT_BITARRAY_MACROS_H

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
// File: Useful macros
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
// Group: Bitarray definition and declaration
////////////////////////////////////////////////////////////////////////
//    Group of macros to declare and/or define bitarrays.
//
// Macro: CPCT_1BITARRAY
//    Define or declare arrays with 1-bit elements
//
// Macro: CPCT_2BITARRAY
//    Define or declare arrays with 2-bits elements
//
// Macro: CPCT_4BITARRAY
//    Define or declare arrays with 4-bits elements
// 
// Macro: CPCT_6BITARRAY
//    Define or declare arrays with 6-bits elements
//
// Parameters (1 byte):
//    Name   - C identifier for the bitarray.
//    Elems  - Number of elements the array will have (total items)
//
// C Definitions:
//    #define CPCT_6BITARRAY (*Name*, *Elems*)
//
//    #define CPCT_4BITARRAY (*Name*, *Elems*)
//
//    #define CPCT_2BITARRAY (*Name*, *Elems*)
//
//    #define CPCT_1BITARRAY (*Name*, *Elems*)
//
// Details:
//    These macros make more comfortable the process of declaring and defining
// bitarrays. Any bitarray is a normal array of bytes in the end. However, it
// is usually accessed through CPCtelera's bitarray function to manage elements
// smaller than 1 byte. 
//
//	  When a bitarray is defined, a calculation has to be made to know how many
// bytes are required to store the total amount of X-bits elements it will contain.
// For instance, to store 8 2-bits elements, 16 bits are needed, so 2 bytes needs
// to be allocated. Therefore, in the next code segment, both sentences are equivalent:
// (start code)
//    	CPCT_2BITSARRAY(my_array, 8);	// This allocates 2 bytes (8 2-bits elements)
//		u8 my_array[2]; 				// This does exactly the same.
// (end code)
//
//    These 4 macros can be used either for defining and for declaring bitarrays.
// This example shows how to define and declare different bitarrays:
// (start code)
//		// Declaring an array (without defining it)
//      //	   This one is a 40 bits array (5 bytes, 10 4-bits elements)
//		extern CPCT_4BITSARRAY(an_array, 10); 
//
//		// Define and populate a constant array 
//		//		This other is a 16-bits array (2 bytes, 8 2-bits elements)
//		const CPCT_2BITSARRAY(other_array, 8) = {
//			0b00011011, 0b11100100	// Populate with 8 elements (0,1,2,3,3,2,1,0)
//		};
// (end code)
// 
#define CPCT_6BITARRAY(Name, Elems) u8 Name[ (((Elems)/4 + !!((Elems) % 4)) * 3) ]
#define CPCT_4BITARRAY(Name, Elems) u8 Name[ ((Elems)/2 + 1) ]
#define CPCT_2BITARRAY(Name, Elems) u8 Name[ ((Elems)/4 + 1) ]
#define CPCT_1BITARRAY(Name, Elems) u8 Name[ ((Elems)/8 + 1) ]

////////////////////////////////////////////////////////////////////////
// Group: Bitarray element encoding
////////////////////////////////////////////////////////////////////////
//    Macros that help initializing, populating and inserting elements 
// manually into different types of bitarrays
//
// Macro: CPCT_ENCODE6BITS 
//    Encodes 4 6-bits elements into 3 bytes for a <CPCT_6BITARRAY>
// 
// Macro: CPCT_ENCODE4BITS
//    Encodes 2 4-bits elements into 1 byte for a <CPCT_4BITARRAY>
//
// Macro: CPCT_ENCODE2BITS
//    Encodes 4 2-bits elements into 1 byte for a <CPCT_2BITARRAY>
//
// C Definitions:
//   #define CPCT_ENCODE6BITS(A, B, C, D)
//
//   #define CPCT_ENCODE4BITS(A, B)
//
//   #define CPCT_ENCODE2BITS(A, B, C, D)
//
// Parameters (2-4 bytes):
//  A-D - Individual elements to be inserted in the bitarray
//
// Parameter Restrictions:
//    CPCT_ENCODE6BITS - Each value must be in the range [0, 63]
//    CPCT_ENCODE4BITS - Each value must be in the range [0, 15]
//    CPCT_ENCODE2BITS - Each value must be in the range [0, 3]
//
// Details:
//    These macros help in the initialization of bitarray elements mainly, and
// can also help on their population and modification. They get individual elements
// (one number for each element) and pack them together, putting each element into
// its corresponding bits.
//
//    Let us understand this better with an example. Suppose we wanted to initialize a 
// <CPCT_4BITARRAY> with these elements: 5, 10, 15, 1. We could do it manually 
// this way:
// (start code)
//    // Define and populate a new bitarray with 4-bits elements
//    CPCT_4BITARRAY(mybitarray, 4) = { 
//       0x5A, // First 2 elements of the bitarray, 5 and 10, 4-bits each, hexadecimally codified
//       0xF1  // Next 2 elements of the bitarray, 15 and 1, 4-bits each, hexadecimally codified
//    };
// (end code)
//    In this case, we know that each hexadecimal digit corresponds to 4-bits and 
// use this to define 4 elements in 2 bytes, being each one a hexadecimal digit. 
// We can do exactly the same, easily, using <CPCT_ENCODE4BITS> macro:
// (start code)
//    // Define and populate a new bitarray with 4-bits elements
//    CPCT_4BITARRAY(mybitarray, 4) = { 
//       CPCT_ENCODE4BITS( 5, 10),  // Add elements 5 and 10
//       CPCT_ENCODE4BITS(15,  1)   // Add elements 15 and 1
//    };
// (end code)
//    This code does the same as previous one, but its easier to do. We use <CPCT_ENCODE4BITS>
// macro and directly write desired values in order, as in a conventional array definition. 
// This let us forget about internal codification and focus on our data.
//
// Examples of use:
//    This example is from a platform game, where user controls a running man that 
// has to jump over metal spikes. The game needs an array defining the layout of 
// the floor, having 4 types of floor block: (0) normal floor, (1) decelerator floor,
// (2) jump-booster floor, (3) spikes. This is the definition of the first level:
// (start code)
//    // Define level 1 layout. It starts with normal floor, going then through 
//    // some easy jumps and ending with a decelerator floor previous to a 
//    // jump-booster which is required for the final jump.
//    CPCT_2BITARRAY(level_1, 24) = {
//         CPCT_ENCODE2BITS(0, 0, 0, 0) // Start with normal floor
//       , CPCT_ENCODE2BITS(3, 0, 0, 0) // Some easy jumps (spike and then 3 floors)
//       , CPCT_ENCODE2BITS(3, 0, 0, 0) 
//       , CPCT_ENCODE2BITS(1, 1, 2, 2) // Decelerator floor, followed by 2 jump-boosters
//       , CPCT_ENCODE2BITS(3, 3, 3, 3) // Big spike hole
//       , CPCT_ENCODE2BITS(0, 0, 0, 0) // Normal floor at the end of the level
//    }
// (end code)
//    The same operation this code does (defining and populating an array), could have
// been manually done this way:
// (start code)
//    // Defining and populating level 1, using 2 bits for each element
//    // (4 elements per byte, so 6 bytes required, as 6 x 4 = 24). We 
//    // use binary numbers for clarity (2bits per element), and include hexadecimal
//    // and decimal for comparison purposes only.
//    level_1[6] = { 0b00000000, 0b11000000, 0b11000000, 0b01011010, 0b11111111, 0b00000000 };
//    //         = { 0x00, 0xC0, 0xC0, 0x5A, 0xFF, 0x00 }; Same in hexadecimal
//    //         = {    0,  192,  192,   80,  255,    0 }; Same in decimal
// (end code)
//
//    Another example could be the definition of a height map for a 2D lateral game
// filled with mountains. Each element of the next array will refer to the height
// of the floor at a given location. Thinking of a floor that will never be taller
// than 63 pixels, we can use a 6-bits array to define the layout of the map. 
// This would be a map for the second level of this game:
// (start code)
//    // Define the height map for the level 2 that     #        < 28
//    // will be a great mountain like this one >>     ###       < 24
//    CPCT_6BITARRAY(heightmap_l2, 12) = {      //     ###       < 20
//         CPCT_ENCODE6BITS( 0,  4,  8, 16)     //    ######     < 16
//       , CPCT_ENCODE6BITS(24, 28, 24, 16)     //    ######     < 12
//       , CPCT_ENCODE6BITS(16,  4,  0,  0)     //   #######     <  8
//    };                                        // _#########__  <  4
// (end code)
// 
#define CPCT_ENCODE6BITS(A, B, C, D) ((A)<<2) | ((B)>>4), ((B)<<4) | ((C)>>2), ((C)<<6) | ((D)&0x3F)
#define CPCT_ENCODE4BITS(A, B)       ((A)<<4) | ((B)>>4)
#define CPCT_ENCODE2BITS(A, B, C, D) ((A)<<6) | (((B)<<4)&0x30) | (((C)<<2)&0x0C) | ((D)&0x03)

#endif

// Get bit functions
extern   u8 cpct_getBit  (void *array, u16 pos) __z88dk_callee;
extern   u8 cpct_get2Bits(void *array, u16 pos) __z88dk_callee;
extern   u8 cpct_get4Bits(void *array, u16 pos) __z88dk_callee;
extern   u8 cpct_get6Bits(void *array, u16 pos) __z88dk_callee;

// Set bit functions
extern void cpct_setBit  (void *array, u16 value, u16 pos) __z88dk_callee;
extern void cpct_set2Bits(void *array, u16 value, u16 pos) __z88dk_callee;
extern void cpct_set4Bits(void *array, u16 value, u16 pos) __z88dk_callee;
extern void cpct_set6Bits(void *array, u16 value, u16 pos) __z88dk_callee;

#endif//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
//  Copyright (C) 2014-2016 ronaldo / Fremos / Cheesetea / ByteRealms (@FranGallegoBR)
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
//-------------------------------------------------------------------------------

//#####################################################################
//### MODULE: Sprites                                               ###
//#####################################################################
//### This module contains several functions and routines to manage ###
//### sprites and video memory in an Amstrad CPC environment.       ###
//#####################################################################
//

#ifndef CPCT_SPRITES_H
#define CPCT_SPRITES_H

//#include <types.h>

//#include "sprite_types.h"
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
//-------------------------------------------------------------------------------

//
// Title: Sprite Types
//

#ifndef CPCT_SPRITE_TYPES_H
#define CPCT_SPRITE_TYPES_H

// 
// Enum: CPCT_BlendMode
//
//    Enumerates all blending modes for <cpct_drawSpriteBlended>. 
//
// Description:
//    These blend operations are common byte operations that the processor
// does between two values. The <cpct_drawSpriteBlended> function blends
// the sprite with the background (present contents of the video memory)
// byte by byte. It takes 1 byte from video memory (background) and 1 byte
// from the sprite array (data), does the selected operation with both 
// (XOR, OR, AND, etc) and puts the result in screen video memory, where
// it got the first byte from the background.
//
//    All possible blending modes are implemented as 1-byte Z80 operations.
// The name of every enumerate value include the mnemonic of the operation
// that will be performed (XOR, AND, OR, ADD...) between both bytes 
// (background and sprite data). Take into account that pixel values refer
// to palette indices (0-1, 0-3 or 0-15, depending on graphics mode). Final
// result of operations will depend on how you select your palette colours.
//
// Modes available:
// (start code)
//    %======================================================%
//    | Constant       | Value | Blending operation          |
//    |------------------------------------------------------|
//    | CPCT_BLEND_XOR |  0xAE | = background ^ data         |
//    | CPCT_BLEND_AND |  0xA6 | = background & data         |
//    | CPCT_BLEND_OR  |  0xB6 | = background | data         |
//    | CPCT_BLEND_ADD |  0x86 | = background + data         |
//    | CPCT_BLEND_ADC |  0x8E | = background + data + Carry |
//    | CPCT_BLEND_SBC |  0x9E | = background - data - Carry |
//    | CPCT_BLEND_SUB |  0x96 | = background - data         |
//    | CPCT_BLEND_LDI |  0x7E | = data                      |
//    | CPCT_BLEND_NOP |  0x00 | = background                |
//    %======================================================%
// (end code)
// * Background = bytes of data read from screen video memory (where background lies)
// * Data       = bytes of data read from the sprite
// * Carry      = Carry bits from previous additions and subtractions
//
typedef enum {
     CPCT_BLEND_XOR = 0xAE
   , CPCT_BLEND_AND = 0xA6
   , CPCT_BLEND_OR  = 0xB6
   , CPCT_BLEND_ADD = 0x86
   , CPCT_BLEND_ADC = 0x8E
   , CPCT_BLEND_SBC = 0x9E
   , CPCT_BLEND_SUB = 0x96
   , CPCT_BLEND_LDI = 0x7E
   , CPCT_BLEND_NOP = 0x00
} CPCT_BlendMode;

#endif

//#include "transparency_table_macros.h"
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
//-------------------------------------------------------------------------------

#ifndef _TRANSPARENCY_TABLE_MACROS_H
#define _TRANSPARENCY_TABLE_MACROS_H

//----------------------------------------------------------------------------------------
// Title: Transparency Macros
//----------------------------------------------------------------------------------------

//#include <types.h>

//#include "transparency_tables_m0.h"
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
//-------------------------------------------------------------------------------

#ifndef _TRANSPARENCY_TABLES_MODE0_H
#define _TRANSPARENCY_TABLES_MODE0_H

//----------------------------------------------------------------------------------------
// Title: Transparency Tables for Mode 0
//----------------------------------------------------------------------------------------

//
// Macro: CPCTM_MASKTABLE0M0
//    256-table (assembly definition) with mask values for mode 0 using pen 0 as transparent
//
#define CPCTM_MASKTABLE0M0 \
      .db 0xFF, 0xAA, 0x55, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE1M0
//    256-table (assembly definition) with mask values for mode 0 using pen 1 as transparent
//
#define CPCTM_MASKTABLE1M0 \
      .db 0x00, 0x55, 0xAA, 0xFF, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE2M0
//    256-table (assembly definition) with mask values for mode 0 using pen 2 as transparent
//
#define CPCTM_MASKTABLE2M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xFF, 0xAA, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE3M0
//    256-table (assembly definition) with mask values for mode 0 using pen 3 as transparent
//
#define CPCTM_MASKTABLE3M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x55, 0xAA, 0xFF \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE4M0
//    256-table (assembly definition) with mask values for mode 0 using pen 4 as transparent
//
#define CPCTM_MASKTABLE4M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xFF, 0xAA, 0x55, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE5M0
//    256-table (assembly definition) with mask values for mode 0 using pen 5 as transparent
//
#define CPCTM_MASKTABLE5M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0xAA, 0xFF, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE6M0
//    256-table (assembly definition) with mask values for mode 0 using pen 6 as transparent
//
#define CPCTM_MASKTABLE6M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xFF, 0xAA, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE7M0
//    256-table (assembly definition) with mask values for mode 0 using pen 7 as transparent
//
#define CPCTM_MASKTABLE7M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x55, 0xAA, 0xFF \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
//
// Macro: CPCTM_MASKTABLE8M0
//    256-table (assembly definition) with mask values for mode 0 using pen 8 as transparent
//
#define CPCTM_MASKTABLE8M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xFF, 0xAA, 0x55, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE9M0
//    256-table (assembly definition) with mask values for mode 0 using pen 9 as transparent
//
#define CPCTM_MASKTABLE9M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0xAA, 0xFF, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE10M0
//    256-table (assembly definition) with mask values for mode 0 using pen 10 as transparent
//
#define CPCTM_MASKTABLE10M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xFF, 0xAA, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE11M0
//    256-table (assembly definition) with mask values for mode 0 using pen 11 as transparent
//
#define CPCTM_MASKTABLE11M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x55, 0xAA, 0xFF \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE12M0
//    256-table (assembly definition) with mask values for mode 0 using pen 12 as transparent
//
#define CPCTM_MASKTABLE12M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xFF, 0xAA, 0x55, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE13M0
//    256-table (assembly definition) with mask values for mode 0 using pen 13 as transparent
//
#define CPCTM_MASKTABLE13M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x55, 0xAA, 0xFF, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x55, 0x00, 0x55, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE14M0
//    256-table (assembly definition) with mask values for mode 0 using pen 14 as transparent
//
#define CPCTM_MASKTABLE14M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55, 0x00 \
      .db 0xAA, 0xAA, 0x00, 0x00, 0xFF, 0xAA, 0x55, 0x00

//
// Macro: CPCTM_MASKTABLE15M0
//    256-table (assembly definition) with mask values for mode 0 using pen 15 as transparent
//
#define CPCTM_MASKTABLE15M0 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x00, 0xAA, 0xAA \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x55, 0x00, 0x55 \
      .db 0x00, 0x00, 0xAA, 0xAA, 0x00, 0x55, 0xAA, 0xFF

#endif

//#include "transparency_tables_m1.h"
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
//-------------------------------------------------------------------------------

#ifndef _TRANSPARENCY_TABLES_MODE1_H
#define _TRANSPARENCY_TABLES_MODE1_H

//----------------------------------------------------------------------------------------
// Title: Transparency Tables for Mode 1
//----------------------------------------------------------------------------------------

//
// Macro: CPCTM_MASKTABLE0M1
//    256-table (assembly definition) with mask values for mode 1 using pen 0 as transparent
//
#define CPCTM_MASKTABLE0M1 \
      .db 0xFF, 0xEE, 0xDD, 0xCC, 0xBB, 0xAA, 0x99, 0x88 \
      .db 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11, 0x00 \
      .db 0xEE, 0xEE, 0xCC, 0xCC, 0xAA, 0xAA, 0x88, 0x88 \
      .db 0x66, 0x66, 0x44, 0x44, 0x22, 0x22, 0x00, 0x00 \
      .db 0xDD, 0xCC, 0xDD, 0xCC, 0x99, 0x88, 0x99, 0x88 \
      .db 0x55, 0x44, 0x55, 0x44, 0x11, 0x00, 0x11, 0x00 \
      .db 0xCC, 0xCC, 0xCC, 0xCC, 0x88, 0x88, 0x88, 0x88 \
      .db 0x44, 0x44, 0x44, 0x44, 0x00, 0x00, 0x00, 0x00 \
      .db 0xBB, 0xAA, 0x99, 0x88, 0xBB, 0xAA, 0x99, 0x88 \
      .db 0x33, 0x22, 0x11, 0x00, 0x33, 0x22, 0x11, 0x00 \
      .db 0xAA, 0xAA, 0x88, 0x88, 0xAA, 0xAA, 0x88, 0x88 \
      .db 0x22, 0x22, 0x00, 0x00, 0x22, 0x22, 0x00, 0x00 \
      .db 0x99, 0x88, 0x99, 0x88, 0x99, 0x88, 0x99, 0x88 \
      .db 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00 \
      .db 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11, 0x00 \
      .db 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11, 0x00 \
      .db 0x66, 0x66, 0x44, 0x44, 0x22, 0x22, 0x00, 0x00 \
      .db 0x66, 0x66, 0x44, 0x44, 0x22, 0x22, 0x00, 0x00 \
      .db 0x55, 0x44, 0x55, 0x44, 0x11, 0x00, 0x11, 0x00 \
      .db 0x55, 0x44, 0x55, 0x44, 0x11, 0x00, 0x11, 0x00 \
      .db 0x44, 0x44, 0x44, 0x44, 0x00, 0x00, 0x00, 0x00 \
      .db 0x44, 0x44, 0x44, 0x44, 0x00, 0x00, 0x00, 0x00 \
      .db 0x33, 0x22, 0x11, 0x00, 0x33, 0x22, 0x11, 0x00 \
      .db 0x33, 0x22, 0x11, 0x00, 0x33, 0x22, 0x11, 0x00 \
      .db 0x22, 0x22, 0x00, 0x00, 0x22, 0x22, 0x00, 0x00 \
      .db 0x22, 0x22, 0x00, 0x00, 0x22, 0x22, 0x00, 0x00 \
      .db 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00 \
      .db 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE1M1
//    256-table (assembly definition) with mask values for mode 1 using pen 1 as transparent
//
#define CPCTM_MASKTABLE1M1 \
      .db 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77 \
      .db 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF \
      .db 0x00, 0x00, 0x22, 0x22, 0x44, 0x44, 0x66, 0x66 \
      .db 0x88, 0x88, 0xAA, 0xAA, 0xCC, 0xCC, 0xEE, 0xEE \
      .db 0x00, 0x11, 0x00, 0x11, 0x44, 0x55, 0x44, 0x55 \
      .db 0x88, 0x99, 0x88, 0x99, 0xCC, 0xDD, 0xCC, 0xDD \
      .db 0x00, 0x00, 0x00, 0x00, 0x44, 0x44, 0x44, 0x44 \
      .db 0x88, 0x88, 0x88, 0x88, 0xCC, 0xCC, 0xCC, 0xCC \
      .db 0x00, 0x11, 0x22, 0x33, 0x00, 0x11, 0x22, 0x33 \
      .db 0x88, 0x99, 0xAA, 0xBB, 0x88, 0x99, 0xAA, 0xBB \
      .db 0x00, 0x00, 0x22, 0x22, 0x00, 0x00, 0x22, 0x22 \
      .db 0x88, 0x88, 0xAA, 0xAA, 0x88, 0x88, 0xAA, 0xAA \
      .db 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11 \
      .db 0x88, 0x99, 0x88, 0x99, 0x88, 0x99, 0x88, 0x99 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88 \
      .db 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77 \
      .db 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77 \
      .db 0x00, 0x00, 0x22, 0x22, 0x44, 0x44, 0x66, 0x66 \
      .db 0x00, 0x00, 0x22, 0x22, 0x44, 0x44, 0x66, 0x66 \
      .db 0x00, 0x11, 0x00, 0x11, 0x44, 0x55, 0x44, 0x55 \
      .db 0x00, 0x11, 0x00, 0x11, 0x44, 0x55, 0x44, 0x55 \
      .db 0x00, 0x00, 0x00, 0x00, 0x44, 0x44, 0x44, 0x44 \
      .db 0x00, 0x00, 0x00, 0x00, 0x44, 0x44, 0x44, 0x44 \
      .db 0x00, 0x11, 0x22, 0x33, 0x00, 0x11, 0x22, 0x33 \
      .db 0x00, 0x11, 0x22, 0x33, 0x00, 0x11, 0x22, 0x33 \
      .db 0x00, 0x00, 0x22, 0x22, 0x00, 0x00, 0x22, 0x22 \
      .db 0x00, 0x00, 0x22, 0x22, 0x00, 0x00, 0x22, 0x22 \
      .db 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11 \
      .db 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00

//
// Macro: CPCTM_MASKTABLE2M1
//    256-table (assembly definition) with mask values for mode 1 using pen 2 as transparent
//
#define CPCTM_MASKTABLE2M1 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00 \
      .db 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00 \
      .db 0x22, 0x22, 0x00, 0x00, 0x22, 0x22, 0x00, 0x00 \
      .db 0x22, 0x22, 0x00, 0x00, 0x22, 0x22, 0x00, 0x00 \
      .db 0x33, 0x22, 0x11, 0x00, 0x33, 0x22, 0x11, 0x00 \
      .db 0x33, 0x22, 0x11, 0x00, 0x33, 0x22, 0x11, 0x00 \
      .db 0x44, 0x44, 0x44, 0x44, 0x00, 0x00, 0x00, 0x00 \
      .db 0x44, 0x44, 0x44, 0x44, 0x00, 0x00, 0x00, 0x00 \
      .db 0x55, 0x44, 0x55, 0x44, 0x11, 0x00, 0x11, 0x00 \
      .db 0x55, 0x44, 0x55, 0x44, 0x11, 0x00, 0x11, 0x00 \
      .db 0x66, 0x66, 0x44, 0x44, 0x22, 0x22, 0x00, 0x00 \
      .db 0x66, 0x66, 0x44, 0x44, 0x22, 0x22, 0x00, 0x00 \
      .db 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11, 0x00 \
      .db 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11, 0x00 \
      .db 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x99, 0x88, 0x99, 0x88, 0x99, 0x88, 0x99, 0x88 \
      .db 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00 \
      .db 0xAA, 0xAA, 0x88, 0x88, 0xAA, 0xAA, 0x88, 0x88 \
      .db 0x22, 0x22, 0x00, 0x00, 0x22, 0x22, 0x00, 0x00 \
      .db 0xBB, 0xAA, 0x99, 0x88, 0xBB, 0xAA, 0x99, 0x88 \
      .db 0x33, 0x22, 0x11, 0x00, 0x33, 0x22, 0x11, 0x00 \
      .db 0xCC, 0xCC, 0xCC, 0xCC, 0x88, 0x88, 0x88, 0x88 \
      .db 0x44, 0x44, 0x44, 0x44, 0x00, 0x00, 0x00, 0x00 \
      .db 0xDD, 0xCC, 0xDD, 0xCC, 0x99, 0x88, 0x99, 0x88 \
      .db 0x55, 0x44, 0x55, 0x44, 0x11, 0x00, 0x11, 0x00 \
      .db 0xEE, 0xEE, 0xCC, 0xCC, 0xAA, 0xAA, 0x88, 0x88 \
      .db 0x66, 0x66, 0x44, 0x44, 0x22, 0x22, 0x00, 0x00 \
      .db 0xFF, 0xEE, 0xDD, 0xCC, 0xBB, 0xAA, 0x99, 0x88 \
      .db 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11, 0x00

//
// Macro: CPCTM_MASKTABLE3M1
//    256-table (assembly definition) with mask values for mode 1 using pen 3 as transparent
//
#define CPCTM_MASKTABLE3M1 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11 \
      .db 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11 \
      .db 0x00, 0x00, 0x22, 0x22, 0x00, 0x00, 0x22, 0x22 \
      .db 0x00, 0x00, 0x22, 0x22, 0x00, 0x00, 0x22, 0x22 \
      .db 0x00, 0x11, 0x22, 0x33, 0x00, 0x11, 0x22, 0x33 \
      .db 0x00, 0x11, 0x22, 0x33, 0x00, 0x11, 0x22, 0x33 \
      .db 0x00, 0x00, 0x00, 0x00, 0x44, 0x44, 0x44, 0x44 \
      .db 0x00, 0x00, 0x00, 0x00, 0x44, 0x44, 0x44, 0x44 \
      .db 0x00, 0x11, 0x00, 0x11, 0x44, 0x55, 0x44, 0x55 \
      .db 0x00, 0x11, 0x00, 0x11, 0x44, 0x55, 0x44, 0x55 \
      .db 0x00, 0x00, 0x22, 0x22, 0x44, 0x44, 0x66, 0x66 \
      .db 0x00, 0x00, 0x22, 0x22, 0x44, 0x44, 0x66, 0x66 \
      .db 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77 \
      .db 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77 \
      .db 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 \
      .db 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88, 0x88 \
      .db 0x00, 0x11, 0x00, 0x11, 0x00, 0x11, 0x00, 0x11 \
      .db 0x88, 0x99, 0x88, 0x99, 0x88, 0x99, 0x88, 0x99 \
      .db 0x00, 0x00, 0x22, 0x22, 0x00, 0x00, 0x22, 0x22 \
      .db 0x88, 0x88, 0xAA, 0xAA, 0x88, 0x88, 0xAA, 0xAA \
      .db 0x00, 0x11, 0x22, 0x33, 0x00, 0x11, 0x22, 0x33 \
      .db 0x88, 0x99, 0xAA, 0xBB, 0x88, 0x99, 0xAA, 0xBB \
      .db 0x00, 0x00, 0x00, 0x00, 0x44, 0x44, 0x44, 0x44 \
      .db 0x88, 0x88, 0x88, 0x88, 0xCC, 0xCC, 0xCC, 0xCC \
      .db 0x00, 0x11, 0x00, 0x11, 0x44, 0x55, 0x44, 0x55 \
      .db 0x88, 0x99, 0x88, 0x99, 0xCC, 0xDD, 0xCC, 0xDD \
      .db 0x00, 0x00, 0x22, 0x22, 0x44, 0x44, 0x66, 0x66 \
      .db 0x88, 0x88, 0xAA, 0xAA, 0xCC, 0xCC, 0xEE, 0xEE \
      .db 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77 \
      .db 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF

#endif


//
// Macro: cpctm_createTransparentMaskTable
//
//    Creates a 256-bytes look-up table for drawing standard screen pixel formatted 
// sprites using a given colour index as transparent.
//
// C Definition:
//    #define <cpctm_createTransparentMaskTable> (*TABLENAME*, *ADDRESS*, *MODE*, *PEN*)
//
// Parameters:
//    TABLENAME - C-identifier to be used as name for this table
//    ADDRESS   - Memory address where the start of the table will be located. Take special 
// care with this value not to overlap other parts of the code.
//    MODE      - It must be either *M0* or *M1* (M capital)
//    PEN       - It must be a *decimal* value from 0 to 15 (from 0 to 3 for mode 1) *without*
// *trailing zeros*.
// 
// Known limitations:
//    * This macro may be used several times in different files, resulting in several copies 
// of a same table in memory. There is no way to prevent this, so take care when using this 
// macro several times: be sure of what you want to do.
//    * Any *ADDRESS* value may be used, even addresses that overlap with other parts of your
// own code or data. If this was the case, compiler will complain with "Overlapped record" 
// messages. Take this into account to move your data accordingly, as 2 values cannot share the
// same memory location.
//    * Most of the time, you will require this table to be *memory aligned*. As this table
// takes 256 bytes, it only will be aligned if you place it at any 0x??00 location. If any 
// of the last 2 digits from your 4-digit address is not 0, your table will not be 256-byte aligned.
//
// Size:
//    256 (0x100) bytes
//
// Details:
//    This macro generates a dummy __naked function called dummy_cpct_transparentMaskTable<PEN><MODE>_container
// (without the < > signs, as <PEN> and <MODE> are placeholders for parameters given). The function 
// created contains absolute location assembly code along with the definition of a 256-bytes array (the 
// conversion table) with mask values to be used for generating transparencies out of normal screen
// pixel format values.
//
//    This table will be used by functions like <cpct_drawSpriteMaskedAlignedTable> to make normal sprites
// transparent. The technique is simple: one colour index is considered as transparent. Therefore, pixels
// of this colour form a mask that is used to remove them from the sprite and background. Then, after
// removing transparent pixels, a mixing operation is performed, and the sprite is drawn like if it 
// had an interlaced mask. With this technique, normal sprites may be used as transparent, at the 
// cost of losing one colour. 
//
// Use example:
//    In a mode 0 pirates game, we have three main characters, all of them pirates, that have 
// many animated sprites. These sprites are created in screen pixel format without interlaced
// masks to save a great amount of bytes. To draw these pirates and animations transparent,
// we use the colour 0 (palette index 0) as transparent. For that, we create the transparent
// mask table at a 256-byte aligned memory location (0x2100), and then use that table
// to draw the sprites with the function <cpct_drawSpriteMaskedAlignedTable>:
// (start code)
//    #include <cpctelera.h>
//
//    // Create a 256-byte aligned transparent mask table, for mode 0, 
//    // using palette colour index 0 as transparent
//    cpctm_createTransparentMaskTable(transparentMaskTable, 0x2100, M0, 0);
//
//    // Draws a pirate sprite at a given (X,Y) location as transparent 
//    // All pirates are same size, SPR_W: Sprite Width, SPR_H: Sprite Height
//    drawPirateTransparent(u8* sprite, x, y) {
//       u8* pmem;         // Pointer to video memory location where the pirate will be drawn
//       
//       // Calculate video memory location where to draw the pirate and draw it transparent
//       // Important: Remember that this drawing function requires sprites to be also memory-aligned!
//       pmem = cpct_getScreenPtr(CPCT_VMEM_START, x, y);
//       cpct_drawSpriteMaskedAlignedTable(sprite, pmem, SPR_W, SPR_H, transparentMaskTable);
//    }
// (end code)
//    This code creates the 256-byte table and includes it in the binary located at address 0x2100 
// (256-bytes aligned, from 0x2100 to 0x21FF, never changing the Most significant byte). Then, the
// function <cpct_drawSpriteMaskedAlignedTable> uses this table to draw pirate sprites as transparent,
// substituting colour 0 in the sprites by the background pixels. 
//
// General recommendations:
//    * Remember that locating items at a specific memory location is done writing them at a concrete
// location in the final binary, taking into account where it will be loaded. That can make the size
// of the final binary increase, and even overwrite parts of the memory you did not intended. For instance,
// imagine you have a binary with 1024 (0x400) bytes of code that you load at memory address 0x1000.
// That binary occupies memory from 0x1000 to 0x1400 when loaded. If you try to explicitly place 
// the transparent table at location 0x8000 in memory, what the compiler does is creating a 28K 
// binary, with code at first 1024 (0x400) bytes, 27K of zeros (from 0x1400 to 0x8000) and then 
// 256 (0x100) bytes with the table. That could erase unintended things in memory when loading.
//    * Always do your own calculations to prevent explicitly placing things overlapped. It is
// recommended that you put your explicitly located data items first, previous to the starting
// memory address of your program. That's easier to manage.
//
#define cpctm_createTransparentMaskTable(TABLENAME,ADDRESS,MODE,PEN) \
cpctm_declareMaskTable(TABLENAME); \
void dummy_cpct_transparentMaskTable ## PEN ## MODE ## _container() __naked { \
   __asm \
      .area _ ## TABLENAME ## _ (ABS) \
      .org ADDRESS \
      _ ## TABLENAME:: \
      CPCTM_MASKTABLE ## PEN ## MODE \
      .area _CSEG (REL, CON) \
   __endasm; \
} \
void dummy_cpct_transparentMaskTable ## PEN ## MODE ## _container() __naked

//
// Macro: cpctm_declareMaskTable
//
//    Declares a 256-bytes look-up table for drawing standard screen pixel formatted 
// sprites using a given colour index as transparent. It does not create the table:
// it only declares it to make it accessible from different code files.
//
// C Definition:
//    #define <cpctm_declareMaskTable> (*TABLENAME*)
//
// Parameters:
//    TABLENAME - C-identifier of the table to be declared
//
// Details:
//    This macro generates a declaration for the given *TABLENAME*. This declaration
// is normally expected to be included in a header file so that files including
// the header become able to access the table *TABLENAME*. *TABLENAME* gets
// declared as *extern* and will require to be defined in a source code file.
// If a table is declared using this macro but not defined using 
// <cpctm_createTransparentMaskTable>, a linker error will happen.
//
// Use example:
//    Imagine we have 3 source files and 1 header file: a.c, b.c, t.c and h.h. Both
// a.c and b.c make use of a transparency table named g_transparencyMaskTable, which
// is defined in t.c. For that to be possible, we declare the table in h.h this way:
// (start code)
//    // Include guards
//    #ifndef _H_H_
//    #define _H_H_
//
//    #include <cpctelera.h>
//
//    // Declare g_transparencyMaskTable, which is defined in t.c, and used
//    // in a.c and in b.c also.
//    cpctm_declareMaskTable(g_transparencyMaskTable);
//
//    #endif
// (end code)
//    With this declaration, a.c and b.c only have to include h.h to be able to access
// g_transparencyMaskTable, which is defined in t.c this way:
// (start code)
//    #include "h.h"
//
//    // Create transparency mask table for mode 1 and palette index 1, at address 0x100
//    cpctm_createTransparentMaskTable(g_transparencyMaskTable, 0x100, M1, 1);
// (end code)
//    Then, for instance, a.c. can make use of the table like in this example:
// (start code)
//    #include "h.h"
//
//    //.... code ....
//
//    // Function to draw a transparent sprite
//    drawMyTransparentSprite(u8* sprite, u8* mem_loc) {
//       // All sprites are same width and height
//       cpct_drawSpriteMaskedAlignedTable(sprite, mem_loc, WIDTH, HEIGHT, g_transparencyMaskTable);
//    }
// (end code)
//
#define cpctm_declareMaskTable(TABLENAME) extern const u8 TABLENAME[256]

#endif

// Functions to transform firmware colours for a group of pixels into a byte in screen pixel format
extern   u8 cpct_px2byteM0 (u8 px0, u8 px1) __z88dk_callee;
extern   u8 cpct_px2byteM1 (u8 px0, u8 px1, u8 px2, u8 px3);

// Tile drawing functions
extern void cpct_drawTileAligned2x8    (void *sprite, void* memory) __z88dk_callee;
extern void cpct_drawTileAligned4x8    (void *sprite, void* memory) __z88dk_callee;
extern void cpct_drawTileAligned2x4_f  (void *sprite, void* memory) __z88dk_callee;
extern void cpct_drawTileAligned2x8_f  (void *sprite, void* memory) __z88dk_callee;
extern void cpct_drawTileGrayCode2x8_af(void *sprite, void* memory) __z88dk_callee;
extern void cpct_drawTileAligned4x4_f  (void *sprite, void* memory) __z88dk_callee;
extern void cpct_drawTileAligned4x8_f  (void *sprite, void* memory) __z88dk_callee;

// Sprite and box drawing functions
extern void cpct_drawSprite          (void *sprite, void* memory, u8 width, u8 height) __z88dk_callee;
extern void cpct_drawSpriteMasked    (void *sprite, void* memory, u8 width, u8 height) __z88dk_callee;
extern void cpct_drawSpriteBlended   (void *memory, u8 height, u8 width, void *sprite) __z88dk_callee;
extern void cpct_drawSolidBox        (void *memory, u8 colour_pattern, u8 width, u8 height);
extern void cpct_drawSpriteMaskedAlignedTable(const void *psprite, void* pvideomem, 
                                              u8 width, u8 height, const void* pmasktable) __z88dk_callee;

// Sprite flipping functions
extern void cpct_hflipSpriteM0   (u8 width, u8 height, void* sprite) __z88dk_callee;
extern void cpct_hflipSpriteM1   (u8 width, u8 height, void* sprite) __z88dk_callee;
extern void cpct_hflipSpriteM2   (u8 width, u8 height, void* sprite) __z88dk_callee;

// Sprite flipping functions (ROM-friendly versions)
extern void cpct_hflipSpriteM0_r (void* sprite, u8 width, u8 height) __z88dk_callee;
extern void cpct_hflipSpriteM1_r (void* sprite, u8 width, u8 height) __z88dk_callee;
extern void cpct_hflipSpriteM2_r (void* sprite, u8 width, u8 height) __z88dk_callee;

// Masked Sprite flipping functions
extern void cpct_hflipSpriteMaskedM0(u8 width, u8 height, void* sprite) __z88dk_callee;
extern void cpct_hflipSpriteMaskedM1(u8 width, u8 height, void* sprite) __z88dk_callee;
extern void cpct_hflipSpriteMaskedM2(u8 width, u8 height, void* sprite) __z88dk_callee;

// Functions to modify behaviour of other functions
extern void cpct_setBlendMode (CPCT_BlendMode mode) __z88dk_fastcall;

#endif
//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
//  Copyright (C) 2014-2015 ronaldo / Fremos / Cheesetea / ByteRealms (@FranGallegoBR)
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
//-------------------------------------------------------------------------------

#ifndef CPCT_CHARACTERS_H
#define CPCT_CHARACTERS_H

//#include <types.h>

// Functions for drawing ROM Characters on Graphics Screen
extern void cpct_drawCharM0     (void* video_memory, u8 fg_pen, u8 bg_pen, u8 ascii);
extern void cpct_drawCharM1     (void* video_memory, u8 fg_pen, u8 bg_pen, u8 ascii);
extern void cpct_drawCharM1_f   (void* video_memory, u8 fg_pen, u8 bg_pen, u8 ascii);
extern void cpct_drawCharM2     (void* video_memory, u8 pen, u8 ascii);

// Functions for drawing Strings with ROM Characters on Graphics Sceen
extern void cpct_drawStringM0   (void* string, void* video_memory, u8 fg_pen, u8 bg_pen);
extern void cpct_drawStringM1   (void* string, void* video_memory, u8 fg_pen, u8 bg_pen);
extern void cpct_drawStringM1_f (void* string, void* video_memory, u8 fg_pen, u8 bg_pen);
extern void cpct_drawStringM2   (void* string, void* video_memory, u8 pen);

#endif
//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
//  Copyright (C) 2014-2016 ronaldo / Fremos / Cheesetea / ByteRealms (@FranGallegoBR)
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
//-------------------------------------------------------------------------------

#ifndef CPCT_VIDEOMODE_H
#define CPCT_VIDEOMODE_H

//#include <types.h>
//#include <memutils/memutils.h>
//#####################################################################
//### MODULE: Memutils                                              ###
//#####################################################################
//### Utilities to manage memory blocks                             ###
//#####################################################################
//

#ifndef CPCT_MEMUTILS_H
#define CPCT_MEMUTILS_H

//#include <types.h>
//#include "relocation.h"


//
// Title: Memory Relocation Utilities
//
// Utilities to locate or relocate things into memory, or to 
// establish memory location where to load different areas of a binary. 
//

#ifndef CPCT_RELOCATIONUTILS_H
#define CPCT_RELOCATIONUTILS_H

//#include <types.h>

// Useful macros to concatenate names of identifiers
#define CONCAT3(A, B, C)     A ## B ## C
#define NAMECONCAT3(A, B, C) CONCAT3(A, B, C)

//
// Macro: CPCT_ABSOLUTE_LOCATION_AREA
//
//    Macro that produces following code and data to be located at 
// given absolute memory location MEM. 
//
// C Definition:
//    #define <CPCT_ABSOLUTE_LOCATION_AREA> (*MEM*)
//
// Input Parameters (2 bytes):
//    (2B) MEM - Memory location where code produced next will be placed
//
// Parameter Restrictions:
//    * *MEM* could be any 16-bits value from 0x0000 to 0xFFFF. Passing
// any value lower than 0 or greater than 0xFFFF will produce unpredictable
// behaviour.
//
// Warnings:
//    * *MEM* should be different to any other *MEM* value used on previous
// calls to this macro.
//    * It is up to the programmer to locate code on available memory places.
// If *MEM* is not carefully selected, it could be placed overlapping other
// code segments. On this event, part of the code will be shadowed (it will
// never be loaded in memory) as it is impossible to load 2 values on the
// same memory cell.
//    * This macro should be used *outside* the scope of any function.
//    * This macro *should not be used to* set the code entry point (i.e. the
// place where compiler starts generating the code). For this purpose you 
// should used *Z80CODELOC* variable instead (located in cfg/build_config.mk).
//    * Beware when using this macro on files not containing code (only data, 
// like arrays, strings, etc.). In this case, if you use only once and previous
// to all data definitions, it would probably fail. This is due to the compiler
// adding an ".area _CODE" directive to files that do not contain functions.
// To overcome this problem you should add another macro at the end or 
// in the middle of the file. You can use <CPCT_ABSOLUTE_LOCATION_AREA> again
// or <CPCT_RELOCATABLE_AREA>, to prevent the compiler from rearranging your data.
// This is an example on how to do it:
// (start code)
//    // This is the start of a file called music.c
//    CPCT_ABSOLUTE_LOCATION_AREA(0x040);
//
//    // Music data gets located at 0x040
//    const u8 music_data[100] = { 0x41, 0x54, 0x31, .... };
//
//    // Failing to add a relocation macro here will produce 
//    // the compiler to add a ".area _CODE" directive before 
//    // music data. This happens in data-only files.
//    CPCT_RELOCATABLE_AREA();
//
//    // This is the end of the file music.c
// (end code)
// 
// Required memory:
//    1 byte
//
// Details:
//    This macro is used to change the location where subsequent code or
// data will be located when the binary gets loaded. All code or data
// written *after* the call to this macro will be loaded from *MEM* on.
//
//    An example of use of this macro would be as follows:
// (start code)
//    //
//    // .. previous code, dynamically placed in memory by the compiler
//    //
//
//    CPCT_ABSOLUTE_LOCATION_AREA(0x0040);
//
//    // 1000 bytes of music to be located staring at 0x0040
//    const u8 music_data[1000] = { 0x0A, 0x12, 0x5F, 
//    // .....
//    }
//    
//    CPCT_ABSOLUTE_LOCATION_AREA(0x8000);
//
//    // Function code will be placed at 0x8000
//    void game_loop(u8 parameter) {
//       // function code...   
//    }
// (end code)
//    Several absolutely located code areas may be created, but they 
// should be placed at different memory locations.
//
//    This macro creates dummy functions and produces assembly code
// for relocation inside these dummy functions. These functions are
// not to be called by any means, nor it is required; they are required
// as the compiler prevents directives from being entered outside function
// scope. These functions are named as /dummy_absolute_MEM/ and 
// /dummy_data_absorber_MEM/ and they cannot be duplicated, as they are 
// proper functions for the compiler. 
//
//    /dummy_data_absorber_MEM/ function is generated first, and its 
// purpose is to make all previous data definitions (arrays, strings, etc)
// to be "absorbed". With this function being defined, previous data 
// gets placed by the compiler at the end of this "absorber" function, 
// just before the new absolutely located area definition, as wanted.
// This function only contains a RET statement, and takes up 1 byte of
// space in the final binary. As this function is dummy and gets never
// called, this additional byte can be safely removed or overlapped if
// required. This may by done by placing next absolutely located area
// exactly where this byte lies, or by editing produced assembly code
// and removing the RET statement before compiling. Do these operations
// only if you know exactly what you are doing.
//
#define CPCT_ABSOLUTE_LOCATION_AREA(MEM) \
void dummy_data_absorber##MEM (void) {} \
void dummy_absolute_##MEM (void) __naked { \
  __asm \
    .area _ ## MEM ## _ (ABS) \
    .org MEM \
  __endasm; \
} \
void dummy_absolute_##MEM (void) __naked

//
// Macro: CPCT_RELOCATABLE_AREA
//
//    Macro that produces following code to be automatically distributed
// by the linker amongst available memory space area, starting in the
// loading location defined by Z80CODELOC (see cfg/build_config.mk file)
//
// C Definition:
//    #define <CPCT_RELOCATABLE_AREA> (*ID*)
//
// Input Parameters (identifier):
//    (identifier) ID - An *optional* identifier to distinguish container
// functions for relative location areas.
//
// Parameter Restrictions:
//    * *ID* could be any valid identifier of, at most, 16 characters length.
// This identifier is optional, and only required when name collisions do
// appear.
//
// Warnings:
//    * *ID* parameter is not mandatory, but optional.
//    * This macro should be used *outside* the scope of any function.
//    * Read section *Details* if you have compilation problems using this
// macro. There are possible issues when using the macro across different
// source files.
//
// Required memory:
//    1 byte
//
// Details:
//    This macro restores normal code location behaviour. This normal behaviour
// sets the linker to decide where should code and data be placed, inside
// the relative code area. Relative code area starts at the binary loading
// point (Z80CODELOC) and extends from there to the end of memory. Starting
// place for this code area can be changed at compile-time by editing
// the file cfg/build_config.mk of your CPCtelera project, and assigning
// desired memory location to Z80CODELOC variable.
//
//    Every time this macro is called, following code will be added to the
// general _CODE area. This area is the global relocatable area. This means
// that all the code contained in this area can be relocated as linker considers.
//
//    An example of use of this macro would be as follows:
// (start code)
//    //
//    // First part of a C file. All code is added to _CODE area by
//    // default, and located by the linker from Z80CODELOC onwards.
//    // So, following code will be relocated by the linker as required.
//    //
//    void drawCompound(u8* sprite) {
//       // .. Code for drawing a compound. Compiled code
//       // .. will be placed by the linker in the _CODE area, 
//       // .. from Z80CODELOC onwards
//    }
//
//    CPCT_ABSOLUTE_LOCATION_AREA(0x0040);
//
//    //
//    // .. This array of data will be placed at 0x0040 absolute location onwards
//    // 
//    const u8 music_data[1000] = { 0x0A, 0x12, 0x5F, 
//       // .. 1000 bytes of data
//    };
//    
//    CPCT_RELOCATABLE_AREA();
//
//    // 
//    // Next data and functions will be added to the _CODE area, 
//    // same as the drawCompound function. All will be placed by 
//    // the linker as it considers, inside the relocatable area 
//    // that starts at Z80CODELOC
//    //
//    const u8 character_info[5] = { 10, 52, 100, -1, 3 };
//    void game_loop(u8 parameter) {
//       // function code...
//    }
//
//    CPCT_ABSOLUTE_LOCATION_AREA(0x1040);
//
//    //
//    // Next code will be placed from 0x1040 onwards, just after
//    // music data (ensuring that it is not overlapped)
//    // 
//    void playMusic() {
//       // function code...
//    }
//
//    CPCT_RELOCATABLE_AREA();
//
//    // Main function will be placed in relative _CODE area managed
//    // by the linker. 
//    void main() {
//       // main code
//    }
//
// (end code)
//
//    This macro may be used as many times as required. An indefinite
// number of code and data areas can be flagged as relative to be
// managed by the linker. 
//
//    This macro creates dummy functions and produces assembly code
// for relocation inside these dummy functions. These functions are
// not to be called by any means, nor it is required; they are required
// as the compiler prevents directives from being entered outside function
// scope. These functions are named as /dummy_relative___LINE__ID/ and 
// /dummy_data_absorber___LINE__ID/ and they cannot be duplicated, 
// as they are proper functions for the compiler. 
//
//    /dummy_data_absorber___LINE__ID/ function is generated first, and its 
// purpose is to make all previous data definitions (arrays, strings, etc)
// to be "absorbed". With this function being defined, previous data 
// gets placed by the compiler at the end of this "absorber" function, 
// just before the new absolutely located area definition, as wanted.
// This function only contains a RET statement, and takes up 1 byte of
// space in the final binary. As this function is dummy and gets never
// called, this additional byte can be safely removed or overlapped if
// required. This may by done by placing next absolutely located area
// exactly where this byte lies, or by editing produced assembly code
// and removing the RET statement before compiling. Do these operations
// only if you know exactly what you are doing.
//
//    When using this macro on different source code files, a compilation
// error may arise. On the event of having 2 uses of this macro, on
// the same source code line number, but in different files, they will
// produce the same function name, unless different IDs are provided. 
// In this case, a compilation error will happen. There are 2 possible
// solutions,
//    -  Add source code lines to place macros at different source code lines
//    -  Add 2 different IDs on the call to <CPCT_RELOCATABLE_AREA> (ID).
// This will prevent names from clashing.
//
#define CPCT_RELOCATABLE_AREA(FNAME) \
void NAMECONCAT3(dummy_data_absorber_, __LINE__, FNAME) (void) {} \
void NAMECONCAT3(dummy_relocatable_, __LINE__, FNAME) (void) __naked { \
  __asm \
    .area _CSEG (REL, CON) \
  __endasm; \
} \
void NAMECONCAT3(dummy_relocatable_, __LINE__, FNAME) (void) __naked

#endif

//#include "banks.h"
//
// Title: Memory Pagination Utilities
//
// Constants to paginate memory
//

#ifndef CPCT_BANKING_H
#define CPCT_BANKING_H

// Info from http://www.cpcwiki.eu/index.php/Gate_Array#Register_3_-_RAM_Banking
// Memory banking is done in the CPC by using the Register 3 in the Gate Array.
// The memory configuration is defined by specifiying which bank of 64 kb to use as, 
// additional memory, and a memory layout (how the low 64 kb and the selected additional 
// 64kb are mapped to the low 64kb address range).
// Those two parameters are specified as groups of three bits in register 3 of the
// Gate Array.
// 
// Bit	Value	Function
// 7	1	Gate Array function 3
// 6	1
// 5	b	64K bank number (0..7); always 0 on an unexpanded CPC6128, 0-7 on Standard Memory Expansions
// 4	b
// 3	b
// 2	x	RAM Config (0..7)
// 1	x
// 0	x

#define BANK_NUM_SHIFT 3

// BANK NUMBERS:
// As these constants are specified in bits 3-5, the constants are 
// shifted so that they can be OR'd with the RAM configuration parameter.

// BANK_0: RAM_4 -> 10000-13FFF, RAM_5 -> 14000-17FFF, RAM_6 -> 18000-1BFFF, RAM_7 -> 1C000-1FFFF
#define BANK_0 (0 << BANK_NUM_SHIFT)
// BANK_1: RAM_4 -> 20000-23FFF, RAM_5 -> 24000-27FFF, RAM_6 -> 28000-1BFFF, RAM_7 -> 2C000-1FFFF
#define BANK_1 (1 << BANK_NUM_SHIFT)
// BANK_2: RAM_4 -> 30000-33FFF, RAM_5 -> 34000-37FFF, RAM_6 -> 38000-3BFFF, RAM_7 -> 3C000-3FFFF
#define BANK_2 (2 << BANK_NUM_SHIFT)
// BANK_3: RAM_4 -> 40000-43FFF, RAM_5 -> 44000-47FFF, RAM_6 -> 48000-4BFFF, RAM_7 -> 4C000-4FFFF
#define BANK_3 (3 << BANK_NUM_SHIFT)
// BANK_4: RAM_4 -> 50000-53FFF, RAM_5 -> 54000-57FFF, RAM_6 -> 58000-5BFFF, RAM_7 -> 5C000-5FFFF
#define BANK_4 (4 << BANK_NUM_SHIFT)
// BANK_5: RAM_4 -> 60000-63FFF, RAM_5 -> 64000-67FFF, RAM_6 -> 68000-6BFFF, RAM_7 -> 6C000-6FFFF
#define BANK_5 (5 << BANK_NUM_SHIFT)
// BANK_6: RAM_4 -> 70000-73FFF, RAM_5 -> 74000-77FFF, RAM_6 -> 78000-7BFFF, RAM_7 -> 7C000-7FFFF
#define BANK_6 (6 << BANK_NUM_SHIFT)
// BANK_7: RAM_4 -> 80000-83FFF, RAM_5 -> 84000-87FFF, RAM_6 -> 88000-8BFFF, RAM_7 -> 8C000-8FFFF
#define BANK_7 (7 << BANK_NUM_SHIFT)

// RAM CONFIGURATIONS:
// Specify which 16kb pages are mapped to each page in the addresable RAM range.

// RAMCFG_0: 0000-3FFF -> RAM_0, 4000-7FFF -> RAM_1, 8000-BFFF -> RAM_2, C000-FFFF -> RAM_3
// Only the lower 64kb are accessible.
#define RAMCFG_0 0
// RAMCFG_1: 0000-3FFF -> RAM_0, 4000-7FFF -> RAM_1, 8000-BFFF -> RAM_2, C000-FFFF -> RAM_7
#define RAMCFG_1 1
// RAMCFG_2: 0000-3FFF -> RAM_4, 4000-7FFF -> RAM_5, 8000-BFFF -> RAM_6, C000-FFFF -> RAM_7
#define RAMCFG_2 2
// RAMCFG_3: 0000-3FFF -> RAM_0, 4000-7FFF -> RAM_3, 8000-BFFF -> RAM_2, C000-FFFF -> RAM_7
#define RAMCFG_3 3
// RAMCFG_4: 0000-3FFF -> RAM_0, 4000-7FFF -> RAM_4, 8000-BFFF -> RAM_2, C000-FFFF -> RAM_3
#define RAMCFG_4 4
// RAMCFG_5: 0000-3FFF -> RAM_0, 4000-7FFF -> RAM_5, 8000-BFFF -> RAM_2, C000-FFFF -> RAM_3
#define RAMCFG_5 5
// RAMCFG_6: 0000-3FFF -> RAM_0, 4000-7FFF -> RAM_6, 8000-BFFF -> RAM_2, C000-FFFF -> RAM_3
#define RAMCFG_6 6
// RAMCFG_7: 0000-3FFF -> RAM_0, 4000-7FFF -> RAM_7, 8000-BFFF -> RAM_2, C000-FFFF -> RAM_3
#define RAMCFG_7 7

// The default memory configuration uses the standard upper 64kb RAM
// but it is not addressable, as the RAM configuration has mapped only 
// the lower 64kb.
#define DEFAULT_MEM_CFG RAMCFG_0 | BANK_0

#endif


// Standard memory management functions
extern void cpct_memset    (void *array, u8  value, u16 size) __z88dk_callee;
extern void cpct_memset_f8 (void *array, u16 value, u16 size) __z88dk_callee;
extern void cpct_memset_f64(void *array, u16 value, u16 size) __z88dk_callee;
extern void cpct_memcpy    (void *to, const void *from, u16 size) __z88dk_callee;

// Stack manipulation
extern void cpct_setStackLocation(void *memory) __z88dk_fastcall;

// Memory pagination
extern void cpct_pageMemory(u8 configAndBankValue) __z88dk_fastcall;

// Macro to check conditions at compile time and issue errors
#define BUILD_BUG_ON(condition) ((void)sizeof(char[2 - 2*!!(condition)]))

#endif


//#include "colours.h"
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
//-------------------------------------------------------------------------------

#ifndef CPCT_COLOURS_H
#define CPCT_COLOURS_H

// File: Colours
//
//    Constants and utilities to manage the 27 colours from
// the CPC Palette comfortably.
//

// enum: CPCT_FW_Colour
//
//    Enumerates all 27 firmware colours
//
// Values:
// (start code)
//   [=================================================]
//   | Identifier        | Val| Identifier        | Val|
//   |-------------------------------------------------|
//   | FW_BLACK          |  0 | FW_BLUE           |  1 |
//   | FW_BRIGHT_BLUE    |  2 | FW_RED            |  3 |
//   | FW_MAGENTA        |  4 | FW_MAUVE          |  5 |
//   | FW_BRIGHT_RED     |  6 | FW_PURPLE         |  7 |
//   | FW_BRIGHT_MAGENTA |  8 | FW_GREEN          |  9 |
//   | FW_CYAN           | 10 | FW_SKY_BLUE       | 11 |
//   | FW_YELLOW         | 12 | FW_WHITE          | 13 |
//   | FW_PASTEL_BLUE    | 14 | FW_ORANGE         | 15 |
//   | FW_PINK           | 16 | FW_PASTEL_MAGENTA | 17 |
//   | FW_BRIGHT_GREEN   | 18 | FW_SEA_GREEN      | 19 |
//   | FW_BRIGHT_CYAN    | 20 | FW_LIME           | 21 |
//   | FW_PASTEL_GREEN   | 22 | FW_PASTEL_CYAN    | 23 |
//   | FW_BRIGHT_YELLOW  | 24 | FW_PASTEL_YELLOW  | 25 |
//   | FW_BRIGHT_WHITE   | 26 |                   |    |
//   [=================================================]
//(end code)
//
enum CPCT_FW_Colour {
     FW_BLACK          =  0 , FW_BLUE           =  1
   , FW_BRIGHT_BLUE    =  2 , FW_RED            =  3
   , FW_MAGENTA        =  4 , FW_MAUVE          =  5
   , FW_BRIGHT_RED     =  6 , FW_PURPLE         =  7
   , FW_BRIGHT_MAGENTA =  8 , FW_GREEN          =  9
   , FW_CYAN           = 10 , FW_SKY_BLUE       = 11
   , FW_YELLOW         = 12 , FW_WHITE          = 13
   , FW_PASTEL_BLUE    = 14 , FW_ORANGE         = 15
   , FW_PINK           = 16 , FW_PASTEL_MAGENTA = 17
   , FW_BRIGHT_GREEN   = 18 , FW_SEA_GREEN      = 19
   , FW_BRIGHT_CYAN    = 20 , FW_LIME           = 21
   , FW_PASTEL_GREEN   = 22 , FW_PASTEL_CYAN    = 23
   , FW_BRIGHT_YELLOW  = 24 , FW_PASTEL_YELLOW  = 25
   , FW_BRIGHT_WHITE   = 26
};

// enum: CPCT_HW_Colour
//
//    Enumerates all 27 hardware colours
//
// Values:
// (start code)
//   [=====================================================]
//   | Identifier        | Value| Identifier        | Value|
//   |-----------------------------------------------------|
//   | HW_BLACK          | 0x14 | HW_BLUE           | 0x04 |
//   | HW_BRIGHT_BLUE    | 0x15 | HW_RED            | 0x1C |
//   | HW_MAGENTA        | 0x18 | HW_MAUVE          | 0x1D |
//   | HW_BRIGHT_RED     | 0x0C | HW_PURPLE         | 0x05 |
//   | HW_BRIGHT_MAGENTA | 0x0D | HW_GREEN          | 0x16 |
//   | HW_CYAN           | 0x06 | HW_SKY_BLUE       | 0x17 |
//   | HW_YELLOW         | 0x1E | HW_WHITE          | 0x00 |
//   | HW_PASTEL_BLUE    | 0x1F | HW_ORANGE         | 0x0E |
//   | HW_PINK           | 0x07 | HW_PASTEL_MAGENTA | 0x0F |
//   | HW_BRIGHT_GREEN   | 0x12 | HW_SEA_GREEN      | 0x02 |
//   | HW_BRIGHT_CYAN    | 0x13 | HW_LIME           | 0x1A |
//   | HW_PASTEL_GREEN   | 0x19 | HW_PASTEL_CYAN    | 0x1B |
//   | HW_BRIGHT_YELLOW  | 0x0A | HW_PASTEL_YELLOW  | 0x03 |
//   | HW_BRIGHT_WHITE   | 0x0B |                   |      |
//   [=====================================================]
//(end code)
//
enum CPCT_HW_Colour {
     HW_BLACK          = 0x14 , HW_BLUE           = 0x04
   , HW_BRIGHT_BLUE    = 0x15 , HW_RED            = 0x1C
   , HW_MAGENTA        = 0x18 , HW_MAUVE          = 0x1D
   , HW_BRIGHT_RED     = 0x0C , HW_PURPLE         = 0x05
   , HW_BRIGHT_MAGENTA = 0x0D , HW_GREEN          = 0x16
   , HW_CYAN           = 0x06 , HW_SKY_BLUE       = 0x17
   , HW_YELLOW         = 0x1E , HW_WHITE          = 0x00
   , HW_PASTEL_BLUE    = 0x1F , HW_ORANGE         = 0x0E
   , HW_PINK           = 0x07 , HW_PASTEL_MAGENTA = 0x0F
   , HW_BRIGHT_GREEN   = 0x12 , HW_SEA_GREEN      = 0x02
   , HW_BRIGHT_CYAN    = 0x13 , HW_LIME           = 0x1A
   , HW_PASTEL_GREEN   = 0x19 , HW_PASTEL_CYAN    = 0x1B
   , HW_BRIGHT_YELLOW  = 0x0A , HW_PASTEL_YELLOW  = 0x03
   , HW_BRIGHT_WHITE   = 0x0B
};

#endif

//#include "video_macros.h"
//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
//  Copyright (C) 2014-2016 ronaldo / Fremos / Cheesetea / ByteRealms (@FranGallegoBR)
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
//-------------------------------------------------------------------------------

#ifndef _CPCT_VIDEO_MACROS_H
#define _CPCT_VIDEO_MACROS_H

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////
// File: Useful Macros
////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////
// Group: Video memory manipulation
////////////////////////////////////////////////////////////////////////

//
// Constant: CPCT_VMEM_START
//
//    The address where screen video memory starts by default in the Amstrad CPC.
//
//    This address is exactly 0xC000, and this macro represents this number but
// automatically converted to <u8>* (Pointer to unsigned byte). You can use this
// macro for any function requiring the start of video memory, like 
// <cpct_getScreenPtr>.
//
#define CPCT_VMEM_START (u8*)0xC000

//
// Constants: Video Memory Pages
//
// Useful constants defining some typical Video Memory Pages to be used as 
// parameters for <cpct_setVideoMemoryPage>
//
// cpct_pageCO - Video Memory Page 0xC0 (0xC0··)
// cpct_page8O - Video Memory Page 0x80 (0x80··)
// cpct_page4O - Video Memory Page 0x40 (0x40··)
// cpct_page0O - Video Memory Page 0x00 (0x00··)
//
#define cpct_pageC0 0x30
#define cpct_page80 0x20
#define cpct_page40 0x10
#define cpct_page00 0x00

//
// Macro: cpct_memPage6
//
//    Macro that encodes a video memory page in the 6 Least Significant bits (LSb)
// of a byte, required as parameter for <cpct_setVideoMemoryPage>
//
// C Definition:
// #define <cpct_memPage6> (*PAGE*)
//
// Parameters (1 byte):
// (1B) PAGE - Video memory page wanted 
//
// Returns:
//  u8   - Video Memory Page encoded in the 6 LSb of the byte.
//
// Details:
//  This is just a macro that shifts *PAGE* 2 bits to the right, to leave it
// with just 6 significant bits. For more information, check functions
// <cpct_setVideoMemoryPage> and <cpct_setVideoMemoryOffset>.
//
#define cpct_memPage6(PAGE) ((PAGE) >> 2)

//
// Macro: cpctm_screenPtr
//
//    Macro that calculates the video memory location (byte pointer) of a 
// given pair of coordinates (*X*, *Y*)
//
// C Definition:
//    #define <cpctm_screenPtr> (*VMEM*, *X*, *Y*)
//
// Parameters:
//    (2B) VMEM - Start of video memory buffer where (*X*, *Y*) coordinates will be calculated
//    (1B) X    - X Coordinate of the video memory location *in bytes* (*BEWARE! NOT in pixels!*)
//    (1B) Y    - Y Coordinate of the video memory location in pixels / bytes (they are same amount)
//
// Parameter Restrictions:
//    * *VMEM* will normally be the start of the video memory buffer where you want to 
// draw something. It could theoretically be any 16-bits value. 
//    * *X* must be in the range [0-79] for normal screen sizes (modes 0,1,2). Screen is
// always 80 bytes wide in these modes and this function is byte-aligned, so you have to 
// give it a byte coordinate (*NOT a pixel one!*).
//    * *Y* must be in the range [0-199] for normal screen sizes (modes 0,1,2). Screen is 
// always 200 pixels high in these modes. Pixels and bytes always coincide in vertical
// resolution, so this coordinate is the same in bytes that in pixels.
//    * If you give incorrect values to this function, the returned pointer could
// point anywhere in memory. This function will not cause any damage by itself, 
// but you may destroy important parts of your memory if you use its result to 
// write to memory, and you gave incorrect parameters by mistake. Take always
// care.
//
// Returns:
//    void * - Pointer to the (*X*, *Y*) location in the video buffer that starts at *VMEM*
//
// Details:
//    This macro does the same calculation than the function <cpct_getScreenPtr>. However,
// as it is a macro, if all 3 parameters (*VMEM*, *X*, *Y*) are constants, the calculation
// will be done at compile-time. This will free the binary from code or data, just puting in
// the result of this calculation (2 bytes with the resulting address). It is highly 
// recommended to use this macro instead of the function <cpct_getScreenPtr> when values
// involved are all constant. 
//
//    Take care of using this macro with variable values. In this latest case, the compiler 
// will generate in-place code for doing the calculation. Therefore, that will take binary
// space for the code and CPU time for the calculation. Moreover, calculation will be slower
// than if it were done using <cpct_getScreenPtr> and code could be duplicated if this macro
// is used in several places. Therefore, for variable values, <cpct_getScreenPtr> is recommended.
//
//    Sum up of recommendations:
//    All constant values - Use this macro <cpctm_screenPtr>
//    Any variable value  - Use the function <cpct_getScreenPtr>
//
#define cpctm_screenPtr(VMEM,X,Y) (void*)((VMEM) + 80 * ((unsigned int)((Y) >> 3)) + 2048 * ((Y) & 7) + (X))

////////////////////////////////////////////////////////////////////////
// Group: Setting the border
////////////////////////////////////////////////////////////////////////

///
/// Macro: cpct_setBorder
///
///   Changes the colour of the screen border.
///
/// C Definition:
///   #define <cpct_setBorder> (HWC)  <cpct_setPALColour> (16, (HWC))
///
/// Input Parameters (1 Byte):
///   (1B) HWC - Hardware colour value for the screen border.
///
/// More information:
///   This is not a real function, but a C macro. Beware of using it along
/// with complex expressions or calculations, as it may expand in non-desired
/// ways.
///
///   For more information, check the real function <cpct_setPALColour>, which
/// is called when using *cpct_setBorderColour* (It is called using 16 as *pen*
/// argument, which identifies the border).
///
#define cpct_setBorder(HW_C) cpct_setPALColour(16, (HW_C))

////////////////////////////////////////////////////////////////////////
// Group: Clearing screen
////////////////////////////////////////////////////////////////////////

//
// Macro: cpct_clearScreen
//
//    Macro to simplify clearing the screen.
//
// C Definition:
//   #define <cpct_clearScreen> (*COL*)
//
// Parameters (1 byte):
//   (1B) COL - Colour pattern to be used for screen clearing. Typically, a 0x00 is used 
// to fill up all the screen with 0's (firmware colour 0). However, you may use it in 
// combination with <cpct_px2byteM0>, <cpct_px2byteM1> or a manually created colour pattern.
//
// Details:
//   Fills up all the standard screen (range [0xC000-0xFFFF]) with *COL* byte, the colour 
// pattern given. It uses <cpc_memset> to do the task, just filling up 16K bytes out of
// *COL* value, starting at 0xC000.
//
// Measures:
//    This function takes *98331 microseconds* to fill the screen.
//    This is *4.924 VSYNCs* on a 50Hz display.
//
#define cpct_clearScreen(COL) cpct_memset((void*)0xC000, (COL), 0x4000)

//
// Macro: cpct_clearScreen_f8
//
//    Macro to simplify clearing the screen: fast version (in chuncks of 8 bytes)
//
// C Definition:
//   #define <cpct_clearScreen_f8> (*COL*)
//
// Parameters (2 bytes):
//   (2B) COL - Colour pattern to be used for screen clearing. Typically, a 0x0000 is used 
// to fill up all the screen with 0's (firmware colour 0). However, you may use it in 
// combination with <cpct_px2byteM0>, <cpct_px2byteM1> or a manually created colour pattern.
// Take into account that CPC's memory access is little-endian: this means that using
// 0x1122 as colour pattern will fill up memory with the sequence 0x22, 0x11, 0x22, 0x11...
//
// Details:
//   Fills up all the standard screen (range [0xC000-0xFFFF]) with *COL* pair of bytes, the 
// colour pattern given. It uses <cpc_memset_f8> to do the task, just filling up 16K bytes out 
// of *COL* value, starting at 0xC000.
//
// Warning:
//   <cpc_memset_f8> disables interrupts and moves SP while operating. It also sets interrupts
// to enabled at its end, without taking into account its previous status. Take it into 
// account when using this macro.
//
// Measures:
//    This function takes *41036 microseconds* to fill the screen.
//    This is *2.086 VSYNCs* on a 50Hz display.
//
#define cpct_clearScreen_f8(COL) cpct_memset_f8((void*)0xC000, (COL), 0x4000)

//
// Macro: cpct_clearScreen_f64
//
//    Does exactly the same as <cpct_clearScreen_f8> but calling <cpct_memset_f64> instead
// of <cpct_memset_f8>. Therefore, it works in chuncks of 64 bytes, being a 33% faster. 
//
// C Definition:
//   #define <cpct_clearScreen_f64> (*COL*)
//
// Parameters (2 bytes):
//   (2B) COL - Colour pattern to be used for screen clearing. Typically, a 0x0000 is used 
// to fill up all the screen with 0's (firmware colour 0). However, you may use it in 
// combination with <cpct_px2byteM0>, <cpct_px2byteM1> or a manually created colour pattern.
// Take into account that CPC's memory access is little-endian: this means that using
// 0x1122 as colour pattern will fill up memory with the sequence 0x22, 0x11, 0x22, 0x11...
//
// Details:
//   Fills up all the standard screen (range [0xC000-0xFFFF]) with *COL* pair of bytes, the 
// colour pattern given. It uses <cpc_memset_f64> to do the task, just filling up 16K bytes out 
// of *COL* value, starting at 0xC000.
//
// Warning:
//   <cpc_memset_f64> disables interrupts and moves SP while operating. It also sets interrupts
// to enabled at its end, without taking into account its previous status. Take it into 
// account when using this macro.
//
// Measures:
//    This function takes *33843 microseconds* to fill the screen.
//    This is *1.721 VSYNCs* on a 50Hz display.
//
#define cpct_clearScreen_f64(COL) cpct_memset_f64((void*)0xC000, (COL), 0x4000)


#endif


// Setting Video Mode
extern void cpct_setVideoMode (u8 videoMode) __z88dk_fastcall;

// Waiting for VSYNC
extern void cpct_waitVSYNC    ();
extern  u16 cpct_count2VSYNC  ();

// Palette functions
extern void cpct_fw2hw        (void *fw_colour_array, u16 size) __z88dk_callee;
extern void cpct_setPalette   (u8* ink_array, u16 ink_array_size) __z88dk_callee;
extern   u8 cpct_getHWColour  (u16 firmware_colour) __z88dk_fastcall;
extern void cpct_setPALColour (u8 pen, u8 hw_ink) __z88dk_callee;

// Functions to modify video memory location
extern void cpct_setVideoMemoryPage   (u8 page_codified_in_6LSb) __z88dk_fastcall;
extern void cpct_setVideoMemoryOffset (u8 offset) __z88dk_fastcall;

// Using screen coordinates to get byte pointers
extern  u8* cpct_getScreenPtr (void* screen_start, u8 x, u8 y) __z88dk_callee;

#endif
//-----------------------------LICENSE NOTICE------------------------------------
//  This file is part of CPCtelera: An Amstrad CPC Game Engine
//  Copyright (C) 2009 Targhan / Arkos
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
//-------------------------------------------------------------------------------
//######################################################################
//### MODULE: Audio                                                  ###
//######################################################################
//### This module contains code for music and SFX players and other  ###
//### audio routines.                                                ###
//######################################################################
//
#ifndef CPCT_AUDIO_H
#define CPCT_AUDIO_H

//
// File: Audio Constants&Variables
//

//
// Arkos Player: full control version (without interrupts)
// 

// Arkos Player Music Control Functions
extern void cpct_akp_musicInit  (void* songdata);
extern void cpct_akp_musicPlay  ();
extern void cpct_akp_stop       ();

// Arkos Player Sound FX Control Functions (Only available if SFX is active)
extern void cpct_akp_SFXInit    (void* sfx_song_data);
extern void cpct_akp_SFXStopAll ();
extern void cpct_akp_SFXStop    (u8 stop_bitmask);
extern void cpct_akp_SFXPlay    (u8 sfx_num, u8 volume, u8 note, u8 speed, 
                                 u16 inverted_pitch, u8 channel_bitmask);
extern  u16 cpct_akp_SFXGetInstrument (u8 channel_bitmask);

// Arkos Player Fade in / out volume control (Only valid if Fades are active)
extern void cpct_akp_setFadeVolume(u8 volume);

//
// Variable: cpct_akp_digidrumStatus
//
//    This is an internal variable, updated by Arkos Tracker Player, 
// that is used by the player for signalling events to user code. You
// may read it at any time to know if any "event" has happened (as 
// signalled by the player) and then react accordingly. To know more,
// read about <Digidrums>.
// 
//
extern volatile  u8 cpct_akp_digidrumStatus;

//
// Variable: cpct_akp_songLoopTimes
//
//    This is an internal variable, updated by Arkos Tracker Player, 
// that contains the number of times the present song has looped. You
// may use it to know if a song has finished or if it has looped
// N times.
//
extern volatile  u8 cpct_akp_songLoopTimes;


// 
// Constants: Audio Channels (bitmasks)
//
//    Bitmask constants for referring to audio channels of the
// AY-3-8912 PSG chip.
//
//    AY_CHANNEL_A   - Audio Channel A (also referred as 0)
//    AY_CHANNEL_B   - Audio Channel B (also referred as 1)
//    AY_CHANNEL_C   - Audio Channel C (also referred as 2)
//    AY_CHANNEL_ALL - All audio channels (A, B & C)
//
#define AY_CHANNEL_A    0b00000001
#define AY_CHANNEL_B    0b00000010
#define AY_CHANNEL_C    0b00000100
#define AY_CHANNEL_ALL  0b00000111

#endif//-----------------------------LICENSE NOTICE------------------------------------
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
//-------------------------------------------------------------------------------

//
// Title: Random
//
#ifndef _CPCT_RANDOM_H_
#define _CPCT_RANDOM_H_

//#include "random_types.h"
#ifndef __RANDOM_TYPES__
#define __RANDOM_TYPES__

//
// Title: Defined Types
//    Types defined to be used with pseudo-random generator functions
//

////////////////////////////////////////////////////////////////////////////////////////
// Enum: GLFSR16_TAPSET
//
//    This enumeration hold sets of valid TAPS for generating complete pseudo-random
// sequences using 16-bits Galois LFSR method. There are 1024 different TAP sets 
// (GLFSR16_TAPSET_YYYY, with YYYY ranging from 0000 to 1023), each of them defining 
// a different traversal order for the pseudo-random number generator. All these 1024 
// traversal orders are guaranteed to generate sequences of 65535 pseudo-random numbers 
// without repetition.
//
//    Use this TAPSETS along with the function <cpct_setSeed_glfsr16> to select
// the traversal order for the 16-bits G-LFSR pseudo-random number generator. Default one
// is GLFSR16_TAPSET_1023. An example of setting a new traversal tapset could be
// this one:
// (start code)
//    // Set TAPSET 0020 as new traversal order for the pseudo-random
//    // number generator based on 16-bits Galois LFSR method.
//    cpct_setSeed_glfsr16(GLFSR16_TAPSET_0020);
// (end code)
////////////////////////////////////////////////////////////////////////////////////////
typedef enum GLFSR16_TAPSET {
     GLFSR16_TAPSET_0000 = 0xd008
   , GLFSR16_TAPSET_0001 = 0xca00
   , GLFSR16_TAPSET_0002 = 0xc801
   , GLFSR16_TAPSET_0003 = 0xc208
   , GLFSR16_TAPSET_0004 = 0xc120
   , GLFSR16_TAPSET_0005 = 0xc108
   , GLFSR16_TAPSET_0006 = 0xc042
   , GLFSR16_TAPSET_0007 = 0xc00a
   , GLFSR16_TAPSET_0008 = 0xb400
   , GLFSR16_TAPSET_0009 = 0xb010
   , GLFSR16_TAPSET_0010 = 0xa840
   , GLFSR16_TAPSET_0011 = 0xa440
   , GLFSR16_TAPSET_0012 = 0xa140
   , GLFSR16_TAPSET_0013 = 0xa108
   , GLFSR16_TAPSET_0014 = 0xa084
   , GLFSR16_TAPSET_0015 = 0x9c00
   , GLFSR16_TAPSET_0016 = 0x9840
   , GLFSR16_TAPSET_0017 = 0x9420
   , GLFSR16_TAPSET_0018 = 0x9120
   , GLFSR16_TAPSET_0019 = 0x9028
   , GLFSR16_TAPSET_0020 = 0x8940
   , GLFSR16_TAPSET_0021 = 0x8920
   , GLFSR16_TAPSET_0022 = 0x8610
   , GLFSR16_TAPSET_0023 = 0x8580
   , GLFSR16_TAPSET_0024 = 0x8540
   , GLFSR16_TAPSET_0025 = 0x8320
   , GLFSR16_TAPSET_0026 = 0xfc00
   , GLFSR16_TAPSET_0027 = 0xf480
   , GLFSR16_TAPSET_0028 = 0xf440
   , GLFSR16_TAPSET_0029 = 0xf280
   , GLFSR16_TAPSET_0030 = 0xf208
   , GLFSR16_TAPSET_0031 = 0xf104
   , GLFSR16_TAPSET_0032 = 0xf030
   , GLFSR16_TAPSET_0033 = 0xf024
   , GLFSR16_TAPSET_0034 = 0xf022
   , GLFSR16_TAPSET_0035 = 0xf00a
   , GLFSR16_TAPSET_0036 = 0xf009
   , GLFSR16_TAPSET_0037 = 0xeb00
   , GLFSR16_TAPSET_0038 = 0xea20
   , GLFSR16_TAPSET_0039 = 0xe980
   , GLFSR16_TAPSET_0040 = 0xe908
   , GLFSR16_TAPSET_0041 = 0xe881
   , GLFSR16_TAPSET_0042 = 0xe80c
   , GLFSR16_TAPSET_0043 = 0xe620
   , GLFSR16_TAPSET_0044 = 0xe444
   , GLFSR16_TAPSET_0045 = 0xe40c
   , GLFSR16_TAPSET_0046 = 0xe409
   , GLFSR16_TAPSET_0047 = 0xe380
   , GLFSR16_TAPSET_0048 = 0xe304
   , GLFSR16_TAPSET_0049 = 0xe2a0
   , GLFSR16_TAPSET_0050 = 0xe222
   , GLFSR16_TAPSET_0051 = 0xe209
   , GLFSR16_TAPSET_0052 = 0xe1c0
   , GLFSR16_TAPSET_0053 = 0xe1a0
   , GLFSR16_TAPSET_0054 = 0xe184
   , GLFSR16_TAPSET_0055 = 0xe128
   , GLFSR16_TAPSET_0056 = 0xe0c1
   , GLFSR16_TAPSET_0057 = 0xe0a8
   , GLFSR16_TAPSET_0058 = 0xe08c
   , GLFSR16_TAPSET_0059 = 0xe08a
   , GLFSR16_TAPSET_0060 = 0xe085
   , GLFSR16_TAPSET_0061 = 0xe064
   , GLFSR16_TAPSET_0062 = 0xe058
   , GLFSR16_TAPSET_0063 = 0xe026
   , GLFSR16_TAPSET_0064 = 0xe01a
   , GLFSR16_TAPSET_0065 = 0xd904
   , GLFSR16_TAPSET_0066 = 0xd841
   , GLFSR16_TAPSET_0067 = 0xd828
   , GLFSR16_TAPSET_0068 = 0xd821
   , GLFSR16_TAPSET_0069 = 0xd809
   , GLFSR16_TAPSET_0070 = 0xd481
   , GLFSR16_TAPSET_0071 = 0xd2c0
   , GLFSR16_TAPSET_0072 = 0xd282
   , GLFSR16_TAPSET_0073 = 0xd260
   , GLFSR16_TAPSET_0074 = 0xd242
   , GLFSR16_TAPSET_0075 = 0xd224
   , GLFSR16_TAPSET_0076 = 0xd190
   , GLFSR16_TAPSET_0077 = 0xd160
   , GLFSR16_TAPSET_0078 = 0xd148
   , GLFSR16_TAPSET_0079 = 0xd144
   , GLFSR16_TAPSET_0080 = 0xd141
   , GLFSR16_TAPSET_0081 = 0xd0c2
   , GLFSR16_TAPSET_0082 = 0xd0a2
   , GLFSR16_TAPSET_0083 = 0xd094
   , GLFSR16_TAPSET_0084 = 0xd092
   , GLFSR16_TAPSET_0085 = 0xd086
   , GLFSR16_TAPSET_0086 = 0xd061
   , GLFSR16_TAPSET_0087 = 0xd04a
   , GLFSR16_TAPSET_0088 = 0xd019
   , GLFSR16_TAPSET_0089 = 0xd016
   , GLFSR16_TAPSET_0090 = 0xcca0
   , GLFSR16_TAPSET_0091 = 0xcc21
   , GLFSR16_TAPSET_0092 = 0xcc11
   , GLFSR16_TAPSET_0093 = 0xca82
   , GLFSR16_TAPSET_0094 = 0xca60
   , GLFSR16_TAPSET_0095 = 0xca48
   , GLFSR16_TAPSET_0096 = 0xca44
   , GLFSR16_TAPSET_0097 = 0xc982
   , GLFSR16_TAPSET_0098 = 0xc944
   , GLFSR16_TAPSET_0099 = 0xc941
   , GLFSR16_TAPSET_0100 = 0xc928
   , GLFSR16_TAPSET_0101 = 0xc918
   , GLFSR16_TAPSET_0102 = 0xc8d0
   , GLFSR16_TAPSET_0103 = 0xc8a1
   , GLFSR16_TAPSET_0104 = 0xc852
   , GLFSR16_TAPSET_0105 = 0xc846
   , GLFSR16_TAPSET_0106 = 0xc710
   , GLFSR16_TAPSET_0107 = 0xc648
   , GLFSR16_TAPSET_0108 = 0xc611
   , GLFSR16_TAPSET_0109 = 0xc606
   , GLFSR16_TAPSET_0110 = 0xc5c0
   , GLFSR16_TAPSET_0111 = 0xc530
   , GLFSR16_TAPSET_0112 = 0xc522
   , GLFSR16_TAPSET_0113 = 0xc498
   , GLFSR16_TAPSET_0114 = 0xc464
   , GLFSR16_TAPSET_0115 = 0xc3a0
   , GLFSR16_TAPSET_0116 = 0xc390
   , GLFSR16_TAPSET_0117 = 0xc360
   , GLFSR16_TAPSET_0118 = 0xc312
   , GLFSR16_TAPSET_0119 = 0xc30c
   , GLFSR16_TAPSET_0120 = 0xc2c2
   , GLFSR16_TAPSET_0121 = 0xc2b0
   , GLFSR16_TAPSET_0122 = 0xc294
   , GLFSR16_TAPSET_0123 = 0xc286
   , GLFSR16_TAPSET_0124 = 0xc268
   , GLFSR16_TAPSET_0125 = 0xc226
   , GLFSR16_TAPSET_0126 = 0xc1e0
   , GLFSR16_TAPSET_0127 = 0xc1c2
   , GLFSR16_TAPSET_0128 = 0xc1b0
   , GLFSR16_TAPSET_0129 = 0xc194
   , GLFSR16_TAPSET_0130 = 0xc164
   , GLFSR16_TAPSET_0131 = 0xc12a
   , GLFSR16_TAPSET_0132 = 0xc036
   , GLFSR16_TAPSET_0133 = 0xbd00
   , GLFSR16_TAPSET_0134 = 0xbc80
   , GLFSR16_TAPSET_0135 = 0xbc04
   , GLFSR16_TAPSET_0136 = 0xba80
   , GLFSR16_TAPSET_0137 = 0xba40
   , GLFSR16_TAPSET_0138 = 0xba08
   , GLFSR16_TAPSET_0139 = 0xb902
   , GLFSR16_TAPSET_0140 = 0xb8c0
   , GLFSR16_TAPSET_0141 = 0xb888
   , GLFSR16_TAPSET_0142 = 0xb830
   , GLFSR16_TAPSET_0143 = 0xb814
   , GLFSR16_TAPSET_0144 = 0xb812
   , GLFSR16_TAPSET_0145 = 0xb640
   , GLFSR16_TAPSET_0146 = 0xb580
   , GLFSR16_TAPSET_0147 = 0xb424
   , GLFSR16_TAPSET_0148 = 0xb302
   , GLFSR16_TAPSET_0149 = 0xb228
   , GLFSR16_TAPSET_0150 = 0xb1c0
   , GLFSR16_TAPSET_0151 = 0xb130
   , GLFSR16_TAPSET_0152 = 0xb118
   , GLFSR16_TAPSET_0153 = 0xb08c
   , GLFSR16_TAPSET_0154 = 0xb01c
   , GLFSR16_TAPSET_0155 = 0xae02
   , GLFSR16_TAPSET_0156 = 0xac44
   , GLFSR16_TAPSET_0157 = 0xac12
   , GLFSR16_TAPSET_0158 = 0xab10
   , GLFSR16_TAPSET_0159 = 0xa984
   , GLFSR16_TAPSET_0160 = 0xa930
   , GLFSR16_TAPSET_0161 = 0xa922
   , GLFSR16_TAPSET_0162 = 0xa8d0
   , GLFSR16_TAPSET_0163 = 0xa8a4
   , GLFSR16_TAPSET_0164 = 0xa892
   , GLFSR16_TAPSET_0165 = 0xa864
   , GLFSR16_TAPSET_0166 = 0xa852
   , GLFSR16_TAPSET_0167 = 0xa82c
   , GLFSR16_TAPSET_0168 = 0xa740
   , GLFSR16_TAPSET_0169 = 0xa590
   , GLFSR16_TAPSET_0170 = 0xa498
   , GLFSR16_TAPSET_0171 = 0xa454
   , GLFSR16_TAPSET_0172 = 0xa42c
   , GLFSR16_TAPSET_0173 = 0xa390
   , GLFSR16_TAPSET_0174 = 0xa350
   , GLFSR16_TAPSET_0175 = 0xa348
   , GLFSR16_TAPSET_0176 = 0xa322
   , GLFSR16_TAPSET_0177 = 0xa314
   , GLFSR16_TAPSET_0178 = 0xa2c4
   , GLFSR16_TAPSET_0179 = 0xa294
   , GLFSR16_TAPSET_0180 = 0xa270
   , GLFSR16_TAPSET_0181 = 0xa170
   , GLFSR16_TAPSET_0182 = 0xa154
   , GLFSR16_TAPSET_0183 = 0xa138
   , GLFSR16_TAPSET_0184 = 0xa0f0
   , GLFSR16_TAPSET_0185 = 0xa0cc
   , GLFSR16_TAPSET_0186 = 0xa0ac
   , GLFSR16_TAPSET_0187 = 0x9d04
   , GLFSR16_TAPSET_0188 = 0x9c90
   , GLFSR16_TAPSET_0189 = 0x9c24
   , GLFSR16_TAPSET_0190 = 0x9924
   , GLFSR16_TAPSET_0191 = 0x9894
   , GLFSR16_TAPSET_0192 = 0x96c0
   , GLFSR16_TAPSET_0193 = 0x96a0
   , GLFSR16_TAPSET_0194 = 0x9630
   , GLFSR16_TAPSET_0195 = 0x9584
   , GLFSR16_TAPSET_0196 = 0x9518
   , GLFSR16_TAPSET_0197 = 0x9514
   , GLFSR16_TAPSET_0198 = 0x94c4
   , GLFSR16_TAPSET_0199 = 0x9438
   , GLFSR16_TAPSET_0200 = 0x9388
   , GLFSR16_TAPSET_0201 = 0x9328
   , GLFSR16_TAPSET_0202 = 0x9158
   , GLFSR16_TAPSET_0203 = 0x90f0
   , GLFSR16_TAPSET_0204 = 0x90d8
   , GLFSR16_TAPSET_0205 = 0x8f10
   , GLFSR16_TAPSET_0206 = 0x8ec0
   , GLFSR16_TAPSET_0207 = 0x8e30
   , GLFSR16_TAPSET_0208 = 0x8b28
   , GLFSR16_TAPSET_0209 = 0x8ad0
   , GLFSR16_TAPSET_0210 = 0xfe08
   , GLFSR16_TAPSET_0211 = 0xfd80
   , GLFSR16_TAPSET_0212 = 0xfd20
   , GLFSR16_TAPSET_0213 = 0xfd10
   , GLFSR16_TAPSET_0214 = 0xfc82
   , GLFSR16_TAPSET_0215 = 0xfc12
   , GLFSR16_TAPSET_0216 = 0xfb10
   , GLFSR16_TAPSET_0217 = 0xfa11
   , GLFSR16_TAPSET_0218 = 0xf9c0
   , GLFSR16_TAPSET_0219 = 0xf941
   , GLFSR16_TAPSET_0220 = 0xf924
   , GLFSR16_TAPSET_0221 = 0xf922
   , GLFSR16_TAPSET_0222 = 0xf906
   , GLFSR16_TAPSET_0223 = 0xf889
   , GLFSR16_TAPSET_0224 = 0xf868
   , GLFSR16_TAPSET_0225 = 0xf834
   , GLFSR16_TAPSET_0226 = 0xf832
   , GLFSR16_TAPSET_0227 = 0xf826
   , GLFSR16_TAPSET_0228 = 0xf81c
   , GLFSR16_TAPSET_0229 = 0xf816
   , GLFSR16_TAPSET_0230 = 0xf688
   , GLFSR16_TAPSET_0231 = 0xf621
   , GLFSR16_TAPSET_0232 = 0xf618
   , GLFSR16_TAPSET_0233 = 0xf605
   , GLFSR16_TAPSET_0234 = 0xf590
   , GLFSR16_TAPSET_0235 = 0xf582
   , GLFSR16_TAPSET_0236 = 0xf548
   , GLFSR16_TAPSET_0237 = 0xf544
   , GLFSR16_TAPSET_0238 = 0xf530
   , GLFSR16_TAPSET_0239 = 0xf528
   , GLFSR16_TAPSET_0240 = 0xf521
   , GLFSR16_TAPSET_0241 = 0xf50c
   , GLFSR16_TAPSET_0242 = 0xf492
   , GLFSR16_TAPSET_0243 = 0xf491
   , GLFSR16_TAPSET_0244 = 0xf452
   , GLFSR16_TAPSET_0245 = 0xf44c
   , GLFSR16_TAPSET_0246 = 0xf419
   , GLFSR16_TAPSET_0247 = 0xf342
   , GLFSR16_TAPSET_0248 = 0xf321
   , GLFSR16_TAPSET_0249 = 0xf305
   , GLFSR16_TAPSET_0250 = 0xf303
   , GLFSR16_TAPSET_0251 = 0xf234
   , GLFSR16_TAPSET_0252 = 0xf225
   , GLFSR16_TAPSET_0253 = 0xf1b0
   , GLFSR16_TAPSET_0254 = 0xf1a8
   , GLFSR16_TAPSET_0255 = 0xf1a2
   , GLFSR16_TAPSET_0256 = 0xf146
   , GLFSR16_TAPSET_0257 = 0xf0e1
   , GLFSR16_TAPSET_0258 = 0xf0b2
   , GLFSR16_TAPSET_0259 = 0xf0a6
   , GLFSR16_TAPSET_0260 = 0xf099
   , GLFSR16_TAPSET_0261 = 0xf08b
   , GLFSR16_TAPSET_0262 = 0xf074
   , GLFSR16_TAPSET_0263 = 0xf059
   , GLFSR16_TAPSET_0264 = 0xf02d
   , GLFSR16_TAPSET_0265 = 0xf01b
   , GLFSR16_TAPSET_0266 = 0xef01
   , GLFSR16_TAPSET_0267 = 0xee48
   , GLFSR16_TAPSET_0268 = 0xee22
   , GLFSR16_TAPSET_0269 = 0xee0c
   , GLFSR16_TAPSET_0270 = 0xee06
   , GLFSR16_TAPSET_0271 = 0xed81
   , GLFSR16_TAPSET_0272 = 0xed0a
   , GLFSR16_TAPSET_0273 = 0xeca2
   , GLFSR16_TAPSET_0274 = 0xeca1
   , GLFSR16_TAPSET_0275 = 0xec85
   , GLFSR16_TAPSET_0276 = 0xec83
   , GLFSR16_TAPSET_0277 = 0xec68
   , GLFSR16_TAPSET_0278 = 0xec61
   , GLFSR16_TAPSET_0279 = 0xec4c
   , GLFSR16_TAPSET_0280 = 0xec1c
   , GLFSR16_TAPSET_0281 = 0xec13
   , GLFSR16_TAPSET_0282 = 0xeb0a
   , GLFSR16_TAPSET_0283 = 0xeac4
   , GLFSR16_TAPSET_0284 = 0xeac1
   , GLFSR16_TAPSET_0285 = 0xeaa4
   , GLFSR16_TAPSET_0286 = 0xea58
   , GLFSR16_TAPSET_0287 = 0xea4c
   , GLFSR16_TAPSET_0288 = 0xea2a
   , GLFSR16_TAPSET_0289 = 0xea0e
   , GLFSR16_TAPSET_0290 = 0xe94a
   , GLFSR16_TAPSET_0291 = 0xe946
   , GLFSR16_TAPSET_0292 = 0xe931
   , GLFSR16_TAPSET_0293 = 0xe926
   , GLFSR16_TAPSET_0294 = 0xe8c9
   , GLFSR16_TAPSET_0295 = 0xe8b8
   , GLFSR16_TAPSET_0296 = 0xe8a5
   , GLFSR16_TAPSET_0297 = 0xe896
   , GLFSR16_TAPSET_0298 = 0xe790
   , GLFSR16_TAPSET_0299 = 0xe782
   , GLFSR16_TAPSET_0300 = 0xe724
   , GLFSR16_TAPSET_0301 = 0xe709
   , GLFSR16_TAPSET_0302 = 0xe686
   , GLFSR16_TAPSET_0303 = 0xe651
   , GLFSR16_TAPSET_0304 = 0xe643
   , GLFSR16_TAPSET_0305 = 0xe632
   , GLFSR16_TAPSET_0306 = 0xe625
   , GLFSR16_TAPSET_0307 = 0xe613
   , GLFSR16_TAPSET_0308 = 0xe591
   , GLFSR16_TAPSET_0309 = 0xe58c
   , GLFSR16_TAPSET_0310 = 0xe58a
   , GLFSR16_TAPSET_0311 = 0xe570
   , GLFSR16_TAPSET_0312 = 0xe554
   , GLFSR16_TAPSET_0313 = 0xe549
   , GLFSR16_TAPSET_0314 = 0xe532
   , GLFSR16_TAPSET_0315 = 0xe529
   , GLFSR16_TAPSET_0316 = 0xe4d4
   , GLFSR16_TAPSET_0317 = 0xe4ca
   , GLFSR16_TAPSET_0318 = 0xe4c9
   , GLFSR16_TAPSET_0319 = 0xe4b1
   , GLFSR16_TAPSET_0320 = 0xe4aa
   , GLFSR16_TAPSET_0321 = 0xe4a5
   , GLFSR16_TAPSET_0322 = 0xe435
   , GLFSR16_TAPSET_0323 = 0xe3a1
   , GLFSR16_TAPSET_0324 = 0xe394
   , GLFSR16_TAPSET_0325 = 0xe332
   , GLFSR16_TAPSET_0326 = 0xe31c
   , GLFSR16_TAPSET_0327 = 0xe30d
   , GLFSR16_TAPSET_0328 = 0xe2e8
   , GLFSR16_TAPSET_0329 = 0xe2d8
   , GLFSR16_TAPSET_0330 = 0xe2a9
   , GLFSR16_TAPSET_0331 = 0xe299
   , GLFSR16_TAPSET_0332 = 0xe296
   , GLFSR16_TAPSET_0333 = 0xe274
   , GLFSR16_TAPSET_0334 = 0xe271
   , GLFSR16_TAPSET_0335 = 0xe26a
   , GLFSR16_TAPSET_0336 = 0xe23c
   , GLFSR16_TAPSET_0337 = 0xe1f0
   , GLFSR16_TAPSET_0338 = 0xe1e4
   , GLFSR16_TAPSET_0339 = 0xe1b8
   , GLFSR16_TAPSET_0340 = 0xe172
   , GLFSR16_TAPSET_0341 = 0xe14d
   , GLFSR16_TAPSET_0342 = 0xe12e
   , GLFSR16_TAPSET_0343 = 0xe0ec
   , GLFSR16_TAPSET_0344 = 0xe0e6
   , GLFSR16_TAPSET_0345 = 0xe0bc
   , GLFSR16_TAPSET_0346 = 0xe0ba
   , GLFSR16_TAPSET_0347 = 0xe079
   , GLFSR16_TAPSET_0348 = 0xe03d
   , GLFSR16_TAPSET_0349 = 0xdf10
   , GLFSR16_TAPSET_0350 = 0xde30
   , GLFSR16_TAPSET_0351 = 0xde14
   , GLFSR16_TAPSET_0352 = 0xde05
   , GLFSR16_TAPSET_0353 = 0xdd82
   , GLFSR16_TAPSET_0354 = 0xdd50
   , GLFSR16_TAPSET_0355 = 0xdd41
   , GLFSR16_TAPSET_0356 = 0xdd22
   , GLFSR16_TAPSET_0357 = 0xdd18
   , GLFSR16_TAPSET_0358 = 0xdd0a
   , GLFSR16_TAPSET_0359 = 0xdcc8
   , GLFSR16_TAPSET_0360 = 0xdc54
   , GLFSR16_TAPSET_0361 = 0xdc46
   , GLFSR16_TAPSET_0362 = 0xdc45
   , GLFSR16_TAPSET_0363 = 0xdc34
   , GLFSR16_TAPSET_0364 = 0xdc29
   , GLFSR16_TAPSET_0365 = 0xdc26
   , GLFSR16_TAPSET_0366 = 0xdc15
   , GLFSR16_TAPSET_0367 = 0xdc0d
   , GLFSR16_TAPSET_0368 = 0xdb88
   , GLFSR16_TAPSET_0369 = 0xdb48
   , GLFSR16_TAPSET_0370 = 0xdb12
   , GLFSR16_TAPSET_0371 = 0xda4c
   , GLFSR16_TAPSET_0372 = 0xda2a
   , GLFSR16_TAPSET_0373 = 0xda0e
   , GLFSR16_TAPSET_0374 = 0xda0d
   , GLFSR16_TAPSET_0375 = 0xd9a4
   , GLFSR16_TAPSET_0376 = 0xd9a2
   , GLFSR16_TAPSET_0377 = 0xd991
   , GLFSR16_TAPSET_0378 = 0xd989
   , GLFSR16_TAPSET_0379 = 0xd968
   , GLFSR16_TAPSET_0380 = 0xd92c
   , GLFSR16_TAPSET_0381 = 0xd926
   , GLFSR16_TAPSET_0382 = 0xd90d
   , GLFSR16_TAPSET_0383 = 0xd8f0
   , GLFSR16_TAPSET_0384 = 0xd8cc
   , GLFSR16_TAPSET_0385 = 0xd8c5
   , GLFSR16_TAPSET_0386 = 0xd8a9
   , GLFSR16_TAPSET_0387 = 0xd86c
   , GLFSR16_TAPSET_0388 = 0xd85c
   , GLFSR16_TAPSET_0389 = 0xd7a0
   , GLFSR16_TAPSET_0390 = 0xd70a
   , GLFSR16_TAPSET_0391 = 0xd6e0
   , GLFSR16_TAPSET_0392 = 0xd698
   , GLFSR16_TAPSET_0393 = 0xd689
   , GLFSR16_TAPSET_0394 = 0xd658
   , GLFSR16_TAPSET_0395 = 0xd646
   , GLFSR16_TAPSET_0396 = 0xd634
   , GLFSR16_TAPSET_0397 = 0xd60e
   , GLFSR16_TAPSET_0398 = 0xd5a8
   , GLFSR16_TAPSET_0399 = 0xd58c
   , GLFSR16_TAPSET_0400 = 0xd568
   , GLFSR16_TAPSET_0401 = 0xd561
   , GLFSR16_TAPSET_0402 = 0xd4d8
   , GLFSR16_TAPSET_0403 = 0xd4c5
   , GLFSR16_TAPSET_0404 = 0xd4a9
   , GLFSR16_TAPSET_0405 = 0xd4a6
   , GLFSR16_TAPSET_0406 = 0xd4a5
   , GLFSR16_TAPSET_0407 = 0xd49a
   , GLFSR16_TAPSET_0408 = 0xd499
   , GLFSR16_TAPSET_0409 = 0xd46a
   , GLFSR16_TAPSET_0410 = 0xd362
   , GLFSR16_TAPSET_0411 = 0xd352
   , GLFSR16_TAPSET_0412 = 0xd338
   , GLFSR16_TAPSET_0413 = 0xd331
   , GLFSR16_TAPSET_0414 = 0xd325
   , GLFSR16_TAPSET_0415 = 0xd31c
   , GLFSR16_TAPSET_0416 = 0xd316
   , GLFSR16_TAPSET_0417 = 0xd2d8
   , GLFSR16_TAPSET_0418 = 0xd2ac
   , GLFSR16_TAPSET_0419 = 0xd2aa
   , GLFSR16_TAPSET_0420 = 0xd29a
   , GLFSR16_TAPSET_0421 = 0xd274
   , GLFSR16_TAPSET_0422 = 0xd272
   , GLFSR16_TAPSET_0423 = 0xd23c
   , GLFSR16_TAPSET_0424 = 0xd1b2
   , GLFSR16_TAPSET_0425 = 0xd1a9
   , GLFSR16_TAPSET_0426 = 0xd199
   , GLFSR16_TAPSET_0427 = 0xd0ec
   , GLFSR16_TAPSET_0428 = 0xd07a
   , GLFSR16_TAPSET_0429 = 0xcf90
   , GLFSR16_TAPSET_0430 = 0xcf88
   , GLFSR16_TAPSET_0431 = 0xcf82
   , GLFSR16_TAPSET_0432 = 0xcf48
   , GLFSR16_TAPSET_0433 = 0xcf41
   , GLFSR16_TAPSET_0434 = 0xcf30
   , GLFSR16_TAPSET_0435 = 0xcea4
   , GLFSR16_TAPSET_0436 = 0xcea2
   , GLFSR16_TAPSET_0437 = 0xce8c
   , GLFSR16_TAPSET_0438 = 0xce62
   , GLFSR16_TAPSET_0439 = 0xce51
   , GLFSR16_TAPSET_0440 = 0xce46
   , GLFSR16_TAPSET_0441 = 0xce34
   , GLFSR16_TAPSET_0442 = 0xce32
   , GLFSR16_TAPSET_0443 = 0xce29
   , GLFSR16_TAPSET_0444 = 0xcd98
   , GLFSR16_TAPSET_0445 = 0xcd1a
   , GLFSR16_TAPSET_0446 = 0xcd0e
   , GLFSR16_TAPSET_0447 = 0xcce1
   , GLFSR16_TAPSET_0448 = 0xccc6
   , GLFSR16_TAPSET_0449 = 0xcbd0
   , GLFSR16_TAPSET_0450 = 0xcbb0
   , GLFSR16_TAPSET_0451 = 0xcb8a
   , GLFSR16_TAPSET_0452 = 0xcb86
   , GLFSR16_TAPSET_0453 = 0xcb1a
   , GLFSR16_TAPSET_0454 = 0xcb16
   , GLFSR16_TAPSET_0455 = 0xcae8
   , GLFSR16_TAPSET_0456 = 0xcae1
   , GLFSR16_TAPSET_0457 = 0xcad4
   , GLFSR16_TAPSET_0458 = 0xcac6
   , GLFSR16_TAPSET_0459 = 0xcab8
   , GLFSR16_TAPSET_0460 = 0xca9c
   , GLFSR16_TAPSET_0461 = 0xc9e2
   , GLFSR16_TAPSET_0462 = 0xc9aa
   , GLFSR16_TAPSET_0463 = 0xc9a6
   , GLFSR16_TAPSET_0464 = 0xc99a
   , GLFSR16_TAPSET_0465 = 0xc93c
   , GLFSR16_TAPSET_0466 = 0xc936
   , GLFSR16_TAPSET_0467 = 0xc8bc
   , GLFSR16_TAPSET_0468 = 0xc7c4
   , GLFSR16_TAPSET_0469 = 0xc758
   , GLFSR16_TAPSET_0470 = 0xc734
   , GLFSR16_TAPSET_0471 = 0xc6e4
   , GLFSR16_TAPSET_0472 = 0xc6d2
   , GLFSR16_TAPSET_0473 = 0xc6d1
   , GLFSR16_TAPSET_0474 = 0xc6ca
   , GLFSR16_TAPSET_0475 = 0xc64e
   , GLFSR16_TAPSET_0476 = 0xc5e8
   , GLFSR16_TAPSET_0477 = 0xc5ac
   , GLFSR16_TAPSET_0478 = 0xc59a
   , GLFSR16_TAPSET_0479 = 0xc572
   , GLFSR16_TAPSET_0480 = 0xc54e
   , GLFSR16_TAPSET_0481 = 0xc53a
   , GLFSR16_TAPSET_0482 = 0xc4d6
   , GLFSR16_TAPSET_0483 = 0xc4bc
   , GLFSR16_TAPSET_0484 = 0xc4ae
   , GLFSR16_TAPSET_0485 = 0xc3e2
   , GLFSR16_TAPSET_0486 = 0xc3d8
   , GLFSR16_TAPSET_0487 = 0xc38e
   , GLFSR16_TAPSET_0488 = 0xc378
   , GLFSR16_TAPSET_0489 = 0xc36c
   , GLFSR16_TAPSET_0490 = 0xc2f4
   , GLFSR16_TAPSET_0491 = 0xc2ec
   , GLFSR16_TAPSET_0492 = 0xc2bc
   , GLFSR16_TAPSET_0493 = 0xc2b6
   , GLFSR16_TAPSET_0494 = 0xc27c
   , GLFSR16_TAPSET_0495 = 0xc26e
   , GLFSR16_TAPSET_0496 = 0xc1f8
   , GLFSR16_TAPSET_0497 = 0xc1bc
   , GLFSR16_TAPSET_0498 = 0xc1ae
   , GLFSR16_TAPSET_0499 = 0xbe90
   , GLFSR16_TAPSET_0500 = 0xbe50
   , GLFSR16_TAPSET_0501 = 0xbd82
   , GLFSR16_TAPSET_0502 = 0xbcc8
   , GLFSR16_TAPSET_0503 = 0xbc86
   , GLFSR16_TAPSET_0504 = 0xbc68
   , GLFSR16_TAPSET_0505 = 0xbc64
   , GLFSR16_TAPSET_0506 = 0xbc4c
   , GLFSR16_TAPSET_0507 = 0xbc1a
   , GLFSR16_TAPSET_0508 = 0xbbc0
   , GLFSR16_TAPSET_0509 = 0xbba0
   , GLFSR16_TAPSET_0510 = 0xbb0c
   , GLFSR16_TAPSET_0511 = 0xbb06
   , GLFSR16_TAPSET_0512 = 0xbad0
   , GLFSR16_TAPSET_0513 = 0xbaa4
   , GLFSR16_TAPSET_0514 = 0xba8a
   , GLFSR16_TAPSET_0515 = 0xba62
   , GLFSR16_TAPSET_0516 = 0xba4a
   , GLFSR16_TAPSET_0517 = 0xba34
   , GLFSR16_TAPSET_0518 = 0xba1c
   , GLFSR16_TAPSET_0519 = 0xb9c8
   , GLFSR16_TAPSET_0520 = 0xb9a2
   , GLFSR16_TAPSET_0521 = 0xb994
   , GLFSR16_TAPSET_0522 = 0xb970
   , GLFSR16_TAPSET_0523 = 0xb94c
   , GLFSR16_TAPSET_0524 = 0xb938
   , GLFSR16_TAPSET_0525 = 0xb916
   , GLFSR16_TAPSET_0526 = 0xb90e
   , GLFSR16_TAPSET_0527 = 0xb8ac
   , GLFSR16_TAPSET_0528 = 0xb836
   , GLFSR16_TAPSET_0529 = 0xb748
   , GLFSR16_TAPSET_0530 = 0xb742
   , GLFSR16_TAPSET_0531 = 0xb728
   , GLFSR16_TAPSET_0532 = 0xb70c
   , GLFSR16_TAPSET_0533 = 0xb6e0
   , GLFSR16_TAPSET_0534 = 0xb6c4
   , GLFSR16_TAPSET_0535 = 0xb68a
   , GLFSR16_TAPSET_0536 = 0xb652
   , GLFSR16_TAPSET_0537 = 0xb61c
   , GLFSR16_TAPSET_0538 = 0xb586
   , GLFSR16_TAPSET_0539 = 0xb552
   , GLFSR16_TAPSET_0540 = 0xb4c6
   , GLFSR16_TAPSET_0541 = 0xb4aa
   , GLFSR16_TAPSET_0542 = 0xb46a
   , GLFSR16_TAPSET_0543 = 0xb3d0
   , GLFSR16_TAPSET_0544 = 0xb38c
   , GLFSR16_TAPSET_0545 = 0xb354
   , GLFSR16_TAPSET_0546 = 0xb338
   , GLFSR16_TAPSET_0547 = 0xb2d2
   , GLFSR16_TAPSET_0548 = 0xb2b2
   , GLFSR16_TAPSET_0549 = 0xb29c
   , GLFSR16_TAPSET_0550 = 0xb29a
   , GLFSR16_TAPSET_0551 = 0xb274
   , GLFSR16_TAPSET_0552 = 0xb1b2
   , GLFSR16_TAPSET_0553 = 0xb19a
   , GLFSR16_TAPSET_0554 = 0xaf14
   , GLFSR16_TAPSET_0555 = 0xaf0c
   , GLFSR16_TAPSET_0556 = 0xaec8
   , GLFSR16_TAPSET_0557 = 0xae98
   , GLFSR16_TAPSET_0558 = 0xae52
   , GLFSR16_TAPSET_0559 = 0xae4c
   , GLFSR16_TAPSET_0560 = 0xada2
   , GLFSR16_TAPSET_0561 = 0xad52
   , GLFSR16_TAPSET_0562 = 0xad4c
   , GLFSR16_TAPSET_0563 = 0xad38
   , GLFSR16_TAPSET_0564 = 0xad2a
   , GLFSR16_TAPSET_0565 = 0xacb4
   , GLFSR16_TAPSET_0566 = 0xac6c
   , GLFSR16_TAPSET_0567 = 0xaba8
   , GLFSR16_TAPSET_0568 = 0xab94
   , GLFSR16_TAPSET_0569 = 0xab62
   , GLFSR16_TAPSET_0570 = 0xaa5c
   , GLFSR16_TAPSET_0571 = 0xa9f0
   , GLFSR16_TAPSET_0572 = 0xa7d0
   , GLFSR16_TAPSET_0573 = 0xa7b0
   , GLFSR16_TAPSET_0574 = 0xa7a4
   , GLFSR16_TAPSET_0575 = 0xa798
   , GLFSR16_TAPSET_0576 = 0xa792
   , GLFSR16_TAPSET_0577 = 0xa758
   , GLFSR16_TAPSET_0578 = 0xa6b8
   , GLFSR16_TAPSET_0579 = 0xa6b4
   , GLFSR16_TAPSET_0580 = 0xa69c
   , GLFSR16_TAPSET_0581 = 0xa65c
   , GLFSR16_TAPSET_0582 = 0xa5e4
   , GLFSR16_TAPSET_0583 = 0xa3e4
   , GLFSR16_TAPSET_0584 = 0xa3cc
   , GLFSR16_TAPSET_0585 = 0xa374
   , GLFSR16_TAPSET_0586 = 0xa2dc
   , GLFSR16_TAPSET_0587 = 0xa27c
   , GLFSR16_TAPSET_0588 = 0x9fc0
   , GLFSR16_TAPSET_0589 = 0x9f28
   , GLFSR16_TAPSET_0590 = 0x9f18
   , GLFSR16_TAPSET_0591 = 0x9ee0
   , GLFSR16_TAPSET_0592 = 0x9ec8
   , GLFSR16_TAPSET_0593 = 0x9ea4
   , GLFSR16_TAPSET_0594 = 0x9e98
   , GLFSR16_TAPSET_0595 = 0x9e34
   , GLFSR16_TAPSET_0596 = 0x9d94
   , GLFSR16_TAPSET_0597 = 0x9d34
   , GLFSR16_TAPSET_0598 = 0x9ce4
   , GLFSR16_TAPSET_0599 = 0x9ccc
   , GLFSR16_TAPSET_0600 = 0x9b8c
   , GLFSR16_TAPSET_0601 = 0x9b68
   , GLFSR16_TAPSET_0602 = 0x9b54
   , GLFSR16_TAPSET_0603 = 0x9b4c
   , GLFSR16_TAPSET_0604 = 0x9ae4
   , GLFSR16_TAPSET_0605 = 0x9ab8
   , GLFSR16_TAPSET_0606 = 0x99e8
   , GLFSR16_TAPSET_0607 = 0x99d4
   , GLFSR16_TAPSET_0608 = 0x9978
   , GLFSR16_TAPSET_0609 = 0x9738
   , GLFSR16_TAPSET_0610 = 0x96f0
   , GLFSR16_TAPSET_0611 = 0x95e8
   , GLFSR16_TAPSET_0612 = 0x94f8
   , GLFSR16_TAPSET_0613 = 0x8fe0
   , GLFSR16_TAPSET_0614 = 0x8f38
   , GLFSR16_TAPSET_0615 = 0x8df0
   , GLFSR16_TAPSET_0616 = 0xff82
   , GLFSR16_TAPSET_0617 = 0xff41
   , GLFSR16_TAPSET_0618 = 0xff24
   , GLFSR16_TAPSET_0619 = 0xff18
   , GLFSR16_TAPSET_0620 = 0xff12
   , GLFSR16_TAPSET_0621 = 0xfec2
   , GLFSR16_TAPSET_0622 = 0xfea1
   , GLFSR16_TAPSET_0623 = 0xfe91
   , GLFSR16_TAPSET_0624 = 0xfe86
   , GLFSR16_TAPSET_0625 = 0xfe64
   , GLFSR16_TAPSET_0626 = 0xfe54
   , GLFSR16_TAPSET_0627 = 0xfe2a
   , GLFSR16_TAPSET_0628 = 0xfe0d
   , GLFSR16_TAPSET_0629 = 0xfe07
   , GLFSR16_TAPSET_0630 = 0xfdc2
   , GLFSR16_TAPSET_0631 = 0xfdc1
   , GLFSR16_TAPSET_0632 = 0xfd45
   , GLFSR16_TAPSET_0633 = 0xfd25
   , GLFSR16_TAPSET_0634 = 0xfce8
   , GLFSR16_TAPSET_0635 = 0xfcb8
   , GLFSR16_TAPSET_0636 = 0xfca6
   , GLFSR16_TAPSET_0637 = 0xfc9c
   , GLFSR16_TAPSET_0638 = 0xfc78
   , GLFSR16_TAPSET_0639 = 0xfc1e
   , GLFSR16_TAPSET_0640 = 0xfbc1
   , GLFSR16_TAPSET_0641 = 0xfb92
   , GLFSR16_TAPSET_0642 = 0xfb8a
   , GLFSR16_TAPSET_0643 = 0xfb62
   , GLFSR16_TAPSET_0644 = 0xfb52
   , GLFSR16_TAPSET_0645 = 0xfb43
   , GLFSR16_TAPSET_0646 = 0xfb2a
   , GLFSR16_TAPSET_0647 = 0xfb1c
   , GLFSR16_TAPSET_0648 = 0xfb1a
   , GLFSR16_TAPSET_0649 = 0xfb15
   , GLFSR16_TAPSET_0650 = 0xfb13
   , GLFSR16_TAPSET_0651 = 0xfb07
   , GLFSR16_TAPSET_0652 = 0xfab8
   , GLFSR16_TAPSET_0653 = 0xfab2
   , GLFSR16_TAPSET_0654 = 0xfa9c
   , GLFSR16_TAPSET_0655 = 0xfa93
   , GLFSR16_TAPSET_0656 = 0xfa8e
   , GLFSR16_TAPSET_0657 = 0xfa78
   , GLFSR16_TAPSET_0658 = 0xfa69
   , GLFSR16_TAPSET_0659 = 0xfa4e
   , GLFSR16_TAPSET_0660 = 0xfa47
   , GLFSR16_TAPSET_0661 = 0xfa35
   , GLFSR16_TAPSET_0662 = 0xfa0f
   , GLFSR16_TAPSET_0663 = 0xf9cc
   , GLFSR16_TAPSET_0664 = 0xf9c9
   , GLFSR16_TAPSET_0665 = 0xf9c3
   , GLFSR16_TAPSET_0666 = 0xf99a
   , GLFSR16_TAPSET_0667 = 0xf98b
   , GLFSR16_TAPSET_0668 = 0xf978
   , GLFSR16_TAPSET_0669 = 0xf96a
   , GLFSR16_TAPSET_0670 = 0xf955
   , GLFSR16_TAPSET_0671 = 0xf8e9
   , GLFSR16_TAPSET_0672 = 0xf8e5
   , GLFSR16_TAPSET_0673 = 0xf8d5
   , GLFSR16_TAPSET_0674 = 0xf8d3
   , GLFSR16_TAPSET_0675 = 0xf89b
   , GLFSR16_TAPSET_0676 = 0xf85e
   , GLFSR16_TAPSET_0677 = 0xf857
   , GLFSR16_TAPSET_0678 = 0xf7c2
   , GLFSR16_TAPSET_0679 = 0xf791
   , GLFSR16_TAPSET_0680 = 0xf74c
   , GLFSR16_TAPSET_0681 = 0xf738
   , GLFSR16_TAPSET_0682 = 0xf731
   , GLFSR16_TAPSET_0683 = 0xf70d
   , GLFSR16_TAPSET_0684 = 0xf693
   , GLFSR16_TAPSET_0685 = 0xf68e
   , GLFSR16_TAPSET_0686 = 0xf672
   , GLFSR16_TAPSET_0687 = 0xf66c
   , GLFSR16_TAPSET_0688 = 0xf659
   , GLFSR16_TAPSET_0689 = 0xf63c
   , GLFSR16_TAPSET_0690 = 0xf636
   , GLFSR16_TAPSET_0691 = 0xf633
   , GLFSR16_TAPSET_0692 = 0xf62d
   , GLFSR16_TAPSET_0693 = 0xf617
   , GLFSR16_TAPSET_0694 = 0xf5e1
   , GLFSR16_TAPSET_0695 = 0xf5d8
   , GLFSR16_TAPSET_0696 = 0xf5aa
   , GLFSR16_TAPSET_0697 = 0xf596
   , GLFSR16_TAPSET_0698 = 0xf595
   , GLFSR16_TAPSET_0699 = 0xf572
   , GLFSR16_TAPSET_0700 = 0xf54e
   , GLFSR16_TAPSET_0701 = 0xf4ab
   , GLFSR16_TAPSET_0702 = 0xf49d
   , GLFSR16_TAPSET_0703 = 0xf467
   , GLFSR16_TAPSET_0704 = 0xf43b
   , GLFSR16_TAPSET_0705 = 0xf3f0
   , GLFSR16_TAPSET_0706 = 0xf3d2
   , GLFSR16_TAPSET_0707 = 0xf3c5
   , GLFSR16_TAPSET_0708 = 0xf39a
   , GLFSR16_TAPSET_0709 = 0xf396
   , GLFSR16_TAPSET_0710 = 0xf378
   , GLFSR16_TAPSET_0711 = 0xf35c
   , GLFSR16_TAPSET_0712 = 0xf34e
   , GLFSR16_TAPSET_0713 = 0xf335
   , GLFSR16_TAPSET_0714 = 0xf2da
   , GLFSR16_TAPSET_0715 = 0xf2cd
   , GLFSR16_TAPSET_0716 = 0xf2b5
   , GLFSR16_TAPSET_0717 = 0xf29b
   , GLFSR16_TAPSET_0718 = 0xf279
   , GLFSR16_TAPSET_0719 = 0xf26d
   , GLFSR16_TAPSET_0720 = 0xf23e
   , GLFSR16_TAPSET_0721 = 0xf1f2
   , GLFSR16_TAPSET_0722 = 0xf1d6
   , GLFSR16_TAPSET_0723 = 0xf1cd
   , GLFSR16_TAPSET_0724 = 0xf1b9
   , GLFSR16_TAPSET_0725 = 0xf17c
   , GLFSR16_TAPSET_0726 = 0xf0db
   , GLFSR16_TAPSET_0727 = 0xefa2
   , GLFSR16_TAPSET_0728 = 0xef61
   , GLFSR16_TAPSET_0729 = 0xef52
   , GLFSR16_TAPSET_0730 = 0xef34
   , GLFSR16_TAPSET_0731 = 0xef32
   , GLFSR16_TAPSET_0732 = 0xef26
   , GLFSR16_TAPSET_0733 = 0xeef0
   , GLFSR16_TAPSET_0734 = 0xeeca
   , GLFSR16_TAPSET_0735 = 0xeeb8
   , GLFSR16_TAPSET_0736 = 0xeea3
   , GLFSR16_TAPSET_0737 = 0xee8d
   , GLFSR16_TAPSET_0738 = 0xee69
   , GLFSR16_TAPSET_0739 = 0xee5c
   , GLFSR16_TAPSET_0740 = 0xee56
   , GLFSR16_TAPSET_0741 = 0xee55
   , GLFSR16_TAPSET_0742 = 0xedd2
   , GLFSR16_TAPSET_0743 = 0xedd1
   , GLFSR16_TAPSET_0744 = 0xedc3
   , GLFSR16_TAPSET_0745 = 0xeda5
   , GLFSR16_TAPSET_0746 = 0xeda3
   , GLFSR16_TAPSET_0747 = 0xed9c
   , GLFSR16_TAPSET_0748 = 0xed69
   , GLFSR16_TAPSET_0749 = 0xed65
   , GLFSR16_TAPSET_0750 = 0xed5a
   , GLFSR16_TAPSET_0751 = 0xed2e
   , GLFSR16_TAPSET_0752 = 0xecd9
   , GLFSR16_TAPSET_0753 = 0xecba
   , GLFSR16_TAPSET_0754 = 0xecb3
   , GLFSR16_TAPSET_0755 = 0xec7a
   , GLFSR16_TAPSET_0756 = 0xec3e
   , GLFSR16_TAPSET_0757 = 0xebe8
   , GLFSR16_TAPSET_0758 = 0xebd8
   , GLFSR16_TAPSET_0759 = 0xebac
   , GLFSR16_TAPSET_0760 = 0xeb9a
   , GLFSR16_TAPSET_0761 = 0xeb96
   , GLFSR16_TAPSET_0762 = 0xeb8b
   , GLFSR16_TAPSET_0763 = 0xeb66
   , GLFSR16_TAPSET_0764 = 0xeb5a
   , GLFSR16_TAPSET_0765 = 0xeb59
   , GLFSR16_TAPSET_0766 = 0xeb2e
   , GLFSR16_TAPSET_0767 = 0xeaf8
   , GLFSR16_TAPSET_0768 = 0xeaf2
   , GLFSR16_TAPSET_0769 = 0xeaf1
   , GLFSR16_TAPSET_0770 = 0xeada
   , GLFSR16_TAPSET_0771 = 0xead6
   , GLFSR16_TAPSET_0772 = 0xead5
   , GLFSR16_TAPSET_0773 = 0xeab3
   , GLFSR16_TAPSET_0774 = 0xea7c
   , GLFSR16_TAPSET_0775 = 0xea7a
   , GLFSR16_TAPSET_0776 = 0xea79
   , GLFSR16_TAPSET_0777 = 0xea73
   , GLFSR16_TAPSET_0778 = 0xea6e
   , GLFSR16_TAPSET_0779 = 0xea5d
   , GLFSR16_TAPSET_0780 = 0xe9e5
   , GLFSR16_TAPSET_0781 = 0xe99e
   , GLFSR16_TAPSET_0782 = 0xe976
   , GLFSR16_TAPSET_0783 = 0xe975
   , GLFSR16_TAPSET_0784 = 0xe95d
   , GLFSR16_TAPSET_0785 = 0xe87d
   , GLFSR16_TAPSET_0786 = 0xe7b2
   , GLFSR16_TAPSET_0787 = 0xe7b1
   , GLFSR16_TAPSET_0788 = 0xe7a6
   , GLFSR16_TAPSET_0789 = 0xe795
   , GLFSR16_TAPSET_0790 = 0xe78d
   , GLFSR16_TAPSET_0791 = 0xe778
   , GLFSR16_TAPSET_0792 = 0xe756
   , GLFSR16_TAPSET_0793 = 0xe753
   , GLFSR16_TAPSET_0794 = 0xe736
   , GLFSR16_TAPSET_0795 = 0xe71d
   , GLFSR16_TAPSET_0796 = 0xe6f4
   , GLFSR16_TAPSET_0797 = 0xe6e5
   , GLFSR16_TAPSET_0798 = 0xe6bc
   , GLFSR16_TAPSET_0799 = 0xe67a
   , GLFSR16_TAPSET_0800 = 0xe676
   , GLFSR16_TAPSET_0801 = 0xe63d
   , GLFSR16_TAPSET_0802 = 0xe5f4
   , GLFSR16_TAPSET_0803 = 0xe5d5
   , GLFSR16_TAPSET_0804 = 0xe5ae
   , GLFSR16_TAPSET_0805 = 0xe579
   , GLFSR16_TAPSET_0806 = 0xe55e
   , GLFSR16_TAPSET_0807 = 0xe4dd
   , GLFSR16_TAPSET_0808 = 0xe3da
   , GLFSR16_TAPSET_0809 = 0xe3d6
   , GLFSR16_TAPSET_0810 = 0xe3ba
   , GLFSR16_TAPSET_0811 = 0xe3ad
   , GLFSR16_TAPSET_0812 = 0xe379
   , GLFSR16_TAPSET_0813 = 0xe36e
   , GLFSR16_TAPSET_0814 = 0xe2f6
   , GLFSR16_TAPSET_0815 = 0xe2be
   , GLFSR16_TAPSET_0816 = 0xe1be
   , GLFSR16_TAPSET_0817 = 0xdfc2
   , GLFSR16_TAPSET_0818 = 0xdfa8
   , GLFSR16_TAPSET_0819 = 0xdfa1
   , GLFSR16_TAPSET_0820 = 0xdf92
   , GLFSR16_TAPSET_0821 = 0xdf91
   , GLFSR16_TAPSET_0822 = 0xdf64
   , GLFSR16_TAPSET_0823 = 0xdf52
   , GLFSR16_TAPSET_0824 = 0xdf34
   , GLFSR16_TAPSET_0825 = 0xdf1c
   , GLFSR16_TAPSET_0826 = 0xded4
   , GLFSR16_TAPSET_0827 = 0xdec6
   , GLFSR16_TAPSET_0828 = 0xde78
   , GLFSR16_TAPSET_0829 = 0xddd8
   , GLFSR16_TAPSET_0830 = 0xdda5
   , GLFSR16_TAPSET_0831 = 0xdd8d
   , GLFSR16_TAPSET_0832 = 0xdd66
   , GLFSR16_TAPSET_0833 = 0xdcf8
   , GLFSR16_TAPSET_0834 = 0xdcba
   , GLFSR16_TAPSET_0835 = 0xdcb6
   , GLFSR16_TAPSET_0836 = 0xdcad
   , GLFSR16_TAPSET_0837 = 0xdc6e
   , GLFSR16_TAPSET_0838 = 0xdbf0
   , GLFSR16_TAPSET_0839 = 0xdbd4
   , GLFSR16_TAPSET_0840 = 0xdbd1
   , GLFSR16_TAPSET_0841 = 0xdbc9
   , GLFSR16_TAPSET_0842 = 0xdbb4
   , GLFSR16_TAPSET_0843 = 0xdb69
   , GLFSR16_TAPSET_0844 = 0xdb4d
   , GLFSR16_TAPSET_0845 = 0xdb1e
   , GLFSR16_TAPSET_0846 = 0xdaf4
   , GLFSR16_TAPSET_0847 = 0xdaf2
   , GLFSR16_TAPSET_0848 = 0xdadc
   , GLFSR16_TAPSET_0849 = 0xdad9
   , GLFSR16_TAPSET_0850 = 0xdab5
   , GLFSR16_TAPSET_0851 = 0xd9f8
   , GLFSR16_TAPSET_0852 = 0xd9ce
   , GLFSR16_TAPSET_0853 = 0xd9ae
   , GLFSR16_TAPSET_0854 = 0xd976
   , GLFSR16_TAPSET_0855 = 0xd975
   , GLFSR16_TAPSET_0856 = 0xd8ee
   , GLFSR16_TAPSET_0857 = 0xd7c9
   , GLFSR16_TAPSET_0858 = 0xd7b2
   , GLFSR16_TAPSET_0859 = 0xd772
   , GLFSR16_TAPSET_0860 = 0xd73a
   , GLFSR16_TAPSET_0861 = 0xd71e
   , GLFSR16_TAPSET_0862 = 0xd6e6
   , GLFSR16_TAPSET_0863 = 0xd6d6
   , GLFSR16_TAPSET_0864 = 0xd6bc
   , GLFSR16_TAPSET_0865 = 0xd5ea
   , GLFSR16_TAPSET_0866 = 0xd5e9
   , GLFSR16_TAPSET_0867 = 0xd5da
   , GLFSR16_TAPSET_0868 = 0xd5d6
   , GLFSR16_TAPSET_0869 = 0xd5ba
   , GLFSR16_TAPSET_0870 = 0xd57a
   , GLFSR16_TAPSET_0871 = 0xd55e
   , GLFSR16_TAPSET_0872 = 0xd47e
   , GLFSR16_TAPSET_0873 = 0xd3dc
   , GLFSR16_TAPSET_0874 = 0xd3d9
   , GLFSR16_TAPSET_0875 = 0xd33e
   , GLFSR16_TAPSET_0876 = 0xd2ee
   , GLFSR16_TAPSET_0877 = 0xd27e
   , GLFSR16_TAPSET_0878 = 0xd17e
   , GLFSR16_TAPSET_0879 = 0xd0fe
   , GLFSR16_TAPSET_0880 = 0xcfd2
   , GLFSR16_TAPSET_0881 = 0xcfcc
   , GLFSR16_TAPSET_0882 = 0xcfc9
   , GLFSR16_TAPSET_0883 = 0xcfb2
   , GLFSR16_TAPSET_0884 = 0xcfa6
   , GLFSR16_TAPSET_0885 = 0xcf78
   , GLFSR16_TAPSET_0886 = 0xcf5c
   , GLFSR16_TAPSET_0887 = 0xcdbc
   , GLFSR16_TAPSET_0888 = 0xcdb6
   , GLFSR16_TAPSET_0889 = 0xcbf4
   , GLFSR16_TAPSET_0890 = 0xcbf1
   , GLFSR16_TAPSET_0891 = 0xcbdc
   , GLFSR16_TAPSET_0892 = 0xcb7c
   , GLFSR16_TAPSET_0893 = 0xcb3e
   , GLFSR16_TAPSET_0894 = 0xc97e
   , GLFSR16_TAPSET_0895 = 0xc7f2
   , GLFSR16_TAPSET_0896 = 0xc7ec
   , GLFSR16_TAPSET_0897 = 0xc6de
   , GLFSR16_TAPSET_0898 = 0xbfa2
   , GLFSR16_TAPSET_0899 = 0xbf98
   , GLFSR16_TAPSET_0900 = 0xbf68
   , GLFSR16_TAPSET_0901 = 0xbf62
   , GLFSR16_TAPSET_0902 = 0xbf32
   , GLFSR16_TAPSET_0903 = 0xbf2c
   , GLFSR16_TAPSET_0904 = 0xbf0e
   , GLFSR16_TAPSET_0905 = 0xbee2
   , GLFSR16_TAPSET_0906 = 0xbed4
   , GLFSR16_TAPSET_0907 = 0xbed2
   , GLFSR16_TAPSET_0908 = 0xbeac
   , GLFSR16_TAPSET_0909 = 0xbe5a
   , GLFSR16_TAPSET_0910 = 0xbe2e
   , GLFSR16_TAPSET_0911 = 0xbdd8
   , GLFSR16_TAPSET_0912 = 0xbd9c
   , GLFSR16_TAPSET_0913 = 0xbd5c
   , GLFSR16_TAPSET_0914 = 0xbcf4
   , GLFSR16_TAPSET_0915 = 0xbcbc
   , GLFSR16_TAPSET_0916 = 0xbc6e
   , GLFSR16_TAPSET_0917 = 0xbbd2
   , GLFSR16_TAPSET_0918 = 0xbb8e
   , GLFSR16_TAPSET_0919 = 0xbb4e
   , GLFSR16_TAPSET_0920 = 0xba76
   , GLFSR16_TAPSET_0921 = 0xb9dc
   , GLFSR16_TAPSET_0922 = 0xb9d6
   , GLFSR16_TAPSET_0923 = 0xb9b6
   , GLFSR16_TAPSET_0924 = 0xb8fc
   , GLFSR16_TAPSET_0925 = 0xb7e4
   , GLFSR16_TAPSET_0926 = 0xb7c6
   , GLFSR16_TAPSET_0927 = 0xb76c
   , GLFSR16_TAPSET_0928 = 0xb6f2
   , GLFSR16_TAPSET_0929 = 0xb3ec
   , GLFSR16_TAPSET_0930 = 0xb3bc
   , GLFSR16_TAPSET_0931 = 0xb1fa
   , GLFSR16_TAPSET_0932 = 0xafaa
   , GLFSR16_TAPSET_0933 = 0xaf72
   , GLFSR16_TAPSET_0934 = 0xaf6a
   , GLFSR16_TAPSET_0935 = 0xaef8
   , GLFSR16_TAPSET_0936 = 0xa5fc
   , GLFSR16_TAPSET_0937 = 0xa3fc
   , GLFSR16_TAPSET_0938 = 0x9f74
   , GLFSR16_TAPSET_0939 = 0x9df8
   , GLFSR16_TAPSET_0940 = 0xffd2
   , GLFSR16_TAPSET_0941 = 0xffb8
   , GLFSR16_TAPSET_0942 = 0xff9c
   , GLFSR16_TAPSET_0943 = 0xff9a
   , GLFSR16_TAPSET_0944 = 0xff99
   , GLFSR16_TAPSET_0945 = 0xff74
   , GLFSR16_TAPSET_0946 = 0xfed9
   , GLFSR16_TAPSET_0947 = 0xfecd
   , GLFSR16_TAPSET_0948 = 0xfeba
   , GLFSR16_TAPSET_0949 = 0xfe9e
   , GLFSR16_TAPSET_0950 = 0xfe76
   , GLFSR16_TAPSET_0951 = 0xfe4f
   , GLFSR16_TAPSET_0952 = 0xfdf8
   , GLFSR16_TAPSET_0953 = 0xfde6
   , GLFSR16_TAPSET_0954 = 0xfde5
   , GLFSR16_TAPSET_0955 = 0xfdb6
   , GLFSR16_TAPSET_0956 = 0xfdad
   , GLFSR16_TAPSET_0957 = 0xfdab
   , GLFSR16_TAPSET_0958 = 0xfd73
   , GLFSR16_TAPSET_0959 = 0xfd3e
   , GLFSR16_TAPSET_0960 = 0xfcdd
   , GLFSR16_TAPSET_0961 = 0xfbe6
   , GLFSR16_TAPSET_0962 = 0xfbda
   , GLFSR16_TAPSET_0963 = 0xfbd9
   , GLFSR16_TAPSET_0964 = 0xfba7
   , GLFSR16_TAPSET_0965 = 0xfb7c
   , GLFSR16_TAPSET_0966 = 0xfb79
   , GLFSR16_TAPSET_0967 = 0xfb75
   , GLFSR16_TAPSET_0968 = 0xfb6e
   , GLFSR16_TAPSET_0969 = 0xfb4f
   , GLFSR16_TAPSET_0970 = 0xfaeb
   , GLFSR16_TAPSET_0971 = 0xfa7d
   , GLFSR16_TAPSET_0972 = 0xf9e7
   , GLFSR16_TAPSET_0973 = 0xf9d7
   , GLFSR16_TAPSET_0974 = 0xf7f1
   , GLFSR16_TAPSET_0975 = 0xf7dc
   , GLFSR16_TAPSET_0976 = 0xf7d9
   , GLFSR16_TAPSET_0977 = 0xf7cb
   , GLFSR16_TAPSET_0978 = 0xf7ab
   , GLFSR16_TAPSET_0979 = 0xf79e
   , GLFSR16_TAPSET_0980 = 0xf76d
   , GLFSR16_TAPSET_0981 = 0xf757
   , GLFSR16_TAPSET_0982 = 0xf6ed
   , GLFSR16_TAPSET_0983 = 0xf6dd
   , GLFSR16_TAPSET_0984 = 0xf5f5
   , GLFSR16_TAPSET_0985 = 0xf5e7
   , GLFSR16_TAPSET_0986 = 0xf5bd
   , GLFSR16_TAPSET_0987 = 0xf57e
   , GLFSR16_TAPSET_0988 = 0xf4fe
   , GLFSR16_TAPSET_0989 = 0xf4fd
   , GLFSR16_TAPSET_0990 = 0xf3dd
   , GLFSR16_TAPSET_0991 = 0xefe6
   , GLFSR16_TAPSET_0992 = 0xefb9
   , GLFSR16_TAPSET_0993 = 0xefab
   , GLFSR16_TAPSET_0994 = 0xef9d
   , GLFSR16_TAPSET_0995 = 0xef9b
   , GLFSR16_TAPSET_0996 = 0xef5e
   , GLFSR16_TAPSET_0997 = 0xef3d
   , GLFSR16_TAPSET_0998 = 0xedf9
   , GLFSR16_TAPSET_0999 = 0xedee
   , GLFSR16_TAPSET_1000 = 0xedeb
   , GLFSR16_TAPSET_1001 = 0xecfd
   , GLFSR16_TAPSET_1002 = 0xebed
   , GLFSR16_TAPSET_1003 = 0xebbe
   , GLFSR16_TAPSET_1004 = 0xe5fd
   , GLFSR16_TAPSET_1005 = 0xe3fe
   , GLFSR16_TAPSET_1006 = 0xdfd6
   , GLFSR16_TAPSET_1007 = 0xdfb5
   , GLFSR16_TAPSET_1008 = 0xdf7c
   , GLFSR16_TAPSET_1009 = 0xdef9
   , GLFSR16_TAPSET_1010 = 0xddde
   , GLFSR16_TAPSET_1011 = 0xdd7e
   , GLFSR16_TAPSET_1012 = 0xdbf6
   , GLFSR16_TAPSET_1013 = 0xcdfe
   , GLFSR16_TAPSET_1014 = 0xcbfe
   , GLFSR16_TAPSET_1015 = 0xbfba
   , GLFSR16_TAPSET_1016 = 0xbf76
   , GLFSR16_TAPSET_1017 = 0xbdfa
   , GLFSR16_TAPSET_1018 = 0xfff6
   , GLFSR16_TAPSET_1019 = 0xfff5
   , GLFSR16_TAPSET_1020 = 0xfedf
   , GLFSR16_TAPSET_1021 = 0xfbfd
   , GLFSR16_TAPSET_1022 = 0xfbf7
   , GLFSR16_TAPSET_1023 = 0xf7fb
} GLFSR16_TAPS;

#endif
//
// Uniform Random Generators
//

// -- Based on simple linear congruential algebra
//
extern u8   cpct_getRandom_lcg_u8  (u8 entropy_byte) __z88dk_fastcall;
extern void cpct_setSeed_lcg_u8    (u8      newseed) __z88dk_fastcall;

// -- Based on Galois Linear-Feedback Shift Register
//
extern void cpct_setSeed_glfsr16      (u16       newseed) __z88dk_fastcall;
extern void cpct_setTaps_glfsr16      (GLFSR16_TAPS taps) __z88dk_fastcall;
extern u8   cpct_getRandom_glfsr16_u8 ();
extern u16  cpct_getRandom_glfsr16_u16();

// -- Based on Marsaglia's XOR-shift algorithm
//

// Calculating next 32-bits value in the sequence (seed)
extern u32  cpct_nextRandom_mxor_u32    (u32 seed) __z88dk_fastcall;
extern u32  cpct_nextRandom_mxor_u8     (u32 seed) __z88dk_fastcall;
extern u32  cpct_nextRandom_mxor532_u8  (u32 seed) __z88dk_fastcall;

// RNG direct user generators (return the random value)
extern u32  cpct_mxor32_seed;
extern u8   cpct_getRandom_mxor_u8      ();
extern u16  cpct_getRandom_mxor_u16     ();
extern u32  cpct_getRandom_mxor_u32     ();
extern void cpct_setSeed_mxor           (u32 newseed) __z88dk_fastcall;
extern void cpct_restoreState_mxor_u8   ();
extern void cpct_restoreState_mxor_u16  ();

// -- Based on Marsaglia's XOR-shift+ algorithm
//
extern u8   cpct_getRandom_xsp40_u8  ();
extern void cpct_setSeed_xsp40_u8    (u16 seed8, u32 seed32) __z88dk_callee;

///
/// Macros: Simple aliases for most common random generators
///
///   This macros are designed to simplify the user interface for generating
/// random numbers. Most of the time, a Marsaglia XOR-shift RNG is best
/// choice for generating random numbers
///
///  cpct_rand8         - returns a random  <u8> value ( 8-bits). It uses <cpct_getRandom_mxor_u8>.
///  cpct_rand16        - returns a random <u16> value (16-bits). It uses <cpct_getRandom_mxor_u16>.
///  cpct_rand32        - returns a random <u32> value (32-bits). It uses <cpct_getRandom_mxor_u32>.
///  cpct_srand8(SEED)  - Sets seed for MXOR generators (SEED = 32 bits value) and restores 
///    internal state of <cpct_getRandom_mxor_u8>.
///  cpct_srand16(SEED) - Sets seed for MXOR generators (SEED = 32 bits value) and restores 
///    internal state of <cpct_getRandom_mxor_u16>.
///  cpct_rand          - alias for <cpct_rand8>
///  cpct_srand         - alias for <cpct_srand8>
///
#define cpct_rand8         cpct_getRandom_mxor_u8
#define cpct_rand16        cpct_getRandom_mxor_u16
#define cpct_rand32        cpct_getRandom_mxor_u32
#define cpct_srand8(SEED)  cpct_setSeed_mxor((SEED)); cpct_restoreState_mxor_u8();
#define cpct_srand16(SEED) cpct_setSeed_mxor((SEED)); cpct_restoreState_mxor_u16();
#define cpct_rand          cpct_rand8
#define cpct_srand         cpct_srand8

#endif
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
//-------------------------------------------------------------------------------

//
// Title: EasyTilemaps
//

#ifndef CPCT_EASYTILEMAPS_H
#define CPCT_EASYTILEMAPS_H

//#include <types.h>

// EasyTilemaps managing functions
extern void cpct_etm_drawTilemap2x4_f(u8 map_width, u8 map_height, void* pvideomem, const void* ptilemap) __z88dk_callee;
extern void cpct_etm_drawTileBox2x4  (u8 x, u8 y, u8 w, u8 h, u8 map_width, void* pvideomem, const void* ptilemap) __z88dk_callee;
extern void cpct_etm_drawTileRow2x4  (u8 numtiles, void* video_memory, const void* ptilemap) __z88dk_callee;
extern void cpct_etm_setTileset2x4   (const void* ptileset) __z88dk_fastcall;

//
// Macro: cpct_etm_drawTilemap2x4
//
//    This macro uses <cpct_etm_drawTileBox2x4> to draw a complete tilemap. 
//
// C Definition:
//    #define <cpct_etm_drawTilemap2x4> (*W*, *H*, *SCR*, *TM*)
//
// Parameters (1 byte):
//  (1B) W   - Width  of the tilemap in tiles
//  (1B) H   - Height of the tilemap in tiles
//  (2B) SCR - Pointer to the screen or backbuffer location where tilemap will be drawn
//  (2B) TM  - Pointer to the tilemap 
//
// Details:
//    This macro draws a complete tilemap *TM* of size *W*, *H*, at the location *SCR* in 
// video memory or a backbuffer. It's main purpose is to simplify this operation, while 
// saving some space, as no other function is required for drawing the full tilemap.
//
//    Drawing a full tilemap could also be done much faster with <cpct_etm_drawTilemap2x4_f>,
// but that will include the code for that function in the final binary. If speed is not a
// great concern when drawing the full tilemap, using this macro is prefered to save some
// space.
//
#define cpct_etm_drawTilemap2x4(W, H, V, TM)    cpct_etm_drawTileBox2x4(0, 0, (W), (H), (W), (V), (TM))



#endif
