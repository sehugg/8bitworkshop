
; Assembler should use basic 6502 instructions
	processor 6502
	
; Include files for Atari 2600 constants and handy macro routines
	include "vcs.h"
	include "macro.h"
	
; Here we're going to introduce the 6502 (the CPU) and
; the TIA (the chip that generates the video signal).
; There's no frame buffer, so you have to program the TIA
; before (or during) each scanline.
; We're just going to initialize the system and put some
; color on the TV.

; 4K Atari 2600 ROMs usually start at address $F000
	org  $f000

; Typical initialization routine
; ('start' is a label because it's on the left margin)
Start   sei		; disable interrupts
	cld		; disable BCD math mode
	ldx  #$ff	; init stack pointer to $FF (grows upward)
	txs		; ... transfer X register to S register (stack pointer)

; Another typical thing is to clear the zero page region ($00-$FF)
; This includes a bunch of TIA registers as well as RAM ($80-$FF)
	lda  #$00	; set A register to zero ('#' denotes constant)
; X register is already at $ff from previous instruction, so let's loop...
Zero    sta  $00,X	; store A register at address ($0 + X)
	dex		; decrement X by one
	bne  Zero	; branch until X is zero
        sta  $00	; the loop doesn't cover address 0

; Set background color
	lda #$30	;load value into A ($30 is deep red on NTSC)
	sta COLUBK	;put the value of A into the background color register

; Nothing else to do, so let's start over.
; There's no vertical sync logic, and the zero-page clearing routine 
; will run again, so you'll see alternating black and red lines.
	jmp Start
	
; Here we skip to address $FFFC and define a word with the
; address of where the CPU should start fetching instructions.
; This also fills out the ROM size to $1000 (4k) bytes
	org $fffc
	.word Start
	.word Start
