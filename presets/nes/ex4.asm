
	include "nesdefs.asm"

;;;;; VARIABLES

	seg.u RAM
	org $0

ScrollX	byte	; used during NMI
ScrollY	byte	; used during NMI

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
	PPU_SETADDR $2000
	ldy #$10
        ldx #0
.loop:
	stx PPU_DATA
	inx
	bne .loop
	dey
	bne .loop
        rts

; set palette colors
SetPalette: subroutine
	PPU_SETADDR $3f00
        ldy #0
.loop:
	lda Palette,y	; lookup byte in ROM
	sta PPU_DATA	; store byte to PPU data
        iny		; Y = Y + 1
        cpy #32		; is Y equal to 32?
	bne .loop	; not yet, loop
        rts		; return to caller


;;;;; COMMON SUBROUTINES

	include "nesppu.asm"

;;;;; INTERRUPT HANDLERS

NMIHandler:
	SAVE_REGS
; update scroll position (must be done after VRAM updates)
	jsr ReadJoypad
        pha
        and #$03
        tay
        lda ScrollDirTab,y
        clc
        adc ScrollX
        sta ScrollX
        sta PPU_SCROLL
        pla
        lsr
        lsr
        and #$03
        tay
        lda ScrollDirTab,y
        clc
        adc ScrollY
        sta ScrollY
        sta PPU_SCROLL
; reload registers
        RESTORE_REGS
	rti

; Scroll direction lookup table
ScrollDirTab:
	hex 00 01 ff 00
 
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
