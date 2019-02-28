
	include "nesdefs.asm"

;;;;; VARIABLES

	seg.u RAM
	org $0

ScrollPos	word	; used during NMI
Rand		byte	; random number
Temp1		byte	; temporary

; OAM sprite buffer
SpriteBuf	equ	$200

;;;;; NES CARTRIDGE HEADER

	NES_HEADER 0,2,1,1 ; mapper 0, 2 PRGs, 1 CHR, horiz. mirror

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
	PPU_SETADDR	$2000
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
	PPU_SETADDR	$3f00
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
	SAVE_REGS
; update scroll position (must be done after VRAM updates)
	inc ScrollPos	; increment low byte
        bne .noinc	; Z flag set if wrapped to 0
        inc ScrollPos+1	; increment high byte
.noinc
; store X and Y scroll position
        lda ScrollPos	; A -> low byte
        sta PPU_SCROLL	; set horiz scroll
        lda #0		; A -> zero
        sta PPU_SCROLL	; set vert scroll
; store 8th bit into name table selector
; name table A or B ($2000 or $2400)
	lda ScrollPos+1	; load high byte
        and #1		; select its low bit
	ora #CTRL_NMI	; set rest of bits
        sta PPU_CTRL
; load sprites
	lda #$02	; page 2 ($0200)
        sta PPU_OAM_DMA	; start DMA transfer
; move sprites
	jsr MoveSprites	; move sprites
; restore registers, return from interrupt
        RESTORE_REGS
	rti

;;;;; CONSTANT DATA

Palette:
	hex 1f		;screen color
	hex 09092c00	;background 0
        hex 09091900	;background 1
        hex 09091500	;background 2
        hex 09092500	;background 3
        hex 14243400	;sprite 0
        hex 15253500	;sprite 1
        hex 16263600	;sprite 2
        hex 17273700	;sprite 3

;;;;; CPU VECTORS

	NES_VECTORS

;;;;; TILE SETS

	org $10000
        incbin "jroatch.chr"
