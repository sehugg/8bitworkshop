;
; Fast VRAM upload via HuC6280 TIA.
; TIA alternates dest between $0202/$0203 for LSB/MSB VDC data writes.
;
; IMPORTANT: the TIA opcode lives in DATA (RAM). Patching a ROM-resident
; instruction is a no-op on HuCard and produces garbage VRAM uploads.
;
        .setcpu         "huc6280"
        .export         _pce_tia_vdc
        .export         _pce_vram_burst
        .export         _pce_wait_vsync
        .export         _pce_wait_vsync_vb
        .export         _pce_vb_pending
        .export         _pce_vsync_overruns
        .export         _pce_busy_wait_iters
        .export         _pce_band_scroll_set
        .export         _pce_band_scroll_enable
        .export         _pce_band_scroll_disable
        .export         _pce_band_catchup
        .export         _pce_put_tile
        .import         popax
        .import         popa
        .importzp       tmp1, tmp2, ptr1, vdc_flags

VDC_CTRL        = $0200
VDC_DATA_LO     = $0202
VDC_DATA_HI     = $0203
VDC_MAWR        = 0
VDC_VWR         = 2
STATUS_VB       = $20
STATUS_BUSY     = $40
STATUS_SATBEND  = $08
STATUS_RCR      = $04

VDC_RCR         = 6
VDC_BXR         = 7

; BSS trampoline: rebuilt every call so we never depend on .DATA init
; surviving (BSS clear / stack smash / bank quirks can wipe DATA).
.segment        "BSS"
tia_stub:
        .res    8                  ; TIA src,dest,len + RTS
put_tile_bat:
        .res    2                  ; bat lo/hi for pce_put_tile
_pce_vsync_overruns:
        .res    2                  ; word — byte wrapped mid-bench
_pce_busy_wait_iters:
        .res    2                  ; loops spent waiting out SATB DMA

.segment        "CODE"

; Build and run TIA. nbytes in tmp1/tmp2, src in ptr1.
.proc   tia_run
        lda     #$E3               ; TIA opcode
        sta     tia_stub
        lda     ptr1
        sta     tia_stub+1
        lda     ptr1+1
        sta     tia_stub+2
        lda     #<$0202            ; VDC data port
        sta     tia_stub+3
        lda     #>$0202
        sta     tia_stub+4
        lda     tmp1
        sta     tia_stub+5
        lda     tmp2
        sta     tia_stub+6
        lda     #$60               ; RTS
        sta     tia_stub+7
        jmp     tia_stub
.endproc

; void __fastcall__ pce_put_tile(unsigned char x, unsigned char y,
;                                unsigned int bat);
; bat in A/X. Soft stack [y][x] (y at TOS) per cc65 call setup.
; Bat saved in BSS — ZP tmp1/tmp2 are clobbered by IRQ wait helpers.
.proc   _pce_put_tile
        sta     put_tile_bat       ; bat lo
        stx     put_tile_bat+1     ; bat hi
        jsr     popa               ; y
        sta     ptr1
        stz     ptr1+1
        asl     ptr1
        rol     ptr1+1
        asl     ptr1
        rol     ptr1+1
        asl     ptr1
        rol     ptr1+1
        asl     ptr1
        rol     ptr1+1
        asl     ptr1
        rol     ptr1+1             ; ptr1 = y << 5
        jsr     popa               ; x
        clc
        adc     ptr1
        sta     ptr1
        bcc     :+
        inc     ptr1+1
:       stz     VDC_CTRL           ; MAWR
        lda     ptr1
        sta     VDC_DATA_LO
        lda     ptr1+1
        sta     VDC_DATA_HI
        lda     #VDC_VWR
        sta     VDC_CTRL
        lda     put_tile_bat
        sta     VDC_DATA_LO
        lda     put_tile_bat+1
        sta     VDC_DATA_HI
        rts
.endproc

; void __fastcall__ pce_tia_vdc(const void *src, unsigned int nbytes);
; nbytes in A/X, src on soft stack. VWR must already be selected.
.proc   _pce_tia_vdc
        sta     tmp1
        stx     tmp2
        ora     tmp2
        beq     done
        jsr     popax
        sta     ptr1
        stx     ptr1+1
        jsr     tia_run
done:   rts
.endproc

; void __fastcall__ pce_vram_burst(unsigned int vaddr, const void *src,
;                                 unsigned int nbytes);
; Sets MAWR + VWR, then TIA. nbytes in A/X; src then vaddr on soft stack.
.proc   _pce_vram_burst
        sta     tmp1
        stx     tmp2
        ora     tmp2
        beq     drain

        jsr     popax
        sta     ptr1
        stx     ptr1+1
        jsr     popax              ; vaddr

        ldy     #0                 ; MAWR
        sty     VDC_CTRL
        sta     VDC_DATA_LO
        stx     VDC_DATA_HI
        ldy     #2                 ; VWR
        sty     VDC_CTRL
        jmp     tia_run

; nbytes==0: still drop both pointer args
drain:  jsr     popax
        jmp     popax
.endproc

; ---------------------------------------------------------------------------
; VBlank sync
;
; cc65's IRQStub reads VDC_CTRL (clearing status) into vdc_flags every IRQ.
; Polling VDC_CTRL directly therefore races the IRQ and can hang forever —
; that was freezing gfxtest/solarian/chase/perftest after a few frames.
; Always sync on vdc_flags instead.
; ---------------------------------------------------------------------------

; Clear VB bit in vdc_flags (A, X clobbered).
.proc   ack_vb_flag
        lda     vdc_flags
        and     #<~STATUS_VB
        sta     vdc_flags
        rts
.endproc

; Wait for next VB via vdc_flags. Increments overrun if already pending.
.proc   wait_vb_edge
        lda     vdc_flags
        and     #STATUS_VB
        beq     wait_edge
        inc     _pce_vsync_overruns
        bne     :+
        inc     _pce_vsync_overruns+1
:       jsr     ack_vb_flag
wait_edge:
        lda     vdc_flags
        and     #STATUS_VB
        beq     wait_edge
        jmp     ack_vb_flag
.endproc

; After VB: wait for SATB DMA end so TIA won't RDY-stall.
; Exit on SATBEND, or on BUSY falling after it was seen, or on a short
; timeout (~1k polls ≈ a few scanlines — not a whole frame).
; IMPORTANT: reading VDC_CTRL clears RCR — if that bit is set, run band
; catch-up so we don't drop a mid-frame BXR update.
.proc   wait_satb_idle
        stz     _pce_busy_wait_iters
        stz     _pce_busy_wait_iters+1
        stz     tmp1               ; busy-seen flag
        ldx     #4                 ; 4 × 256 polls max (X — Y used by band writes)
loop:
        lda     VDC_CTRL
        sta     tmp2               ; preserve status
        and     #STATUS_RCR
        beq     :+
        jsr     band_rcr_from_poll
:       lda     tmp2
        and     #STATUS_SATBEND
        bne     done
        lda     tmp2
        and     #STATUS_BUSY
        beq     not_busy
        lda     #1
        sta     tmp1
        bra     cont
not_busy:
        lda     tmp1
        bne     done               ; was busy, now clear
cont:
        inc     _pce_busy_wait_iters
        bne     loop
        inc     _pce_busy_wait_iters+1
        dex
        bne     loop
done:   rts
.endproc

.proc   _pce_wait_vsync_vb
        jmp     wait_vb_edge
.endproc

.proc   _pce_wait_vsync
        jsr     wait_vb_edge
        jmp     wait_satb_idle
.endproc

; unsigned char pce_vb_pending(void);
; Non-zero if vdc_flags still has VB set (does not acknowledge).
.proc   _pce_vb_pending
        lda     vdc_flags
        and     #STATUS_VB
        ldx     #0
        rts
.endproc

; ---------------------------------------------------------------------------
; Mid-frame BXR band scroll via RCR IRQ.
; Screen Y top/bot are converted by C to RCR values (64+Y) before enable.
; At VB: BXR=0, arm top. At top: BXR=band_bxr, arm bot. At bot: BXR=0, arm top.
; ---------------------------------------------------------------------------

.segment        "BSS"
band_enabled:
        .res    1
band_phase:
        .res    1                  ; 0 = expect top, 1 = expect bot
band_top_rcr:
        .res    2
band_bot_rcr:
        .res    2
band_bxr:
        .res    2

.segment        "CODE"

.proc   write_bxr
        ldy     #VDC_BXR
        sty     VDC_CTRL
        sta     VDC_DATA_LO
        stx     VDC_DATA_HI
        rts
.endproc

.proc   write_rcr
        ldy     #VDC_RCR
        sty     VDC_CTRL
        sta     VDC_DATA_LO
        stx     VDC_DATA_HI
        rts
.endproc

; Enter scrolled band: BXR=band_bxr, phase=1, arm bot.
.proc   band_apply_top
        lda     #1
        sta     band_phase
        lda     band_bxr
        ldx     band_bxr+1
        jsr     write_bxr
        lda     band_bot_rcr
        ldx     band_bot_rcr+1
        jmp     write_rcr
.endproc

; Leave scrolled band: BXR=0, phase=0, arm top.
.proc   band_apply_bot
        stz     band_phase
        lda     #0
        tax
        jsr     write_bxr
        lda     band_top_rcr
        ldx     band_top_rcr+1
        jmp     write_rcr
.endproc

; Status poll stole an RCR edge — advance phase the same way the IRQ would.
.proc   band_rcr_from_poll
        lda     band_enabled
        beq     :+
        lda     band_phase
        bne     bot
        jmp     band_apply_top
bot:    jmp     band_apply_bot
:       rts
.endproc

; void __fastcall__ pce_band_scroll_set(unsigned int bxr);
; Updates shadow; if already inside the band, poke hardware immediately so a
; missed top IRQ (or mid-band offset change) cannot leave aliens at BXR=0.
.proc   _pce_band_scroll_set
        sta     band_bxr
        stx     band_bxr+1
        lda     band_enabled
        beq     done
        lda     band_phase
        beq     done
        lda     band_bxr
        ldx     band_bxr+1
        jmp     write_bxr
done:   rts
.endproc

; void __fastcall__ pce_band_scroll_enable(unsigned int top_rcr,
;                                          unsigned int bot_rcr);
; bot_rcr in A/X; top_rcr on soft stack. CR.RCR bit must be set by C.
.proc   _pce_band_scroll_enable
        sta     band_bot_rcr
        stx     band_bot_rcr+1
        jsr     popax
        sta     band_top_rcr
        stx     band_top_rcr+1
        lda     #1
        sta     band_enabled
        stz     band_phase
        stz     band_bxr
        stz     band_bxr+1
        lda     #0
        tax
        jsr     write_bxr
        lda     band_top_rcr
        ldx     band_top_rcr+1
        jmp     write_rcr
.endproc

; void pce_band_scroll_disable(void);
.proc   _pce_band_scroll_disable
        stz     band_enabled
        lda     #0
        tax
        jsr     write_rcr
        lda     #0
        tax
        jmp     write_bxr
.endproc

; void pce_band_catchup(void);
; Call after VB-time VRAM work. If the top RCR was missed (phase still 0),
; force the scrolled BXR now so the formation does not sit at offset 0.
.proc   _pce_band_catchup
        lda     band_enabled
        beq     done
        lda     band_phase
        bne     done
        jmp     band_apply_top
done:   rts
.endproc

.interruptor    band_irq

.proc   band_irq
        lda     band_enabled
        beq     not_ours
        lda     vdc_flags
        and     #STATUS_RCR
        bne     do_rcr
        lda     vdc_flags
        and     #STATUS_VB
        bne     do_vb
not_ours:
        clc
        rts

do_vb:
        ; Re-arm at true vblank: HUD-safe BXR=0, wait for top.
        stz     band_phase
        lda     #0
        tax
        jsr     write_bxr
        lda     band_top_rcr
        ldx     band_top_rcr+1
        jsr     write_rcr
        clc
        rts

do_rcr:
        lda     band_phase
        bne     at_bot
        jsr     band_apply_top
        sec
        rts
at_bot:
        jsr     band_apply_bot
        sec
        rts
.endproc
