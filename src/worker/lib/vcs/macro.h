; MACRO.H
; Version 1.11, 01/FEB/2026

VERSION_MACRO         = 111

;
; THIS FILE IS EXPLICITLY SUPPORTED AS A DASM-PREFERRED COMPANION FILE
; The latest version can be found at https://dasm-assembler.github.io/
;
; This file defines DASM macros useful for development for the Atari 2600.
; It is distributed as a companion machine-specific support package
; for the DASM compiler.
;
; Many thanks to the people who have contributed. If you find an issue with the
; contents, or would like ot add something, please report as an issue at...
; https://github.com/dasm-assembler/dasm/issues


; Latest Revisions...
; 1.11  01/FEB/2026     - added macros ALIGN_PAGE, BYTE_COUNT, CHECK_PAGE, TIMER_SETUP 
;                         and TIMER_WAIT
; 1.10  09/MAY/2022     - ("nop 0") should be changed to "nop VSYNC", to ensure that
;                         the instruction will access a "safe" memory location even
;                         when a different TIA_BASE_ADDRESS is defined - ale_79
; 1.09  05/SEP/2020     - updated license/links
; 1.08  13/JUL/2020     - added use of LXA to CLEAN_START
; 1.07  19/JAN/2020     - correction to comment VERTICAL_SYNC
; 1.06  03/SEP/2004     - nice revision of VERTICAL_SYNC (Edwin Blink)
; 1.05  14/NOV/2003     - Added VERSION_MACRO equate (which will reflect 100x version #)
;                         This will allow conditional code to verify MACRO.H being
;                         used for code assembly.
; 1.04  13/NOV/2003     - SET_POINTER macro added (16-bit address load)
;
; 1.03  23/JUN/2003     - CLEAN_START macro added - clears TIA, RAM, registers
;
; 1.02  14/JUN/2003     - VERTICAL_SYNC macro added
;                         (standardised macro for vertical synch code)
; 1.01  22/MAR/2003     - SLEEP macro added. 
;                       - NO_ILLEGAL_OPCODES switch implemented
; 1.0	22/MAR/2003		Initial release

; Note: Some of these macros use illegal opcodes.  To disable illegal opcode usage, 
;   define the symbol NO_ILLEGAL_OPCODES (-DNO_ILLEGAL_OPCODES=1 on command-line).
;   If you do not allow illegal opcode usage, you must include this file 
;   *after* including VCS.H (as the non-illegal opcodes access hardware
;   registers and require them to be defined first).

; Available macros...
;   SLEEP n             - sleep for n cycles
;   VERTICAL_SYNC       - correct 3 scanline vertical synch code
;   CLEAN_START         - set machine to known state on startup
;   SET_POINTER         - load a 16-bit absolute to a 16-bit variable
;   BOUNDARY byte#      - pad to byte # in page and count free bytes
;   ALIGN_PAGE          - align code to 256-byte page boundary and report free space
;   BYTE_COUNT          - report number of bytes used by a section
;   CHECK_PAGE          - verify code/data hasn't crossed a page boundary
;   TIMER_SETUP n       - setup a timer for n scanlines
;   TIMER_WAIT          - wait for the timer to expire

;-------------------------------------------------------------------------------
; SLEEP duration
; Original author: Thomas Jentzsch
; Inserts code which takes the specified number of cycles to execute.  This is
; useful for code where precise timing is required.
; ILLEGAL-OPCODE VERSION DOES NOT AFFECT FLAGS OR REGISTERS.
; LEGAL OPCODE VERSION MAY AFFECT FLAGS
; Uses illegal opcode (DASM 2.20.01 onwards).

            MAC SLEEP            ;usage: SLEEP n (n>1)
.CYCLES     SET {1}

                IF .CYCLES < 2
                    ECHO "MACRO ERROR: 'SLEEP': Duration must be > 1"
                    ERR
                ENDIF

                IF .CYCLES & 1
                    IFNCONST NO_ILLEGAL_OPCODES
                        nop VSYNC
                    ELSE
                        bit VSYNC
                    ENDIF
.CYCLES             SET .CYCLES - 3
                ENDIF
            
                REPEAT .CYCLES / 2
                    nop
                REPEND
            ENDM

;-------------------------------------------------------------------------------
; VERTICAL_SYNC
; revised version by Edwin Blink -- saves bytes!
; Inserts the code required for a proper 3 scanline vertical sync sequence
; Note: Alters the accumulator

; OUT: A = 0

             MAC VERTICAL_SYNC
                lda #%1110          ; each '1' bits generate a VSYNC ON line (bits 1..3)
.VSLP1          sta WSYNC           ; 1st '0' bit resets Vsync, 2nd '0' bit exit loop
                sta VSYNC
                lsr
                bne .VSLP1          ; branch until VSYNC has been reset
             ENDM

;-------------------------------------------------------------------------------
; CLEAN_START
; Original author: Andrew Davie
; Standardised start-up code, clears stack, all TIA registers and RAM to 0
; Sets stack pointer to $FF, and all registers to 0
; Sets decimal mode off, sets interrupt flag (kind of un-necessary)
; Use as very first section of code on boot (ie: at reset)
; Code written to minimise total ROM usage - uses weird 6502 knowledge :)

            MAC CLEAN_START
                sei
                cld
            
                IFNCONST NO_ILLEGAL_OPCODES
                    lxa #0
                ELSE
                    ldx #0
                    txa
                ENDIF
                tay
.CLEAR_STACK    dex
                txs
                pha
                bne .CLEAR_STACK     ; SP=$FF, X = A = Y = 0

            ENDM

;-------------------------------------------------------
; SET_POINTER
; Original author: Manuel Rotschkar
;
; Sets a 2 byte RAM pointer to an absolute address.
;
; Usage: SET_POINTER pointer, address
; Example: SET_POINTER SpritePTR, SpriteData
;
; Note: Alters the accumulator, NZ flags
; IN 1: 2 byte RAM location reserved for pointer
; IN 2: absolute address

            MAC SET_POINTER
.POINTER    SET {1}
.ADDRESS    SET {2}

                LDA #<.ADDRESS  ; Get Lowbyte of Address
                STA .POINTER    ; Store in pointer
                LDA #>.ADDRESS  ; Get Hibyte of Address
                STA .POINTER+1  ; Store in pointer+1

            ENDM

;-------------------------------------------------------
; BOUNDARY byte#
; Original author: Denis Debro (borrowed from Bob Smith / Thomas)
;
; Push data to a certain position inside a page and keep count of how
; many free bytes the programmer will have.
;
; eg: BOUNDARY 5    ; position at byte #5 in page

.FREE_BYTES SET 0   
    MAC BOUNDARY
        REPEAT 256
            IF <. % {1} = 0
                MEXIT
            ELSE
.FREE_BYTES SET .FREE_BYTES + 1
                .byte $00
            ENDIF
        REPEND
    ENDM

;-------------------------------------------------------
; ALIGN_PAGE
; Aligns code to a 256-byte page boundary and reports free space.
; Useful for ensuring data tables don't cross page boundaries, which
; can cause timing issues on the 6502.
;
; Usage: ALIGN_PAGE description
; Example: ALIGN_PAGE "Sprite Data"
;
; Note: Echoes the number of free bytes before the specified section

    MAC ALIGN_PAGE
.Align
    align 256
    ECHO "###", [* - .Align]d, "bytes free before", {1}
    ENDM

;-------------------------------------------------------
; BYTE_COUNT
; Reports the number of bytes used by a section of code or data.
; Useful for tracking ROM usage and optimizing code size.
;
; Usage: BYTE_COUNT start_label, "description"
; Example: BYTE_COUNT SpriteStart, "Sprite Graphics"
;
; IN 1: Label marking the start position
; IN 2: Description string for the section

    MAC BYTE_COUNT
	ECHO ">>>", {2}, ":", [* - {1}]d, "bytes"
	ENDM

;-------------------------------------------------------
; CHECK_PAGE
; Verifies that code/data hasn't crossed a page boundary.
; Generates an assembly error if the boundary was crossed.
; Critical for 6502 code where page crossing can affect timing
; or cause indirect addressing issues.
;
; Usage: CHECK_PAGE position, "description"
; Example: CHECK_PAGE TableStart, "Jump Table"
;
; IN 1: Starting position to check against
; IN 2: Description string for error message

	MAC CHECK_PAGE
.PREV_POS   SET . - 1
        IF >.PREV_POS != >{1}
            ECHO ""
            ECHO "ERROR:", {2}, "crosses page"
            ECHO ""
            ERR
        ENDIF
	ENDM

;-------------------------------------------------------
; Usage: TIMER_SETUP lines
; where lines is the number of scanlines to skip (> 2).
; The timer will be set so that it expires before this number
; of scanlines. A WSYNC will be done first.

    MAC TIMER_SETUP
.lines  SET {1}
.cycles SET ((.lines * 76) - 13)
; special case for when we have two timer events in a line
; and our 2nd event straddles the WSYNC boundary
	if (.cycles % 64) < 12
		lda #(.cycles / 64) - 1
		sta WSYNC
        else
		lda #(.cycles / 64)
		sta WSYNC
        endif
        sta TIM64T
    ENDM

;-------------------------------------------------------
; Use with TIMER_SETUP to wait for timer to complete.
; Performs a WSYNC afterwards.

    MAC TIMER_WAIT
.waittimer
        lda INTIM
        bne .waittimer
        sta WSYNC
    ENDM

; EOF
