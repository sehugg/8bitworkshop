
;;;;; CONSTANTS

PPU_CTRL	equ $2000
PPU_MASK	equ $2001
PPU_STATUS	equ $2002
OAM_ADDR	equ $2003
OAM_DATA	equ $2004
PPU_SCROLL	equ $2005
PPU_ADDR	equ $2006
PPU_DATA	equ $2007
PPU_OAM_DMA	equ $4014
DMC_FREQ	equ $4010

;;;;; ZERO-PAGE VARIABLES

        seg.u ZPVars
	org $0

ScrollPos	byte	; used during NMI

;;;;; CARTRIDGE FILE HEADER

	processor 6502
	seg Header
        org $7FF0

NES_MAPPER	equ 0	;mapper number
NES_PRG_BANKS	equ 2	;number of 16K PRG banks, change to 2 for NROM256
NES_CHR_BANKS	equ 1	;number of 8K CHR banks (0 = RAM)
NES_MIRRORING	equ 1	;0 horizontal, 1 vertical, 8 four screen

	.byte $4e,$45,$53,$1a ; header
	.byte NES_PRG_BANKS
	.byte NES_CHR_BANKS
	.byte NES_MIRRORING|(NES_MAPPER<<4)
	.byte NES_MAPPER&$f0
	.byte 0,0,0,0,0,0,0,0 ; reserved, set to zero

;;;;; CODE

	seg Code
	org $8000
start:
_exit:
        sei			;disable IRQs
        cld			;decimal mode not supported
        ldx #$ff
        txs			;set up stack pointer
        inx			;increment X to 0
        stx PPU_MASK		;disable rendering
        stx DMC_FREQ		;disable DMC interrupts
        stx PPU_CTRL		;disable NMI interrupts
        jsr WaitSyncSafe	;wait for VSYNC
; clear RAM -- not a subroutine because we clear the stack too
	lda #0
        tax
.clearRAM
	sta $0,x
	sta $100,x
        ; skip $200-$2FF, used for OAM display list
	sta $300,x
	sta $400,x
	sta $500,x
	sta $600,x
	sta $700,x
        inx
        bne .clearRAM
; end of clear RAM routine
	jsr SetPalette		;set colors
        jsr FillVRAM		;set PPU RAM
        jsr WaitSync		;wait for VSYNC (and PPU warmup)
        lda #0
        sta PPU_ADDR
        sta PPU_ADDR		;PPU addr = 0
        sta PPU_SCROLL
        sta PPU_SCROLL		;scroll = 0
        lda #$90
        sta PPU_CTRL		;enable NMI
        lda #$1e
        sta PPU_MASK		;enable rendering
.endless
	jmp .endless		;endless loop

;;;;; SUBROUTINES

; set palette colors
SetPalette: subroutine
        ldy #$0
	lda #$3f
	sta PPU_ADDR
	sty PPU_ADDR
	ldx #4
.loop:
	lda Palette,y
	sta PPU_DATA
        iny
	dex
	bne .loop
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
        adc #1
	inx
	bne .loop
	dey
	bne .loop
        rts

; wait for VSYNC to start
WaitSyncSafe: subroutine
	bit PPU_STATUS
WaitSync:
	bit PPU_STATUS
	bpl WaitSync
        rts

;;;;; INTERRUPT HANDLERS

nmi:
irq:
; save registers
	pha	; save A
; update scroll position
	inc ScrollPos
        lda ScrollPos
        sta PPU_SCROLL
        sta PPU_SCROLL
; reload registers
        pla	; reload A
	rti

;;;;; CONSTANT DATA

Palette:
	hex 1f001020 ; black, gray, lt gray, white
TextString:
	byte "HELLO WORLD!"
        byte 0

;;;;; CPU VECTORS

	org $fffa
       	.word nmi	;$fffa vblank nmi
	.word start	;$fffc reset
	.word irq	;$fffe irq / brk

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
