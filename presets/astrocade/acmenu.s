
; Minimal header file for use with Astrocade C programs

	.area	_CODE

	.byte	0x55            ; ... with the code for a normal menued cartridge
	.word	0x0218          ; Initialize menu
	.word	PrgName         ; ... with string at PrgName
	.word	_main           ; ... such that selecting the program enters PrgStart
PrgName:
	.ascii	"8BITWORKSHOP"  ; String
	.byte	0               ; ... which must be followed by 0
