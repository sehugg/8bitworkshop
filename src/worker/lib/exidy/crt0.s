; Startup code for cc65 and Shiru's NES library
; based on code by Groepaz/Hitmen <groepaz@gmx.net>, Ullrich von Bassewitz <uz@cc65.org>
; edited by Steven Hugg for Exidy

	.export _exit,__STARTUP__:absolute=1
	.export _HandyRTI
	.exportzp _INTVEC
	.export	NMI,IRQ,START
	.import initlib,push0,popa,popax,_main,zerobss,copydata
	.importzp sp

	; Linker generated symbols
	.import __RAM0_START__  ,__RAM0_SIZE__
	.import __ROM_START__  ,__ROM_SIZE__
	.import __STARTUP_LOAD__,__STARTUP_RUN__,__STARTUP_SIZE__
	.import	__CODE_LOAD__   ,__CODE_RUN__   ,__CODE_SIZE__
	.import	__RODATA_LOAD__ ,__RODATA_RUN__ ,__RODATA_SIZE__

.segment "ZEROPAGE"

_INTVEC:         .res 2

.segment "STARTUP"

START:
_exit:
	sei                     ;Disable interrupts
	cld                     ;Clear decimal mode
	ldx #$ff				;Setup stack pointer
	txs


@irrwait:
	lda $5103
	dex
	bne @irrwait

	lda #$00        ;Clear Ram
	sta $5100		;Set sprites to #0
@2:
	sta	$0,x
	sta	$100,x
	sta	$200,x
	sta	$300,x
	sta	$4000,x
	sta	$4100,x
	sta	$4200,x
	sta	$4300,x
	sta	$6800,x
	sta	$6900,x
	sta	$6a00,x
	sta	$6b00,x
	sta	$6c00,x
	sta	$6d00,x
	sta	$6e00,x
	sta	$6f00,x
	inx
	bne	@2

; copy data segment
	jsr	copydata

; initialize cc65 stack
	lda	#<(__RAM0_START__+__RAM0_SIZE__)
	sta	sp
	lda	#>(__RAM0_START__+__RAM0_SIZE__)
	sta	sp+1

; init CC65 library
	jsr	initlib

; set interrupt vector in ZP
	lda	#<_HandyRTI
	sta	_INTVEC
	lda	#>_HandyRTI
	sta	_INTVEC+1
	cli                     ;Enable interrupts

; start main()
	jmp	_main		;no parameters

; interrupt handler
NMI:
IRQ:
	jmp	(_INTVEC)

_HandyRTI:
	rti

; CPU vectors
.segment "VECTORS"

	.word NMI	;$fffa vblank nmi
	.word START	;$fffc reset
	.word IRQ	;$fffe irq / brk

