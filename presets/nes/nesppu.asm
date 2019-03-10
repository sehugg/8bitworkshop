
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

