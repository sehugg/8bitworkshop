
	processor 6502
	include "vcs.h"
	include "macro.h"

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
;
; Besides the two 8x1 sprites ("players") the TIA has
; two "missiles" and one "ball", which are just variable-length
; dots or dashes. They have similar positioning and display
; requirements, so we're going to make a subroutine that can
; set the horizontal position of any of them.
; But we can also use the HMPx/HMOVE registers directly to move the
; objects by small offsets without using this routine every time.
;
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

	org  $f000

counter	equ $81

; Initialize and set initial offsets of objects.
start	CLEAN_START
	lda #10
	ldx #0
	jsr SetHorizPos	; set player 0 horiz. pos
	inx
	lda #130
	jsr SetHorizPos	; set player 1 horiz. pos
	inx
	lda #40
	jsr SetHorizPos	; set missile 0 horiz. pos
	lda #$10
	sta NUSIZ0	; make missile 0 2x-wide
	inx
	lda #70
	jsr SetHorizPos	; set missile 1 horiz. pos
	lda #$20
	sta NUSIZ1	; make missile 1 4x-wide
	inx
	lda #100
	jsr SetHorizPos	; set ball horiz. pos
	lda #$30
	sta CTRLPF	; set ball 8x-wide
	sta WSYNC
	sta HMOVE
; We've technically generated an invalid frame because
; these operations have generated superfluous WSYNCs.
; But it's just at the beginning of our program, so whatever.

; Next frame loop
nextframe
	VERTICAL_SYNC
	
; 36 lines of VBLANK
	ldx #36
lvblank	sta WSYNC
	dex
	bne lvblank

; Draw 192 scanlines
; We're going to draw both players, both missiles, and the ball
; straight down the screen. We can draw various kinds of vertical
; lines this way.
	ldx #192
	stx COLUBK	; set the background color
	lda #0		; A changes every scanline
	ldy #0		; Y is sprite data index
lvscan
	sta WSYNC	; wait for next scanline
	lda NUMBERS,y
	sta GRP0	; set sprite 0 pixels
	sta GRP1	; set sprite 1 pixels
	tya		; we'll use the Y position, only the 2nd bit matters
	sta ENAM0	; enable/disable missile 0
	sta ENAM1	; enable/disable missile 1
	sta ENABL	; enable/disable ball
	iny
	cpy #60
	bne wrap1	; wrap Y at 60 to 0
	ldy #0
wrap1
	dex
	bne lvscan	; repeat next scanline until finished
	
; Clear all colors to black before overscan
	stx COLUBK
	stx COLUP0
	stx COLUP1
	stx COLUPF
; 30 lines of overscan
	ldx #25
lvover	sta WSYNC
	dex
	bne lvover
	
; Move all the objects by a different offset using HMP/HMOVE registers
; We'll hard-code the offsets in a table for now
	ldx #0
hmoveloop
	lda MOVEMENT,x
	sta HMCLR
	sta HMP0,x
	sta WSYNC
	sta HMOVE
	inx
	cpx #5
	bcc hmoveloop
; This loop also gave us 5 extra scanlines = 30 total

; Cycle the sprite colors for the next frame
	inc counter
	lda counter
	sta COLUP0
	clc
	ror
	sta COLUP1
	clc
	ror
	sta COLUPF
	jmp nextframe

; SetHorizPos - Sets the horizontal position of an object.
; The X register contains the index of the desired object:
;  X=0: player 0
;  X=1: player 1
;  X=2: missile 0
;  X=3: missile 1
;  X=4: ball
; This routine does a WSYNC and HMOVE before executing,
; so whatever you do here will not take effect until you
; call the routine again or do your own WSYNC and HMOVE.
SetHorizPos
	sta WSYNC	; start a new line
	sta HMOVE	; apply the previous fine position(s)
	sta HMCLR	; reset the old horizontal position(s)
	sec		; set carry flag
DivideLoop
	sbc #15		; subtract 15
	bcs DivideLoop	; branch until negative
	eor #7		; calculate fine offset
	asl
	asl
	asl
	asl
	sta RESP0,x	; fix coarse position
	sta HMP0,x	; set fine offset
	rts		; return to caller

; Hard-coded  values for movement registers
MOVEMENT
	.byte $f0	; +1 pixels
	.byte $e0	; +2 pixels
	.byte $c0	; +4 pixels
	.byte $10	; -1 pixels
	.byte $20	; -2 pixels

; Bitmap pattern for digits
NUMBERS ;;{w:8,h:6,count:10,brev:1};;
        .byte $EE,$AA,$AA,$AA,$EE,$00
        .byte $22,$22,$22,$22,$22,$00
        .byte $EE,$22,$EE,$88,$EE,$00
        .byte $EE,$22,$66,$22,$EE,$00
        .byte $AA,$AA,$EE,$22,$22,$00
        .byte $EE,$88,$EE,$22,$EE,$00
        .byte $EE,$88,$EE,$AA,$EE,$00
        .byte $EE,$22,$22,$22,$22,$00
        .byte $EE,$AA,$EE,$AA,$EE,$00
        .byte $EE,$AA,$EE,$22,$EE,$00
;;end

; Epilogue
	org $fffc
	.word start
	.word start
