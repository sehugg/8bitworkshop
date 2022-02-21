
; Fetchs the approximate scanline (could be off by +/- 1)
; into A. Takes 11 or 14 cycles.
	MAC GET_APPROX_SCANLINE
        ldy INTIM
        lda Timer2Scanline,y
        bne .Ok
        lda Timer2Scanline-1,y
.Ok
        ENDM
