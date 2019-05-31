
;#link "bioslib.c"

TEST	= 1

	.module	biosasm
	.globl	_STIMER,_CTIMER,_BIGFONT,_SMLFONT

BIOSStart:
	di			; disable interrupts
	ld	HL,#0x2000
	ld	A,(HL)		; A <- mem[0x2000]
	cp	#0x55		; found sentinel byte? ($55)
	jp	Z,FoundSentinel	; yes, load program
.if TEST
	jp	_main		; jump to test program
.else
	jp	0x2000		; jump to $2000
.endif
FoundSentinel:
	ld	SP,#0x4fce	; position stack below BIOS vars
	call	_bios_init	; misc. bios init routines
.if TEST
	ld	HL,#(_main+5)
.else
	ld	HL,#0x2005	; cartridge start vector
.endif
	ld	A,(HL)
	inc	HL
	ld	H,(HL)
	ld	L,A
	jp	(HL)		; jump to cart start vector
	.ds	0x38 - (. - BIOSStart)	; eat up space until 0x38
	.globl	SYSCALL38
SYSCALL38:
	push	hl
	push	af
	push	bc
	push	de
	push	ix
	push	iy
	ld	hl,#0
	add	hl,sp
	push	hl		; HL points to context block
	call	_SYSCALL	; syscall handler
	pop	hl
	pop	iy
	pop	ix
	pop	de
	pop	bc
	pop	af
	pop	hl
	ret
; TODO?
ReloadRegs:
	ld	c,(hl)
        inc	hl
	ld	b,(hl)
        inc	hl
        push	bc
        pop	iy
	ld	c,(hl)
        inc	hl
	ld	b,(hl)
        inc	hl
        push	bc
        pop	ix
	ld	c,(hl)
        inc	hl
	ld	b,(hl)
        inc	hl
        push	bc
        pop	de
	ld	c,(hl)
        inc	hl
	ld	b,(hl)
        inc	hl
        push	bc
	ld	c,(hl)
        inc	hl
	ld	b,(hl)
        inc	hl
        push	bc
        pop	af
	ld	c,(hl)
        inc	hl
	ld	b,(hl)
        inc	hl
        push	bc
        pop	hl
        pop	bc
	ret
	.ds	0x200 - (. - BIOSStart)	; eat up space until 0x200

DOPEVector:
	JP	_STIMER
	JP	_CTIMER
	.db	0x20, 8, 8, 1, 7	; Font descriptor (big font)
	.dw	_BIGFONT
	.db	0xa0, 4, 6, 1, 5	; Font descriptor (small font)
	.dw	_SMLFONT


