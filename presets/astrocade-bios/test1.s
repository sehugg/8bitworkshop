

; need these in 1st file sdcc linker sees
.area _HOME
.area _INITIALIZER
.area _DATA
.area _INITIALIZED
.area _BSEG
.area _BSS
.area _HEAP
.area _CODE

	.include "astrocade.inc"
        .globl	_main
_main:
	LD	SP,#0x4fce	; position stack below BIOS vars
  	ld	hl,#0x20d	; small font -> IX
  	push	hl
  	pop	ix
        SYSTEM	INTPC
        DO	SETOUT
        .db	89*2, 23, 0x00
        DONT	ACTINT
        DO	COLSET
        .dw	palette
        DO	FILL
        .dw	0x4000
        .dw	95*40
        .db	0x00
        DO	STRDIS
        .db	2
        .db	2
        .db	(1<<2)
        .dw	HelloString
        DO	STRDIS
        .db	4
        .db	16
        .db	(2<<2)|0x40
        .dw	BigString
        DO	STRDIS	; draw string
        .db	4	; x
        .db	36	; y
        .db	(2<<2)|0x80	; options
        .dw	FourString
        DO	CHRDIS	; draw char
        .db	109
        .db	24
        .db	(3<<2)|0x20|0xc0 ; xor 8x8
        .db	0x3f
        DO	STRDIS
        .db	4
        .db	80
        .db	(1<<2)
        .dw	NumString
        DO	RECTAN
        .db	4
        .db	72
        .db	100
        .db	4
        .db	0xa5
        DO	WRITR
        .db	50
        .db	80
        .db	0x00
        .dw	PATERN
        DO	WRITR
        .db	0
        .db	80
        .db	0x40	;+expand
        .dw	PATERN
        DO	WRITR
        .db	140
        .db	70
        .db	0x00|0x08 ;+expand
        .dw	BALL
        DO	WRITR
        .db	0
        .db	70
        .db	0x40|0x08 ;flop+expand
        .dw	BALL
        DO	WRITR
        .db	67
        .db	80
        .db	0x08|1	;expand
        .dw	BALL
        DO	MOVE
        .dw	BCDNUM
        .dw	3
        .dw	_BCDNUM
        ; exit interpreter
        EXIT
.loop:
        SYSSUK	DISNUM
        .db	80
        .db	80
        .db	(2<<2)		;opts
        .db	6|0x40|0x80	;ext
        .dw	BCDNUM
        SYSSUK	PAWS
        .db	60
        SYSSUK	BCDADD
        .dw	BCDNUM
        .db	3
        .dw	BCDINC
        jp	.loop
HelloString:
        .ascii	"HELLO WORLD! "
        .db	0xb1, 0xb2, 0xb3, 0xb4, 0xb5
        .db	0
BigString:
	.ascii	"BIG TEXT!"
	.db	0
FourString:
	.ascii	"4X4"
        .db	0
NumString:
	.db	0xb0,0xb1,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9
        .db	0
palette:
	.db	0x77, 0xD4, 0x35, 0x01
	.db	0x07, 0xD4, 0x35, 0x01

BCDNUM	= 0x4ea0	; RAM
_BCDNUM:
	.db	0x97,0x34,0x12
BCDINC:
        .db	0x01,0x00,0x00
; Critter Pattern
; Color 0 = White and Color 2 = Black
;
PATERN: .DB     0,0      ; (0,0) Position
        .DB     0x02,0x08  ; 2 byte, 8 line pattern size

        .DB     0x0A,0xA0  ; 0000101010100000 - . . 2 2 2 2 . .  
        .DB     0x22,0x88  ; 0010001010001000 - . 2 . 2 2 . 2 .
        .DB     0xAA,0xAA  ; 1010101010101010 - 2 2 2 2 2 2 2 2
        .DB     0x2A,0xA8  ; 0010101010101000 - . 2 2 2 2 2 2 .
        .DB     0x08,0x20  ; 0000100000100000 - . . 2 . . 2 . .
        .DB     0x20,0x08  ; 0010000000001000 - . 2 . . . . 2 .
        .DB     0x08,0x20  ; 0000100000100000 - . . 2 . . 2 . .
        .DB     0x00,0x00  ; 0000000000000000 - . . . . . . . .

BALL:	.db	0,0
	.db	1,6
        .db	0b01111010
        .db	0b11011101
        .db	0b10111101
        .db	0b10111101
        .db	0b11111101
        .db	0b01111010

RINGING:
	.db	0x80,0x23,0xB0,0x80,0x00,0x3C,0x17,0x3C,0x11,0xE1,0x50,0x3C,0x17,0x3C,0x11,0xE1,0xA0,0xC3,0x5B,0x23,0x00
