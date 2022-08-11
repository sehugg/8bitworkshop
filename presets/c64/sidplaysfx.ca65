
; music and SFX from GoatTracker 2 sample files
; http://sourceforge.net/projects/goattracker2

.segment "DATA"

_sid_playing: .byte $00

.segment "SIDFILE"

.incbin "sidmusic1.bin"

.segment "LOWCODE"

.global _sid_init, _sid_update, _sid_sfx
.global _sid_start, _sid_stop, _sid_playing

_sid_init:
        jmp $1000

_sid_update:
	bit _sid_playing
        bpl @noplay
	jmp $1003
@noplay:
        rts

_sid_sfx:
	tax
        lda sfxtbllo,x     ;Address in A,Y
        ldy sfxtblhi,x
        ldx #$0e           ;Channel index in X
        jmp $1006          ;(0, 7 or 14)

_sid_start:
	lda #$80
        bne skipstop
_sid_stop:
	lda #$00
        sta $d418
skipstop:
        sta _sid_playing
        rts

sfxtbllo:       .byte <arpeggio2
                .byte <arpeggio1
                .byte <gunshot
                .byte <explosion

sfxtblhi:       .byte >arpeggio2
                .byte >arpeggio1
                .byte >gunshot
                .byte >explosion

arpeggio2:
        .byte $00,$89,$04,$A2,$41,$A2,$A2,$A6,$A6,$A6,$40,$A9,$A9,$A9,$A2,$A2
        .byte $A2,$A6,$A6,$A6,$A9,$A9,$A9,$A2,$A2,$A2,$A6,$A6,$A6,$A9,$A9,$A9
        .byte $A2,$A2,$A2,$A6,$A6,$A6,$A9,$A9,$A9,$00
        
arpeggio1:
        .byte $0A,$00,$02,$A0,$41,$A0,$A0,$A4,$A4,$A4,$A7,$A7,$A7,$A0,$A0,$A0
        .byte $A4,$A4,$A4,$A7,$A7,$A7,$A0,$A0,$A0,$A4,$A4,$A4,$A7,$A7,$A7,$A0
        .byte $A0,$A0,$A4,$A4,$A4,$A7,$A7,$A7,$00
        
gunshot:
        .byte $00,$F9,$08,$C4,$81,$A8,$41,$C0,$81,$BE,$BC,$80,$BA,$B8,$B6,$B4
        .byte $B2,$B0,$AE,$AC,$AA,$A8,$A6,$A4,$A2,$A0,$9E,$9C,$9A,$98,$96,$94
        .byte $92,$90,$00

explosion:
        .byte $00,$FA,$08,$B8,$81,$A4,$41,$A0,$B4,$81,$98,$92,$9C,$90,$95,$9E
        .byte $92,$80,$94,$8F,$8E,$8D,$8C,$8B,$8A,$89,$88,$87,$86,$84,$00
