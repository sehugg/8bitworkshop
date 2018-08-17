; VCS.H
; Version 1.05, 13/November/2003

VERSION_VCS         = 105

; THIS IS A PRELIMINARY RELEASE OF *THE* "STANDARD" VCS.H
; THIS FILE IS EXPLICITLY SUPPORTED AS A DASM-PREFERRED COMPANION FILE
; PLEASE DO *NOT* REDISTRIBUTE THIS FILE!
;
; This file defines hardware registers and memory mapping for the
; Atari 2600. It is distributed as a companion machine-specific support package
; for the DASM compiler. Updates to this file, DASM, and associated tools are
; available at at http://www.atari2600.org/dasm
;
; Many thanks to the original author(s) of this file, and to everyone who has
; contributed to understanding the Atari 2600.  If you take issue with the
; contents, or naming of registers, please write to me (atari2600@taswegian.com)
; with your views.  Please contribute, if you think you can improve this
; file!
;
; Latest Revisions...
; 1.05  13/NOV/2003      - Correction to 1.04 - now functions as requested by MR.
;                        - Added VERSION_VCS equate (which will reflect 100x version #)
;                          This will allow conditional code to verify VCS.H being
;                          used for code assembly.
; 1.04  12/NOV/2003     Added TIA_BASE_WRITE_ADDRESS and TIA_BASE_READ_ADDRESS for
;                       convenient disassembly/reassembly compatibility for hardware
;                       mirrored reading/writing differences.  This is more a 
;                       readability issue, and binary compatibility with disassembled
;                       and reassembled sources.  Per Manuel Rotschkar's suggestion.
; 1.03  12/MAY/2003     Added SEG segment at end of file to fix old-code compatibility
;                       which was broken by the use of segments in this file, as
;                       reported by Manuel Polik on [stella] 11/MAY/2003
; 1.02  22/MAR/2003     Added TIMINT($285)
; 1.01	        		Constant offset added to allow use for 3F-style bankswitching
;						 - define TIA_BASE_ADDRESS as $40 for Tigervision carts, otherwise
;						   it is safe to leave it undefined, and the base address will
;						   be set to 0.  Thanks to Eckhard Stolberg for the suggestion.
;                          Note, may use -DLABEL=EXPRESSION to define TIA_BASE_ADDRESS
;                        - register definitions are now generated through assignment
;                          in uninitialised segments.  This allows a changeable base
;                          address architecture.
; 1.0	22/MAR/2003		Initial release


;-------------------------------------------------------------------------------

; TIA_BASE_ADDRESS
; The TIA_BASE_ADDRESS defines the base address of access to TIA registers.
; Normally 0, the base address should (externally, before including this file)
; be set to $40 when creating 3F-bankswitched (and other?) cartridges.
; The reason is that this bankswitching scheme treats any access to locations
; < $40 as a bankswitch.

			IFNCONST TIA_BASE_ADDRESS
TIA_BASE_ADDRESS	= 0
			ENDIF

; Note: The address may be defined on the command-line using the -D switch, eg:
; dasm.exe code.asm -DTIA_BASE_ADDRESS=$40 -f3 -v5 -ocode.bin
; *OR* by declaring the label before including this file, eg:
; TIA_BASE_ADDRESS = $40
;   include "vcs.h"

; Alternate read/write address capability - allows for some disassembly compatibility
; usage ; to allow reassembly to binary perfect copies).  This is essentially catering
; for the mirrored ROM hardware registers.

; Usage: As per above, define the TIA_BASE_READ_ADDRESS and/or TIA_BASE_WRITE_ADDRESS
; using the -D command-line switch, as required.  If the addresses are not defined, 
; they defaut to the TIA_BASE_ADDRESS.

     IFNCONST TIA_BASE_READ_ADDRESS
TIA_BASE_READ_ADDRESS = TIA_BASE_ADDRESS
     ENDIF

     IFNCONST TIA_BASE_WRITE_ADDRESS
TIA_BASE_WRITE_ADDRESS = TIA_BASE_ADDRESS
     ENDIF

;-------------------------------------------------------------------------------

			SEG.U TIA_REGISTERS_WRITE
			ORG TIA_BASE_WRITE_ADDRESS

	; DO NOT CHANGE THE RELATIVE ORDERING OF REGISTERS!
    
VSYNC       ds 1    ; $00   0000 00x0   Vertical Sync Set-Clear
VBLANK		ds 1	; $01   xx00 00x0   Vertical Blank Set-Clear
WSYNC		ds 1	; $02   ---- ----   Wait for Horizontal Blank
RSYNC		ds 1	; $03   ---- ----   Reset Horizontal Sync Counter
NUSIZ0		ds 1	; $04   00xx 0xxx   Number-Size player/missle 0
NUSIZ1		ds 1	; $05   00xx 0xxx   Number-Size player/missle 1
COLUP0		ds 1	; $06   xxxx xxx0   Color-Luminance Player 0
COLUP1      ds 1    ; $07   xxxx xxx0   Color-Luminance Player 1
COLUPF      ds 1    ; $08   xxxx xxx0   Color-Luminance Playfield
COLUBK      ds 1    ; $09   xxxx xxx0   Color-Luminance Background
CTRLPF      ds 1    ; $0A   00xx 0xxx   Control Playfield, Ball, Collisions
REFP0       ds 1    ; $0B   0000 x000   Reflection Player 0
REFP1       ds 1    ; $0C   0000 x000   Reflection Player 1
PF0         ds 1    ; $0D   xxxx 0000   Playfield Register Byte 0
PF1         ds 1    ; $0E   xxxx xxxx   Playfield Register Byte 1
PF2         ds 1    ; $0F   xxxx xxxx   Playfield Register Byte 2
RESP0       ds 1    ; $10   ---- ----   Reset Player 0
RESP1       ds 1    ; $11   ---- ----   Reset Player 1
RESM0       ds 1    ; $12   ---- ----   Reset Missle 0
RESM1       ds 1    ; $13   ---- ----   Reset Missle 1
RESBL       ds 1    ; $14   ---- ----   Reset Ball
AUDC0       ds 1    ; $15   0000 xxxx   Audio Control 0
AUDC1       ds 1    ; $16   0000 xxxx   Audio Control 1
AUDF0       ds 1    ; $17   000x xxxx   Audio Frequency 0
AUDF1       ds 1    ; $18   000x xxxx   Audio Frequency 1
AUDV0       ds 1    ; $19   0000 xxxx   Audio Volume 0
AUDV1       ds 1    ; $1A   0000 xxxx   Audio Volume 1
GRP0        ds 1    ; $1B   xxxx xxxx   Graphics Register Player 0
GRP1        ds 1    ; $1C   xxxx xxxx   Graphics Register Player 1
ENAM0       ds 1    ; $1D   0000 00x0   Graphics Enable Missle 0
ENAM1       ds 1    ; $1E   0000 00x0   Graphics Enable Missle 1
ENABL       ds 1    ; $1F   0000 00x0   Graphics Enable Ball
HMP0        ds 1    ; $20   xxxx 0000   Horizontal Motion Player 0
HMP1        ds 1    ; $21   xxxx 0000   Horizontal Motion Player 1
HMM0        ds 1    ; $22   xxxx 0000   Horizontal Motion Missle 0
HMM1        ds 1    ; $23   xxxx 0000   Horizontal Motion Missle 1
HMBL        ds 1    ; $24   xxxx 0000   Horizontal Motion Ball
VDELP0      ds 1    ; $25   0000 000x   Vertical Delay Player 0
VDELP1      ds 1    ; $26   0000 000x   Vertical Delay Player 1
VDELBL      ds 1    ; $27   0000 000x   Vertical Delay Ball
RESMP0      ds 1    ; $28   0000 00x0   Reset Missle 0 to Player 0
RESMP1      ds 1    ; $29   0000 00x0   Reset Missle 1 to Player 1
HMOVE       ds 1    ; $2A   ---- ----   Apply Horizontal Motion
HMCLR       ds 1    ; $2B   ---- ----   Clear Horizontal Move Registers
CXCLR       ds 1    ; $2C   ---- ----   Clear Collision Latches
 
;-------------------------------------------------------------------------------

			SEG.U TIA_REGISTERS_READ
			ORG TIA_BASE_READ_ADDRESS

                    ;											bit 7   bit 6
CXM0P       ds 1    ; $00       xx00 0000       Read Collision  M0-P1   M0-P0
CXM1P       ds 1    ; $01       xx00 0000                       M1-P0   M1-P1
CXP0FB      ds 1    ; $02       xx00 0000                       P0-PF   P0-BL
CXP1FB      ds 1    ; $03       xx00 0000                       P1-PF   P1-BL
CXM0FB      ds 1    ; $04       xx00 0000                       M0-PF   M0-BL
CXM1FB      ds 1    ; $05       xx00 0000                       M1-PF   M1-BL
CXBLPF      ds 1    ; $06       x000 0000                       BL-PF   -----
CXPPMM      ds 1    ; $07       xx00 0000                       P0-P1   M0-M1
INPT0       ds 1    ; $08       x000 0000       Read Pot Port 0
INPT1       ds 1    ; $09       x000 0000       Read Pot Port 1
INPT2       ds 1    ; $0A       x000 0000       Read Pot Port 2
INPT3       ds 1    ; $0B       x000 0000       Read Pot Port 3
INPT4       ds 1    ; $0C		x000 0000       Read Input (Trigger) 0
INPT5       ds 1	; $0D		x000 0000       Read Input (Trigger) 1

;-------------------------------------------------------------------------------

			SEG.U RIOT
			ORG $280
 
	; RIOT MEMORY MAP

SWCHA       ds 1    ; $280      Port A data register for joysticks:
					;			Bits 4-7 for player 1.  Bits 0-3 for player 2.

SWACNT      ds 1    ; $281      Port A data direction register (DDR)
SWCHB       ds 1    ; $282		Port B data (console switches)
SWBCNT      ds 1    ; $283      Port B DDR
INTIM       ds 1    ; $284		Timer output

TIMINT  	ds 1	; $285

		; Unused/undefined registers ($285-$294)

			ds 1	; $286
			ds 1	; $287
			ds 1	; $288
			ds 1	; $289
			ds 1	; $28A
			ds 1	; $28B
			ds 1	; $28C
			ds 1	; $28D
			ds 1	; $28E
			ds 1	; $28F
			ds 1	; $290
			ds 1	; $291
			ds 1	; $292
			ds 1	; $293

TIM1T       ds 1    ; $294		set 1 clock interval
TIM8T       ds 1    ; $295      set 8 clock interval
TIM64T      ds 1    ; $296      set 64 clock interval
T1024T      ds 1    ; $297      set 1024 clock interval

;-------------------------------------------------------------------------------
; The following required for back-compatibility with code which does not use
; segments.

            SEG

; EOF
