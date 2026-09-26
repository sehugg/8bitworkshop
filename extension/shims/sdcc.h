/* Forced include for clangd/cpptools on SDCC code: hides SDCC's
   keywords from a host C parser. Never passed to sdcc itself.
   __asm ... __endasm; blocks can't be hidden by a macro. */
#define __at(x)
/* empty, not a type: GBDK writes 'extern volatile SFR UBYTE' */
#define __sfr
#define __sfr16
#define __banked
#define __nonbanked
#define __naked
#define __interrupt
#define __critical
#define __z88dk_fastcall
#define __z88dk_callee
#define __preserves_regs(...)
#define __sdcccall(x)
#define __smallc
#define __reentrant
#define __data
#define __code
#define __asm__(...) ((void)0)
/* sdcc allows restrict on function pointers; clang doesn't */
#define restrict
