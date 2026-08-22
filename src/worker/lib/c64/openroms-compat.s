;
; Open ROMs compatibility overrides for the cc65 runtime library.
;
; The Open ROMs KERNAL used by 8bitworkshop is not binary-compatible
; with the original Commodore KERNAL at some undocumented entry points
; that cc65 routines call directly. This object is linked before
; c64.lib so ld65 resolves the overridden symbols here and never pulls
; the incompatible library members (cgetc.o, kplot.o).
;
; Only entry points that are actually broken in Open ROMs are
; overridden; everything else (CLRSCR $E544, SCREEN $FFED, BSOUT,
; etc.) works and is left to the KERNAL.
;
; Safe to use with the original C64 KERNAL as well: _cgetc only
; depends on the documented keyboard buffer interface (KEY_COUNT /
; KEY_BUF), and PLOT is a pure RAM-pointer implementation.
;

        .export         _cgetc
        .export         PLOT

        .include        "c64.inc"

KEY_BUF         := $0277        ; keyboard buffer (10 bytes, FIFO)

; ----------------------------------------------------------------------------
; char cgetc (void)
;
; cc65's stock version jumps to KBDREAD ($E5B4), which is "get character from
; keyboard buffer" on the original KERNAL but unimplemented VIC-II init code
; inside Open ROMs - so cgetc() returned garbage instead of blocking/reading.
; Read the buffer directly instead (same thing the stock KERNAL GETIN path does).
;
_cgetc:
        lda     KEY_COUNT
        beq     _cgetc          ; wait until a character is available
        sei                     ; IRQ must not touch the buffer while we shift
        lda     KEY_BUF         ; first character (to be returned)
        pha
        ldx     #$00
L:      lda     KEY_BUF+1,x     ; shift remaining characters down
        sta     KEY_BUF,x
        inx
        cpx     #$09            ; buffer holds 10 characters
        bne     L
        dec     KEY_COUNT
        cli
        pla
        ldx     #$00            ; cc65 char return: char in A, high byte in X
        rts

; ----------------------------------------------------------------------------
; PLOT - set/read cursor position (replaces kplot.o)
;
; cc65's kplot.o calls the original ROM PLOT ($FFF0) and UPDCRAMPTR ($EA24)
; directly. In Open ROMs, that path runs into unimplemented code ($EA24 is a
; KIL instruction), and the previous workaround (patching $EA24 to RTS in the
; BIOS) left CRAM_PTR stale, breaking text colors. This replacement computes
; SCREEN_PTR/CRAM_PTR directly - no KERNAL calls at all.
;
; Entry: C=0: set position (X = row, Y = column), like the KERNAL routine.
;        C=1: read position (returns X = row, Y = column, C = 0).
;
ZP_ROW          := $FB          ; temp: 16-bit offset (row*40 + col)
ZP_ROWHI        := $FC
ZP_ROW8         := $FD          ; temp: row*8
ZP_ROW8HI       := $FE

.proc   PLOT
        bcs     @read

        ; offset = row*40 + column
        stx     ZP_ROW
        lda     #$00
        sta     ZP_ROWHI
        asl     ZP_ROW
        rol     ZP_ROWHI        ; *2
        asl     ZP_ROW
        rol     ZP_ROWHI        ; *4
        asl     ZP_ROW
        rol     ZP_ROWHI        ; *8
        lda     ZP_ROW
        sta     ZP_ROW8
        lda     ZP_ROWHI
        sta     ZP_ROW8HI       ; ZP_ROW8/HI = row*8
        asl     ZP_ROW
        rol     ZP_ROWHI        ; *16
        asl     ZP_ROW
        rol     ZP_ROWHI        ; *32
        lda     ZP_ROW
        clc
        adc     ZP_ROW8
        sta     ZP_ROW          ; + row*8 = row*40
        lda     ZP_ROWHI
        adc     ZP_ROW8HI
        sta     ZP_ROWHI
        ; NOTE: no column offset here - the KERNAL PLOT convention is that
        ; SCREEN_PTR/CRAM_PTR point to the START of the cursor row; the
        ; column is applied by callers via indexed addressing
        ; (e.g. putchar: sta (SCREEN_PTR),y with Y = CURS_X).
        ; SCREEN_PTR = $0400 + row*40
        lda     #<$0400
        clc
        adc     ZP_ROW
        sta     SCREEN_PTR
        lda     #>$0400
        adc     ZP_ROWHI
        sta     SCREEN_PTR+1
        ; CRAM_PTR = $D800 + offset
        lda     #<$D800
        clc
        adc     ZP_ROW
        sta     CRAM_PTR
        lda     #>$D800
        adc     ZP_ROWHI
        sta     CRAM_PTR+1
        rts

@read:  ldx     CURS_Y
        ldy     CURS_X
        clc
        rts
.endproc
