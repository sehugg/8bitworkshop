
	include "nesdefs.asm"

;;;;; VARIABLES

	seg.u RAM
	org $0

ScrollPos	byte	; used during NMI
Rand		byte
Temp1		byte

SpriteBuf	equ	$200

;;;;; NES CARTRIDGE HEADER

	NES_HEADER 0,2,1,0 ; mapper 0, 2 PRGs, 1 CHR, horiz. mirror

;;;;; START OF CODE

Start:
	NES_INIT		; set up stack pointer, turn off PPU
        jsr WaitSync
        jsr WaitSync
        jsr ClearRAM
        jsr WaitSync		;wait for VSYNC
	jsr SetPalette		;set colors
        jsr FillVRAM		;set PPU RAM
        jsr WaitSync		;wait for VSYNC (and PPU warmup)
        jsr InitSprites
        lda #0
        sta PPU_ADDR
        sta PPU_ADDR		;PPU addr = 0
        sta PPU_SCROLL
        sta PPU_SCROLL		;scroll = 0
        lda #CTRL_NMI
        sta PPU_CTRL	; enable NMI
        lda #MASK_BG|MASK_SPR
        sta PPU_MASK 	; enable rendering
.endless
	jmp .endless		;endless loop

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

;
InitSprites: subroutine
	lda #1
        ldx #0
.loop
	sta SpriteBuf,x
        jsr NextRandom
        inx
        bne .loop
        rts

;
MoveSprites: subroutine
	lda #1
        ldx #0
.loop
	sta Temp1
        and #3
        clc
        adc SpriteBuf,x
	sta SpriteBuf,x
        lda Temp1
        jsr NextRandom
        inx
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
	SAVE_REGS
; load sprites
	lda #$02
        sta PPU_OAM_DMA
; update scroll position (must be done after VRAM updates)
	inc ScrollPos
        lda ScrollPos
        sta PPU_SCROLL
        lda #0
        sta PPU_SCROLL
; move sprites
	jsr MoveSprites
; reload registers
        RESTORE_REGS
	rti

;;;;; CONSTANT DATA

	align $100
Palette:
	hex 1f		;background
	hex 09090000	;bg0
        hex 09090c00	;bg1
        hex 09091c00	;bg2
        hex 09092c00	;bg3
        hex 14243400	;sp0
        hex 15253500	;sp1
        hex 16263600	;sp2
        hex 17273700	;sp3

;;;;; CPU VECTORS

	NES_VECTORS

;;;;; TILE SETS

	org $10000
        incbin "jroatch.chr"
