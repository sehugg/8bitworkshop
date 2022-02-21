; Startup code for cc65 and Shiru's NES library
; based on code by Groepaz/Hitmen <groepaz@gmx.net>, Ullrich von Bassewitz <uz@cc65.org>
; edited by Steven Hugg (remove integrated Famitone2 library, add NMICallback)

	.export _exit,__STARTUP__:absolute=1
	.export _HandyRTI
	.export	NMI,IRQ,START
	.import initlib,push0,popa,popax,_main,zerobss,copydata
	.importzp sp

	; Linker generated symbols
	.import __RAM0_START__  ,__RAM0_SIZE__
	.import __RAM1_START__  ,__RAM1_SIZE__
	.import __ROM0_START__  ,__ROM0_SIZE__
	.import __STARTUP_LOAD__,__STARTUP_RUN__,__STARTUP_SIZE__
	.import	__CODE_LOAD__   ,__CODE_RUN__   ,__CODE_SIZE__
	.import	__RODATA_LOAD__ ,__RODATA_RUN__ ,__RODATA_SIZE__

	.include "atari7800.inc"

.segment "ZEROPAGE"

INTVEC:		.res 2

.segment "HEADER"

; A78 Header - http://7800.8bitdev.org/index.php/A78_Header_Specification
        .byte    1  ; 0   Header version     - 1 byte
        .byte    "ATARI7800"     ; 1..16  "ATARI7800   "  - 16 bytes
        .res      7,32
        .byte    "Your Name Here"; 17..48 Cart title      - 32 bytes
	.res	 (32-.strlen("Your Name Here")),0
        .byte    $00,$00,$c0,$00; 49..52 data length      - 4 bytes
        .byte    $00,$00  ; 53..54 cart type      - 2 bytes
    ;    bit 0 - pokey at $4000
    ;    bit 1 - supergame bank switched
    ;    bit 2 - supergame ram at $4000
    ;    bit 3 - rom at $4000
    ;    bit 4 - bank 6 at $4000
    ;    bit 5 - supergame banked ram
    ;    bit 6 - pokey at $450
    ;    bit 7 - mirror ram at $4000
    ;    bit 8-15 - Special
    ;   0 = Normal cart
        .byte    1  ; 55   controller 1 type  - 1 byte
        .byte    1  ; 56   controller 2 type  - 1 byte
    ;    0 = None
    ;    1 = Joystick
    ;    2 = Light Gun
        .byte    0  ; 57 0 = NTSC 1 = PAL
        .byte    0  ; 58   Save data peripheral - 1 byte (version 2)
    ;    0 = None / unknown (default)
    ;    1 = High Score Cart (HSC)
    ;    2 = SaveKey
        .byte    0,0,0,0
        .byte    0  ; 63   Expansion module
    ;    0 = No expansion module (default on all currently released games)
    ;    1 = Expansion module required
	.res	 36
        .byte    "ACTUAL CART DATA STARTS HERE"


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

; copy data segment
	jsr	copydata
; initialize cc65 stack
	lda	#<(__RAM1_START__+__RAM1_SIZE__)
	sta	sp
	lda	#>(__RAM1_START__+__RAM1_SIZE__)
	sta	sp+1
; init CC65 library
	jsr	initlib
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

