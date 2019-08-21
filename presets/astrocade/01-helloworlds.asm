; Demo 1: HELLO, WORLDS! / 2018 hxlnt
; Inspired by Adam Trionfo's Hello World
; http://www.ballyalley.com/ml/ml_homebrew/helloworld/hello.asm
; Assemble with Zmac 1.3
; From: https://github.com/hxlnt/astrocade

            INCLUDE "hvglib.h"      ; Include HVGLIB library
            ORG     FIRSTC          ; Initialize at beginning of cartridge ROM area
            DB      $55             ; ... with the code for a normal menued cartridge
            DW      MENUST          ; Initialize menu
            DW      PrgName         ; ... with string at PrgName
            DW      PrgStart        ; ... such that selecting the program enters PrgStart
PrgName:    DB      "HELLO, WORLDS!"; String
            DB      0               ; ... which must be followed by 0
PrgStart:   DI                      ; Disable interrupts
;            db $ed,$ff
            SYSTEM  INTPC           ; Begin interpreter mode
            DO      SETOUT          ; Set output ports
            DB      100*2           ; ... with VBLANK line set to line 100
            DB      112/4           ; ... with color boundary 112 pixels from the left of the screen
            DB      00001000b       ; ... with screen interrupts reenabled 
            DO      COLSET          ; Set color palettes
            DW      Palettes        ; ... with the values at Palettes
            DO      FILL            ; Set background fill
            DW      NORMEM          ; ... starting at the beginning of screen RAM
            DW      98*BYTEPL      ; ... and going for 100 lines
            DB      00010010b       ; ... with a fill pattern of three different colored pixels
            DO      STRDIS          ; Set string display
            DB      0               ; ... starting 0 pixels from the left of the screen
            DB      32              ; ... and 32 pixels from the top of the screen
            DB      00001100b       ; ... with no enlargement, foreground color = 11, background color = 00          
            DW      PrgName         ; ... to show string at PrgName
; call Begin Music system routine
	    DO     ACTINT
            DO     BMUSIC           ; START THE NATIONAL ANTHEM
            DW     MUSICWRK         ; MUSIC STACK
            DB     11111100B        ; 3-VOICE (A,B,C)
            DW     ANTHEM           ; SCORE
            EXIT                    ; Exit interpreter mode
Loop:       JP      Loop            ; Play infinite loop
Palettes:   DB      $BF,$00,$00,$00 ; Left color palette (11b, 10b, 01b, 00b)
            DB      $E7,$9A,$39,$19 ; Right color palette (11b, 10b, 01b, 00b)

; Music stack in RAM
MUSICWRK  EQU   $4E7F     ; BLOCK 2
; [...]
 
ANTHEM:  MASTER 32
         VOLUME $CC,$0F          ; A,B=12, C=15
         NOTE3  12,G1,0,0        ; G1, 0, 0
         NOTE3  12,G1,0,0        ; G1, 0, 0
         NOTE3  36,C2,G1,E1      ; C2, G1, E1
         NOTE3  12,D2,B1,G1      ; D2, B1, G1
         NOTE3  14,E2,C2,G1      ; E2, C2, G1
         NOTE3  16,F2,D2,G1      ; F2, D2, G1
         NOTE3  72,G2,E2,C2      ; G2, E2, C2
;
         NOTE3  14,C2,F1,A1      ; C2, F1, A1
         NOTE3  16,D2,F1,A1      ; D2, F1, A1
         NOTE3  54,E2,C2,A1      ; E2, C2, A1
         NOTE3  18,F2,D2,G1
         NOTE3  36,D2,B1,G1      ; D2, B1, G1
         NOTE3  72,C2,E1,G1      ; C2, E1, G1
;
CHEERS:  LEGSTA                  ; Cheers
         MASTER  24
         VOICEM  11111101B       ; A,B,C & Noise
         VOLUME  $FF,$1F         ; Max. Volume
;
         PUSHN  5
L2FE8:   DB     30               ; Noise
         NOTE3  25,G6,60,80
         DSJNZ  L2FE8
         LEGSTA
         QUIET
