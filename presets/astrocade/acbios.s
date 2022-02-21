
	.include "astrocade.inc"

;;; C functions

	.area	_CODE_ACBIOS

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

	.globl	_fast_vsync
_fast_vsync:
	ld	hl,#TMR60
        ld	c,(hl)
.lvsync:
        ld	a,(hl)
        sub	c
        jp	z,.lvsync
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
        ld	a,h
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

; RANGED n
	.globl	_ranged_random
_ranged_random:
	ld	a,l
        SYSTEM	RANGED
        ret

; KCTASC n
	.globl	_keycode_to_ascii
_keycode_to_ascii:
	ld	a,l
        SYSTEM	KCTASC
        ret

; BLANK w h data video-addr
	.globl	_blank_area
_blank_area:
	call	load5_edca_hl
        SYSTEM	BLANK
        ret

; SENTRY mask-addr
	.globl	_sense_transition
_sense_transition:
	ld	l,e
        ld	h,d
        SYSTEM	SENTRY
        ld	l,a
        ld	h,b
        ret

; DOIT table-addr
	.globl	_respond_to_input
_respond_to_input:
	call	load5_edca_hl
	SYSTEM	DOIT
	ret

; DOITB table-addr
	.globl	_respond_to_input_b
_respond_to_input_b:
	call	load5_edca_hl
	SYSTEM	DOIT
	ret

; BMUSIC stack-addr voices score-addr
	.globl  _begin_music
_begin_music:
	call	load5_edca_hl
        push	de
        pop	ix
        SYSTEM	BMUSIC
	ret

