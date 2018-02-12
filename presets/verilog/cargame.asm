.arch nano8
.org 128

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
	lda	128
	sta	PLAYER_X
	sta	ENEMY_X
	sta 	ENEMY_Y
	lda	180
	sta	PLAYER_Y
	zero	A
	sta	SPEED
; test hpaddle flag
DisplayLoop:
	lda	F_HPADDLE
	ldb	IN_FLAGS
	andrb	NOP
	bz	DisplayLoop
; [vpos] -> paddle_x
	ldb	IN_VPOS
	movrb	A
	sta	PLAYER_X
; wait for vsync=1 then vsync=0
	lda	F_VSYNC
	ldb	IN_FLAGS
WaitForVsyncOn:
	andrb	NOP
	bz	WaitForVsyncOn
WaitForVsyncOff:
	andrb	NOP
	bnz	WaitForVsyncOff
; check collision
	lda	F_COLLIDE
	ldb	IN_FLAGS
	andrb	NOP
	bz	NoCollision
; load slow speed
	lda	16
	sta	SPEED
NoCollision:
; update speed
	ldb	SPEED
	movrb	A
	inc	A
; don't store if == 0
	bz	MaxSpeed
	sta	SPEED
MaxSpeed:
	movrb	A
	lsr	A
	lsr	A
	lsr	A
	lsr	A
; add to lo byte of track pos
	ldb	TRACKPOS_LO
	addrb	B
	swapab
	sta	TRACKPOS_LO
	swapab
; update enemy vert pos
	ldb	ENEMY_Y
	addrb	A
	sta	ENEMY_Y
	jmp	DisplayLoop
	reset
