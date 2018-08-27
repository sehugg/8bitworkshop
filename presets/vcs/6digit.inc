
        seg.u Variables

; Pointers to bitmap for each digit
Digit0		.word
Digit1		.word
Digit2		.word
Digit3		.word
Digit4		.word
Digit5		.word

BCDScore	hex 000000

THREE_COPIES    equ %011 ; for NUSIZ registers

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

	seg Code

; Adds value to 6-BCD-digit score.
; A = 1st BCD digit
; X = 2nd BCD digit
; Y = 3rd BCD digit
AddScore: subroutine
.temp	equ Temp1
        sed	; enter BCD mode
        clc	; clear carry
        sta .temp
        lda BCDScore
        adc .temp
        sta BCDScore
        stx .temp
        lda BCDScore+1
        adc .temp
        sta BCDScore+1
        sty .temp
        lda BCDScore+2
        adc .temp
        sta BCDScore+2
        cld	; exit BCD mode
        rts

GetDigitPtrs: subroutine
	ldx #0	; leftmost bitmap
        ldy #2	; start from most-sigificant BCD value
.Loop
        lda BCDScore,y	; get BCD value
        and #$f0	; isolate high nibble (* 16)
        lsr		; shift right 1 bit (* 8)
        sta Digit0,x	; store pointer lo byte
        lda #>Digit6Font
        sta Digit0+1,x	; store pointer hi byte
        inx
        inx		; next bitmap pointer
        lda BCDScore,y	; get BCD value (again)
        and #$f		; isolate low nibble
        asl
        asl
        asl		; * 8
        sta Digit0,x	; store pointer lo byte
        lda #>Digit6Font
        sta Digit0+1,x	; store pointer hi byte
        inx
        inx		; next bitmap pointer
        dey		; next BCD value
        bpl .Loop	; repeat until < 0
	rts

; Display the resulting 48x8 bitmap
; using the Digit0-5 pointers.
; A = color of scoreboard
DrawDigits: subroutine
.temp	equ Temp1
.count	equ Temp2
; clear player bitmaps first
	jsr ClearGRP
; set colors
        sta COLUP0
        sta COLUP1
; set horizontal position of player objects
        sta WSYNC
; instead of SLEEP 26...
        lda #THREE_COPIES
        sta NUSIZ0
        sta NUSIZ1
        lda #1
        sta VDELP0
        sta VDELP1
        lda #$10
        sta HMP1
        stx HMP0	; x = 0
        nop
; set player positions (26 cycles later)
        stx RESP0
        stx RESP1
        stx REFP0
        stx REFP1
; apply fine adjustment
        sta WSYNC
        sta HMOVE
        sta HMCLR
        lda #8
        sta .count	; 8 scanlines
        jsr ClearGRP	; just killing some time...
.bigloop
	ldy .count	; counts backwards
        lda (Digit0),y	; load B0 (1st sprite byte)
        sta GRP0	; B0 -> [GRP0]
        lda (Digit1),y	; load B1 -> A
        sta GRP1	; B1 -> [GRP1], B0 -> GRP0
        sta WSYNC	; sync to next scanline
        lda (Digit2),y	; load B2 -> A
        sta GRP0	; B2 -> [GRP0], B1 -> GRP1
        lda (Digit5),y	; load B5 -> A
        sta .temp	; B5 -> temp
        lda (Digit4),y	; load B4
        tax		; -> X
        lda (Digit3),y	; load B3 -> A
        ldy .temp	; load B5 -> Y
.storegrp
        sta GRP1	; B3 -> [GRP1]; B2 -> GRP0
        stx GRP0	; B4 -> [GRP0]; B3 -> GRP1
        sty GRP1	; B5 -> [GRP1]; B4 -> GRP0
        sta GRP0	; ?? -> [GRP0]; B5 -> GRP1
        dec .count	; go to next line
	bpl .bigloop	; repeat until < 0
ClearGRP
        ldx #0		; empty out player bitmaps
        stx GRP0
        stx GRP1
        stx GRP0
        stx GRP1
        rts

; Font table for digits 0-9 (8x8 pixels)
        align $100 ; make sure data doesn't cross page boundary
Digit6Font:
	hex 003c6666766e663c007e181818381818
        hex 007e60300c06663c003c66061c06663c
        hex 0006067f661e0e06003c6606067c607e
        hex 003c66667c60663c00181818180c667e
        hex 003c66663c66663c003c66063e66663c
	hex 00 ; so top of 9 is clean
