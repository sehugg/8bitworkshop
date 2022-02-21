;
; Oliver Schmidt, 2013-05-16
;
; Startup code for cc65 (sim6502 version)
;

        .export         _exit
        .export         __STARTUP__ : absolute = 1      ; Mark as startup
        .import         zerobss, callmain
        .import         initlib, donelib, copydata
        .import         __PRGRAM_START__, __PRGRAM_SIZE__   ; Linker generated
;        .import         __STACKSIZE__                   ; Linker generated

        .include        "zeropage.inc"

        .segment        "STARTUP"
start:
        cld
        ldx     #$FF
        txs
        lda     #<(__PRGRAM_START__ + __PRGRAM_SIZE__)
        ldx     #>(__PRGRAM_START__ + __PRGRAM_SIZE__)
        sta     sp
        stx     sp+1
        jsr     zerobss
	jsr	copydata
        jsr     initlib
        jsr     callmain
_exit:  pha
        jsr     donelib
        pla
        jmp     start

nmi:
	inc	$0
	rti

.segment "VECTORS"

        .word   nmi         ; $fffa nmi
        .word   start       ; $fffc reset
        .word   nmi         ; $fffe irq / brk
