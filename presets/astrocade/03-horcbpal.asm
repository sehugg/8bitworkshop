; "HORCB Pal" demo 2018 hxlnt
; Inspired by Michael Garber's Color Picker
; http://ballyalley.com/ml/ml_homebrew/colorpicker.asm
; Assemble with Zmac 1.3
; From: https://github.com/hxlnt/astrocade
                                    
            INCLUDE "hvglib.h"      ; Include HVGLIB library
FrameCount  EQU     $4F00           ; Reserve a space for a frame counter
            ORG     FIRSTC          ; Initialize at beginning of cartridge ROM area
            DB      $55             ; ... with the code for a normal menued cartridge
            DW      MENUST          ; Initialize menu
            DW      PrgName         ; ... with string at PrgName
            DW      PrgStart        ; ... such that selecting the program enters PrgStart
PrgName:    DB      "HORCB PAL"     ; String
            DB      0               ; ... which must be followed by 0
PrgStart:   DI                      ; Disable interrupts
            SYSTEM  INTPC           ; Begin interpreter mode
            DO      SETOUT          ; Set output ports
            DB      96*2            ; ... with VBLANK line set to line 96
            DB      0/4             ; ... with color boundary 0 pixels from the left of the screen
            DB      00001000b       ; ... with screen interrupts enabled 
            DO      COLSET          ; Set color palettes
            DW      Palettes        ; ... with the values at Palettes
            DO      FILL            ; Set background fill
            DW      NORMEM          ; ... starting at the beginning of screen RAM
            DW      24*BYTEPL       ; ... and going for 24 lines
            DB      00011011b       ; ... with a fill pattern of four different colored pixels 
            DO      FILL            ; Set background fill
            DW      NORMEM+(24*BYTEPL)
            DW      24*BYTEPL       ; ... and going for 24 lines
            DB      00000000b       ; ... with a solid fill of color 00
            DO      FILL            ; Set background fill
            DW      NORMEM+(48*BYTEPL)
            DW      24*BYTEPL       ; ... and going for 24 lines
            DB      11111111b       ; ... with a solid fill of color 11
            DO      STRDIS          ; Set string display
            DB      28              ; ... starting 28 pixels from the left of the screen
            DB      40              ; ... and 40 pixels from the top of the screen
            DB      00001100b       ; ... with no enlargement, foreground color = 11, background color = 00 
            DW      PrgName         ; ... with string at PrgName
            EXIT                    ; Exit interpreter mode
Loop:       IN      A,(POT0)        ; Let A = controller 1 knob value
            OUT     (HORCB),A       ; Let horizontal color boundary = A
            CALL    UpdateDisp      ; Call UpdateDisp subroutine
            JP      Loop            ; Go back to beginning of infinite loop
Palettes:   DB      $F4,$1C,$1F,$5F ; Left color palette (11b, 10b, 01b, 00b)
            DB      $ED,$CD,$D5,$8E ; Right color palette (11b, 10b, 01b, 00b)
UpdateDisp: DI                      ; Disable interrupts
            PUSH    AF              ; Push AF to SP
	    LD      C,A             ; Get first hex digit from knob value
	    SRL     C               ; ...
	    SRL     C               ; ...
	    SRL     C               ; ...
	    SRL     C               ; ...
	    LD      B,0             ; Display first hex digit from knob value
	    LD      HL,Hex          ; ... Load HL with address Hex
	    ADD     HL,BC           ; ... Offset Hex by BC to get first hex digit
	    LD      A,(HL)          ; ... Load A with first hex digit
	    LD      C,00000100b     ; ... Load C with string options
	    LD      D,40            ; ... Load D with string Y-coordinate
	    LD      E,120           ; ... Load E with X-coordinate
            SYSTEM  (CHRDIS)        ; ... Display first digit
	    POP     AF              ; Pop AF off SP
	    AND     $0F             ; Get second hex digit from knob value             
	    LD      C,A             ; ...
	    LD      B,0             ; Display second hex digit from knob value
	    LD      HL,Hex          ; ... Load HL with address Hex
	    ADD     HL,BC           ; ... Offset Hex by BC to get second hex digit
	    LD      A,(HL)          ; ... Load A with second hex digit
	    LD      C,00000100b     ; ... Load C with string options
	    LD      D,40            ; ... Load D with Y-coordinate
	    LD      E,128           ; ... Load E with X-coordinate
            SYSTEM  (CHRDIS)        ; ... Display second digit
            LD      A,(FrameCount)  ; Increment frame counter
            INC     A               ; ...
            LD      (FrameCount),A  ; ...
            AND     00000111b       ; Every fourth frame, run AnimBars
            CP      00000100b       ; ...
            JR      Z, AnimBars     ; ...
            JP      AnimDone        ; Otherwise, skip AnimBars
AnimBars:   SYSSUK  RANGED          ; Load a random 8-bit number in A
            DEFB    0               ; ...
            LD      BC,24*BYTEPL    ; Load BC with one scanline's length
            LD      DE,NORMEM+(72*BYTEPL)
            SYSTEM  FILL            ; Fill remainder of screen with repeating random tile
AnimDone:   EI                      ; Enable interrupts
            RET                     ; Return from subroutine
Hex:        DB      "0123456789ABCDEF"
