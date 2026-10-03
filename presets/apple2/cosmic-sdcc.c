// Cosmic Impalas built with SDCC's mos6502 backend instead of cc65.
// The game is cosmic.c; this file picks the compiler and memory layout.

// the hires page 1 buffer is $2000-$3FFF, so the program loads above it
//#tooldef ld code_start=0x4000

#include "cosmic.c"
