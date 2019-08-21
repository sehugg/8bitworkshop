
; FAST SPRITE ROUTINES FOR ASTROCADE
; fast_sprite_8: 8 (2 bytes) by H pixels, unexpanded
; fast_sprite_16: 16 (4 bytes) by H pixels, unexpanded
; Pattern format: bytewidth height data...
.area	_CODE_ACFAST

;void fast_sprite_8(const byte* src, byte* dst) {
.globl	_fast_sprite_8
_fast_sprite_8:
  push	ix
  ld	ix,#0
  add	ix,sp		; IX = arg pointer
  ld	l,4(ix)		; src (HL)
  ld	h,5(ix)
  ld	e,6(ix)		; dst (DE)
  ld	d,7(ix)
  inc	hl		; skip width
  ld	c,(hl)		; load height -> C
  sla	c		; C *= 2
  ld	b,#0		; B always 0 (BC < 256)
  inc	hl		; move HL to pattern start
001$:
  ldi
  ldi			; copy 2 bytes src to dst
  ld	a,b		; 0 -> A, doesnt affect flags
  ld	(de),a		; copy 3rd 0 (for shifts)
  jp	po,002$		; exit if BC == 0
  ld	a,e		; E -> A
  add	a,#38		; next scanline (dest += 38)
  ld	e,a		; A -> E
  jr	nc,001$		; loop unless lo byte overflow
  inc	d		; inc hi byte of dest. addr
  jr    001$		; loop to next line
002$:
  pop	ix
  ret

;void fast_sprite_16(const byte* src, byte* dst) {
.globl	_fast_sprite_16
_fast_sprite_16:
  push	ix
  ld	ix,#0
  add	ix,sp		; IX = arg pointer
  ld	l,4(ix)		; src (HL)
  ld	h,5(ix)
  inc	hl		; skip width
  ld	c,(hl)		; load height -> C
fast_sprite_16_clip_entry:
  sla	c
  sla	c		; C *= 4
  ld	b,#0		; B always 0 (BC < 256)
  inc	hl		; move HL to pattern start
  ld	e,6(ix)		; dst (DE)
  ld	d,7(ix)
001$:
  ldi
  ldi
  ldi
  ldi			; copy 4 bytes src to dst
  ld	a,b		; 0 -> A, doesnt affect flags
  ld	(de),a		; copy 3rd 0 (for shifts)
  jp	po,002$		; exit if BC == 0
  ld	a,e		; E -> A
  add	a,#36		; next scanline (dest += 38)
  ld	e,a		; A -> E
  jr	nc,001$		; loop unless lo byte overflow
  inc	d		; inc hi byte of dest. addr
  jr    001$		; loop to next line
002$:
  pop	ix
  ret

;void fast_sprite_16_yclip(const byte* src, byte* dst, byte height) {
.globl	_fast_sprite_16_yclip
_fast_sprite_16_yclip:
  push	ix
  ld	ix,#0
  add	ix,sp		; IX = arg pointer
  ld	l,4(ix)		; src (HL)
  ld	h,5(ix)
  ld	c,8(ix)		; height (C)
  inc	hl		; skip width
  jp	fast_sprite_16_clip_entry
