
; use CC65's interrupter (slower)
USE_INTERRUPTOR = 0

.segment "DATA"

StartDlist: .word NullDlist-1
NextDlist:  .word NullDlist-1

.segment "CODE"

.global ___dlist_setup
.global ___dlist_done
.global DLIST_IRQ_NEXT
.global DLIST_IRQ_RESTART

.if USE_INTERRUPTOR
.interruptor DLIST_IRQ
.endif

___dlist_setup:
  sei                  ; set interrupt bit, make the CPU ignore interrupt requests
  
  sta StartDlist+0     ; save XA as pointer to start of dlist
  stx StartDlist+1
  
  lda #%01111111       ; switch off interrupt signals from CIA-1
  sta $DC0D

  and $D011            ; clear most significant bit of VIC's raster register
  sta $D011

  lda $DC0D            ; acknowledge pending interrupts from CIA-1
  lda $DD0D            ; acknowledge pending interrupts from CIA-2

  lda #252             ; set rasterline where interrupt shall occur
  sta $D012

.if !USE_INTERRUPTOR
  lda #<DLIST_IRQ      ; set interrupt vectors, pointing to interrupt service routine below
  sta $0314
  lda #>DLIST_IRQ
  sta $0315
.endif

  lda #%00000001       ; enable raster interrupt signals from VIC
  sta $D01A
  cli
  rts

DLIST_IRQ:
DLIST_CALL:
  lda NextDlist+1
  pha
  lda NextDlist+0
  pha
  rts

DLIST_IRQ_RESTART:
  sta $D012	; set IRQ raster line
  lda StartDlist+0
  sta NextDlist+0
  lda StartDlist+1
  sta NextDlist+1
  bne DLIST_ACK

DLIST_IRQ_NEXT:
  sta $D012
  pla
  sta NextDlist+0
  pla
  sta NextDlist+1
DLIST_ACK:
  asl $D019            ; acknowledge the interrupt by clearing the VIC's interrupt flag
.if USE_INTERRUPTOR
  clc
  rts
.else
  pla
  tay
  pla
  tax
  pla
  rti          ; return from interrupt
.endif

___dlist_done:
  php
  sei		; disable interrupts
  lda #$0	; disable raster interrupt signals from VIC
  sta $D01A
  lda #$ff
  sta $DC0D
.if !USE_INTERRUPTOR
  lda #$31      ; set interrupt vectors back to KERNAL
  sta $0314
  lda #$ea
  sta $0315
.else
  lda #<(NullDlist-1)
  sta StartDlist
  lda #>(NullDlist-1)
  sta StartDlist+1
.endif
  plp
  rts


NullDlist:
  lda #252
  jmp DLIST_IRQ_RESTART
