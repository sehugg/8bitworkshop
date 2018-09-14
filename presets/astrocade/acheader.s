
; Minimal header file for use with Astrocade C programs

	.area _CODE

	jp	start		; jump to main()
start:
	ld	sp,#0x4fce
	jp	_main
