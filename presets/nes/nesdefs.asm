
	processor 6502

;;;;; CONSTANTS

PPU_CTRL	= $2000
PPU_MASK	= $2001
PPU_STATUS	= $2002
OAM_ADDR	= $2003
OAM_DATA	= $2004
PPU_SCROLL	= $2005
PPU_ADDR	= $2006
PPU_DATA	= $2007

PPU_OAM_DMA	= $4014
DMC_FREQ	= $4010
APU_STATUS	= $4015
APU_NOISE_VOL   = $400C
APU_NOISE_FREQ  = $400E
APU_NOISE_TIMER = $400F
APU_DMC_CTRL    = $4010
APU_CHAN_CTRL   = $4015
APU_FRAME       = $4017

; NOTE: I've put this outside of the PPU & APU, because it is a feature
; of the APU that is primarily of use to the PPU.
OAM_DMA         = $4014
; OAM local RAM copy goes from $0200-$02FF:
OAM_RAM         = $0200


;;;;; CARTRIDGE FILE HEADER

NES_MIRR_HORIZ	= 0
NES_MIRR_VERT	= 1
NES_MIRR_QUAD	= 8

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
        bit APU_CHAN_CTRL	;ack DMC IRQ bit 7
	lda #$40
	sta APU_FRAME		;disable APU Frame IRQ
	lda #$0F
	sta APU_CHAN_CTRL	;disable DMC, enable/init other channels.        
        ENDM

;;;;; NES_VECTORS - CPU vectors at end of address space

	MAC NES_VECTORS
	seg Vectors
	org $fffa
       	.word NMIHandler	;$fffa vblank nmi
	.word Start		;$fffc reset
	.word NMIHandler	;$fffe irq / brk (not used)
	ENDM
