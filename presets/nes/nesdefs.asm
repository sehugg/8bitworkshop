
	processor 6502

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
APU_STATUS	equ $4015


;;;;; CARTRIDGE FILE HEADER

NES_MIRR_HORIZ	equ	0
NES_MIRR_VERT	equ	1
NES_MIRR_QUAD	equ	8

	MAC NES_HEADER
	seg Header
	org $7ff0
.NES_MAPPER	SET {1}	;mapper number
.NES_PRG_BANKS	SET {2}	;number of 16K PRG banks, change to 2 for NROM256
.NES_CHR_BANKS	SET {3}	;number of 8K CHR banks (0 = RAM)
.NES_MIRRORING	SET {4}	;0 horizontal, 1 vertical, 8 four screen
	byte $4e,$45,$53,$1a ; header
	byte .NES_PRG_BANKS
	byte .NES_CHR_BANKS
	byte .NES_MIRRORING|(.NES_MAPPER<<4)
	byte .NES_MAPPER&$f0
	byte 0,0,0,0,0,0,0,0 ; reserved, set to zero
	seg Code
	org $8000
	ENDM

;;;;; NES_INIT SETUP MACRO (place at start)
        
        MAC NES_INIT
        sei			;disable IRQs
        cld			;decimal mode not supported
        ldx #$ff
        txs			;set up stack pointer
        inx			;increment X to 0
        stx PPU_MASK		;disable rendering
        stx DMC_FREQ		;disable DMC interrupts
        stx PPU_CTRL		;disable NMI interrupts
	bit PPU_STATUS		;clear VBL flag
        ENDM

;;;;; NES_VECTORS - CPU vectors at end of address space

	MAC NES_VECTORS
	seg Vectors
	org $fffa
       	.word NMIHandler	;$fffa vblank nmi
	.word Start		;$fffc reset
	.word NMIHandler	;$fffe irq / brk (not used)
	ENDM
