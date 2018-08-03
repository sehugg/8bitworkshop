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

; fill video RAM
FillVRAM: subroutine
	txa
	ldy #$20
	sty PPU_ADDR
	sta PPU_ADDR
	ldy #$10
.loop:
	sta PPU_DATA
        adc #7
	inx
	bne .loop
	dey
	bne .loop
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

