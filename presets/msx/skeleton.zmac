
; Hello World example

; ROM routine for character output
CHPUT:  equ $00A2

	org 0x4000
        
; MSX cartridge header @ 0x4000 - 0x400f
	dw 0x4241
        dw Init
        dw Init
        dw 0
        dw 0
        dw 0
        dw 0
        dw 0

; initialize and print message
Init:
    ld hl, msg
    call puts
    jp Init	; loop forever
puts:               ; print 0-terminated string in HL
    ld a,(hl)
    or a
    ret z
    call CHPUT      ; displays one character in A
    inc hl
    jr puts

; ASCII message + CR LF
msg:    defm "Hello, world!",13,10,0
