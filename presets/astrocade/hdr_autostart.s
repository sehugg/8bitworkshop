
; Minimal header file for use with Astrocade C programs

	.area 	_CODE

	jp	Start		; jump to main()
Start:
	ld	hl,#0x4fce	; stack start
        ld	sp,hl		; setup stack pointer
; clear BIOS RAM
        ld	bc,#0x4fff-0x4fce
        xor	a		; A = 0
        ld	(hl),a		; set initial zero
        push	hl
        pop	de
        inc	de		; DE = HL + 1
        ldir			; clear RAM
; initialize INITIALIZED segment
        ld	BC, #l__INITIALIZER
        ld	a,c
        or	b
        jp	z,.nomeminit
        ld	A, B
        ld	DE, #s__INITIALIZED
        ld	HL, #s__INITIALIZER
        ldir
.nomeminit:
; jump to main C function
	jp	_main
