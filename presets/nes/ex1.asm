
	include "nesdefs.asm"

;;;;; VARIABLES

	seg.u RAM
	org $0

ScrollPos	byte	; used during NMI

;;;;; NES CARTRIDGE HEADER

	NES_HEADER 0,2,1,0 ; mapper 0, 2 PRGs, 1 CHR, vertical

;;;;; START OF CODE

Start:
	NES_INIT	; set up stack pointer, turn off PPU
        jsr WaitSync	; wait for VSYNC
        jsr ClearRAM	; clear RAM
	jsr SetPalette	; set palette colors
        jsr FillVRAM	; set PPU video RAM
        jsr WaitSync	; wait for VSYNC (and PPU warmup)
        lda #0
        sta PPU_ADDR
        sta PPU_ADDR	; PPU addr = $0000
        sta PPU_SCROLL
        sta PPU_SCROLL  ; scroll = $0000
        lda #CTRL_NMI
        sta PPU_CTRL	; enable NMI
        lda #MASK_SPR|MASK_BG|MASK_SPR_CLIP|MASK_BG_CLIP
        sta PPU_MASK 	; enable rendering
.endless
	jmp .endless	; endless loop

; fill video RAM
FillVRAM: subroutine
	txa
	ldy #$20
	sty PPU_ADDR
	sta PPU_ADDR	; PPU addr = $2000
	ldy #$10	; $10 (16) 256-byte pages
.loop:
	sta PPU_DATA	; write to VRAM
        adc #7		; add 7 to make randomish pattern
	inx
	bne .loop
	dey		; next page
	bne .loop	; out of pages?
        rts

; set palette colors
SetPalette: subroutine
        ldy #$00
	lda #$3f
	sta PPU_ADDR
	sty PPU_ADDR	; PPU addr = 0x3f00
	ldx #32		; 32 palette colors
.loop:
	lda Palette,y	; load from ROM
	sta PPU_DATA	; store to palette
        iny
	dex
	bne .loop	; loop until 32 colors stored
        rts


;;;;; COMMON SUBROUTINES

	include "nesppu.asm"

;;;;; INTERRUPT HANDLERS

NMIHandler:
; save registers
	pha	; save A
; update scroll position (must be done after VRAM updates)
	inc ScrollPos
        lda ScrollPos
        sta PPU_SCROLL	; X scroll position
        lda #0
        sta PPU_SCROLL	; Y scroll position
; reload registers
        pla	; reload A
	rti

;;;;; CONSTANT DATA

	align $100
Palette:
	hex 1f		;background
	hex 09091900	;bg0
        hex 09091900	;bg1
        hex 09091900	;bg2
        hex 09091900	;bg3

;;;;; CPU VECTORS

	NES_VECTORS

;;;;; TILE SETS

	org $10000
	REPEAT 64
	hex 003c6666766e663c007e181818381818
        hex 007e60300c06663c003c66061c06663c
        hex 0006067f661e0e06003c6606067c607e
        hex 003c66667c60663c00181818180c667e
        hex 003c66663c66663c003c66063e66663c
        hex 01010101010101010000000000000000
        hex ff000000000000000000000000000000
        hex 01020408102040800000000000000000
	REPEND
