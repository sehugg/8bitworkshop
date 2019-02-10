
	include "nesdefs.asm"

;;;;; ZERO-PAGE VARIABLES

	seg.u ZEROPAGE
	org $0

;;;;; OTHER VARIABLES

	seg.u RAM
	org $300
        
LineXLo	ds 224
LineXHi	ds 224

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
        lda #MASK_BG|MASK_SPR
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
	sta PPU_DATA
        adc #7
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

; set sprite 0
SetSprite0: subroutine
	sta $200	;y
        lda #1		;code
        sta $201
        lda #0		;flags
        sta $202
        lda #8		;xpos
        sta $203
	rts

;;;;; COMMON SUBROUTINES

	include "nesppu.asm"

;;;;; INTERRUPT HANDLERS

NMIHandler: subroutine
	SAVE_REGS
        lda #112
        jsr SetSprite0
; load sprites
	lda #$02
        sta PPU_OAM_DMA
; wait for sprite 0
.wait0	bit PPU_STATUS
        bvs .wait0
.wait1	bit PPU_STATUS
        bvc .wait1
; alter horiz. scroll position for each scanline
        ldy #0
.loop
	tya
        sec
	adc LineXLo,y
        sta LineXLo,y
        lda LineXHi,y
        adc #0
        sta LineXHi,y
        sta PPU_SCROLL	; horiz byte
        lda #0
        sta PPU_SCROLL	; vert byte
        REPEAT 25
        bit $0000
        REPEND
        iny
        cpy #224
        bne .loop
        RESTORE_REGS
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
