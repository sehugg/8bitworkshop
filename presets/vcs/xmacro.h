
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
