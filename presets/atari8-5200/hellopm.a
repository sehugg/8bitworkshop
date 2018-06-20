; Atari 5200 "Hello World" sample code
; Written by Daniel Boris (dboris@comcast.net)
;
; Assemble with DASM
;

        processor 6502

; ************ Hardware Adresses ***************************

DMACTL  equ     $D400           ;DMA Control
sDMACTL equ     $07             ;DMA Control Shadow
PMBASE  equ     $D407           ;PM base address
CHBASE  equ     $D409           ;Character set base
GRACTL  equ     $C01D           ;Graphics control
PRIOR   equ     $C01B           ;PM priorities
SIZEP0  equ     $C001           ;Size of player 0
HPOSP0  equ     $C000           ;Horizontal position player 0
COLPM0  equ     $C012           ;Player 0 color
DLISTL  equ     $D402           ;Display list lo
DLISTH  equ     $D403           ;Display list hi
sDLISTL equ     $05             ;Display list lo shadow
sDLISTH equ     $06             ;Display list hi shadow
CHACTL  equ     $D401           ;Character control
NMIEN   equ     $D40E           ;NMI Enable
sCOLPM0 equ      $08            ;Player/missile 0 color shadow
sCOLPM1 equ      $09            ;Player/missile 0 color shadow
sCOLPM2 equ      $0A            ;Player/missile 0 color shadow
sCOLPM3 equ      $0B            ;Player/missile 0 color shadow
sCOLOR0  equ     $0C             ;Color 0 shadow
sCOLOR1  equ     $0D             ;Color 1 shadow
sCOLOR2  equ     $0E             ;Color 2 shadow
sCOLOR3  equ     $0F             ;Color 3 shadow

;*************** Variable ***********************
line equ  $20                   ;Current DLI line
pm0pos equ $21                  ;Current pos of P0

;*************** Start of Code *******************

        org     $4000           ;Start of cartridge area
Start
        sei                     ;Disable interrupts
        cld                     ;Clear decimal mode

;************** Clear zero page and hardware ******

        ldx     #$00
        lda     #$00
crloop1    
        sta     $00,x           ;Clear zero page
        sta     $D400,x         ;Clear ANTIC
        sta     $C000,x         ;Clear GTIA
        sta     $E800,x         ;Clear POKEY
        dex
        bne     crloop1

;************* Clear RAM **************************

        ldy     #$00            ;Clear Ram
        lda     #$02            ;Start at $0200
        sta     $81             
        lda     #$00
        sta     $80
crloop3
        lda     #$00
        sta     ($80),y         ;Store data
        iny                     ;Next byte
        bne     crloop3         ;Branch if not done page
        inc     $81             ;Next page
        lda     $81
        cmp     #$40            ;Check if end of RAM
        bne     crloop3         ;Branch if not

;************* Setup display list *******************


        ldx     #$21            ;Number of bytes in list
dlloop                          ;Copy display list to RAM
        lda     dlist,x         ;Get byte
        sta     $1000,x         ;Copy to RAM
        dex                     ;next byte
        bpl     dlloop

;************ Setup IRQ vectors *********************

        lda     #$03            ;point IRQ vector
        sta     $200            ;to BIOS routine
        lda     #$FC
        sta     $201
        lda     #$B8            ;point VBI vector
        sta     $202            ;to BIOS routine
        lda     #$FC
        sta     $203
        lda     #$B2            ;point Deferred VBI
        sta     $204            ;to BIOS routine
        lda     #$FC
        sta     $205
        lda     #$00            ;point DLI vector
        sta     $206            ;to custom routine
        lda     #$50
        sta     $207
        lda     #$00
        sta     line
        
;************* Setup hardware registers *************

        lda     #$22            ;Set color PF0
        sta     sCOLOR0
        lda     #$0F            ;Set color PF1
        sta     sCOLOR1
        lda     #$84            ;Set color PF2
        sta     sCOLOR2             
        lda     #$00            ;Set Display list pointer
        sta     sDLISTL
        sta     DLISTL
        lda     #$10
        sta     sDLISTH
        sta     DLISTH
        lda     #$f8            ;Set Charcter Set Base
        sta     CHBASE
        lda     #$22            ;Enable DMA
        sta     sDMACTL
        lda     #$C0            ;Enable NMI + DLI
        sta     NMIEN

;************ Draw display graphics *******************

        ldy     #$02            ;Draw bars on screen
        lda     #$18            ;Screen memory starts at $1800
        sta     $81             
        lda     #$00
        sta     $80
        ldx     #$18
crloop5
        lda     #$FF            ;Bar 4 pixels wide of color 3
        sta     ($80),y         ;Store data
        iny                     
        iny                     ;Skip 4 pixels
        lda     #$55            ;Bar 4 pixels wide of color 1
        sta     ($80),y         ;Store data
        iny
        iny                     ;Skip 4 pixels
        lda     #$AA            ;Bar 4 pixels wide of color 2
        sta     ($80),y         ;Store data
        tya
        clc         
        adc     #$06            ;Move pointer to next line
        tay
        dex                     ;Next line
        bne     crloop5         ;Branch if not done

;************* Setup Player/Missile registers ***************

        lda     #$3A           ;Enable DMA (single line resolution/
        sta     sDMACTL        ;normal background)
        lda     #$20           ;Set PM base address ($200)
        sta     PMBASE
        lda     #$03           ;Enable players and missiles
        sta     GRACTL
        lda     #$16           ;Color of player 0
        sta     sCOLPM0
        ldy     #$00
        lda     #$03           ;Size of player 0
        sta     SIZEP0
        lda     #$01           ;Give players priority over playfield
        sta     PRIOR
      

;************ Copy player data to RAM ********************************

pmloop1        
        lda     pm1,y           ;Get data         
        sta     $2430,y         ;Write it into RAM
        sta     $24C0,y
        iny
        cpy     #$08            ;Copy 8 bytes
        bne     pmloop1

;************ Move player ********************************************

        ldx     #$20            ;Starting position of player
mvloop1
        jsr     waitvb          ;Wait for a vertical bank
        lda     #$00            ;Reset line counter
        sta     line
        stx     HPOSP0          ;Set position of player
        stx     pm0pos          ;Save position for DLI
        inx
        cpx     #$B0            ;Check for end of move
        bne     mvloop1         ;If not keep moving right
        lda     #$04            ;Give playfield priority player
        sta     PRIOR

mvloop2
        jsr     waitvb          ;Wait for a vertical blank
        lda     #$00            ;Reset line counter
        sta     line
        stx     HPOSP0          ;Set position of player
        stx     pm0pos          ;Save position for DLI
        dex
        cpx     #$40            ;Check for end of move
        bne     mvloop2         ;If not keep moving left
        lda     #$01            ;Give player priority over playfield
        sta     PRIOR
        jmp     mvloop1         ;Continue looping

;************ Wait for vertical blank ************************

waitvb
        lda     $02     ;Read timer (this is incremented during VB)
waitvb2
        cmp     $02         ;Did it change?
        beq     waitvb2     ;If not keep waiting
        rts

;************ Display list interrupt ************************

        org  $5000
dli
        pha             ;Save A
        inc line        ;Increment the line counter
        lda line        ;Past the fifth DLI?
        cmp #$05
        bne done        ;If not then exit DLI
        lda pm0pos      ;Get player 0 position
        eor #$FF        ;Invert it
        sta HPOSP0      ;Set player 0 position
        lda #$0F        ;Change player color
        sta COLPM0      ;
        ; Note: Player color is changed in hardware register not the shadow
        ; register so it takes effect immediatly. 
done
        pla             ;Restore A
        rti             ;Done

;************* Display list data ****************************

        org     $b000
dlist   .byte     $70,$70,$70      ;24 blank scanlines
        .byte     $48,$00,$18      ;Mode 8 and Load memory scan $1800
        .byte     $88,$88,$88,$88,$88,$88,$88   ;23 more line of mode 8
        .byte     $88,$88,$88,$88,$88,$88,$88,$88,$88,$88,$88,$88,$88
        .byte     $88,$88,$88
        .byte     $41,$00,$10       ;Jump back to start at $1000

;************* Player shape *********************************

pm1     .byte     %00111100
        .byte     %01000010
        .byte     %10100101
        .byte     %10000001
        .byte     %10100101
        .byte     %10011001
        .byte     %01000010
        .byte     %00111100

;************** Cart reset vector **************************

        org     $bffd
        .byte   $FF         ;Don't display Atari logo
        .byte   $00,$40     ;Start code at $4000

