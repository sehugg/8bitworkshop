.area _HOME
.area _CODE
.area _INITIALIZER
.area _DATA
.area _INITIALIZED
.area _BSEG
.area _BSS
.area _HEAP
;--------------------------------------------------------
; File Created by SDCC : free open source ANSI-C Compiler
; Version 3.6.5 # (UNIX)
;--------------------------------------------------------
	.module minimal
	.optsdcc -mz80
	
;--------------------------------------------------------
; Public variables in this module
;--------------------------------------------------------
	.globl _start
	.globl _tileram
	.globl _cellram
	.globl _main
;--------------------------------------------------------
; special function registers
;--------------------------------------------------------
_palette	=	0x0040
;--------------------------------------------------------
; ram data
;--------------------------------------------------------
	.area _DATA
_cellram	=	0xe000
_tileram	=	0xe800
;--------------------------------------------------------
; ram data
;--------------------------------------------------------
	.area _INITIALIZED
;--------------------------------------------------------
; absolute external ram data
;--------------------------------------------------------
	.area _DABS (ABS)
;--------------------------------------------------------
; global & static initialisations
;--------------------------------------------------------
	.area _HOME
	.area _GSINIT
	.area _GSFINAL
	.area _GSINIT
;--------------------------------------------------------
; Home
;--------------------------------------------------------
	.area _HOME
	.area _HOME
;--------------------------------------------------------
; code
;--------------------------------------------------------
	.area _CODE
;<stdin>:15:
;	---------------------------------
; Function start
; ---------------------------------
_start::
;<stdin>:19:
	LD	SP,#0xE800 ; set up stack pointer
	DI	; disable interrupts
;<stdin>:20:
	jp  _main
;<stdin>:23:
;	---------------------------------
; Function main
; ---------------------------------
_main::
;<stdin>:26:
	ld	a,#0x01
	out	(_palette),a
;<stdin>:27:
	ld	hl,#_tileram
	ld	(hl), #0xfe
	ld	e, l
	ld	d, h
	inc	de
	ld	bc, #0x07ff
	ldir
;<stdin>:28:
	ld	hl,#_cellram
	ld	(hl), #0x00
	ld	e, l
	ld	d, h
	inc	de
	ld	bc, #0x07ff
	ldir
;<stdin>:29:
	ld	c,#0x00
;<stdin>:30:
00112$:
	ld	a,c
	rlca
	rlca
	rlca
	and	a,#0xf8
	ld	e,a
	ld	d,#0x00
00106$:
;<stdin>:31:
	ld	l,d
	ld	h,#0x00
	add	hl, hl
	add	hl, hl
	add	hl, hl
	add	hl, hl
	add	hl, hl
	ld	a,#<(_cellram)
	add	a, l
	ld	l,a
	ld	a,#>(_cellram)
	adc	a, h
	ld	h,a
	ld	b,#0x00
	add	hl, bc
	ld	(hl),e
;<stdin>:30:
	inc	d
	ld	a,d
	sub	a, #0x20
	jr	C,00106$
;<stdin>:29:
	inc	c
	ld	a,c
	sub	a, #0x20
	jr	C,00112$
;<stdin>:34:
00104$:
	jr	00104$
	.area _CODE
	.area _INITIALIZER
	.area _CABS (ABS)
