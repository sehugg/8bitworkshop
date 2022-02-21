
TEST	= 1

.module	biosasm
.globl	_STIMER,_CTIMER,_BIGFONT,_SMLFONT

BIOSStart:
	di			; disable interrupts
	ld	HL,#0x2000
.if TEST
	ld	HL,#(_main)
.endif
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

; out to port
.globl	_portOut
_portOut:
	ld	c,h
	out	(c),l
	ret

.globl	_bcdadd8
_bcdadd8:
	push	ix
	ld	ix,#0
	add	ix,sp
        ld 	a,6(ix)	; carry
        rrc	a	; set carry bit
        ld	h,#0	; carry goes here
        ld	a,4(ix)	; a -> A
        adc	a,5(ix)	; a + b -> A
        daa		; BCD conversion
        ld	l,a	; result -> L
        rl	h	; carry -> H
        pop	ix
        ret

;void set_palette(byte palette[8]) __z88dk_fastcall;
.globl	_set_palette
_set_palette:
  ld bc,#0x80b	; B -> 8, C -> 0xb
  otir		; write C bytes from HL to port[B]
  ret

.globl _KCTASC_TABLE
_KCTASC_TABLE:
.db  0x00
.db  0x43, 0x5e, 0x5c, 0x25, 0x52, 0x53, 0x3b, 0x2f
.db  0x37, 0x38, 0x39, 0x2a, 0x34, 0x35, 0x36, 0x2d
.db  0x31, 0x32, 0x33, 0x2b, 0x26, 0x30, 0x2e, 0x3d


	.ds	0x200 - (. - BIOSStart)	; eat up space until 0x200
DOPEVector:
	JP	_STIMER
	JP	_CTIMER
	.db	0x20, 8, 8, 1, 7	; Font descriptor (big font)
	.dw	_BIGFONT
	.db	0xa0, 4, 6, 1, 5	; Font descriptor (small font)
	.dw	_SMLFONT
	.db	0x3f		; all keys mask
	.db	0x3f
	.db	0x3f
	.db	0x3f

