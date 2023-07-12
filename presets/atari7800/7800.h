; 7800.h
; Version 1.0, 2019/12/13

; This file defines hardware registers and memory mapping for the
; Atari 7800. It is distributed as a companion machine-specific support package
; for the DASM compiler. Updates to this file, DASM, and associated tools are
; available at https://github.com/dasm-assembler/dasm


; ******************** 7800 Hardware Adresses ***************************
;
;       MEMORY MAP USAGE OF THE 7800
;
;	  00 -   1F	TIA REGISTERS
;	  20 -   3F	MARIA REGISTERS
;	  40 -   FF	RAM block 0 (zero page)
;	 100 -  11F	TIA   (mirror of 0000-001f)
;	 120 -  13F	MARIA (mirror of 0020-003f)
;	 140 -  1FF	RAM block 1 (stack)
;	 200 -  21F	TIA   (mirror of 0000-001f)
;	 220 -  23F	MARIA (mirror of 0020-003f)
;	 240 -  27F	???
;	 280 -  2FF	RIOT I/O ports and timers
;	 300 -  31F	TIA   (mirror of 0000-001f)
;	 320 -  33F	MARIA (mirror of 0020-003f)
;	 340 -  3FF	???
;	 400 -  47F	unused address space
;	 480 -  4FF	RIOT RAM
;	 500 -  57F	unused address space
;	 580 -  5FF	RIOT RAM (mirror of 0480-04ff)
;	 600 - 17FF	unused address space
;	1800 - 203F	RAM
;	2040 - 20FF	RAM block 0 (mirror of 0000-001f)
;	2100 - 213F	RAM
;	2140 - 21FF	RAM block 1 (mirror of 0140-01ff)
;	2200 - 27FF	RAM
;	2800 - 2FFF	mirror of 1800-27ff
;	3000 - 3FFF	unused address space
;	4000 - FF7F	potential cartridge address space
;	FF80 - FFF9	RESERVED FOR ENCRYPTION
;	FFFA - FFFF 	6502 VECTORS


;****** 00-1F ********* TIA REGISTERS ******************

INPTCTRL = $01     ;Input control. In same address space as TIA. write-only
VBLANK   = $01     ;VBLANK. D7=1:dump paddle caps to ground.     write-only
INPT0    = $08     ;Paddle Control Input 0                       read-only
INPT1    = $09     ;Paddle Control Input 1                       read-only
INPT2    = $0A     ;Paddle Control Input 2                       read-only
INPT3    = $0B     ;Paddle Control Input 3                       read-only

; ** some common alternate names for INPT0/1/2/3
INPT4B   = $08     ;Joystick 0 Fire 1                            read-only
INPT4A   = $09     ;Joystick 0 Fire 1                            read-only
INPT5B   = $0A     ;Joystick 1 Fire 0                            read-only
INPT5A   = $0B     ;Joystick 1 Fire 1                            read-only
INPT4R   = $08     ;Joystick 0 Fire 1                            read-only
INPT4L   = $09     ;Joystick 0 Fire 1                            read-only
INPT5R   = $0A     ;Joystick 1 Fire 0                            read-only
INPT5L   = $0B     ;Joystick 1 Fire 1                            read-only

INPT4    = $0C     ;Player 0 Fire Button Input                   read-only
INPT5    = $0D     ;Player 1 Fire Button Input                   read-only

AUDC0    = $15     ;Audio Control Channel   0                    write-only
AUDC1    = $16     ;Audio Control Channel   1                    write-only
AUDF0    = $17     ;Audio Frequency Channel 0                    write-only
AUDF1    = $18     ;Audio Frequency Channel 1                    write-only
AUDV0    = $19     ;Audio Volume Channel    0                    write-only
AUDV1    = $1A     ;Audio Volume Channel    1                    write-only

;****** 20-3F ********* MARIA REGISTERS ***************

BACKGRND = $20     ;Background Color                             write-only
P0C1     = $21     ;Palette 0 - Color 1                          write-only
P0C2     = $22     ;Palette 0 - Color 2                          write-only
P0C3     = $23     ;Palette 0 - Color 3                          write-only
WSYNC    = $24     ;Wait For Sync                                write-only
P1C1     = $25     ;Palette 1 - Color 1                          write-only
P1C2     = $26     ;Palette 1 - Color 2                          write-only
P1C3     = $27     ;Palette 1 - Color 3                          write-only
MSTAT    = $28     ;Maria Status                                 read-only
P2C1     = $29     ;Palette 2 - Color 1                          write-only
P2C2     = $2A     ;Palette 2 - Color 2                          write-only
P2C3     = $2B     ;Palette 2 - Color 3                          write-only
DPPH     = $2C     ;Display List List Pointer High               write-only
P3C1     = $2D     ;Palette 3 - Color 1                          write-only
P3C2     = $2E     ;Palette 3 - Color 2                          write-only
P3C3     = $2F     ;Palette 3 - Color 3                          write-only
DPPL     = $30     ;Display List List Pointer Low                write-only
P4C1     = $31     ;Palette 4 - Color 1                          write-only
P4C2     = $32     ;Palette 4 - Color 2                          write-only
P4C3     = $33     ;Palette 4 - Color 3                          write-only
CHARBASE = $34     ;Character Base Address                       write-only
CHBASE   = $34     ;Character Base Address                       write-only
P5C1     = $35     ;Palette 5 - Color 1                          write-only
P5C2     = $36     ;Palette 5 - Color 2                          write-only
P5C3     = $37     ;Palette 5 - Color 3                          write-only
OFFSET   = $38     ;Unused - Store zero here                     write-only
P6C1     = $39     ;Palette 6 - Color 1                          write-only
P6C2     = $3A     ;Palette 6 - Color 2                          write-only
P6C3     = $3B     ;Palette 6 - Color 3                          write-only
CTRL     = $3C     ;Maria Control Register                       write-only
P7C1     = $3D     ;Palette 7 - Color 1                          write-only
P7C2     = $3E     ;Palette 7 - Color 2                          write-only
P7C3     = $3F     ;Palette 7 - Color 3                          write-only


;****** 280-2FF ******* PIA PORTS AND TIMERS ************

SWCHA    = $280    ;P0+P1 Joystick Directional Input             read-write
CTLSWA   = $281    ;I/O Control for SCHWA                        read-write
SWACNT   = $281    ;VCS name for above                           read-write
SWCHB    = $282    ;Console Switches                             read-write
CTLSWB   = $283    ;I/O Control for SCHWB                        read-write
SWBCNT   = $283    ;VCS name for above                           read-write

INTIM    = $284    ;Iterval Timer Read                           read-only
TIM1T    = $294    ;Set 1    CLK Interval (838   nsec/interval)  write-only
TIM8T    = $295    ;Set 8    CLK Interval (6.7   usec/interval)  write-only
TIM64T   = $296    ;Set 64   CLK Interval (63.6  usec/interval)  write-only
T1024T   = $297    ;Set 1024 CLK Interval (858.2 usec/interval)  write-only
TIM64TI  = $29E    ;Interrupt timer 64T                          write-only

;XM
XCTRL    = $470    ; 7=YM2151 6=RAM@6k 5=RAM@4k 4=pokey@450 3=hsc 2=cart 1=RoF_bank1 0=RoF_bank2

; Pokey register relative locations, since its base may be different
; depending on the hardware.
PAUDF0   = $0    ; extra audio channels and frequencies
PAUDC0   = $1
PAUDF1   = $2
PAUDC1   = $3
PAUDF2   = $4
PAUDC2   = $5
PAUDF3   = $6
PAUDC3   = $7
PAUDCTL  = $8    ; Audio Control
PRANDOM  = $A    ; 17 bit polycounter pseudo random
PSKCTL   = $F    ; Serial Port control
