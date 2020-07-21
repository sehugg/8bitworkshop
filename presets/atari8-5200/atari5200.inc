;-------------------------------------------------------------------------
; Atari 5200 System Equates
; by Christian Groessler <chris@groessler.org>
; taken from EQUATES.INC from Atari Inc.
;-------------------------------------------------------------------------

;-------------------------------------------------------------------------
; ATASCII CHARACTER DEFS
;-------------------------------------------------------------------------
 
ATEOL   = $9B      ; END-OF-LINE, used by CONIO

;-------------------------------------------------------------------------
; CONIO CHARACTER DEFS
;-------------------------------------------------------------------------

CH_ULCORNER = $0B  ; '+' sign
CH_URCORNER = $0B
CH_LLCORNER = $0B
CH_LRCORNER = $0B
CH_HLINE    = $0D  ; dash
CH_VLINE    = $01  ; exclamation mark

;-------------------------------------------------------------------------
; Zero Page
;-------------------------------------------------------------------------

POKMSK  =  $00     ; Mask for Pokey IRQ enable
RTCLOK  =  $01     ; 60 hz. clock
JUMP    =  $01   
CRITIC  =  $03     ; Critical section
ATRACT  =  $04     ; Attract Mode 

SDLSTL  =  $05     ; DLISTL Shadow
SDLSTH  =  $06     ; DLISTH  "
SDMCTL  =  $07     ; DMACTL  "

PCOLR0  =  $08     ; COLPM0 Shadow
PCOLR1  =  $09     ; COLPM1  "
PCOLR2  =  $0A     ; COLPM2  "
PCOLR3  =  $0B     ; COLPM3  "

COLOR0  =  $0C     ; COLPF0 Shadow
COLOR1  =  $0D     ; COLPF1  "
COLOR2  =  $0E     ; COLPF2  "
COLOR3  =  $0F     ; COLPF3  "
COLOR4  =  $10     ; COLBK   "

PADDL0  =  $11     ; POT0 Shadow
PADDL1  =  $12     ; POT1  "
PADDL2  =  $13     ; POT2  "
PADDL3  =  $14     ; POT3  "
PADDL4  =  $15     ; POT4  "
PADDL5  =  $16     ; POT5  "
PADDL6  =  $17     ; POT6  "
PADDL7  =  $18     ; POT7  "

; cc65 runtime zero page variables

ROWCRS_5200     =       $19
COLCRS_5200     =       $1A
SAVMSC          =       $1B             ; pointer to screen memory (conio)

;-------------------------------------------------------------------------
; Page #2
;-------------------------------------------------------------------------

;Interrupt Vectors
                 
VIMIRQ  =  $0200   ; Immediate IRQ    
                      ; Preset $FC03 (SYSIRQ)
VVBLKI  =  $0202   ; Vblank immediate
                      ; Preset $FCB8 (SYSVBL)
VVBLKD  =  $0204   ; Vblank deferred
                      ; Preset $FCB2 (XITVBL)
VDSLST  =  $0206   ; Display List 
                      ; Preset $FEA1 (OSDLI)
VKYBDI  =  $0208   ; Keyboard immediate
                      ; Preset $FD02 (SYSKBD)
VKYBDF  =  $020A   ; Deferred Keyboard
                      ; Preset $FCB2 (XITVBL)
VTRIGR  =  $020C   ; Soft Trigger   
VBRKOP  =  $020E   ; BRK Opcode
VSERIN  =  $0210   ; Serial in Ready
VSEROR  =  $0212   ; Serial Out Ready
VSEROC  =  $0214   ; Serial Output complete
VTIMR1  =  $0216   ; Pokey Timer 1
VTIMR2  =  $0218   ; Pokey Timer 2
VTIMR4  =  $021A   ; Pokey Timer 4



;-------------------------------------------------------------------------
; CTIA/GTIA Address Equates
;-------------------------------------------------------------------------

GTIA    = $C000    ; CTIA/GTIA area

;-------------------------------------------------------------------------
; ANTIC Address Equates
;-------------------------------------------------------------------------

ANTIC     = $D400  ; ANTIC area

;-------------------------------------------------------------------------
; POKEY Address Equates
;-------------------------------------------------------------------------

POKEY     = $E800  ; POKEY area

;-------------------------------------------------------------------------
; conio color defines
;-------------------------------------------------------------------------

COLOR_WHITE = 0
COLOR_RED   = 1
COLOR_GREEN = 2
COLOR_BLACK = 3

;-------------------------------------------------------------------------
; Cartridge Parameters
;-------------------------------------------------------------------------

CARTNM  =  $BFE8   ; Cartridge Name Area
COPYD   =  $BFFC   ; Copyright Decade in Cart
COPYR   =  $BFFD   ; Copyright Year in Cart
                      ; $FF=Diagnostic Cart
GOCART  =  $BFFE   ; Cartridge Start Vector

CHRORG  =  $F800   ; Character Generator Base
;-------------------------------------------------------------------------
; ANTIC Address Equates
;-------------------------------------------------------------------------

; Read Addresses

VCOUNT  = ANTIC + $0B         ;vertical line counter
PENH    = ANTIC + $0C         ;light pen horizontal position
PENV    = ANTIC + $0D         ;light pen vertical position
NMIST   = ANTIC + $0F         ;NMI interrupt status

; Write Addresses

DMACTL  = ANTIC + $00         ;DMA control
CHACTL  = ANTIC + $01         ;character control
DLISTL  = ANTIC + $02         ;low display list address
DLISTH  = ANTIC + $03         ;high display list address
HSCROL  = ANTIC + $04         ;horizontal scroll
VSCROL  = ANTIC + $05         ;vertical scroll
PMBASE  = ANTIC + $07         ;player-missile base address
CHBASE  = ANTIC + $09         ;character base address
WSYNC   = ANTIC + $0A         ;wait for HBLANK synchronization
NMIEN   = ANTIC + $0E         ;NMI enable
NMIRES  = ANTIC + $0F         ;NMI interrupt reset


;-------------------------------------------------------------------------
; Antic opcodes
;-------------------------------------------------------------------------

; usage example:
;
; ScreenDL:
; .byte DL_BLK8
; .byte DL_BLK8
; .byte DL_CHR40x8x1 | DL_LMS | DL_DLI
; .word ScreenAlignment
; .byte DL_BLK1 | DL_DLI
; .byte DL_MAP320x1x1 | DL_LMS
; .word Screen
;
; .repeat 99
; .byte DL_MAP320x1x1
; .endrepeat
; .byte DL_MAP320x1x1 | DL_LMS
; .word Screen + 40 * 100       ; 100 lines a 40 byte, 'Screen' has to be aligned correctly!
; .repeat 92
; .byte DL_MAP320x1x1
; .endrepeat
;
; .byte DL_JVB

; absolute instructions (non mode lines)

DL_JMP  = 1
DL_JVB  = 65

; DL_BLKn display n empty lines (just background)

DL_BLK1  = 0
DL_BLK2  = 16
DL_BLK3  = 32
DL_BLK4  = 48
DL_BLK5  = 64
DL_BLK6  = 80
DL_BLK7  = 96
DL_BLK8  = 112

; absolute instructions (mode lines)

DL_CHR40x8x1  = 2               ; monochrome, 40 character & 8 scanlines per mode line (GR. 0)
DL_CHR40x10x1 = 3               ; monochrome, 40 character & 10 scanlines per mode line
DL_CHR40x8x4  = 4               ; colour, 40 character & 8 scanlines per mode line (GR. 12)
DL_CHR40x16x4 = 5               ; colour, 40 character & 16 scanlines per mode line (GR. 13)
DL_CHR20x8x2  = 6               ; colour (duochrome per character), 20 character & 8 scanlines per mode line (GR. 1)
DL_CHR20x16x2 = 7               ; colour (duochrome per character), 20 character & 16 scanlines per mode line (GR. 2)

DL_MAP40x8x4  = 8               ; colour, 40 pixel & 8 scanlines per mode line (GR. 3)
DL_MAP80x4x2  = 9               ; 'duochrome', 80 pixel & 4 scanlines per mode line (GR.4) 
DL_MAP80x4x4  = 10              ; colour, 80 pixel & 4 scanlines per mode line (GR.5) 
DL_MAP160x2x2 = 11              ; 'duochrome', 160 pixel & 2 scanlines per mode line (GR.6) 
DL_MAP160x1x2 = 12              ; 'duochrome', 160 pixel & 1 scanline per mode line (GR.14) 
DL_MAP160x2x4 = 13              ; 4 colours, 160 pixel & 2 scanlines per mode line (GR.7) 
DL_MAP160x1x4 = 14              ; 4 colours, 160 pixel & 1 scanline per mode line (GR.15) 
DL_MAP320x1x1 = 15              ; monochrome, 320 pixel & 1 scanline per mode line (GR.8) 

; modifiers on mode lines...

DL_HSCROL = 16
DL_VSCROL = 32
DL_LMS    = 64

; general modifier...

DL_DLI    = 128
;-------------------------------------------------------------------------
; CTIA/GTIA Address Equates
;-------------------------------------------------------------------------

; Read/Write Addresses

CONSOL  = GTIA + $1F         ;console switches and speaker control

; Read Addresses

M0PF    = GTIA + $00         ;missile 0 and playfield collision
M1PF    = GTIA + $01         ;missile 1 and playfield collision
M2PF    = GTIA + $02         ;missile 2 and playfield collision
M3PF    = GTIA + $03         ;missile 3 and playfield collision

P0PF    = GTIA + $04         ;player 0 and playfield collision
P1PF    = GTIA + $05         ;player 1 and playfield collision
P2PF    = GTIA + $06         ;player 2 and playfield collision
P3PF    = GTIA + $07         ;player 3 and playfield collision

M0PL    = GTIA + $08         ;missile 0 and player collision
M1PL    = GTIA + $09         ;missile 1 and player collision
M2PL    = GTIA + $0A         ;missile 2 and player collision
M3PL    = GTIA + $0B         ;missile 3 and player collision

P0PL    = GTIA + $0C         ;player 0 and player collision
P1PL    = GTIA + $0D         ;player 1 and player collision
P2PL    = GTIA + $0E         ;player 2 and player collision
P3PL    = GTIA + $0F         ;player 3 and player collision

TRIG0   = GTIA + $10         ;joystick trigger 0
TRIG1   = GTIA + $11         ;joystick trigger 1

TRIG2   = GTIA + $12         ;cartridge interlock
TRIG3   = GTIA + $13         ;ACMI module interlock

PAL     = GTIA + $14         ;##rev2## PAL/NTSC indicator

; Write Addresses

HPOSP0  = GTIA + $00         ;player 0 horizontal position
HPOSP1  = GTIA + $01         ;player 1 horizontal position
HPOSP2  = GTIA + $02         ;player 2 horizontal position
HPOSP3  = GTIA + $03         ;player 3 horizontal position

HPOSM0  = GTIA + $04         ;missile 0 horizontal position
HPOSM1  = GTIA + $05         ;missile 1 horizontal position
HPOSM2  = GTIA + $06         ;missile 2 horizontal position
HPOSM3  = GTIA + $07         ;missile 3 horizontal position

SIZEP0  = GTIA + $08         ;player 0 size
SIZEP1  = GTIA + $09         ;player 1 size
SIZEP2  = GTIA + $0A         ;player 2 size
SIZEP3  = GTIA + $0B         ;player 3 size

SIZEM   = GTIA + $0C         ;missile sizes

GRAFP0  = GTIA + $0D         ;player 0 graphics
GRAFP1  = GTIA + $0E         ;player 1 graphics
GRAFP2  = GTIA + $0F         ;player 2 graphics
GRAFP3  = GTIA + $10         ;player 3 graphics

GRAFM   = GTIA + $11         ;missile graphics

COLPM0  = GTIA + $12         ;player-missile 0 color/luminance
COLPM1  = GTIA + $13         ;player-missile 1 color/luminance
COLPM2  = GTIA + $14         ;player-missile 2 color/luminance
COLPM3  = GTIA + $15         ;player-missile 3 color/luminance

COLPF0  = GTIA + $16         ;playfield 0 color/luminance
COLPF1  = GTIA + $17         ;playfield 1 color/luminance
COLPF2  = GTIA + $18         ;playfield 2 color/luminance
COLPF3  = GTIA + $19         ;playfield 3 color/luminance

COLBK   = GTIA + $1A         ;background color/luminance

PRIOR   = GTIA + $1B         ;priority select
VDELAY  = GTIA + $1C         ;vertical delay
GRACTL  = GTIA + $1D         ;graphic control
HITCLR  = GTIA + $1E         ;collision clear


; Hue values

HUE_GREY        = 0
HUE_GOLD        = 1
HUE_GOLDORANGE  = 2
HUE_REDORANGE   = 3
HUE_ORANGE      = 4
HUE_MAGENTA     = 5
HUE_PURPLE      = 6
HUE_BLUE        = 7
HUE_BLUE2       = 8
HUE_CYAN        = 9
HUE_BLUEGREEN   = 10
HUE_BLUEGREEN2  = 11
HUE_GREEN       = 12
HUE_YELLOWGREEN = 13
HUE_YELLOW      = 14
HUE_YELLOWRED   = 15

; Color defines, similar to c64 colors (untested)

GTIA_COLOR_BLACK      = (HUE_GREY << 4)
GTIA_COLOR_WHITE      = (HUE_GREY << 4 | 7 << 1)
GTIA_COLOR_RED        = (HUE_REDORANGE << 4 | 1 << 1)
GTIA_COLOR_CYAN       = (HUE_CYAN << 4 | 3 << 1)
GTIA_COLOR_VIOLET     = (HUE_PURPLE << 4 | 4 << 1)
GTIA_COLOR_GREEN      = (HUE_GREEN << 4 | 2 << 1)
GTIA_COLOR_BLUE       = (HUE_BLUE << 4 | 2 << 1)
GTIA_COLOR_YELLOW     = (HUE_YELLOW << 4 | 7 << 1)
GTIA_COLOR_ORANGE     = (HUE_ORANGE << 4 | 5 << 1)
GTIA_COLOR_BROWN      = (HUE_YELLOW << 4 | 2 << 1)
GTIA_COLOR_LIGHTRED   = (HUE_REDORANGE << 4 | 6 << 1)
GTIA_COLOR_GRAY1      = (HUE_GREY << 4 | 2 << 1)
GTIA_COLOR_GRAY2      = (HUE_GREY << 4 | 3 << 1)
GTIA_COLOR_LIGHTGREEN = (HUE_GREEN << 4 | 6 << 1)
GTIA_COLOR_LIGHTBLUE  = (HUE_BLUE << 4 | 6 << 1)
GTIA_COLOR_GRAY3      = (HUE_GREY << 4 | 5 << 1)
;-------------------------------------------------------------------------
; POKEY Address Equates
;-------------------------------------------------------------------------

; Read Addresses

POT0    = POKEY + $00         ;potentiometer 0
POT1    = POKEY + $01         ;potentiometer 1
POT2    = POKEY + $02         ;potentiometer 2
POT3    = POKEY + $03         ;potentiometer 3
POT4    = POKEY + $04         ;potentiometer 4
POT5    = POKEY + $05         ;potentiometer 5
POT6    = POKEY + $06         ;potentiometer 6
POT7    = POKEY + $07         ;potentiometer 7

ALLPOT  = POKEY + $08         ;potentiometer port status
KBCODE  = POKEY + $09         ;keyboard code
RANDOM  = POKEY + $0A         ;random number generator
SERIN   = POKEY + $0D         ;serial port input
IRQST   = POKEY + $0E         ;IRQ interrupt status
SKSTAT  = POKEY + $0F         ;serial port and keyboard status

; Write Addresses

AUDF1   = POKEY + $00         ;channel 1 audio frequency
AUDC1   = POKEY + $01         ;channel 1 audio control

AUDF2   = POKEY + $02         ;channel 2 audio frequency
AUDC2   = POKEY + $03         ;channel 2 audio control

AUDF3   = POKEY + $04         ;channel 3 audio frequency
AUDC3   = POKEY + $05         ;channel 3 audio control

AUDF4   = POKEY + $06         ;channel 4 audio frequency
AUDC4   = POKEY + $07         ;channel 4 audio control

AUDCTL  = POKEY + $08         ;audio control
STIMER  = POKEY + $09         ;start timers
SKRES   = POKEY + $0A         ;reset SKSTAT status
POTGO   = POKEY + $0B         ;start potentiometer scan sequence
SEROUT  = POKEY + $0D         ;serial port output
IRQEN   = POKEY + $0E         ;IRQ interrupt enable
SKCTL   = POKEY + $0F         ;serial port and keyboard control
