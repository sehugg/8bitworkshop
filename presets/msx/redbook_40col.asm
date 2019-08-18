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
CNVCHR: EQU     00ABH
MAPXYC: EQU     0111H
SETC:   EQU     0120H

; ******************************
; *     WORKSPACE VARIABLES    *
; ******************************

FORCLR: EQU     0F3E9H
ATRBYT: EQU     0F3F2H
CGPNT:  EQU     0F91FH
PATWRK: EQU     0FC40H
SCRMOD: EQU     0FCAFH
GRPACX: EQU     0FCB7H
GRPACY: EQU     0FCB9H

; ******************************
; *      CONTROL CHARACTERS    *
; ******************************

CR:     EQU     13

Start:
GFORTY: CP      3                   ; String type?
        RET     NZ                  ;
        LD      A,(SCRMOD)          ; Mode
        CP      2                   ; Graphics?
        RET     NZ                  ;
        EX      DE,HL               ; HL->Descriptor
        LD      B,(HL)              ; B=String len
        INC     HL                  ;
        LD      E,(HL)              ; Address LSB
        INC     HL                  ;
        LD      D,(HL)              ; DE->String
        INC     B                   ;
GF2:    DEC     B                   ; Finished?
        RET     Z                   ;
        LD      A,(DE)              ; A=Chr from string
        CALL    GPRINT              ; Print it
        INC     DE                  ;
        JR      GF2                 ; Next chr
GPRINT: PUSH    AF                  ;
        PUSH    BC                  ;
        PUSH    DE                  ;
        PUSH    HL                  ;
        PUSH    IY                  ;
        LD      BC,(GRPACX)         ; BC=X coord
        LD      DE,(GRPACY)         ; DE=Y coord
        CALL    GDC                 ; Decode chr
        LD      (GRPACX),BC         ; New X coord
        LD      (GRPACY),DE         ; New Y coord
        POP     IY                  ;
        POP     HL                  ;
        POP     DE                  ;
        POP     BC                  ;
        POP     AF                  ;
        RET                         ;

GDC:    CALL    CNVCHR              ; Check graphic
        RET     NC                  ; NC=Header
        JR      NZ,GD2              ; NZ=Converted
        CP      CR                  ; Carriage Return?
        JR      Z,GCRLF             ;
        CP      20H                 ; Other control?
        RET     C                   ; Ignore
GD2:    LD      L,A                 ;
        LD      H,0                 ; HL=Chr code
        ADD     HL,HL               ;
        ADD     HL,HL               ;
        ADD     HL,HL               ; HL=Chr*8
        PUSH    BC                  ; X coord
        PUSH    DE                  ; Y coord
        LD      DE,(CGPNT+1)        ; Character set
        ADD     HL,DE               ; HL->Pattern
        LD      DE,PATWRK           ; DE->Buffer
        LD      B,8                 ; Eight byte pattern
GD3:    PUSH    BC                  ;
        PUSH    DE                  ;
        LD      A,(CGPNT)           ; Slot ID
        CALL    RDSLT               ; Get pattern
        EI                          ;
        POP     DE                  ;
        POP     BC                  ;
        LD      (DE),A              ; Put in buffer
        INC     DE                  ;
        INC     HL                  ;
        DJNZ    GD3                 ; Next
        POP     DE                  ;
        POP     BC                  ;
        LD      A,(FORCLR)          ; Current colour
        LD      (ATRBYT),A          ; Set ink
        LD      IY,PATWRK           ; IY->Patterns
        PUSH    DE                  ;
        LD      H,8                 ; Max dot rows
GD4:    BIT     7,D                 ; Pos Y coord?
        JR      NZ,GD8              ;
        CALL    BMDROW              ; Bottom most row?
        JR      C,GD9               ; C=Y too large
        PUSH    BC                  ;
        LD      L,6                 ; Max dot cols
        LD      A,(IY+0)            ; A=Pattern row
GD5:    BIT     7,B                 ; Pos X coord
        JR      NZ,GD6              ;
        CALL    RMDCOL              ; Rightmost col?
        JR      C,GD7               ; C=X too large
        BIT     7,A                 ; Pattern bit
        JR      Z,GD6               ; Z=0 Pixel
        PUSH    AF                  ;
        PUSH    DE                  ;
        PUSH    HL                  ;
        CALL    MAPXYC              ; Map coords
        CALL    SETC                ; Set pixel
        POP     HL                  ;
        POP     DE                  ;
        POP     AF                  ;
GD6:    RLCA                        ; Shift pattern
        INC     BC                  ; X=X+1
        DEC     L                   ; Finished dot cols?
        JR      NZ,GD5              ;
GD7:    POP     BC                  ; Initial X coord
GD8:    INC     IY                  ; Next pattern byte
        INC     DE                  ; Y=Y+1
        DEC     H                   ; Finished dot rows?
        JR      NZ,GD4              ;
GD9:    POP     DE                  ; Initial Y coord
        LD      HL,6                ; Step
        ADD     HL,BC               ; X=X+6
        LD      B,H                 ;
        LD      C,L                 ; BC=New X coord
        CALL    RMDCOL              ; Rightmost col?
        RET     NC                  ;

GCRLF:  LD      BC,0                ; X=0
        LD      HL,8                ;
        ADD     HL,DE               ;
        EX      DE,HL               ; Y=Y+8
        RET                         ;

BMDROW: PUSH    HL                  ;
        LD      HL,191              ; Bottom dot row
        OR      A                   ;
        SBC     HL,DE               ; Check Y coord
        POP     HL                  ;
        RET                         ; C=Below screen

RMDCOL: PUSH    HL                  ;
        LD      HL,239              ; Rightmost dot col
        OR      A                   ;
        SBC     HL,BC               ; Check X coord
        POP     HL                  ;
        RET                         ; C=Beyond right

        END