
	.include "astrocade.inc"

; Minimal header file for use with Astrocade C programs

	.area	_CODE

	.db	0x55		; sentinel
        .dw	MENUST
        .dw	PrgName
        .dw	PrgStart
PrgName:
	.ascii	"8BITWORKSHOP"
        .db	0
PrgStart:
	jp	_main
