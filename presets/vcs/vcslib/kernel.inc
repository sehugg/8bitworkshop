
.macro DO_WSYNC
  sta WSYNC
.endmacro

; 16-17 cycles
; modifies _k_ypos
.macro DO_DRAW_A index
  lda _k_height+index
  dcp _k_ypos+index
  bcs :+
  lda #0
  .byte $2C
:
  lda (_k_bitmap+index*2),y
.endmacro

; 19-20 cycles (unless WSYNC)
; modifies _k_ypos
.macro DO_DRAW index,wsync
  DO_DRAW_A index
.if wsync
  DO_WSYNC
.endif
  sta GRP0+index
.endmacro

; 8 cycles
.macro DO_PCOLOR index
  lda (_k_colormap+index*2),y
  sta COLUP0+index
.endmacro

; 13-14 cycles
; modifies _k_playfield (can't cross page boundary)
.macro DO_PF index
  lda (_k_playfield,x)
  sta _k_pftmp + index
  inc _k_playfield
.endmacro

; 18 cycles
.macro DO_PFWRITE
  lda _k_pftmp+0
  sta PF0
  lda _k_pftmp+1
  sta PF1
  lda _k_pftmp+2
  sta PF2
.endmacro

; 18 cycles
.macro DO_PFWRITE_2
  lda _k_pftmp+3
  sta PF0
  lda _k_pftmp+4
  sta PF1
  lda _k_pftmp+5
  sta PF2
.endmacro

; 7-8 cycles
.macro DO_VERSATILE_PF_1
  lda (_k_playfield),y
  tax
.endmacro

; 9-10 cycles
.macro DO_VERSATILE_PF_2
  lda (_k_playfield),y
  sta $40,x		; use TIA mirror
.endmacro

; 13 cycles
; modifies _k_ypos
.macro DO_MISSILE index
  lda _k_height+index
  dcp _k_ypos+index
  sbc #$fe
  sta ENAM0-2+index
.endmacro

; 5 cycles
; modifies _k_ypos
.macro DO_MISSILE_NOP index
  dcp _k_ypos+index
.endmacro

; 13 cycles
.macro DO_MISSILE_PIXEL index
  cpy _k_ypos+index
  php
  pla
  sta ENAM0-2+index
.endmacro

.macro RESET_GFX
  lda #0
  sta GRP0
  sta GRP1
  sta PF0
  sta PF1
  sta PF2
.endmacro
