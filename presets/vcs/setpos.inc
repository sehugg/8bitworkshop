
; SetHorizPos - Sets the horizontal position of an object.
; The X register contains the index of the desired object:
;  X=0: player 0
;  X=1: player 1
;  X=2: missile 0
;  X=3: missile 1
;  X=4: ball
; NOTE: This version of the routine does a NEWLINE before executing.
; It does NOT do a HMOVE and HCLR.
SetHorizPos subroutine
	sec		; set carry flag
	sta WSYNC	; start a new line
.DivideLoop
	sbc #15		; subtract 15
	bcs .DivideLoop	; branch until negative
	eor #7		; calculate fine offset
	asl
	asl
	asl
	asl
	sta HMP0,x	; set fine offset
	sta RESP0,x	; fix coarse position
	rts		; return to caller

