        ORG     04000H
;        LOAD    04000H
; MSX cartridge header @ 0x4000 - 0x400f
        dw 0x4241
        dw Start
        dw Start
        dw 0,0,0,0,0

; ******************************
; *   BIOS STANDARD ROUTINES   *
; ******************************

RDSLT:  EQU     000CH
RDVRM:  EQU     004AH
WRTVRM: EQU     004AH
FILVRM: EQU     0056H
INIGRP: EQU     0072H
CHSNS:  EQU     009CH
CHGET:  EQU     009FH
MAPXYC: EQU     0111H
FETCHC: EQU     0114H
RSLREG: EQU     0138H

; ******************************
; *     WORKSPACE VARIABLES    *
; ******************************

GRPCOL: EQU     0F3D9H
FORCLR: EQU     0F3E9H
BAKCLR: EQU     0F3EAH
CGPNT:  EQU     0F91FH
EXPTBL: EQU     0FCC1H
SLTTBL: EQU     0FCC5H

; ******************************
; *      CONTROL CHARACTERS    *
; ******************************

CR:     EQU     13
RIGHT:  EQU     28
LEFT:   EQU     29
UP:     EQU     30
DOWN:   EQU     31

Start:
CHEDIT: CALL    INIT                ; Cold start
CH1:    CALL    CHRMAG              ; Magnify chr
        CALL    CHRXY               ; Chr coords
        LD      D,8                 ; Cursor size
        CALL    GETKEY              ; Get command
        CP      "Q"                 ; Quit
        RET     Z                   ;
        LD      HL,CH1              ; Set up return
        PUSH    HL                  ;
        CP      "A"                 ; Adopt
        JP      Z,ADOPT             ;
        CP      CR                  ; Edit
        JR      Z,EDIT              ;
        LD      C,1                 ; C=Offset
        CP      RIGHT               ; Right
        JR      Z,CH2               ;
        LD      C,0FFH              ;
        CP      LEFT                ; Left
        JR      Z,CH2               ;
        LD      C,0F0H              ;
        CP      UP                  ; Up
        JR      Z,CH2               ;
        LD      C,16                ;
        CP      DOWN                ; Down
        RET     NZ                  ;
CH2:    LD      A,(CHRNUM)          ; Current chr
        ADD     A,C                 ; Add offset
        LD      (CHRNUM),A          ; New chr
        RET                         ;

EDIT:   CALL    DOTXY               ; Dot coords
        LD      D,2                 ; Cursor size
        CALL    GETKEY              ; Get command
        CP      CR                  ; Quit
        RET     Z                   ;
        LD      HL,EDIT             ; Set up return
        PUSH    HL                  ;
        LD      BC,0FE00H           ; AND/OR masks
        CP      " "                 ; Space
        JR      Z,ED3               ;
        INC     C                   ; New OR mask
        CP      "."                 ; Dot
        JR      Z,ED3               ;
        CP      RIGHT               ; Right
        JR      Z,ED2               ;
        LD      C,0FFH              ; C=Offset
        CP      LEFT                ; Left
        JR      Z,ED2               ;
        LD      C,0F8H              ;
        CP      UP                  ; Up
        JR      Z,ED2               ;
        LD      C,8                 ;
        CP      DOWN                ; Down
        RET     NZ                  ;
ED2:    LD      A,(DOTNUM)          ; Current dot
        ADD     A,C                 ; Add offset
        AND     63                  ; Wrap round
        LD      (DOTNUM),A          ; New dot
        RET                         ;
ED3:    CALL    PATPOS              ; IY->Pattern
        LD      A,(DOTNUM)          ; Current dot
        PUSH    AF                  ;
        RRCA                        ;
        RRCA                        ;
        RRCA                        ;
        AND     7                   ; A=Row
        LD      E,A                 ;
        LD      D,0                 ; DE=Row
        ADD     IY,DE               ; IY->Row
        POP     AF                  ;
        AND     7                   ; A=Column
        INC     A                   ;
ED4:    RRC     B                   ; AND mask
        RRC     C                   ; OR mask
        DEC     A                   ; Count columns
        JR      NZ,ED4              ;
        LD      A,(IY+0)            ; A=Pattern
        AND     B                   ; Strip old bit
        OR      C                   ; New bit
        LD      (IY+0),A            ; New pattern
        CALL    CHRMAG              ; Update magnified

CHROUT: CALL    PATPOS              ; IY->Pattern
        CALL    CHRXY               ; Get coords
        CALL    MAP                 ; Map
        LD      B,8                 ; Dot rows
CO1:    PUSH    DE                  ;
        PUSH    HL                  ;
        LD      A,8                 ; Dot cols
        LD      E,(IY+0)            ; E=Pattern
        CALL    SETROW              ; Set row
        POP     HL                  ; HL=CLOC
        POP     DE                  ; D=CMASK
        CALL    DOWNP               ; Down a pixel
        INC     IY                  ;
        DJNZ    CO1                 ;
        RET                         ;

CHRMAG: CALL    PATPOS              ; IY->Pattern
        LD      C,191               ; Start X
        LD      E,7                 ; Start Y
        CALL    MAP                 ; Map
        LD      B,8                 ; Dot rows
CM1:    LD      C,5                 ; Row mag
CM2:    PUSH    BC                  ;
        PUSH    DE                  ;
        PUSH    HL                  ;
        LD      B,8                 ; Dot columns
        LD      A,(IY+0)            ; A=Pattern
CM3:    RLCA                        ; Test bit
        PUSH    AF                  ;
        SBC     A,A                 ; 0=00H, 1=FFH
        LD      E,A                 ; E=Mag pattern
        LD      A,5                 ; Column mag
        CALL    SETROW              ; Set row
        CALL    RIGHTP              ; Right a pixel
        CALL    RIGHTP              ; Skip grid
        POP     AF                  ;
        DJNZ    CM3                 ;
        POP     HL                  ; HL=CLOC
        POP     DE                  ; D=CMASK
        POP     BC                  ;
        CALL    DOWNP               ; Down a pixel
        DEC     C                   ;
        JR      NZ,CM2              ;
        CALL    DOWNP               ; Skip grid
        INC     IY                  ;
        DJNZ    CM1                 ;
        RET                         ;

INIT:   LD      BC,2048             ; Size
        LD      DE,CHRTAB           ; Destination
        LD      HL,(CGPNT+1)        ; Source
IN1:    PUSH    BC                  ;
        PUSH    DE                  ;
        LD      A,(CGPNT)           ; Slot ID
        CALL    RDSLT               ; Read chr  pattern
        EI                          ;
        POP     DE                  ;
        POP     BC                  ;
        LD      (DE),A              ; Put in buffer
        INC     DE                  ;
        INC     HL                  ;
        DEC     BC                  ;
        LD      A,B                 ;
        OR      C                   ;
        JR      NZ,IN1              ;
        CALL    INIGRP              ; SCREEN 2
        LD      A,(FORCLR)          ; Colour 1
        RLCA                        ;
        RLCA                        ;
        RLCA                        ;
        RLCA                        ;
        LD      C,A                 ; C=Colour 1
        LD      A,(BAKCLR)          ; Colour 0
        OR      C                   ; Mix
        LD      BC,6144             ; Colour table size
        LD      HL,(GRPCOL)         ; Colour table
        CALL    FILVRM              ; Fill colours
        LD      HL,177*256+11       ;
        LD      BC,0FFH*256+10      ;
        LD      E,6                 ;
        LD      A,17                ;
        CALL    GRID                ; Draw chr grid
        LD      HL,49*256+6         ;
        LD      BC,0AAH*256+190     ;
        LD      E,6                 ;
        LD      A,9                 ;
        CALL    GRID                ; Draw mag grid
        LD      HL,49*256+48        ;
        LD      BC,0FFH*256+190     ;
        LD      E,6                 ;
        LD      A,2                 ;
        CALL    GRID                ; Draw mag box
        XOR     A                   ;
        LD      (DOTNUM),A          ; Current dot
        LD      HL,CHRNUM           ;
        LD      (HL),A              ; Current chr
IN2:    PUSH    HL                  ;
        CALL    CHROUT              ; Display chr
        POP     HL                  ;
        INC     (HL)                ; Next chr
        JR      NZ,IN2              ; Do 256
        RET                         ;

GRID:   PUSH    AF                  ;
        PUSH    BC                  ;
        PUSH    HL                  ;
        CALL    MAP                 ; Map
        POP     BC                  ; B=Len,C=Step
        POP     AF                  ;
        LD      E,A                 ; E=Pattern
        POP     AF                  ; A=Count
        PUSH    AF                  ;
        PUSH    DE                  ;
        PUSH    HL                  ;
GR1:    PUSH    AF                  ;
        PUSH    BC                  ;
        PUSH    DE                  ;
        PUSH    HL                  ;
        LD      A,B                 ; A=Len
        CALL    SETROW              ; Horizontal line
        POP     HL                  ; HL=CLOC
        POP     DE                  ; D=CMASK
GR3:    CALL    DOWNP               ; Down a pixel
        DEC     C                   ; Done step?
        JR      NZ,GR3              ;
        POP     BC                  ;
        POP     AF                  ; A=Count
        DEC     A                   ; Done lines?
        JR      NZ,GR1              ;
        POP     HL                  ; HL=Initial CLOC
        POP     DE                  ; D=Initial CMASK
        POP     AF                  ; A=Count
GR4:    PUSH    AF                  ;
        PUSH    BC                  ;
        PUSH    DE                  ;
        PUSH    HL                  ;
GR5:    LD      A,1                 ; Line width
        CALL    SETROW              ; Thin line
        CALL    DOWNP               ; Down a pixel
        DJNZ    GR5                 ; Vertical len
        POP     HL                  ; HL=CLOC
        POP     DE                  ; D=CMASK
GR6:    CALL    RIGHTP              ; Right a pixel
        DEC     C                   ; Done step?
        JR      NZ,GR6              ;
        POP     BC                  ;
        POP     AF                  ; A=Count
        DEC     A                   ; Done lines?
        JR      NZ,GR4              ;
        RET                         ;

MAP:    LD      B,0                 ; X MSB
        LD      D,B                 ; Y MSB
        CALL    MAPXYC              ; Map coords
        CALL    FETCHC              ; HL=CLOC
        LD      D,A                 ; D=CMASK
        RET                         ;

RIGHTP: RRC     D                   ; Shift CMASK
        RET     NC                  ; NC=Same cell
RP1:    PUSH    BC                  ;
        LD      BC,8                ; Offset
        ADD     HL,BC               ; HL=Next cell
        POP     BC                  ;
        RET                         ;

DOWNP:  INC     HL                  ; CLOC down
        LD      A,L                 ;
        AND     7                   ; Select pixel row
        RET     NZ                  ; NZ=Same cell
        PUSH    BC                  ;
        LD      BC,00F8H            ; Offset
        ADD     HL,BC               ; HL=Next cell
        POP     BC                  ;
        RET                         ;

SETROW: PUSH    BC                  ;
        LD      B,A                 ; B=Count
SE1:    CALL    RDVRM               ; Get old pattern
SE2:    LD      C,A                 ; C=Old
        LD      A,D                 ; A=CMASK
        CPL                         ; AND mask
        AND     C                   ; Strip old bit
        RLC     E                   ; Shift pattern
        JR      NC,SE3              ; NC=0 Pixel
        OR      D                   ; Set 1 Pixel
SE3:    DEC     B                   ; Finished?
        JR      Z,SE4               ;
        RRC     D                   ; CMASK right
        JR      NC,SE2              ; NC=Same cell
        CALL    WRTVRM              ; Update cell
        CALL    RP1                 ; Next cell
        JR      SE1                 ; Start again
SE4:    CALL    WRTVRM              ; Update cell
        POP     BC                  ;
        RET                         ;

DOTXY:  LD      A,(DOTNUM)          ; Current dot
        PUSH    AF                  ;
        AND     7                   ; Column
        RLCA                        ;
        LD      C,A                 ; C=Col*2
        RLCA                        ; A=Col*4
        ADD     A,C                 ; A=Col*6
        ADD     A,191               ; Grid atart
        LD      C,A                 ; C=X coord
        POP     AF                  ;
        AND     38H                 ; Row*8
        RRCA                        ;
        LD      E,A                 ; E=Row*4
        RRCA                        ; A=Row*2
        ADD     A,E                 ; A=Row*6
        ADD     A,7                 ; Grid start
        LD      E,A                 ; E=Y coord
        RET                         ;

CHRXY:  LD      A,(CHRNUM)          ; Current chr
        PUSH    AF                  ;
        CALL    MULT11              ; Column*11
        ADD     A,12                ; Grid start
        LD      C,A                 ; C=X coord
        POP     AF                  ;
        RRCA                        ;
        RRCA                        ;
        RRCA                        ;
        RRCA                        ;
        CALL    MULT11              ; Row*11
        ADD     A,8                 ; Grid start
        LD      E,A                 ; E=Y coord
        RET                         ;

MULT11: AND     0FH                 ;
        LD      D,A                 ; D=N
        RLCA                        ;
        LD      B,A                 ; B=N*2
        RLCA                        ;
        RLCA                        ; A=N*8
        ADD     A,B                 ;
        ADD     A,D                 ; A=N*11
        RET                         ;

PATPOS: LD      A,(CHRNUM)          ; Current chr
        LD      L,A                 ;
        LD      H,0                 ; HL=Chr
        ADD     HL,HL               ;
        ADD     HL,HL               ;
        ADD     HL,HL               ; HL=Chr*8
        EX      DE,HL               ; DE=Chr*8
        LD      IY,CHRTAB           ; Patterns
        ADD     IY,DE               ; IY->Pattern
        RET                         ;

GETKEY: LD      B,0                 ; Cursor flag
GE1:    PUSH    BC                  ; C=X coord
        PUSH    DE                  ; E=Y coord
        CALL    INVERT              ; Flip cursor
        POP     DE                  ;
        POP     BC                  ;
        INC     B                   ; Flip flag
        LD      HL,8000             ; Blink rate
GE2:    CALL    CHSNS               ; Check KEYBUF
        JR      NZ,GE3              ; NZ=Got key
        DEC     HL                  ;
        LD      A,H                 ;
        OR      L                   ;
        JR      NZ,GE2              ;
        JR      GE1                 ; Time for cursor
GE3:    BIT     0,B                 ; Cursor state
        CALL    NZ,INVERT           ; Remove cursor
        JP      CHGET               ; Collect character

INVERT: PUSH    DE                  ;
        CALL    MAP                 ; Map coords
        POP     AF                  ; A=Cursor size
        LD      B,A                 ; B=Rows
        LD      E,A                 ; E=Cols
IV1:    PUSH    DE                  ;
        PUSH    HL                  ;
IV2:    CALL    RDVRM               ; Old pattern
        XOR     D                   ; Flip a bit
        CALL    WRTVRM              ; Put it back
        CALL    RIGHTP              ; Right a pixel
        DEC     E                   ;
        JR      NZ,IV2              ;
        POP     HL                  ; HL=CLOC
        POP     DE                  ; D=CMASK
        CALL    DOWNP               ; Down a pixel
        DJNZ    IV1                 ;
        RET                         ;

ADOPT:  LD      BC,2048             ; Size
        LD      DE,0EB80H           ; Destination
        LD      (CGPNT+1),DE        ;
        LD      HL,CHRTAB           ; Source
        LDIR                        ; Copy up high
        CALL    RSLREG              ; Read PSLOT reg
        RLCA                        ;
        RLCA                        ;
        AND     3                   ; Select Page 3
        LD      C,A                 ;
        LD      B,0                 ; BC=Page 3 PSLOT#
        LD      HL,EXPTBL           ; Expanders
        ADD     HL,BC               ;
        BIT     7,(HL)              ; PSLOT expanded?
        JR      Z,AD1               ; A=Normal
        LD      HL,SLTTBL           ; Secondary regs
        ADD     HL,BC               ;
        LD      A,(HL)              ; A=Secondary reg
        RLCA                        ;
        RLCA                        ;
        RLCA                        ;
        RLCA                        ;
        AND     0CH                 ; A=Page 3 SSLOT#
        OR      C                   ; Mix Page 3 PSLOT#
        SET     7,A                 ; A=Slot ID
AD1:    LD      (CGPNT),A           ;
        RET                         ;

CHRNUM: DEFB    0                   ; Current chr
DOTNUM: DEFB    0                   ; Current dot
CHRTAB: DEFS    2048                ; Patterns to EAA2H

        END
