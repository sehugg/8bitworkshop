
;;;;; SUBROUTINES

ClearRAM: subroutine
	lda #0		; A = 0
        tax		; X = 0
.clearRAM
	sta $0,x	; clear $0-$ff
        cpx #$fe	; last 2 bytes of stack?
        bcs .skipStack	; don't clear it
	sta $100,x	; clear $100-$1fd
.skipStack
	sta $200,x	; clear $200-$2ff
	sta $300,x	; clear $300-$3ff
	sta $400,x	; clear $400-$4ff
	sta $500,x	; clear $500-$5ff
	sta $600,x	; clear $600-$6ff
	sta $700,x	; clear $700-$7ff
        inx		; X = X + 1
        bne .clearRAM	; loop 256 times
        rts

; wait for VSYNC to start
WaitSync:
	bit PPU_STATUS
	bpl WaitSync
        rts

;;;;; RANDOM NUMBERS

NextRandom subroutine
	lsr
        bcc .NoEor
        eor #$d4
.NoEor:
	rts
; Get previous random value
PrevRandom subroutine
	asl
        bcc .NoEor
        eor #$a9
.NoEor:
        rts

;;;;; CONTROLLER READING

ReadJoypad0 subroutine
	ldy #0
ReadJoypadY
        lda #$01
        sta JOYPAD1,y	; set strobe bit
        lsr        	; now A is 0
        sta JOYPAD1,y	; clear strobe bit
        ldx #8		; read 8 bits
.loop:
	pha		; save A (result)
        lda JOYPAD1,y	; load controller state
        lsr        	; bit 0 -> carry
        pla		; restore A (result)
        rol		; carry -> bit 0 of result
        dex		; X = X - 1
        bne .loop	; repeat if X is 0
        rts		; controller bits returned in A

