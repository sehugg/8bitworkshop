
	include "nesdefs.asm"

;;;;; VARIABLES

	seg.u RAM
	org $0

ScrollPos	byte	; used during NMI

;;;;; NES CARTRIDGE HEADER

	NES_HEADER 0,2,1,0 ; mapper 0, 2 PRGs, 1 CHR, horiz. mirror

;;;;; START OF CODE

Start:
	NES_INIT	; set up stack pointer, turn off PPU
        jsr WaitSync	; wait for VSYNC
        jsr ClearRAM	; clear RAM
        jsr WaitSync	; wait for VSYNC (and PPU warmup)

	jsr SetPalette	; set palette colors
        jsr FillVRAM	; set PPU video RAM
        lda #0
        sta PPU_ADDR
        sta PPU_ADDR	; PPU addr = $0000
        sta PPU_SCROLL
        sta PPU_SCROLL  ; scroll = $0000
        lda #CTRL_NMI
        sta PPU_CTRL	; enable NMI
        lda #MASK_BG
        sta PPU_MASK 	; enable rendering
.endless
	jmp .endless	; endless loop

; fill video RAM
FillVRAM: subroutine
	txa
	ldy #$20
	sty PPU_ADDR
	sta PPU_ADDR
	ldy #$10
.loop:
	stx PPU_DATA
	inx
	bne .loop
	dey
	bne .loop
        rts

; set palette colors
SetPalette: subroutine
        ldy #$00
	lda #$3f
	sta PPU_ADDR
	sty PPU_ADDR
	ldx #32
.loop:
	lda Palette,y
	sta PPU_DATA
        iny
	dex
	bne .loop
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
        sta PPU_SCROLL	; horiz byte
        lda #0
        sta PPU_SCROLL	; vert byte
; reload registers
        pla	; reload A
	rti

;;;;; CONSTANT DATA

	align $100
Palette:
	hex 1f		;background
	hex 09092c00	;bg0
        hex 09091900	;bg1
        hex 09091500	;bg2
        hex 09092500	;bg3

;;;;; CPU VECTORS

	NES_VECTORS

;;;;; TILE SETS

	org $10000
        incbin "jroatch.chr"

