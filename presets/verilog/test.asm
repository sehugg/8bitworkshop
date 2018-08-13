
.arch femto16

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

.org 0x8000
.len 1024
      mov       sp,@$6fff
      mov       dx,@InitPageTable
      jsr       dx
      mov       ax,@$4ffe
      mov       dx,@ClearTiles
      jsr       dx
      mov       ex,@ClearSprites
      jsr       ex
      reset
InitPageTable:
      mov       ax,@$6000       ; screen buffer
      mov       bx,@$7e00       ; page table start
      mov       cx,#32          ; 32 rows
InitPTLoop:
      mov       [bx],ax
      add       ax,#32
      inc       bx
      dec       cx
      bnz       InitPTLoop
      rts
ClearTiles:
      mov       bx,@$6000
      mov       cx,@$390
ClearLoop:
        mov     [bx],ax
        inc     bx
        dec     cx
        bnz     ClearLoop
      rts
ClearSprites:
        mov     bx,@$7f00
        mov     ax,#0
        mov     cx,#$40
ClearSLoop:
        mov     ax,[bx]
        add     ax,@$101
        mov     [bx],ax
        inc     bx
        dec     cx
        bnz     ClearSLoop
