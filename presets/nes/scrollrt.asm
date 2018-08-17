
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
; background (tile) pattern table
	REPEAT 10
;;{w:8,h:8,bpp:1,count:48,brev:1,np:2,pofs:8,remap:[0,1,2,4,5,6,7,8,9,10,11,12]};;
	hex 00000000000000000000000000000000
	hex 7e42424646467e007e42424646467e00
	hex 08080818181818000808081818181800
	hex 3e22023e30303e003e22023e30303e00
	hex 3c24041e06263e003c24041e06263e00
	hex 4444447e0c0c0c004444447e0c0c0c00
	hex 3c20203e06263e003c20203e06263e00
	hex 3e22203e26263e003e22203e26263e00
	hex 3e020206060606003e02020606060600
	hex 3c24247e46467e003c24247e46467e00
	hex 3e22223e060606003e22223e06060600
	hex 3c24247e626262003c24247e62626200
	hex 7c44447e62627e007c44447e62627e00
	hex 7e42406060627e007e42406060627e00
	hex 7e42426262627e007e42426262627e00
	hex 7c40407c60607c007c40407c60607c00
	hex 3c20203c303030003c20203c30303000
	hex 7e42406e62627e007e42406e62627e00
	hex 4242427e626262004242427e62626200
	hex 10101018181818001010101818181800
	hex 0404040606467e000404040606467e00
	hex 4444447e626262004444447e62626200
	hex 2020203030303e002020203030303e00
	hex fe9292d2d2d2d200fe9292d2d2d2d200
	hex 7e424262626262007e42426262626200
	hex 7e46464242427e007e46464242427e00
	hex 7e42427e606060007e42427e60606000
	hex 7e424242424e7e007e424242424e7e00
	hex 7c44447e626262007c44447e62626200
	hex 7e42407e06467e007e42407e06467e00
	hex 7e101018181818007e10101818181800
	hex 4242426262627e004242426262627e00
	hex 646464642c2c3c00646464642c2c3c00
	hex 4949494969697f004949494969697f00
	hex 4242423c626262004242423c62626200
	hex 4242427e181818004242427e18181800
	hex 7e42027e60627e007e42027e60427e00
	hex 10101818180018001010181818001800
	hex 187e407e067e1800187e407e067e1800
	hex 00180018180000000018001818000000
	hex 00003c3c0000000000003c3c00000000
	hex 00000018180000000000001818000000
	hex 18180810000000001818081000000000
	hex 00000018180810000000001818081000
	hex 7c7c7c7c7c7c7c007c7c7c7c7c7c7c00
	hex 0000000000007c000000000000007c00
	hex 00000000000000000000000000000000
	hex 00000000000000000000000000000000
;;
	REPEND
	REPEAT 32
 	hex 00000000000000000000000000000000
	REPEND
