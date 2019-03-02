
	include "nesdefs.asm"

;;;;; VARIABLES

	seg.u RAM
	org $0

;;;;; NES CARTRIDGE HEADER

	NES_HEADER 0,2,1,0 ; mapper 0, 2 PRGs, 1 CHR, horiz. mirror

;;;;; START OF CODE

Start:
; wait for PPU warmup; clear CPU RAM
	NES_INIT	; set up stack pointer, turn off PPU
        jsr WaitSync	; wait for VSYNC
        jsr ClearRAM	; clear RAM
        jsr WaitSync	; wait for VSYNC (and PPU warmup)
; set palette
	lda #$3f	; $3F -> A register
        sta PPU_ADDR	; write high byte first
	lda #$00	; $00 -> A register
        sta PPU_ADDR    ; $3F00 -> PPU address
        lda #$1c	; $1C = light blue color
        sta PPU_DATA    ; $1C -> PPU data
; activate PPU graphics
        lda #CTRL_NMI
        sta PPU_CTRL	; enable NMI
        lda #MASK_COLOR
        sta PPU_MASK	; enable rendering
.endless
	jmp .endless	; endless loop

;;;;; COMMON SUBROUTINES

	include "nesppu.asm"

;;;;; INTERRUPT HANDLERS

NMIHandler:
	rti

;;;;; CPU VECTORS

	NES_VECTORS

