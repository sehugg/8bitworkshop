;
; Self-contained TGI driver for the Apple ][ hi-res screen (280x192, 8 colors)
;
; The stock cc65 hi-res driver calls Applesoft ROM routines, which the
; emulator's ROM doesn't have. This one draws everything itself.
; Usage:  //#link "a2hires.s"  then  tgi_install(a2hires_tgi);
; (no text output, no palette changes)
;
; The picture lives on hi-res page 2 ($4000-$5FFF), so programs may use
; everything below $4000 (the default config puts code at $0803 up).
;
        .include        "zeropage.inc"
        .include        "tgi-kernel.inc"
        .include        "tgi-error.inc"

        .export         _a2hires_tgi

; Soft switches
TXTCLR  := $C050
TXTSET  := $C051
MIXCLR  := $C052
MIXSET  := $C053        ; MIXCLR+1
LOWSCR  := $C054
HISCR   := $C055        ; LOWSCR+1
LORES   := $C056
HIRES   := $C057
WNDTOP  := $22

; Parameters passed by the TGI kernel
X1      := ptr1
Y1      := ptr2
X2      := ptr3
Y2      := ptr4

; Scratch (never live across a driver call)
SCR     := sreg         ; pointer to screen byte
MASK    := tmp1         ; pixel mask within byte
TMP     := tmp2

; ------------------------------------------------------------------------

        .rodata

; Driver header: signature, capabilities, then the jump table.
; Entries are absolute since this driver is linked statically.
_a2hires_tgi:
        .byte   $74, $67, $69   ; "tgi"
        .byte   TGI_API_VERSION
        .addr   $0000           ; Library reference
        .word   280             ; X resolution
        .word   192             ; Y resolution
        .byte   8               ; Number of drawing colors
        .byte   1               ; Number of screens
        .byte   7               ; System font X size
        .byte   8               ; System font Y size
        .word   $00EA           ; Aspect ratio (based on 4/3 display)
        .byte   0               ; TGI driver flags

        .addr   INSTALL
        .addr   UNINSTALL
        .addr   INIT
        .addr   DONE
        .addr   GETERROR
        .addr   CONTROL
        .addr   CLEAR
        .addr   SETVIEWPAGE
        .addr   SETDRAWPAGE
        .addr   SETCOLOR
        .addr   SETPALETTE
        .addr   GETPALETTE
        .addr   GETDEFPALETTE
        .addr   SETPIXEL
        .addr   GETPIXEL
        .addr   LINE
        .addr   BAR
        .addr   TEXTSTYLE
        .addr   OUTTEXT

; Colors: 0 black, 1 green, 2 violet, 3 white, 4 black2, 5 orange, 6 blue, 7 white2
DEFPALETTE:
        .byte   0, 1, 2, 3, 4, 5, 6, 7

; Per-color pixel behavior, indexed by color & 3
EVENSET: .byte  0, 0, 1, 1      ; set the pixel in even columns?
ODDSET:  .byte  0, 1, 0, 1      ; set the pixel in odd columns?

ROWOFS: .byte   0, 40, 80       ; 40 bytes per row of 8 scanlines, 3 groups

; ------------------------------------------------------------------------

        .bss

ERROR:  .res    1
SETEVEN: .res   1               ; current color: set pixel in even columns
SETODD: .res    1               ;                set pixel in odd columns
PALBIT: .res    1               ;                palette bit ($00 or $80)

XDIV:   .res    256             ; x / 7
XMASK:  .res    256             ; 1 << (x % 7)
ROWLO:  .res    192             ; address of scanline y on page 1
ROWHI:  .res    192

; Pixel position, also used as the running point of LINE
PX:     .res    2
PY:     .res    1

; Line state
SXDIR:  .res    1               ; $00 = x increases, $FF = decreases
SYDIR:  .res    1
MAJVEC: .res    2               ; routine that steps the major axis
MINVEC: .res    2               ; ... and the minor axis
LEN:    .res    2               ; major axis length (steps remaining)
TOT:    .res    2               ; copy of LEN
MINOR:  .res    2               ; minor axis length
ERR:    .res    2

; ------------------------------------------------------------------------

        .code

INSTALL:
UNINSTALL:
SETVIEWPAGE:
SETDRAWPAGE:
TEXTSTYLE:
OUTTEXT:
        rts

; INIT: build lookup tables, then switch on page 1 of hi-res
INIT:
        ; x -> byte offset and bit mask, for x = 0..255
        ldx     #0
        stx     tmp3            ; div
        stx     tmp4            ; mod
        lda     #1
        sta     MASK
@xloop: lda     tmp3
        sta     XDIV,x
        lda     MASK
        sta     XMASK,x
        asl     MASK
        inc     tmp4
        lda     tmp4
        cmp     #7
        bcc     @nx
        lda     #0
        sta     tmp4
        lda     #1
        sta     MASK
        inc     tmp3
@nx:    inx
        bne     @xloop

        ; y -> address of scanline: $2000 + (y&7)*$400 + ((y>>3)&7)*$80 + (y>>6)*40
        ldy     #0
@yloop: tya
        and     #7
        asl
        asl
        ora     #$20
        sta     TMP
        tya
        lsr
        lsr
        lsr
        and     #7
        lsr                     ; carry = bit 0 of the 8-line group
        ora     TMP
        sta     TMP
        lda     #0
        ror                     ; $80 if carry
        sta     MASK
        tya
        asl
        rol
        rol
        and     #3
        tax
        lda     ROWOFS,x
        clc
        adc     MASK
        sta     ROWLO,y
        lda     TMP
        adc     #0
        sta     ROWHI,y
        iny
        cpy     #192
        bne     @yloop

        bit     MIXCLR
        bit     HISCR
        bit     HIRES
        bit     TXTCLR
        lda     #TGI_ERR_OK
        sta     ERROR
        rts

DONE:
        bit     TXTSET
        bit     LOWSCR
        bit     LORES
        lda     #0
        sta     WNDTOP
        rts

GETERROR:
        lda     ERROR
        ldx     #TGI_ERR_OK
        stx     ERROR
        rts

; CONTROL: data = 0 for full screen, 1 for 4 lines of text
CONTROL:
        ora     ptr1+1
        bne     @err
        lda     ptr1
        cmp     #2
        bcs     @err
        tax
        beq     @top
        lda     #20
@top:   sta     WNDTOP
        lda     MIXCLR,x
        lda     #TGI_ERR_OK
        .byte   $2C             ; BIT absolute
@err:   lda     #TGI_ERR_INV_ARG
        sta     ERROR
        rts

; CLEAR: fill the screen with zeros
CLEAR:
        lda     #0
        sta     SCR
        lda     #$40
        sta     SCR+1
        ldx     #32             ; 32 pages of 256 bytes
        ldy     #0
        tya
@loop:  sta     (SCR),y
        iny
        bne     @loop
        inc     SCR+1
        dex
        bne     @loop
        rts

; SETCOLOR: A = 0..7
SETCOLOR:
        tax
        and     #3
        tay
        lda     EVENSET,y
        sta     SETEVEN
        lda     ODDSET,y
        sta     SETODD
        txa
        and     #4
        beq     @lo
        lda     #$80
@lo:    sta     PALBIT
        rts

SETPALETTE:
        lda     #TGI_ERR_INV_FUNC
        sta     ERROR
        rts

GETPALETTE:
GETDEFPALETTE:
        lda     #<DEFPALETTE
        ldx     #>DEFPALETTE
        rts

; ADDR: locate the pixel at PX/PY. Returns the byte address in (SCR),y
; and the pixel's bit in MASK.
ADDR:
        ldx     PY
        lda     ROWLO,x
        sta     SCR
        lda     ROWHI,x
        clc
        adc     #$20            ; page 2
        sta     SCR+1
        ldy     #0              ; byte offset of the 256 column page
        ldx     PX
        lda     PX+1
        beq     @lo
        txa                     ; x >= 256: use x-252, which is 36 bytes on
        sec
        sbc     #252
        tax
        ldy     #36
@lo:    tya
        clc
        adc     XDIV,x
        tay
        lda     XMASK,x
        sta     MASK
        rts

; PLOT: draw the pixel at PX/PY in the current color
PLOT:
        jsr     ADDR
        ldx     SETEVEN
        lda     PX
        lsr                     ; carry = odd column
        bcc     @even
        ldx     SETODD
@even:  lda     MASK
        ora     #$80            ; the palette bit is always rewritten
        eor     #$FF
        and     (SCR),y
        ora     PALBIT
        cpx     #0
        beq     @store
        ora     MASK
@store: sta     (SCR),y
        rts

SETPIXEL:
        lda     X1
        sta     PX
        lda     X1+1
        sta     PX+1
        lda     Y1
        sta     PY
        jmp     PLOT

; GETPIXEL: returns black/white (+4 for the second palette)
GETPIXEL:
        lda     X1
        sta     PX
        lda     X1+1
        sta     PX+1
        lda     Y1
        sta     PY
        jsr     ADDR
        lda     (SCR),y
        tax                     ; remember the palette bit
        and     MASK
        beq     @black
        lda     #3
@black: cpx     #$80
        bcc     @done
        adc     #3              ; carry is set: +4
@done:  ldx     #0
        rts

; LINE: DDA between X1/Y1 and X2/Y2. The major axis is stepped every pixel,
; and the minor axis whenever the accumulated error passes the major length.
LINE:
        lda     X1
        sta     PX
        lda     X1+1
        sta     PX+1
        lda     Y1
        sta     PY

        ; dx = |x2 - x1|
        lda     #0
        sta     SXDIR
        sec
        lda     X2
        sbc     X1
        sta     LEN
        lda     X2+1
        sbc     X1+1
        sta     LEN+1
        bcs     @dxpos
        dec     SXDIR           ; $FF
        sec                     ; negate
        lda     #0
        sbc     LEN
        sta     LEN
        lda     #0
        sbc     LEN+1
        sta     LEN+1
@dxpos:
        ; dy = |y2 - y1|
        lda     #0
        sta     SYDIR
        sta     MINOR+1
        sec
        lda     Y2
        sbc     Y1
        bcs     @dypos
        dec     SYDIR
        eor     #$FF
        adc     #1
@dypos: sta     MINOR

        ; the major axis is the longer one
        lda     MINOR
        cmp     LEN
        lda     MINOR+1
        sbc     LEN+1
        bcs     @ymajor         ; dy >= dx
        lda     #<stepx
        sta     MAJVEC
        lda     #>stepx
        sta     MAJVEC+1
        lda     #<stepy
        sta     MINVEC
        lda     #>stepy
        sta     MINVEC+1
        bne     @go             ; branch always
@ymajor:
        lda     LEN             ; swap: LEN <-> MINOR
        ldx     MINOR
        sta     MINOR
        stx     LEN
        lda     LEN+1
        ldx     MINOR+1
        sta     MINOR+1
        stx     LEN+1
        lda     #<stepy
        sta     MAJVEC
        lda     #>stepy
        sta     MAJVEC+1
        lda     #<stepx
        sta     MINVEC
        lda     #>stepx
        sta     MINVEC+1
@go:    lda     LEN
        sta     TOT
        lda     LEN+1
        sta     TOT+1
        lsr                     ; error starts at half the length
        sta     ERR+1
        lda     LEN
        ror
        sta     ERR
@loop:  jsr     PLOT
        lda     LEN
        ora     LEN+1
        beq     @done
        lda     LEN
        bne     @nb
        dec     LEN+1
@nb:    dec     LEN
        jsr     @major
        clc
        lda     ERR
        adc     MINOR
        sta     ERR
        lda     ERR+1
        adc     MINOR+1
        sta     ERR+1
        lda     ERR             ; error >= length?
        cmp     TOT
        lda     ERR+1
        sbc     TOT+1
        bcc     @loop
        sec                     ; yes: subtract it and step the minor axis
        lda     ERR
        sbc     TOT
        sta     ERR
        lda     ERR+1
        sbc     TOT+1
        sta     ERR+1
        jsr     @minor
        jmp     @loop
@done:  rts
@major: jmp     (MAJVEC)
@minor: jmp     (MINVEC)

stepx:  lda     SXDIR
        bne     @dec
        inc     PX
        bne     @ret
        inc     PX+1
@ret:   rts
@dec:   lda     PX
        bne     @nb
        dec     PX+1
@nb:    dec     PX
        rts

stepy:  lda     SYDIR
        bne     @dec
        inc     PY
        rts
@dec:   dec     PY
        rts

; BAR: horizontal lines from Y1 to Y2 (the kernel sorts and clips the corners)
BAR:
        inc     Y2
@row:   lda     Y2
        pha
        lda     Y1
        sta     Y2
        jsr     LINE
        pla
        sta     Y2
        inc     Y1
        cmp     Y1
        bne     @row
        rts
