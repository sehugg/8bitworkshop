
;-------------------------------------------------------
; Usage: TIMER_SETUP lines
; where lines is the number of scanlines to skip (> 2).
; The timer will be set so that it expires before this number
; of scanlines. A WSYNC will be done first.

    MAC TIMER_SETUP
.lines  SET {1}
        lda #(((.lines-1)*76-14)/64)
        sta WSYNC
        sta TIM64T
    ENDM

;-------------------------------------------------------
; Use with TIMER_SETUP to wait for timer to complete.
; You may want to do a WSYNC afterwards, since the timer
; is not accurate to the beginning/end of a scanline.

    MAC TIMER_WAIT
.waittimer
        lda INTIM
        bne .waittimer
    ENDM
