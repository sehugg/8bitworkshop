
; Hello World example

; ROM routine for character output
CHGET = #0x009F
CHPUT = #0x00A2

; Bank 1
.area _CODE
; MSX cartridge header @ 0x4000 - 0x400f
	.dw 0x4241
        .dw Init
        .dw Init
        .dw 0
        .dw 0
        .dw 0
        .dw 0
        .dw 0

; initialize and print message
Init:
    ld hl,#msg
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
msg:    .ascii "Hello, world!\n\r\0"
