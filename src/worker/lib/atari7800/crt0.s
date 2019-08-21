; Startup code for cc65 and Shiru's NES library
; based on code by Groepaz/Hitmen <groepaz@gmx.net>, Ullrich von Bassewitz <uz@cc65.org>
; edited by Steven Hugg (remove integrated Famitone2 library, add NMICallback)

	.export _exit,__STARTUP__:absolute=1
	.export _HandyRTI
	.export	NMI,IRQ,START
	.import initlib,push0,popa,popax,_main,zerobss,copydata

	; Linker generated symbols
	.import __RAM_START__   ,__RAM_SIZE__
	.import __ROM0_START__  ,__ROM0_SIZE__
	.import __STARTUP_LOAD__,__STARTUP_RUN__,__STARTUP_SIZE__
	.import	__CODE_LOAD__   ,__CODE_RUN__   ,__CODE_SIZE__
	.import	__RODATA_LOAD__ ,__RODATA_RUN__ ,__RODATA_SIZE__

	.include "atari7800.inc"

.segment "ZEROPAGE"

INTVEC:		.res 2

.segment "HEADER"

.byte $4e,$45,$53,$1a
.res 8,0


.segment "STARTUP"

START:
_exit:
	sei                     ;Disable interrupts
	cld                     ;Clear decimal mode
	

;******** Atari recommended startup procedure

	lda     #$07
	sta     INPTCTRL        ;Lock into 7800 mode
	lda     #$7F
	sta     CTRL            ;Disable DMA
	lda     #$00
	sta     OFFSET
	sta     INPTCTRL
	ldx     #$FF            ;Reset stack pointer
	txs
	
;************** Clear zero page and hardware ******

	ldx     #$40
	lda     #$00
@1:
	sta     $00,x           ;Clear zero page
	sta	$100,x		;Clear page 1
	inx
	bne     @1

        ldy     #$00            ;Clear Ram
@2:
        sta	$1800,y
        sta	$1900,y
        sta	$1a00,y
        sta	$1b00,y
        sta	$1c00,y
        sta	$1d00,y
        sta	$1e00,y
        sta	$1f00,y
        sta	$2200,y
        sta	$2300,y
        sta	$2400,y
        sta	$2500,y
        sta	$2600,y
        sta	$2700,y
        iny
        bne	@2

        ldx     #$00
@3:                        	;Clear 2100-213F
        sta     $2100,x
        inx
        cpx     #$40
        bne     @3

; set interrupt vector in ZP
	lda	#<_HandyRTI
	sta	INTVEC
	lda	#>_HandyRTI
	sta	INTVEC+1

; start main()
	jmp	_main		;no parameters

; interrupt handler
NMI:
IRQ:
	jmp	(INTVEC)

_HandyRTI:
	rti

; CPU vectors
.segment "VECTORS"

	.word NMI	;$fffa vblank nmi
	.word START	;$fffc reset
	.word IRQ	;$fffe irq / brk

