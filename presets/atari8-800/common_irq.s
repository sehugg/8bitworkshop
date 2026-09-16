;
; common_irq.s - interrupt trampoline for presets/atari8-800/common.c
;
; The Atari DLI is delivered as an NMI: the OS (or the 5200 BIOS) jumps
; through the VDSLST vector, and the handler has to finish with RTI.
; cc65 has no way to express that in C, so this tiny stub saves the C
; runtime zero page, calls the C dispatcher, and returns with RTI.
;
; It also restores A/X/Y, so the interrupted program sees no side effects.
;

        .export         _a8_dli_stub
        .import         _a8_dli_dispatch
        .import         __ZP_START__

; cc65's interrupt.s says zpsavespace = zpspace - regbanksize = 26 - 6.
; Kept as a constant so this file does not depend on the asminc version.
A8_ZPSAVE = 20

        .bss
a8_zpsave:      .res    A8_ZPSAVE

        .code

_a8_dli_stub:
        pha
        txa
        pha
        tya
        pha

        ; save cc65's zero page
        ldx     #A8_ZPSAVE-1
@save:  lda     <__ZP_START__,x
        sta     a8_zpsave,x
        dex
        bpl     @save

        jsr     _a8_dli_dispatch

        ; restore cc65's zero page
        ldx     #A8_ZPSAVE-1
@rest:  lda     a8_zpsave,x
        sta     <__ZP_START__,x
        dex
        bpl     @rest

        pla
        tay
        pla
        tax
        pla
        rti
