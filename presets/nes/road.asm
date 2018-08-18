
	include "nesdefs.asm"

;;;;; ZERO-PAGE VARIABLES

	seg.u ZEROPAGE
	org $0

TrackFrac	.byte	; fractional position along track
Speed		.byte	; speed of car
TimeOfDay	.word	; 16-bit time of day counter
; Variables for preprocessing step
XPos		.word	; 16-bit X position
XVel		.word	; 16-bit X velocity
TPos		.word	; 16-bit track position
TrackLookahead	.byte	; current fractional track increment
; Variables for track generation
Random		.byte	; random counter
GenTarget	.byte	; target of current curve
GenDelta	.byte	; curve increment 
GenCur		.byte	; current curve value

ZOfs		.byte	; counter to draw striped center line
Weather		.byte	; bitmask for weather
Heading		.word	; sky scroll pos.

XCenter		= 128
NumRoadSegments = 28

; Preprocessing result: X positions for all track segments 
RoadX0		ds NumRoadSegments

; Generated track curve data
TrackLen	equ 5
TrackData	ds TrackLen

InitialSpeed	equ 10	; starting speed

;;;;; OTHER VARIABLES

	seg.u RAM
	org $300

;;;;; NES CARTRIDGE HEADER

	NES_HEADER 0,2,1,0 ; mapper 0, 2 PRGs, 1 CHR, horiz. mirror

;;;;; START OF CODE

Start:
	NES_INIT	; set up stack pointer, turn off PPU
        jsr WaitSync	; wait for VSYNC
        jsr ClearRAM	; clear RAM
        jsr WaitSync	; wait for VSYNC (and PPU warmup)

	jsr SetPalette	; set palette colors
        jsr FillVRAM	; set PPU video RAM

        jsr RoadSetup

	lda #0
        sta PPU_ADDR
        sta PPU_ADDR	; PPU addr = $0000
        sta PPU_SCROLL
        sta PPU_SCROLL  ; scroll = $0000
        lda #CTRL_NMI
        sta PPU_CTRL	; enable NMI
        lda #MASK_BG|MASK_SPR
        sta PPU_MASK 	; enable rendering
        
.endless
	jmp .endless	; endless loop

;;;;; ROAD SUBS

RoadSetup: subroutine
        lda #1
        sta Random
        lda #InitialSpeed
        sta Speed
        lda #0
        sta TimeOfDay+1
        lda #0
        sta Weather
	rts

RoadPreSetup: subroutine
; Set up some values for road curve computation,
; since we have some scanline left over.
	lda #0
        sta XVel
        sta XVel+1
        sta XPos
        sta XPos+1
        lda TrackFrac
        sta TPos
        lda #0
        sta TPos+1
        lda #10		; initial lookahead
        sta TrackLookahead
	rts

RoadPostFrame: subroutine
; Advance position on track
; TrackFrac += Speed
	lda TrackFrac
        clc
        adc Speed
        sta TrackFrac
        bcc .NoGenTrack ; addition overflowed?
        jsr GenTrack	; yes, generate new track segment
.NoGenTrack
; TimeOfDay += 1
        inc TimeOfDay
        bne .NoTODInc
        inc TimeOfDay+1
        lda TimeOfDay+1
; See if it's nighttime yet, and if the stars come out
        clc
        adc #8
        and #$3f
        cmp #$35
        ror
        sta Weather
.NoTODInc
	lda Heading
        sec
        sbc XPos+1
        sta Heading
        bit XPos+1
        bmi .NegHeading
        lda Heading+1
        sbc #0
        sta Heading+1
        rts
.NegHeading
        lda Heading+1
        sbc #$ff
        sta Heading+1
	rts

; Compute road curve from bottom of screen to horizon.
PreprocessCurve subroutine
	ldx #NumRoadSegments-1
.CurveLoop
; Modify X position
; XPos += XVel (16 bit add)
	lda XPos
        clc
        adc XVel
        sta XPos
        lda XPos+1
        adc XVel+1
        sta XPos+1
        sta RoadX0,x	; store in RoadX0 array
; Modify X velocity (slope)
; XVel += TrackData[TPos]
        ldy TPos+1
        lda TrackData,y
        clc		; clear carry for ADC
        bmi .CurveLeft	; track slope negative?
        adc XVel
        sta XVel
        lda XVel+1
        adc #0		; carry +1
        jmp .NoCurveLeft
.CurveLeft
        adc XVel
        sta XVel
        lda XVel+1
        sbc #0		; carry -1
        nop ; make the branch timings are the same
.NoCurveLeft
        sta XVel+1
; Advance TPos (TrackData index)
; TPos += TrackLookahead
	lda TPos
        clc
        adc TrackLookahead
        sta TPos
        lda TPos+1
        adc #0
        sta TPos+1
; Go to next segment
	inc TrackLookahead ; see further along track
        dex
        bpl .CurveLoop
        rts

; Generate next track byte
GenTrack subroutine
; Shift the existing track data one byte up
; (a[i] = a[i+1])
	ldx #0
.ShiftTrackLoop
	lda TrackData+1,x
        sta TrackData,x
        inx
        cpx #TrackLen-1
        bne .ShiftTrackLoop
; Modify our current track value and
; see if it intersects the target value
	lda GenCur
        clc
        adc GenDelta
        cmp GenTarget
        beq .ChangeTarget   ; target == cur?
        bit GenTarget	    ; we need the sign flag 
        bmi .TargetNeg	    ; target<0?
        bcs .ChangeTarget   ; target>=0 && cur>=target?
        bcc .NoChangeTarget ; branch always taken
.TargetNeg
        bcs .NoChangeTarget ; target<0 && cur<target?
; Generate a new target value and increment value,
; and make sure the increment value is positive if
; the target is above the current value, and negative
; otherwise
.ChangeTarget
	lda Random
	jsr NextRandom	; get a random value
	sta Random
        and #$3f	; range 0..63
        sec
        sbc #$1f	; range -31..32
        sta GenTarget	; -> target
        cmp GenCur
        bmi .TargetBelow ; current > target?
	lda Random
        jsr NextRandom	; get a random value
	sta Random
        and #$f		; mask to 0..15
        jmp .TargetAbove
.TargetBelow
	lda Random
	jsr NextRandom
	sta Random
        ora #$f0	; mask to -16..0
.TargetAbove
        ora #1		; to avoid 0 values
        sta GenDelta	; -> delta
        lda GenCur
.NoChangeTarget
; Store the value in GenCur, and also
; at the end of the TrackData array
	sta GenCur
	sta TrackData+TrackLen-1
	rts


; fill video RAM
FillVRAM: subroutine
	txa
	ldy #$20
	sty PPU_ADDR
	sta PPU_ADDR
	ldy #$10
.loop:
	sta PPU_DATA
        adc #7
	inx
	bne .loop
	dey
	bne .loop
        rts

; set palette colors
SetPalette: subroutine
        ldy #$00
	lda #$3f
	sta PPU_ADDR
	sty PPU_ADDR
	ldx #32
.loop:
	lda Palette,y
	sta PPU_DATA
        iny
	dex
	bne .loop
        rts

; set sprite 0
SetSprite0: subroutine
	sta $200	;y
        lda #1		;code
        sta $201
        lda #0		;flags
        sta $202
        lda #8		;xpos
        sta $203
	rts

;;;;; COMMON SUBROUTINES

	include "nesppu.asm"

;;;;; INTERRUPT HANDLERS

            MAC SLEEP            ;usage: SLEEP n (n>1)
.CYCLES     SET {1}

                IF .CYCLES < 2
                    ECHO "MACRO ERROR: 'SLEEP': Duration must be > 1"
                    ERR
                ENDIF

                IF .CYCLES & 1
                    bit $00
.CYCLES             SET .CYCLES - 3
                ENDIF
            
                REPEAT .CYCLES / 2
                    nop
                REPEND
            ENDM

NMIHandler: subroutine
	SAVE_REGS
; setup sky scroll
	lda Heading+1
        sta PPU_SCROLL
        lda #0
        sta PPU_SCROLL
; load sprites
        lda #112
        jsr SetSprite0
	lda #$02
        sta PPU_OAM_DMA
; do road calc
        jsr RoadPreSetup
        jsr PreprocessCurve
        jsr RoadPostFrame
; wait for sprite 0
.wait0	bit PPU_STATUS
        bvs .wait0
.wait1	bit PPU_STATUS
        bvc .wait1
; alter horiz. scroll position for each scanline
        ldy #0
.loop
	tya
        lsr
        lsr
        tax
	lda RoadX0,x
        sta PPU_SCROLL	; horiz byte
        lda #0
        sta PPU_SCROLL	; vert byte
        SLEEP 84
        iny
        cpy #112
        bne .loop
        RESTORE_REGS
	rti

;;;;; CONSTANT DATA

	align $100
Palette:
	hex 1f		;background
	hex 09092c00	;bg0
        hex 09091900	;bg1
        hex 09091500	;bg2
        hex 09092500	;bg3

;;;;; CPU VECTORS

	NES_VECTORS

;;;;; TILE SETS

	org $10000
; background (tile) pattern table
	REPEAT 10
;;{w:8,h:8,bpp:1,count:48,brev:1,np:2,pofs:8,remap:[0,1,2,4,5,6,7,8,9,10,11,12]};;
	hex 00000000000000000000000000000000
	hex 7e42424646467e007e42424646467e00
	hex 08080818181818000808081818181800
	hex 3e22023e30303e003e22023e30303e00
	hex 3c24041e06263e003c24041e06263e00
	hex 4444447e0c0c0c004444447e0c0c0c00
	hex 3c20203e06263e003c20203e06263e00
	hex 3e22203e26263e003e22203e26263e00
	hex 3e020206060606003e02020606060600
	hex 3c24247e46467e003c24247e46467e00
	hex 3e22223e060606003e22223e06060600
	hex 3c24247e626262003c24247e62626200
	hex 7c44447e62627e007c44447e62627e00
	hex 7e42406060627e007e42406060627e00
	hex 7e42426262627e007e42426262627e00
	hex 7c40407c60607c007c40407c60607c00
	hex 3c20203c303030003c20203c30303000
	hex 7e42406e62627e007e42406e62627e00
	hex 4242427e626262004242427e62626200
	hex 10101018181818001010101818181800
	hex 0404040606467e000404040606467e00
	hex 4444447e626262004444447e62626200
	hex 2020203030303e002020203030303e00
	hex fe9292d2d2d2d200fe9292d2d2d2d200
	hex 7e424262626262007e42426262626200
	hex 7e46464242427e007e46464242427e00
	hex 7e42427e606060007e42427e60606000
	hex 7e424242424e7e007e424242424e7e00
	hex 7c44447e626262007c44447e62626200
	hex 7e42407e06467e007e42407e06467e00
	hex 7e101018181818007e10101818181800
	hex 4242426262627e004242426262627e00
	hex 646464642c2c3c00646464642c2c3c00
	hex 4949494969697f004949494969697f00
	hex 4242423c626262004242423c62626200
	hex 4242427e181818004242427e18181800
	hex 7e42027e60627e007e42027e60427e00
	hex 10101818180018001010181818001800
	hex 187e407e067e1800187e407e067e1800
	hex 00180018180000000018001818000000
	hex 00003c3c0000000000003c3c00000000
	hex 00000018180000000000001818000000
	hex 18180810000000001818081000000000
	hex 00000018180810000000001818081000
	hex 7c7c7c7c7c7c7c007c7c7c7c7c7c7c00
	hex 0000000000007c000000000000007c00
	hex 00000000000000000000000000000000
	hex 00000000000000000000000000000000
;;
	REPEND
	REPEAT 32
 	hex 00000000000000000000000000000000
	REPEND
