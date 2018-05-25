
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
.len 1024

        jmp	Start

Start:
      mov       sp,@$6fff
      mov	fx,@InitPageTable
      jsr	fx
      mov	ax,@$1ffe
      mov	fx,@ClearTiles
;      jsr	ex
	mov	fx,@DrawMaze
        jsr	fx
      mov	bx,@HelloWorld
      mov	cx,@$1f00
      mov	dx,@$6001
      mov	fx,@WriteString
      jsr	fx
      mov	fx,@ClearSprites
      jsr	fx
      reset
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
	mov	dx,@$6040
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
        or	ex,@$1e00
; store to video buffer
        mov	[dx],ex
        inc	dx
        dec	fx
        bnz	ShiftMazeChar
        mov	ax,dx
        sub	ax,@$6340
        bnz	DrawMazeLoop
        rts
        
InitPageTable:
      mov       ax,@$6000	; screen buffer
      mov       bx,@$7e00	; page table start
      mov	cx,#32		; 32 rows
InitPTLoop:
      mov	[bx],ax
      add	ax,#32
      inc	bx
      dec	cx
      bnz	InitPTLoop
      rts
ClearTiles:
      mov	bx,@$6000
      mov	cx,@$3c0
ClearLoop:
        mov	[bx],ax
        inc	bx
        dec	cx
        bnz	ClearLoop
      rts
ClearSprites:
        mov	bx,@$7f00
        mov	ax,#0
        mov	cx,#$40
ClearSLoop:
        mov	ax,[bx]
        add	ax,@$101
        mov	[bx],ax
        inc	bx
	dec	cx
        bnz	ClearSLoop

HelloWorld:
.string HELLO WORLD
.data 0

MazeData:
.data $3111 $1111 $1111 $1114 $3111 $1111 $1111 $1114
.data $2000 $0000 $0000 $0002 $2000 $0000 $0000 $0002
.data $2031 $1114 $0311 $1402 $2031 $1140 $0311 $1402
.data $2051 $1116 $0511 $1605 $6051 $1160 $0511 $1602
.data $2000 $0000 $0000 $0000 $0000 $0000 $0000 $0002
.data $2031 $1114 $0340 $3111 $1114 $0340 $0311 $1402
.data $2051 $1116 $0220 $5114 $3116 $0220 $0511 $1602
.data $2000 $0000 $0220 $0002 $2000 $0220 $0000 $0002
.data $5111 $1114 $0251 $1402 $2031 $1620 $3111 $1116
.data $3111 $1116 $0231 $1605 $6051 $1420 $5111 $1114
.data $2000 $0000 $0220 $0000 $0000 $0220 $0000 $0002
.data $2031 $1114 $0220 $3111 $1114 $0220 $0311 $1402
.data $2051 $1116 $0560 $2ccc $ccc2 $0560 $0511 $1602
.data $2000 $0000 $0000 $2ccc $ccc2 $0000 $0000 $0002
.data $5111 $1114 $0340 $2ccc $ccc2 $0340 $0311 $1116
.data $3111 $1116 $0220 $5111 $1116 $0220 $0511 $1114
.data $2000 $0000 $0220 $0000 $0000 $0220 $0000 $0002
.data $2031 $1114 $0251 $1403 $4031 $1620 $0311 $1402
.data $2051 $1116 $0511 $1605 $6051 $1160 $0511 $1602
.data $2000 $0000 $0000 $0000 $0000 $0000 $0000 $0002
.data $2031 $1114 $0311 $1403 $4031 $1140 $0311 $1402
.data $2051 $1116 $0511 $1602 $2051 $1160 $0511 $1602
.data $2000 $0000 $0000 $0002 $2000 $0000 $0000 $0002
.data $5111 $1111 $1111 $1116 $5111 $1111 $1111 $1116

MazeChars:
.data $f9	; empty
.data $c4 $b3	; horizvert
.data $da $bf $c0 $d9	; corners
.data $c3 $c1 $c2 $b4	; 3-way
.data $c5	; 4-way
.data $20	; empty (no dot)

.data 123 $123
.align $10

