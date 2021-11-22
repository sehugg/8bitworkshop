
; from https://www.chibiakumas.com/z80/helloworld.php#LessonH1

PrintChar = 0xbb5a   
WaitChar  = 0xbb06

    org 0x4000

Start:
    ld hl,Message            ;Address of string
    call PrintString        ;Show String to screen
    call WaitChar
    ret                ;Finished Hello World

PrintString:
    ld a,(hl)    ;Print a '255' terminated string
    cp 255
    ret z
    inc hl
    call PrintChar
    jr PrintString

Message:
    db 'Hello World! Press a key...',255

NewLine:
    ld a,13        ;Carriage return
    call PrintChar
    ld a,10        ;Line Feed
    call PrintChar
    ret
