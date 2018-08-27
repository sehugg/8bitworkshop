

; MULTISPRITE LIBRARY

; For lots of games, we'd like to display more than two sprites.
; There are lots of different ways to tackle this on the VCS,
; but we're going to try for a generalized approach that lets
; use have N different sprites at any X-Y coordinate, each with
; its own bitmap and color table. This is tricky because we can
; only do so much on each scanline.

; Our approach is to separate the problem into three phases.
; In the sort phase, we sort all sprites by Y coordinate.
; We do one sort pass per frame, so it may take several frames
; for the sort to stabilize.
; In the positioning phase, we look at the sprites in Y-sorted
; order, looking several lines ahead to see if a sprite is
; coming up. We then allocate it to one of the two player
; objects in hardware and set its position using the SetHorizPos
; method. We can set one or both of the player objects this way.

; In the display phase, we display the objects which we previously
; assigned and positioned. First we figure out how many scanlines are
; required. If only one object is scheduled, we just use its height.
; If two objects are scheduled, we go until the bottommost line has
; been displayed. We then loop through, fetching pixels and colors
; for one or both objects (up to four lookup tables) and setting
; registers at the appropriate time. We don't have time to do much
; else, so we don't look for any new objects to schedule until
; we're done with this loop.

; This scheme can only display up to two objects on a given
; scanline, so if the system tries to schedule a third, it will 
; be ignored. Also, the positioning routine takes a few scanlines
; to complete, so if the top of a sprite is too close to the
; bottom of another sprite, the latter may not be displayed.
;
; To mitigate this, we increment a priority counter when a
; sprite entry is missed. In the sort phase, we move those sprites
; ahead of lower priority sprites in the sort order. This makes
; overlapping sprites flicker instead of randomly disappear.

; There are two separate multisprite kernels:

; MSpriteDraw1 - Single-line sprites, no playfield.
; This kernel requires TIMER_TABLE_SETUP at the 0th
; scanline, as it uses the timer to figure out the
; current scanline. No vertical clipping is performed.
; In fact, if sprites go past the bottom, it will
; mess up the vertical sync.

; MSpriteDraw2 - Double-line sprites with playfield.
; The playfield is updated and the sprites are positioned
; in 8-scanline segments.
; This kernel uses the timer internally, but does not
; use the timer table or TIMER_TABLE_SETUP.
; Sprites are clipped on the bottom edge, but disappear
; off the top edge.

; Your program must call MSpriteInit when it starts,
; and MSpriteFrame between every frame.

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

	seg.u Variables

Scanline byte	; current scanline
CurIndex byte	; current sprite # to try to schedule

PData0	word	; pointer (lo/hi) to player 0 bitmap data
PData1	word	; pointer to player 1 bitmap data
PColr0	word	; pointer to player 0 color data
PColr1	word	; pointer to player 1 color data
SIndx0	byte	; next y-position to draw player 0
		; or during draw, index into sprite
                ; zero means not assigned
SIndx1	byte	; ... for player 1
SSize0	byte	; sprite size for player 0
SSize1	byte	; sprite size for player 1

NSprites	equ 8       ; max # of sprites
XPos0		ds NSprites ; x coord for each sprite
YPos0		ds NSprites ; y coord for each sprite
Shape0		ds NSprites ; shape index
Flags0		ds NSprites ; NUSIZ and reflection flags
Sorted0		ds NSprites ; sorted list of sprite indices
Priority0	ds NSprites ; sprite priority list, if missed

;MinYDist	equ 0	; min. Y distance to consider sprite (not used)
;MinYPos		equ 1	; TODO???
MinYDist	equ 6	; min. Y distance to consider sprite
MinYPos		equ 2+MinYDist

PF0Ptr	word	; pointer to playfield data
PF1Ptr	word	; pointer to playfield data
PF2Ptr	word	; pointer to playfield data
PFIndex	byte	; offset into playfield array
PFCount byte	; lines left in this playfield segment

; temporary values for kernel
; TODO: share with global temporaries
Temp	byte
Colp0	byte
Colp1	byte
tmpPF0	byte
tmpPF1	byte
tmpPF2	byte

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

	seg Code

; call at start of program
MSpriteInit subroutine
; Initialize initial sort order
        ldx #0
.loop
	txa
	sta Sorted0,x
        inx
        cpx #NSprites
        bne .loop
	rts

; call between frames
MSpriteFrame subroutine
; Do one iteration of bubble sort on sprite indices
	ldx #NSprites-2
.SortLoop
	jsr SwapSprites
        dex
        bpl .SortLoop	; loop until <= 0
; Reset scanline counter and sprite objects
	jsr ResetCounters
        stx CurIndex
	rts

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

; SINGLE-LINE KERNEL

MSpriteDraw1 subroutine
.NextFindSprite
; Try to schedule sprites to both players
	jsr FindAnotherSprite
; Apply fine offsets
	sta WSYNC	; start next scanline
	sta HMOVE	; apply the previous fine position(s)
        sta HMCLR	; clear motion registers
        ldx #0
        stx VDELP0	; set vertical delay off
        stx VDELP1	; set vertical delay off
; See if time to draw
	jsr DrawSprites1
; Repeat until all scanlines drawn
	lda INTIM
        cmp #$1f
        bcs .NextFindSprite
        lda #191
        jmp WaitForScanline

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

; DOUBLE-LINE KERNEL WITH BACKGROUND

MSpritePrefill2 subroutine
        lda #0
        sta Scanline
	jsr FindAnotherSprite2
	jsr FindAnotherSprite2
        sta WSYNC
	sta HMOVE	; apply the previous fine position(s)
        sta HMCLR	; clear motion registers
	rts

MSpriteDraw2 subroutine
	sta WSYNC
        sta PFIndex	; 24 * 4 scanlines = 96 2xlines
        lda #0
        sta PFCount
        sta VDELP1
        lda #1
        sta VDELP0	; updates to GRP0 will be delayed
        jmp .NewSprites
.Draw8Lines
; Phase 0: Fetch PF0 byte
        jsr DrawSprites2
	ldy PFIndex
        lda (PF0Ptr),y	; load PF0
        sta tmpPF0
; Phase 1: Fetch PF1 byte
        jsr DrawSprites2
	ldy PFIndex
        lda (PF1Ptr),y	; load PF1
        sta tmpPF1
; Phase 2: Fetch PF2 byte
        jsr DrawSprites2
	ldy PFIndex
        lda (PF2Ptr),y	; load PF2
        sty PFIndex
        sta tmpPF2
; Phase 3: Write PF0/PF1/PF2 registers
        jsr DrawSprites2
	lda tmpPF0
        sta PF0
        lda tmpPF1
        sta PF1
        lda tmpPF2
        sta PF2
; Go to next scanline, unless playfield is done 
; or unless this segment is done
	dec PFIndex
        bmi .NoMoreLines	; playfield done
	dec PFCount
        bpl .Draw8Lines		; keep drawing
; done drawing, reset player counters
	jsr ResetCounters
.NewSprites
        lda PFIndex
        asl
        asl
        eor #$7f
        sbc #34
        sta Scanline	; Scanlines = 127 - PFIndex*4
; Set up 0-2 player objects taking up to 8 scanlines
	TIMER_SETUP 7
	jsr FindAnotherSprite2
        jsr CalcSpriteEnd
; Update playfield
	ldy PFIndex
        lda (PF0Ptr),y	; load PF0 -> X
        tax
        lda (PF1Ptr),y	; load PF1 -> tmp
        sta tmpPF1
        lda (PF2Ptr),y	; load PF2 -> Y
        tay
; Apply fine offsets
	TIMER_WAIT	; wait for 8th scanlines and WSYNC
	sta HMOVE	; apply the previous fine position(s)
        sta HMCLR	; clear motion registers
; Store playfield registers
        stx PF0
        lda tmpPF1
        sta PF1
        sty PF2
        dec PFIndex	; no more playfield?
        bmi .NoMoreLines
        lda PFCount
        bne .Draw8Lines
        sta WSYNC	; one more line
        beq .NewSprites
.NoMoreLines
	rts

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

; SPRITE DRAWING ROUTINES
; used by kernels
; need to set SIndx0/1, SSize0/1, PData0/1, PColr0/1
; all players must already be setup

; called by single-line kernel
DrawSprites1 subroutine
; Wait for next precise scanline
	lda #0		     ; 0 = wait for next
.AnotherScanline
	jsr WaitForScanline
        lda Timer2Scanline,y ; lookup scanline #
        beq .AnotherScanline ; not if zero!
        sta Scanline         ; save it
DrawSprites1a
; Calculate # of lines to draw for each sprite
; Sprite Y - current scanline + sprite height
	lda SIndx0
        beq .Empty0	; sprite 0 is inactive?
	sec
	sbc Scanline
        clc
        adc SSize0
        sta SIndx0	; SIndx0 += SSize0 - Scanline
.Empty0
	lda SIndx1
        beq .Empty1	; sprite 1 is inactive?
	sec
	sbc Scanline
        clc
        adc SSize1
        sta SIndx1	; SIndx1 += SSize1 - Scanline
.Empty1
; Find out the maximum # of lines to draw
; by taking the maximum of the two sprite heights
	cmp SIndx0
        bpl .Cmp1	; sindx0 < sindx1?
        lda SIndx0
.Cmp1
	tax		; X = # of lines left to draw
        beq .NoSprites	; X = 0? we're done
        sta WSYNC	; next scanline
DrawSprites1b
.DrawNextScanline
; Make sure player 0 index is within bounds
	ldy SIndx0
        cpy SSize0
        bcs .Inactive0	; index >= size? (or index < 0)
; Lookup pixels for player 0
        lda (PData0),y
; Do WSYNC and then quickly store pixels for player 0
        sta WSYNC
	sta GRP0
; Lookup/store colors for player 0
        lda (PColr0),y
        sta COLUP0
.DrawSprite1
; Make sure player 1 index is within bounds
	ldy SIndx1
        cpy SSize1
        bcs .Inactive1	; index >= size? (or index < 0)
; Lookup/store pixels and colors for player 1
; Note that we are already 30-40 pixels into the scanline
; by this point...
        lda (PData1),y
        sta GRP1
        lda (PColr1),y
        sta COLUP1
.Inactive1
; Decrement the two sprite indices
        dey
        sty SIndx1
        dec SIndx0
; Repeat until we've drawn all the scanlines for this job
	dex
        bne .DrawNextScanline
; Free up both player objects by zeroing them out
	jsr ResetCounters
	sta WSYNC
	stx GRP0
	stx GRP1
; No sprites were drawn; just exit
.NoSprites
	rts
.Inactive0
; Alternate player 0 path when it is inactive
	sta WSYNC
	lda #0
	sta GRP0
        sta COLUP0
        beq .DrawSprite1 ; always taken due to lda #0

; called by 2-line kernel
DrawSprites2 subroutine
; Fetch sprite 0 values
        lda SSize0	; height in 2xlines
        sec
        isb SIndx0		; INC yp0, then SBC yp0
        bcs DoDraw0		; inside bounds?
        lda #0			; no, load the padding offset (0)
DoDraw0
        tay			; -> Y
        lda (PColr0),y	; color for both lines
        sta Colp0		; -> colp0
	lda (PData0),y	; bitmap for first line
        sta GRP0		; -> [GRP0] (delayed due to VDEL)
; Fetch sprite 1 values
        lda SSize1	; height in 2xlines
        sec
        isb SIndx1		; INC yp0, then SBC yp0
        bcs DoDraw1		; inside bounds?
        lda #0			; no, load the padding offset (0)
DoDraw1
        tay			; -> Y
        lda (PColr1),y	; color for both lines
        tax
	lda (PData1),y	; bitmap for first line
        tay
; WSYNC and store sprite values
        lda Colp0
; still have about 30 cycles left...
	sta WSYNC
        sty GRP1		; GRP0 is also updated due to VDELP0 flag
        stx COLUP1
        sta COLUP0
; Return to caller
	rts

CalcSpriteEnd subroutine
; Calculate # of lines to draw for each sprite
; SIndx = 255 - ypos + scanline
	lda SIndx0
        beq .zero0
        sec
        sbc Scanline
        eor #$ff
        sta SIndx0
        sec
        sbc SSize0
.zero0
        sta Temp
	lda SIndx1
        beq .zero1
        sec
        sbc Scanline
        eor #$ff
        sta SIndx1
        sec
        sbc SSize1
	cmp Temp
        bmi .cmp1	; sindx0 < sindx1?
.zero1
        lda Temp	; load higher number
.cmp1
; Compute the number of 8x lines in this section
	eor #$ff
	clc
        adc #1
        lsr
        lsr
        sta PFCount
	rts

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;

; COMMON ROUTINES

ResetCounters subroutine
        ldx #0
        stx SSize0
        stx SSize1
        stx SIndx0
        stx SIndx1
	rts

; We were too late to display a sprite.
; Put it earlier in the sort order and try next frame.
; X = sort index
.MissedSprite subroutine
; Have we already looked at all the sprites?
; Increment priority for this sort entry
	inc Priority0,x
; Go to next sort index, until we get to the end
        inx
        stx CurIndex
.OutOfSprites
        rts
; Try to assign the next sprite in the sort order into
; one of the two player slots.
; If sprite found, uses at least 3 scanlines for SetHorizPos.
FindAnotherSprite ; subroutine entry point
; Get the approximate scanline
	GET_APPROX_SCANLINE
        clc
        adc #MinYDist
        sta Scanline
FindAnotherSprite2 ; alternate entry point when scanline known
; Calculate the distance to next sprite 
	ldx CurIndex
	cpx #NSprites
        bcs .OutOfSprites
        ldy Sorted0,x	; get sprite index # in Y-sorted order
        lda YPos0,y	; get Y position of sprite
        cmp Scanline	; SpriteY - Scanline
; Don't schedule the sprite if it's too soon or its scanline
; has already passed -- mark it missed
	bmi .MissedSprite ; passed it? (or > 127 lines away)
; A sprite is starting soon, now we need to schedule it
; to either one of the player objects
        lda XPos0,y
; Is player 1 available?
        ldx SIndx1
	bne .Plyr1NotReady
; Due to timing issues, we have artifacts if player 1 is
; too close to the left edge of the screen. So we'd prefer to
; put those sprites in the player 0 slot.
; TODO: disable for 2-line sprite kernel
        cmp #34		; X < 34
        bcc .Plyr1NotReady
; First let's set its horizontal offset
        ldx #1
        jsr SetHorizPos	; set horizontal position (does WSYNC)
; Assign the sprite's Y position to player 1 
	lda YPos0,y
        sta SIndx1
; Set player 1 reflection/number/size flags
	lda Flags0,y
        sta REFP1	; reflection flag
        sta NUSIZ1	; number-size
; Get index into SpriteDataMap (index * 4)
	lda Shape0,y
        asl
        asl
        tax
; Copy addresses of pixel/color maps to player 1
        lda SpriteDataMap,x
        sta PData1
        lda SpriteDataMap+1,x
        sta PData1+1
        lda SpriteDataMap+2,x
        sta PColr1
        lda SpriteDataMap+3,x
        sta PColr1+1
; Get the sprite height as the first byte of the color map
        ldy #0
        lda (PColr1),y
        sta SSize1
        inc SSize1	; +1 to height
        jmp .SetupDone
.Plyr1NotReady
        ldx SIndx0
        bne .NoNearSprite	; both players in use
; Player 0 is available
; This is essentially the same as the player 1 routine
        ldx #0
        jsr SetHorizPos
	lda YPos0,y
	sta SIndx0
	lda Flags0,y
        sta REFP0	; reflection flag
        sta NUSIZ0	; number-size
	lda Shape0,y
        asl
        asl
        tax
        lda SpriteDataMap,x
        sta PData0
        lda SpriteDataMap+1,x
        sta PData0+1
        lda SpriteDataMap+2,x
        sta PColr0
        lda SpriteDataMap+3,x
        sta PColr0+1
        ldy #0
        lda (PColr0),y
        sta SSize0
        inc SSize0	; +1 to height
.SetupDone
	inc CurIndex	; go to next sprite in sort order
.NoNearSprite
	rts

; Perform one sort iteration
; X register contains sort index (0 to NSprites-1)
SwapSprites subroutine
; First compare Priority[i] and Priority[i+1]
	lda Priority0,x
        cmp Priority0+1,x
        bcs .CompareYPos
; If Priority[i] < Priority[i+1], do the swap
; anyway after resetting priorities
        lda #0
	sta Priority0,x
        sta Priority0+1,x	; reset
        ldy Sorted0+1,x
        bcc .DoSwap	; swap due to priority
.CompareYPos
; Compare Y[i] and Y[i+1]
        ldy Sorted0,x
        lda YPos0,y
        ldy Sorted0+1,x
        cmp YPos0,y
        bcc .NoSwap	; Y[i] < Y[i+1]? don't swap
.DoSwap
; Swap Sorted[i] and Sorted[i+1]
	lda Sorted0,x	; A <- Sorted[i]
        sty Sorted0,x	; Y -> Sorted[i]
        sta Sorted0+1,x ; A -> Sorted[i+1]
.NoSwap
	rts

