
	.segment "INIT"
	.segment "ONCE"
	.segment "STARTUP"
	.segment "CODE"

Loop:
	lda $480,y
        clc
        adc #1
        sta $480,y
        iny
        bne Loop
        jmp Loop
