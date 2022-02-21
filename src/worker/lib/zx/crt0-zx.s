; crt0.s for ZX Spectrum

	.module crt0
	.globl _main
	.globl ___sdcc_call_hl

	; Ordering of segments for the linker - copied from sdcc crt0.s
	.area	_CODE
	.area	_INITIALIZER
	.area	_HOME
	.area	_GSINIT
	.area	_GSFINAL
	.area	_DATA
	.area	_INITIALIZED
	.area	_BSEG
	.area	_BSS
	.area	_HEAP

	.area	_CODE

_Start:
	di
	im	1
	; stack pointer already set by BIOS
	call gsinit			; Initialize global and static variables.
	call _main
	rst 0x0				; Restart when main() returns.

	.area   _GSINIT
gsinit::

	; Implicitly zeroed global and static variables.
	ld	bc, #l__DATA
	ld	a, b
	or	a, c
	jr	Z, zeroed_data
	ld	hl,	#s__DATA
	ld	(hl), #0x00
	dec	bc
	ld	a, b
	or	a, c
	jr	Z, zeroed_data
	ld	e, l
	ld	d, h
	inc	de
	ldir
zeroed_data:

	; Explicitly initialized global variables.
	ld	bc, #l__INITIALIZER
	ld	a, b
	or	a, c
	jr	Z, gsinit_static
	ld	de, #s__INITIALIZED
	ld	hl, #s__INITIALIZER
	ldir

gsinit_static:
	; Explicitly initialized static variables inserted by compiler here.

	.area   _GSFINAL
	ret

	.area _HOME

