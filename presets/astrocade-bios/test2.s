; Demo 1: HELLO, WORLDS! / 2018 hxlnt
; Inspired by Adam Trionfo Hello World
; http://www.ballyalley.com/ml/ml_homebrew/helloworld/hello.asm
; From: https://github.com/hxlnt/astrocade

; need these in 1st file sdcc linker sees
.area _HOME
.area _INITIALIZER
.area _DATA
.area _INITIALIZED
.area _BSEG
.area _BSS
.area _HEAP
.area _CODE

	.include "astrocade.inc"
        .globl	_main
_main:
            .db      0x55             ; ... with the code for a normal menued cartridge
            .dw      MENUST          ; Initialize menu
            .dw      PrgName         ; ... with string at PrgName
            .dw      PrgStart        ; ... such that selecting the program enters PrgStart
PrgName:    .ascii   "HELLO, WORLDS!"; String
            .db      0               ; ... which must be followed by 0
PrgStart:   DI                      ; Disable interrupts
	LD	SP,#0x4fce	; position stack below BIOS vars
  	ld	hl,#0x20d	; small font -> IX
  	push	hl
  	pop	ix
            SYSTEM  INTPC           ; Begin interpreter mode
            DO      SETOUT          ; Set output ports
            .db      100*2           ; ... with VBLANK line set to line 100
            .db      112/4           ; ... with color boundary 112 pixels from the left of the screen
            .db      0b00001000       ; ... with screen interrupts reenabled 
            DO      COLSET          ; Set color palettes
            .dw      Palettes        ; ... with the values at Palettes
            DO      FILL            ; Set background fill
            .dw      NORMEM          ; ... starting at the beginning of screen RAM
            .dw      99*BYTEPL      ; ... and going for 100 lines
            .db      0b00010010       ; ... with a fill pattern of three different colored pixels
            DO      STRDIS          ; Set string display
            .db      0               ; ... starting 0 pixels from the left of the screen
            .db      32              ; ... and 32 pixels from the top of the screen
            .db      0b00001100       ; ... with no enlargement, foreground color = 11, background color = 00          
            .dw      PrgName         ; ... to show string at PrgName
	    DONT	XINTC
Loop:       JP      Loop            ; Play infinite loop
Palettes:   .db      0xBF,0x00,0x00,0x00 ; Left color palette (11b, 10b, 01b, 00b)
            .db      0xE7,0x9A,0x39,0x19 ; Right color palette (11b, 10b, 01b, 00b)
