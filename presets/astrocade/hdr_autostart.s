
; Minimal header file for use with Astrocade C programs

	.area _CODE

	jp	start		; jump to main()
start:
	ld	sp,#0x4fce
        ld	BC, #l__INITIALIZER
        ld	A, B
        ld	DE, #s__INITIALIZED
        ld	HL, #s__INITIALIZER
        ldir
	jp	_main
