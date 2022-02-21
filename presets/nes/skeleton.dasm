
	include "nesdefs.dasm"

;;;;; VARIABLES

	seg.u ZEROPAGE
	org $0

;;;;; NES CARTRIDGE HEADER

	NES_HEADER 0,2,1,NES_MIRR_HORIZ ; mapper 0, 2 PRGs, 1 CHR

;;;;; START OF CODE

Start:	subroutine
	NES_INIT	; set up stack pointer, turn off PPU
        jsr WaitSync	; wait for VSYNC
        jsr ClearRAM	; clear RAM
        jsr WaitSync	; wait for VSYNC (and PPU warmup)

	lda #$3f	; $3F -> A register
        ldy #$00	; $00 -> Y register
        sta PPU_ADDR	; write high byte first
        sty PPU_ADDR    ; $3F00 -> PPU address
        lda #$1c	; $1C = light blue color
        sta PPU_DATA    ; $1C -> PPU data
        lda #CTRL_NMI
        sta PPU_CTRL	; enable NMI
        lda #MASK_COLOR
        sta PPU_MASK	; enable rendering
.endless
	jmp .endless	; endless loop

;;;;; COMMON SUBROUTINES

	include "nesppu.dasm"

;;;;; INTERRUPT HANDLERS

NMIHandler: subroutine
	SAVE_REGS
	RESTORE_REGS
	rti

;;;;; CPU VECTORS

	NES_VECTORS

