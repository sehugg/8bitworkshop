; Telephone
; Inspired by Adam Trionfo's Happy Birthday Music
; http://ballyalley.com/ml/ml_homebrew/birthday.asm
; Assemble with Zmac 1.3
; From: https://github.com/hxlnt/astrocade

            INCLUDE "hvglib.h"      ; Include HVGLIB library
MUSICSP = $4FD2       ; Music stack pointer
            ORG     FIRSTC          ; Initialize at beginning of cartridge ROM area
            DB      $55             ; ... with the code for a normal menued cartridge
            DW      MENUST          ; Initialize menu
            DW      PrgName         ; ... with string at PrgName
            DW      PrgStart        ; ... such that selecting the program enters PrgStart
PrgName:    DB      "TELEPHONE"     ; String to be displayed on menu
            DB      0               ; ... which must be followed by 0
PrgStart:   DI                      ; Disable interrupts
            SYSTEM  INTPC           ; Begin interpreter mode
            DO      SETOUT          ; Set output ports
            DB      80*2            ; ... with VBLANK line set to line 80
            DB      44/4            ; ... with color boundary 44 pixels from the left of the screen
            DB      00001000b       ; ... with screen interrupts reenabled 
            DO      COLSET          ; Set color palettes
            DW      Palettes        ; ... with the values at Palettes
            DO      FILL            ; Fill screen
            DW      NORMEM          ; ... starting at the beginning of screen RAM
            DW      81*BYTEPL       ; ... and going for 81 lines
            DB      00000000b       ; ... with a solid black (color 0) fill pattern
            DO      MOVE            ; Display graphic
            DW      NORMEM+(38*BYTEPL)
            DW      20*BYTEPL       ; ... copy 20 lines
            DW      Telephone       ; ... from data at location Telephone
            DO      ACTINT          ; Activate subtimer interrupts
            DO      BMUSIC          ; Play music
            DW      MUSICSP         ; ... using predefined music stack address 
            DB      00110011B       ; ... setting tone B, vibrato, noise bits
            DW      Ringing         ; ... with music score defined at Ringing
            EXIT                    ; Exit interpreter mode
Loop:       JP      Loop            ; Play infinite loop
Palettes:   DB      $07,$FE,$FB,$00 ; Left color palette (11b, 10b, 01b, 00b)
            DB      $07,$4F,$CB,$00 ; Right color palette (11b, 10b, 01b, 00b)
Telephone:                          ; Telephone graphic
            INCLUDE "02-telephone.gfx"
Ringing:                            ; Music score
            MASTER  OA3             ; 
            VOLUME  $80, $00        ; 
            NOTE1   60, C4          ; ... in which notes oscillate between C4
            NOTE1   60, F4          ; ... and F4
            REST    80              ; ... followed by a short rest
            NOTE1   60, C4          ; ... then another ring
            NOTE1   60, F4          ; 
            REST    160             ; ... and a long rest
            JP      Ringing         ; ... ending in replay