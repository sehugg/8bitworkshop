/** @file asm/types.h
    Shared types definitions.
*/
#ifndef ASM_TYPES_INCLUDE
#define ASM_TYPES_INCLUDE

#define NONBANKED               __nonbanked  /**< Placed in the non-banked lower 16K region (bank 0), regardless of the bank selected by it's source file. */
#define BANKED                  __banked     /**< The function will use banked sdcc calls, and is placed in the bank selected by it's source file (or compiler switches). */
#define REENTRANT                            /**< Needed for mos6502 target when functions take too many parameters. */
#define NO_OVERLAY_LOCALS            /**< Optimization for mos6502 target, indicating locals won't conflict with compiler's overlay segment */

/**  Use to create a block of code which should execute with interrupts temporarily turned off.

    __Do not__ use the function definition attributes
    @ref CRITICAL and @ref INTERRUPT when declaring
    ISR functions added via add_VBL() (or LCD, etc).
    These attributes are only required when constructing
    a bare jump from the interrupt vector itself.

    @see enable_interrupts, disable_interrupts
*/
#define CRITICAL                __critical

/**  Indicate to the compiler the function will be used as an interrupt handler.

    __Do not__ use the function definition attributes
    @ref CRITICAL and @ref INTERRUPT when declaring
    ISR functions added via add_VBL() (or LCD, etc).
    These attributes are only required when constructing
    a bare jump from the interrupt vector itself.

    @see ISR_VECTOR(), ISR_NESTED_VECTOR()
*/
#define INTERRUPT               __interrupt

/** Signed eight bit.
 */
typedef signed char     INT8;
/** Unsigned eight bit.
 */
typedef unsigned char   UINT8;
/** Signed sixteen bit.
 */
typedef signed int      INT16;
/** Unsigned sixteen bit.
 */
typedef unsigned int    UINT16;
/** Signed 32 bit.
 */
typedef signed long     INT32;
/** Unsigned 32 bit.
 */
typedef unsigned long   UINT32;

#ifndef __SIZE_T_DEFINED
#define __SIZE_T_DEFINED
typedef unsigned int    size_t;
#endif

/** Returned from clock
    @see clock
*/
typedef unsigned int    clock_t;

#ifndef OLDCALL
#if __SDCC_REVISION >= 12608
#define OLDCALL __sdcccall(0)
#else
#define OLDCALL
#endif
#endif

#ifdef __SDCC
#define PRESERVES_REGS(...) __preserves_regs(__VA_ARGS__)
#define NAKED    __naked
#define SFR      __sfr
#define AT(A)    __at(A)
#define NORETURN _Noreturn
#else
#define PRESERVES_REGS(...)
#define NAKED
#define SFR
#define AT(A)
#define NORETURN
#endif

#ifndef NONBANKED
#define NONBANKED
#endif
#ifndef BANKED
#define BANKED
#endif
#ifndef CRITICAL
#define CRITICAL
#endif
#ifndef INTERRUPT
#define INTERRUPT
#endif

/** TRUE or FALSE.
    @anchor file_asm_types_h
 */
typedef INT8    BOOLEAN;

/** Signed 8 bit.
 */
typedef INT8    BYTE;
/** Unsigned 8 bit.
 */
typedef UINT8   UBYTE;
/** Signed 16 bit */
typedef INT16   WORD;
/** Unsigned 16 bit */
typedef UINT16  UWORD;
/** Signed 32 bit */
typedef INT32   LWORD;
/** Unsigned 32 bit */
typedef UINT32  ULWORD;
/** Signed 32 bit */
typedef INT32	  DWORD;
/** Unsigned 32 bit */
typedef UINT32	UDWORD;

/** Useful definition for working with 8 bit + 8 bit fixed point values

    Use `.w` to access the variable as unsigned 16 bit type.

    Use `.b.h` and `.b.l` (or just `.h` and `.l`) to directly access it's high and low unsigned 8 bit values.
 */
typedef union _fixed {
    struct {
        UBYTE l;
        UBYTE h;
    };
    struct {
        UBYTE l;
        UBYTE h;
    } b;
    UWORD w;
} fixed;

#endif
