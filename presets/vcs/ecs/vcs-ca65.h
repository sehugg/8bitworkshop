.setcpu "6502X"

; TIA write registers

VSYNC  := $00 ; ---- --1- This address controls vertical sync time by writing D1 into the VSYNC latch.
VBLANK := $01 ; 76-- --1- 1=Start VBLANK, 6=Enable INPT4, INPT5 latches, 7=Dump INPT1,2,3,6 to ground
WSYNC  := $02 ; ---- ---- This address halts microprocessor by clearing RDY latch to zero. RDY is set true again by the leading edge of horizontal blank.
RSYNC  := $03 ; ---- ---- This address resets the horizontal sync counter to define the beginning of horizontal blank time, and is used in chip testing. 
NUSIZ0 := $04 ; --54 -210 \ 0,1,2: player copys'n'size, 4,5: missile size: 2^x pixels
NUSIZ1 := $05 ; --54 -210 / 
COLUP0 := $06 ; 7654 321- color player 0
COLUP1 := $07 ; 7654 321- color player 1
COLUPF := $08 ; 7654 321- color playfield
COLUBK := $09 ; 7654 321- color background
CTRLPF := $0A ; --54 -210 0=reflect playfield, 1=pf uses player colors, 2=playfield over sprites 4,5=ballsize:2^x
REFP0  := $0B ; ---- 3--- reflect player 0
REFP1  := $0C ; ---- 3--- reflect player 1
PF0    := $0D ; DCBA ---- \   Playfield bits: ABCDEFGHIJKLMNOPQRST
PF1    := $0E ; EFGH IJKL  >  normal:  ABCDEFGHIJKLMNOPQRSTABCDEFGHIJKLMNOPQRST
PF2    := $0F ; TSRQ PONM /   reflect: ABCDEFGHIJKLMNOPQRSTTSRQPONMLKJIHGFEDCBA
RESP0  := $10 ; ---- ---- \
RESP1  := $11 ; ---- ----  \
RESM0  := $12 ; ---- ----   > reset players, missiles and the ball. The object will begin its serial graphics at the time of a horizontal line at which the reset address occurs.
RESM1  := $13 ; ---- ----  /
RESBL  := $14 ; ---- ---- /
AUDC0  := $15 ; ---- 3210 audio control voice 0
AUDC1  := $16 ; ---- 3210 audio control voice 1
AUDF0  := $17 ; ---4 3210 frequency divider voice 0
AUDF1  := $18 ; ---4 3210 frequency divider voice 1
AUDV0  := $19 ; ---- 3210 audio volume voice 0
AUDV1  := $1A ; ---- 3210 audio volume voice 1
GRP0   := $1B ; 7654 3210 graphics player 0
GRP1   := $1C ; 7654 3210 graphics player 1
ENAM0  := $1D ; ---- --1- enable missile 0
ENAM1  := $1E ; ---- --1- enable missile 1
ENABL  := $1F ; ---- --1- enable ball
HMP0   := $20 ; 7654 ---- write data (horizontal motion values) into the horizontal motion registers
HMP1   := $21 ; 7654 ---- write data (horizontal motion values) into the horizontal motion registers
HMM0   := $22 ; 7654 ---- write data (horizontal motion values) into the horizontal motion registers
HMM1   := $23 ; 7654 ---- write data (horizontal motion values) into the horizontal motion registers
HMBL   := $24 ; 7654 ---- write data (horizontal motion values) into the horizontal motion registers
VDELP0 := $25 ; ---- ---0 delay player 0 by one vertical line
VDELP1 := $26 ; ---- ---0 delay player 1 by one vertical line
VDELBL := $27 ; ---- ---0 delay ball by one vertical line
RESMP0 := $28 ; ---- --1- keep missile 0 aligned with player 0
RESMP1 := $29 ; ---- --1- keep missile 1 aligned with player 1
HMOVE  := $2A ; ---- ---- This address causes the horizontal motion register values to be acted upon during the horizontal blank time in which it occurs.
HMCLR  := $2B ; ---- ---- This address clears all horizontal motion registers to zero (no motion).
CXCLR  := $2C ; ---- ---- clears all collision latches

; TIA read registers

CXM0P  := $00 ;   xx00 0000       Read Collision  M0-P1   M0-P0
CXM1P  := $01 ;   xx00 0000                       M1-P0   M1-P1
CXP0FB := $02 ;   xx00 0000                       P0-PF   P0-BL
CXP1FB := $03 ;   xx00 0000                       P1-PF   P1-BL
CXM0FB := $04 ;   xx00 0000                       M0-PF   M0-BL
CXM1FB := $05 ;   xx00 0000                       M1-PF   M1-BL
CXBLPF := $06 ;   x000 0000                       BL-PF   -----
CXPPMM := $07 ;   xx00 0000                       P0-P1   M0-M1
INPT0  := $08 ;   x000 0000       Read Pot Port 0
INPT1  := $09 ;   x000 0000       Read Pot Port 1
INPT2  := $0A ;   x000 0000       Read Pot Port 2
INPT3  := $0B ;   x000 0000       Read Pot Port 3
INPT4  := $0C ;		x000 0000       Read Input (Trigger) 0
INPT5  := $0D ;		x000 0000       Read Input (Trigger) 1

; RIOT

SWCHA  := $0280
SWACNT := $0281
SWCHB  := $0282
SWBCNT := $0283
INTIM  := $0284 ; Timer output
TIMINT := $0285

TIM1T  := $0294
TIM8T  := $0295
TIM64T := $0296
TIM1024T := $0297

;-------------------------------------------------------------------------------
; SLEEP duration
; Original author: Thomas Jentzsch
; Inserts code which takes the specified number of cycles to execute.  This is
; useful for code where precise timing is required.
; ILLEGAL-OPCODE VERSION DOES NOT AFFECT FLAGS OR REGISTERS.
; LEGAL OPCODE VERSION MAY AFFECT FLAGS
; Uses illegal opcode (DASM 2.20.01 onwards).

.macro SLEEP cycles
.if cycles < 0 || cycles = 1
.error "MACRO ERROR: 'SLEEP': Duration must be >= 2"
.endif
.if cycles & 1
.ifndef NO_ILLEGAL_OPCODES
	nop 0
.else
	bit VSYNC
.endif
.repeat (cycles-3)/2
	nop
.endrep
.else
.repeat cycles/2
	nop
.endrep
.endif
.endmacro

;-------------------------------------------------------------------------------
; VERTICAL_SYNC
; revised version by Edwin Blink -- saves bytes!
; Inserts the code required for a proper 3 scanline vertical sync sequence
; Note: Alters the accumulator

; OUT: A = 0

.macro VERTICAL_SYNC
  lda #%1110         ; each '1' bits generate a VSYNC ON line (bits 1..3)
: sta WSYNC          ; 1st '0' bit resets Vsync, 2nd '0' bit exit loop
  sta VSYNC
.ifdef VERTICAL_SYNC_MACRO
  pha
  VERTICAL_SYNC_MACRO
  pla
.endif
  lsr
  bne :-             ; branch until VYSNC has been reset
.endmacro

;-------------------------------------------------------
; Usage: TIMER_SETUP lines
; where lines is the number of scanlines to skip (> 2).
; The timer will be set so that it expires before this number
; of scanlines. A WSYNC will be done first.

.macro TIMER_SETUP lines
.local cycles
cycles = ((lines * 76) - 13)
; special case for when we have two timer events in a line
; and our 2nd event straddles the WSYNC boundary
	.if (cycles .mod 64) < 12
		lda #(cycles / 64) - 1
		sta WSYNC
        .else
		lda #(cycles / 64)
		sta WSYNC
        .endif
        sta TIM64T
.endmacro

;-------------------------------------------------------
; Use with TIMER_SETUP to wait for timer to complete.
; Performs a WSYNC afterwards.

.macro TIMER_WAIT
.local waittimer
waittimer:
        lda INTIM
        bne waittimer
        sta WSYNC
.endmacro

;-------------------------------------------------------------------------------
; CLEAN_START
; Original author: Andrew Davie
; Standardised start-up code, clears stack, all TIA registers and RAM to 0
; Sets stack pointer to $FF, and all registers to 0
; Sets decimal mode off, sets interrupt flag (kind of un-necessary)
; Use as very first section of code on boot (ie: at reset)
; Code written to minimise total ROM usage - uses weird 6502 knowledge :)

.macro CLEAN_START
.local CLEAR_STACK
                sei
                cld
                ldx #0
                txa
                tay
CLEAR_STACK:    dex
                txs
                pha
                bne CLEAR_STACK     ; SP=$FF, X = A = Y = 0
.endmacro

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
.macro SET_POINTER ptr, addr
	lda #<addr
        sta ptr
        lda #>addr
        sta ptr+1
.endmacro


; assume NTSC unless PAL defined
.ifndef PAL
PAL = 0
.endif

; 192 visible scanlines for NTSC, 228 for PAL
.if PAL
SCANLINES = 228
LINESD12 = 19
.else
SCANLINES = 192
LINESD12 = 16
.endif

; start of frame -- vsync and set back porch timer
.macro FRAME_START
	VERTICAL_SYNC
        .if PAL
        	TIMER_SETUP 44
        .else
                TIMER_SETUP 36
        .endif
.endmacro

; end of back porch -- start kernel
.macro KERNEL_START
        TIMER_WAIT
        lda #0
        sta VBLANK
       	.if !PAL
                TIMER_SETUP 194
        .endif
.endmacro

; end of kernel -- start front porch timer
.macro KERNEL_END
        .if !PAL
                TIMER_WAIT
        .endif
        lda #2
        sta VBLANK
        .if PAL
                TIMER_SETUP 36
        .else
                TIMER_SETUP 28
        .endif
.endmacro

; end of frame -- jump to frame start
.macro FRAME_END
        TIMER_WAIT
.endmacro

;-----------------------------------------------------------
; SLEEPR - sleep macro that uses JSR/RTS for 12 cycle delays
; Requires a lone RTS instruction with the label "Return"
; (note: may fool 8bitworkshop's Anaylze CPU Timing feature)

.macro SLEEPR cycles
.if cycles >= 14 || cycles = 12
	jsr Return
        SLEEPR (cycles-12)
.else
	SLEEP cycles
.endif
.endmacro

;-----------------------------------------------------------
; SLEEPH - sleep macro that uses PHA/PLA for 12 cycle delays

.macro SLEEPH cycles
.if cycles >= 9 || cycles = 7
	pha
	pla
	SLEEPH (cycles-7)
.else
	SLEEP cycles
.endif
.endmacro

