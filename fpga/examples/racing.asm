.arch ../../presets/verilog/femto8		; FEMTO-8 architecture
.org 128		; origin = 128 ($80)
.len 128		; length = 128 ($80)

; define constants
.define PADDLE_X 0
.define PADDLE_Y 1
.define PLAYER_X 2
.define PLAYER_Y 3
.define ENEMY_X 4
.define ENEMY_Y 5
.define ENEMY_DIR 6
.define SPEED 7
.define TRACKPOS_LO 8
.define TRACKPOS_HI 9

.define IN_HPOS  $40
.define IN_VPOS  $41
.define IN_FLAGS $42

.define F_DISPLAY 1
.define F_HPADDLE 2
.define F_VPADDLE 4
.define F_HSYNC 8
.define F_VSYNC 16
.define F_COLLIDE 32

Start:
	lda	#128		; load initial positions
	sta	PLAYER_X	; player_x = 128
	sta	ENEMY_X		; enemy_x = 128
	sta	ENEMY_Y		; enemy_y = 128
	lda	#180
	sta	PLAYER_Y	; player_y = 180
	zero	A
	sta	SPEED		; player speed = 0
        inc	A
        sta	ENEMY_DIR	; enemy dir = 1 (right)
; read horizontal paddle position
DisplayLoop:
;	lda	#F_HPADDLE	; paddle flag -> A
;	ldb	#IN_FLAGS	; addr of IN_FLAGS -> B
;        and	none,[B]	; read B, AND with A
;	bz	DisplayLoop	; loop until paddle flag set
	ldb	#IN_VPOS
        mov	A,[B]		; load vertical position -> A
	sta	PLAYER_X	; store player x position
; wait for vsync
	lda	#F_VSYNC
	ldb	#IN_FLAGS
WaitForVsyncOn:
        and	none,[B]
	bz	WaitForVsyncOn	; wait until VSYNC on
WaitForVsyncOff:
        and	none,[B]
	bnz	WaitForVsyncOff	; wait until VSYNC off
; check collision
	lda	#F_COLLIDE
	ldb	#IN_FLAGS
        and	none,[B]	; collision flag set?
	bz	NoCollision	; skip ahead if not
	lda	#16
	sta	SPEED		; speed = 16
NoCollision:
; update speed
	ldb	#SPEED
        mov	A,[B]		; speed -> A
	inc	A		; increment speed
	bz	MaxSpeed	; speed wraps to 0?
	sta	SPEED		; no, store speed
MaxSpeed:
	mov	A,[B]		; reload speed -> A
	lsr	A
	lsr	A
	lsr	A
	lsr	A		; divide speed by 16
; add to lo byte of track pos
	ldb	#TRACKPOS_LO
	add	B,[B]		; B <- speed/16 + trackpos_lo
	swapab			; swap A <-> B
	sta	TRACKPOS_LO	; A -> trackpos_lo
	swapab			; swap A <-> B again
	bcc	NoCarry		; carry flag from earlier add op
; add to hi byte of track pos
	ldb	#TRACKPOS_HI
	mov	B,[B]		; B <- trackpos_hi
	inc	b		; increment B
	swapab			; swap A <-> B
	sta	TRACKPOS_HI	; A -> trackpos_hi
	swapab			; swap A <-> B again
NoCarry:
; update enemy vert pos
	ldb	#ENEMY_Y
        add	A,[B]
	sta	ENEMY_Y		; enemy_y = enemy_y + speed/16
; update enemy horiz pos
      	ldb	#ENEMY_X
        mov	A,[B]
        ldb	#ENEMY_DIR
        add	A,[B]
        sta	ENEMY_X		; enemy_x = enemy_x + enemy_dir
        sub	A,#64
      	and     A,#127		; A <- (enemy_x-64) & 127
      	bnz     SkipXReverse	; skip if enemy_x is in range
; load ENEMY_DIR and negate
      	zero	A
        sub	A,[B]
        sta	ENEMY_DIR	; enemy_dir = -enemy_dir
SkipXReverse:
; back to display loop
	jmp	DisplayLoop
