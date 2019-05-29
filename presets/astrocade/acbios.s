
	.include "astrocade.inc"

;;; C functions

	.area	CODE

; activate interrupts
	.globl	_activate_interrupts
_activate_interrupts:
	SYSTEM  ACTINT
	; set INMOD
	ld	a,#0x8
	out	(INMOD),a
	ret

; wait for next interrupt
	.globl	_sleep
_sleep:
	ld	b,l
	SYSTEM  PAWS
        ret

; load 5 bytes from stack into registers
load5_edca_hl:
	ld	ix,#4
        add	ix,sp
        ld	e,0(ix)		; x
        ld	d,1(ix)		; y
        ld	c,2(ix)		; options
        ld	b,c
        ld	a,c
        ld	l,3(ix)		; addr lo
        ld	h,4(ix)		; addr hi
        ret

; STRDIR x y options string-addr
	.globl	_display_string
_display_string:
	call	load5_edca_hl
        ld	ix,#0x20d	; alternate font desc.
        SYSTEM	STRDIS
        ret

; RECTAN x y w h colormask
	.globl	_paint_rectangle
_paint_rectangle:
	call	load5_edca_hl
        ld	b,l
        ld	h,a
        SYSTEM	RECTAN
        ret

; WRITR x y magic pattern-addr
	.globl	_write_relative
_write_relative:
	call	load5_edca_hl
        SYSTEM	WRITR
        ret

; WRITP x y magic pattern-addr
	.globl	_write_pattern
_write_pattern:
	call	load5_edca_hl
        SYSTEM	WRITP
        ret

; DISNUM x y options number-addr
	.globl	_display_bcd_number
_display_bcd_number:
	call	load5_edca_hl
        ld	b,5(ix)		; addr hi
        ld	ix,#0x20d	; alternate font desc.
        SYSTEM	DISNUM
        ret

; BCDADD arg1 size arg2
	.globl	_bcdn_add
_bcdn_add:
	call	load5_edca_hl
        ld	b,c
        SYSTEM	BCDADD
        ret

; BCDSUB arg1 size arg2
	.globl	_bcdn_sub
_bcdn_sub:
	call	load5_edca_hl
        SYSTEM	BCDSUB
        ret

; BLANK w h data video-addr
	.globl	_blank_area
_blank_area:
	call	load5_edca_hl
        SYSTEM	BLANK
        ret

