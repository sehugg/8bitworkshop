
;;;;; SUBROUTINES

ClearRAM: subroutine
	lda #0
        tax
.clearRAM
	sta $0,x
        cpx #$fe	; don't clear last 2 bytes of stack
        bcs .skipStack
	sta $100,x
.skipStack
        ; skip $200-$2FF, used for OAM display list
	sta $300,x
	sta $400,x
	sta $500,x
	sta $600,x
	sta $700,x
        inx
        bne .clearRAM
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

