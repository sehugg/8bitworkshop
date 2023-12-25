
VIC_BASE = $0
VIC_SCRN_BASE = VIC_BASE + $400

MAX_MSPRITES = 28

MIN_Y_SPACING = 35

DEBUG = 0

.code

.global _msprite_render_init
_msprite_render_init:
  lda #0
  sta j
  sta k
  sta $d001 ; ypos #0
  sta $d003
  sta $d005
  sta $d007
  sta $d009
  sta $d00b
  sta $d00d
  sta $d00f ; ypos #7
  lda #$ff
  sta $d015 ; sprite enable
  rts

.global _msprite_render_section
_msprite_render_section:
  lda $d012
  clc
  adc #MIN_Y_SPACING
  sta bailout_line
@loop:
.if DEBUG
  inc $d020
.endif
  lda $d012
  cmp bailout_line
  bcs @loopexit
  ldy k
  cpy #MAX_MSPRITES
  bcs @loopexit
  lda _msprite_order,y ; $ff = end of sprite list
  tay		; Y = sprite index from sort array
  lda j
  asl
  tax		; X = j * 2
; if (VIC.spr_pos[j].y >= 250) break;
  lda $d001,x
  cmp #250
  bcs @loopexit	; offscreen?
; if (VIC.spr_pos[j].y+22 >= VIC.rasterline) break;
  clc
  adc #22
  cmp $d012	; are we done drawing
  bcs @loopexit ; this sprite yet?
; VIC.spr_pos[j].y = msprite_y[i];
  lda _msprite_y,y
  sta $d001,x
; VIC.spr_pos[j].x = msprite_x[i];
  lda _msprite_x_lo,y
  sta $d000,x
  ldx j		; X = j
; VIC.spr_color[j] = msprite_color[i];
  lda  _msprite_color,y
  sta $d027,x
; POKE(0x7f8+j, msprite_shape[i]);
  lda _msprite_shape,y
  sta VIC_SCRN_BASE + $03f8,x
; set hi X bit
  lda _msprite_x_hi,y
  lsr
  lda NOTBITS,x
  and $d010
  bcc @nohix
  ora BITS,x
@nohix:
  sta $d010	; update X hi bits
  inc k		; next object
  inx
  txa
  and #7
  sta j		; next h/w sprite
  jmp @loop
@loopexit:
.if DEBUG
  lda #0
  sta $d020
.endif
  rts

; http://selmiak.bplaced.net/games/c64/index.php?lang=eng&game=Tutorials&page=Sprite-Multiplexing
.global _msprite_sort
_msprite_sort:
  ldx #$00
@sortloop:
  ldy _msprite_order+1,x
  lda _msprite_y,y
  ldy _msprite_order,x
  cmp _msprite_y,y
  bcs @sortskip
  stx @sortreload+1
@sortswap:
  lda _msprite_order+1,x
  sta _msprite_order,x
  tya
  sta _msprite_order+1,x
  cpx #$00
  beq @sortreload
  dex
  ldy _msprite_order+1,x
  lda _msprite_y,y
  ldy _msprite_order,x
  cmp _msprite_y,y
  bcc @sortswap
@sortreload:
  ldx #$00	; self-modifying code
@sortskip:
  inx
  cpx #MAX_MSPRITES-1
  bcc @sortloop
  rts

.global _msprite_add_velocity
_msprite_add_velocity:
  tay
  dey
@loop:
  lda _msprite_y_frac,y
  clc
  adc _msprite_yvel_lo,y
  sta _msprite_y_frac,y
  lda _msprite_y,y
  adc _msprite_yvel_hi,y
  sta _msprite_y,y
  lda _msprite_x_frac,y
  clc
  adc _msprite_xvel_lo,y
  sta _msprite_x_frac,y
  lda _msprite_xvel_hi,y
  bmi @xneg
  lda _msprite_x_lo,y
  adc _msprite_xvel_hi,y
  sta _msprite_x_lo,y
  lda _msprite_x_hi,y
  adc #0
  sta _msprite_x_hi,y
  dey
  bpl @loop
  rts
@xneg:
  lda _msprite_x_lo,y
  adc _msprite_xvel_hi,y
  sta _msprite_x_lo,y
  lda _msprite_x_hi,y
  adc #$ff
  sta _msprite_x_hi,y
  dey
  bpl @loop
  rts

BITS:
 .byte $01,$02,$04,$08,$10,$20,$40,$80
NOTBITS:
 .byte $FE,$FD,$FB,$F7,$EF,$DF,$BF,$7F                          

;;;;;

.data

j: .res 1	; h/w sprite index
k: .res 1	; object index
bailout_line: .res 1

.global _msprite_order
.global _msprite_x_lo
.global _msprite_x_hi
.global _msprite_y
.global _msprite_color
.global _msprite_shape
.global _msprite_flags
.global _msprite_last_y

_msprite_order: .res MAX_MSPRITES
_msprite_x_lo:  .res MAX_MSPRITES
_msprite_x_hi:  .res MAX_MSPRITES
_msprite_y:     .res MAX_MSPRITES
_msprite_color: .res MAX_MSPRITES
_msprite_shape: .res MAX_MSPRITES
_msprite_flags: .res MAX_MSPRITES
_msprite_last_y:.res 1

.global _msprite_x_frac
.global _msprite_xvel_lo
.global _msprite_xvel_hi
.global _msprite_y_frac
.global _msprite_yvel_lo
.global _msprite_yvel_hi

_msprite_x_frac:  .res MAX_MSPRITES
_msprite_xvel_lo: .res MAX_MSPRITES
_msprite_xvel_hi: .res MAX_MSPRITES
_msprite_y_frac:  .res MAX_MSPRITES
_msprite_yvel_lo: .res MAX_MSPRITES
_msprite_yvel_hi: .res MAX_MSPRITES
