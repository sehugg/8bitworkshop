; "HORCB Pal" demo 2018 hxlnt
; Inspired by Michael Garber Color Picker
; http://ballyalley.com/ml/ml_homebrew/colorpicker.asm
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
FrameCount  =     0x4F00           ; Reserve a space for a frame counter
            .db      0x55             ; ... with the code for a normal menued cartridge
            .dw      MENUST          ; Initialize menu
            .dw      PrgName         ; ... with string at PrgName
            .dw      PrgStart        ; ... such that selecting the program enters PrgStart
PrgName:    .ascii   "HORCB PAL"     ; String
            .db      0               ; ... which must be followed by 0
PrgStart:   DI                      ; Disable interrupts
	LD	SP,#0x4fce	; position stack below BIOS vars
  	ld	hl,#0x20d	; small font -> IX
  	push	hl
  	pop	ix
            SYSTEM  INTPC           ; Begin interpreter mode
            DO      SETOUT          ; Set output ports
            .db      96*2            ; ... with VBLANK line set to line 96
            .db      0/4             ; ... with color boundary 0 pixels from the left of the screen
            .db      0b00001000       ; ... with screen interrupts enabled 
            DO      COLSET          ; Set color palettes
            .dw      Palettes        ; ... with the values at Palettes
            DO      FILL            ; Set background fill
            .dw      NORMEM          ; ... starting at the beginning of screen RAM
            .dw      24*BYTEPL       ; ... and going for 24 lines
            .db      0b00011011       ; ... with a fill pattern of four different colored pixels 
            DO      FILL            ; Set background fill
            .dw      NORMEM+(24*BYTEPL)
            .dw      24*BYTEPL       ; ... and going for 24 lines
            .db      0b00000000       ; ... with a solid fill of color 00
            DO      FILL            ; Set background fill
            .dw      NORMEM+(48*BYTEPL)
            .dw      24*BYTEPL       ; ... and going for 24 lines
            .db      0b11111111       ; ... with a solid fill of color 11
            DO      STRDIS          ; Set string display
            .db      28              ; ... starting 28 pixels from the left of the screen
            .db      40              ; ... and 40 pixels from the top of the screen
            .db      0b00001100       ; ... with no enlargement, foreground color = 11, background color = 00 
            .dw      PrgName         ; ... with string at PrgName
            DONT    XINTC                    ; Exit interpreter mode
Loop:       IN      A,(POT0)        ; Let A = controller 1 knob value
            OUT     (HORCB),A       ; Let horizontal color boundary = A
            CALL    UpdateDisp      ; Call UpdateDisp subroutine
            JP      Loop            ; Go back to beginning of infinite loop
Palettes:   .db      0xF4,0x1C,0x1F,0x5F ; Left color palette (11b, 10b, 01b, 00b)
            .db      0xED,0xCD,0xD5,0x8E ; Right color palette (11b, 10b, 01b, 00b)
UpdateDisp:
	    DI                      ; Disable interrupts
            PUSH    AF              ; Push AF to SP
	    LD      C,A             ; Get first hex digit from knob value
	    SRL     C               ; ...
	    SRL     C               ; ...
	    SRL     C               ; ...
	    SRL     C               ; ...
	    LD      B,#0             ; Display first hex digit from knob value
	    LD      HL,#Hex          ; ... Load HL with address Hex
	    ADD     HL,BC           ; ... Offset Hex by BC to get first hex digit
	    LD      A,(HL)          ; ... Load A with first hex digit
	    LD      C,#0b00000100     ; ... Load C with string options
	    LD      D,#40            ; ... Load D with string Y-coordinate
	    LD      E,#120           ; ... Load E with X-coordinate
            SYSTEM  (CHRDIS)        ; ... Display first digit
	    POP     AF              ; Pop AF off SP
	    AND     A,#0x0F             ; Get second hex digit from knob value             
	    LD      C,A             ; ...
	    LD      B,#0             ; Display second hex digit from knob value
	    LD      HL,#Hex          ; ... Load HL with address Hex
	    ADD     HL,BC           ; ... Offset Hex by BC to get second hex digit
	    LD      A,(HL)          ; ... Load A with second hex digit
	    LD      C,#0b00000100     ; ... Load C with string options
	    LD      D,#40            ; ... Load D with Y-coordinate
	    LD      E,#128           ; ... Load E with X-coordinate
            SYSTEM  (CHRDIS)        ; ... Display second digit
            LD      A,(FrameCount)  ; Increment frame counter
            INC     A               ; ...
            LD      (FrameCount),A  ; ...
            AND     #0b00000111       ; Every fourth frame, run AnimBars
            CP      #0b00000100       ; ...
            JR      Z, AnimBars     ; ...
            JP      AnimDone        ; Otherwise, skip AnimBars
AnimBars:   SYSSUK  RANGED          ; Load a random 8-bit number in A
            .db    0               ; ...
            LD      BC,#24*BYTEPL    ; Load BC with one scanline length
            LD      DE,#NORMEM+(72*BYTEPL)
            SYSTEM  FILL            ; Fill remainder of screen with repeating random tile
AnimDone:   EI                      ; Enable interrupts
            RET                     ; Return from subroutine
Hex:        .ascii      "0123456789ABCDEF"
