
;;;;; CONSTANTS

PPU_CTRL	equ $2000
PPU_MASK	equ $2001
PPU_STATUS	equ $2002
PPU_SCROLL	equ $2005
PPU_ADDR	equ $2006
PPU_DATA	equ $2007
DMC_FREQ	equ $4010

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
; wait for PPU warmup        
        jsr WaitSync
; set palette background
        ldy #$0
	lda #$3f
	sta PPU_ADDR
	sty PPU_ADDR
        lda #$1c
        sta PPU_DATA
; enable PPU rendering
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
	rti

;;;;; CPU VECTORS

	org $fffa
       	.word nmi	;$fffa vblank nmi
	.word start	;$fffc reset
	.word irq	;$fffe irq / brk

