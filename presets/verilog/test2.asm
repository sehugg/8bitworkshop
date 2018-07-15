
.include "hvsync_generator.v"
.include "font_cp437_8x8.v"
.include "ram.v"
.include "tile_renderer.v"
.include "sprite_scanline_renderer.v"
.include "lfsr.v"
.include "sound_generator.v"
.include "cpu16.v"
.include "cpu_platform.v"
.module cpu_platform

.arch femto16
.org 0x8000
.len 32768

.define ScreenBuffer $6000
.define PageTable $7e00
.define SpriteTable $7f00

        jmp	Start

Start:
      mov	sp,@$6fff
      mov	fx,@InitPageTable
      jsr	fx
      mov	ax,@$0700
      mov	fx,@ClearTiles
      jsr	fx
	mov	fx,@DrawMaze
        jsr	fx
      mov	bx,@HelloWorld
      mov	cx,@$0200
      mov	dx,@$6001
      mov	fx,@WriteString
      jsr	fx
      mov	fx,@ClearSprites
      jsr	fx
      mov	fx,@InitSprites
      jsr	fx
GameLoop:
	mov	fx,@WaitVSync
        jsr	fx
	mov	fx,@MoveSprites
        jsr	fx
      jmp	GameLoop
      
WaitVSync:
	mov	bx,@$FFFF
        mov	ax,[bx]
        and	ax,#16
        bz	WaitVSync
        rts
      
WriteString:
	mov	ax,[bx]
        bz	StringDone
        xor	ax,cx
        mov	[dx],ax
        inc	bx
        inc	dx
        jmp	WriteString
StringDone:
	rts
        
DrawMaze:
	mov	dx,@$6080
        mov	bx,@MazeData
DrawMazeLoop:
        mov	ax,[bx]
        inc	bx
        mov	fx,#4
ShiftMazeChar:
; rotate high 4 bits to low 4 bits
	asl	ax
        rol	ax
	rol	ax
	rol	ax
        mov	ex,ax
        and	ax,#7
        adc	ax,ex
; lookup character in table
        mov	ex,ax
        and	ex,#$f
        add	ex,@MazeChars
        mov	ex,[ex]
; store to video buffer
        mov	[dx],ex
        inc	dx
        dec	fx
        bnz	ShiftMazeChar
        mov	ax,dx
        sub	ax,@$6380
        bnz	DrawMazeLoop
        rts
        
InitPageTable:
      mov       ax,@ScreenBuffer	; screen buffer
      mov       bx,@PageTable	; page table start
      mov	cx,#32		; 32 rows
InitPTLoop:
      mov	[bx],ax
      add	ax,#32
      inc	bx
      dec	cx
      bnz	InitPTLoop
      rts
ClearTiles:
      mov	bx,@ScreenBuffer
      mov	cx,@$3c0
ClearLoop:
        mov	[bx],ax
        inc	bx
        dec	cx
        bnz	ClearLoop
      rts
ClearSprites:
        mov	ax,#0
        mov	cx,#$40
        mov	dx,@SpriteTable
ClearSLoop:
        mov	[dx],ax
        inc	dx
	dec	cx
        bnz	ClearSLoop
        rts
InitSprites:
	mov	bx,@SpriteInitData
        mov	cx,#10
        mov	dx,@SpriteTable
InitSLoop:
	mov	ax,[bx]
	mov	[dx],ax
        inc	bx
        inc	dx
        dec	cx
        bnz	InitSLoop
        rts
MoveSprites:
	mov	dx,@SpriteTable
        mov	cx,#5
MoveSLoop:
	mov	ax,[dx]	; x/y pos
        mov	bx,[dx+1] ; attributes/dir
        and	bx,#3	; bx = direction (0-3)
        add	bx,@DirectionXY
	add	ax,[bx] ; lookup & add to x/y
        ; make sure we don't collide with wall
        mov	ex,ax
        add	ex,#$08
        lsr	ex
        lsr	ex
        lsr	ex	; divide X by 8
        and	ex,#31
        mov	fx,ex
        mov	ex,ax
        add	ex,@$0800
        lsr	ex
        lsr	ex
        lsr	ex
        lsr	ex
        lsr	ex
        lsr	ex	; divide Y by 64
        and	ex,@$ffe0
        or	ex,fx
        add	ex,@ScreenBuffer
        mov	fx,[ex]
        and	fx,@$ff00
        xor	fx,@$0500
        bz	DoNotUpdatePos
        ; update x/y position
        mov	[dx],ax	; store x/y pos
	inc	dx
	inc	dx
NextSLoop:
        dec	cx
        bnz	MoveSLoop
        rts
; Choose a new direction
DoNotUpdatePos:
        mov	bx,[dx+1] ; attributes/dir
        inc	bx
        inc	dx
        mov	[dx],bx
        inc	dx
	jmp	NextSLoop

HelloWorld:
.string HELLO WORLD
.data 0

SpriteInitData:
.data $8363 $3456
.data $8373 $4567
.data $8383 $5678
.data $8373 $1234

DirectionXY:
.data $FFFF
.data $0100
.data $0001
.data $FF00

MazeData:
.data $3111 $1111 $1111 $1114 $3111 $1111 $1111 $1114
.data $2000 $0000 $0000 $0002 $2000 $0000 $0000 $0002
.data $2031 $1114 $0311 $1402 $2031 $1140 $3111 $1402
.data $2d51 $1116 $0511 $1605 $6051 $1160 $5111 $16d2
.data $2000 $0000 $0000 $0000 $0000 $0000 $0000 $0002
.data $2031 $1114 $0340 $3111 $1114 $0340 $3111 $1402
.data $2051 $1116 $0220 $5114 $3116 $0220 $5111 $1602
.data $2000 $0000 $0220 $0002 $2000 $0220 $0000 $0002
.data $5111 $1114 $0251 $1402 $2031 $1620 $3111 $1116
.data $3111 $1116 $0231 $1605 $6051 $1420 $5111 $1114
.data $2000 $0000 $0220 $0000 $0000 $0220 $0000 $0002
.data $2031 $1114 $0220 $3111 $1114 $0220 $3111 $1402
.data $2051 $1116 $0560 $2ccc $ccc2 $0560 $5111 $1602
.data $2000 $0000 $0000 $2ccc $ccc2 $0000 $0000 $0002
.data $5111 $1114 $0340 $2ccc $ccc2 $0340 $3111 $1116
.data $3111 $1116 $0220 $5111 $1116 $0220 $5111 $1114
.data $2000 $0000 $0220 $0000 $0000 $0220 $0000 $0002
.data $2031 $1114 $0251 $1403 $4031 $1620 $3111 $1402
.data $2051 $1116 $0511 $1605 $6051 $1160 $5111 $1602
.data $2d00 $0000 $0000 $0000 $0000 $0000 $0000 $00d2
.data $2031 $1114 $0311 $1403 $4031 $1140 $3111 $1402
.data $2051 $1116 $0511 $1602 $2051 $1160 $5111 $1602
.data $2000 $0000 $0000 $0002 $2000 $0000 $0000 $0002
.data $5111 $1111 $1111 $1116 $5111 $1111 $1111 $1116

MazeChars:
.data $07f9	; empty
.data $05c4 $05b3	; horizvert
.data $05da $05bf $05c0 $05d9	; corners
.data $05c3 $05c1 $05c2 $05b4	; 3-way
.data $05c5	; 4-way
.data $0720	; empty (no dot)
.data $07fe	; power pill

.data 123 $123
.align $10

