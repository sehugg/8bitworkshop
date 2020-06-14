;; Draw a grayscale mandelbrot fractal
;;
;; i compiled with yasm: yasm -o mandel.com mandel.asm
;; but i think it should be quite portable to other assemblers.
;;
;; from: https://www.reddit.com/r/asm/comments/8o8c0b/mandelbrot_x86_asm_w_vga/

    SECTION .data

    maxi:       equ  128     ; upto maxi iterations per pixel
    palscale:   equ    1     ; ammount to shift to fit maxi onto palette
    crestep:    equ    2     ; x (mandelwidth/320) * 2^shift
    cimstep:    equ    3     ; y (mandelheight/200) * 2^shift
    one:        equ  256     ; fixed point 1.0
    n15:        equ -450     ; start of left side
    two:        equ  512     ; fixed point 2.0
    four:       equ 1024     ; fixed point 4.0

    cim:        dw  300      ; imaginary part of Y
    cre:        dw    0      ; imaginary part of X
    x:          dw    0      ; real part of X
    y:          dw    0      ; real part of Y
    xx:         dw    0      ; x*x placeholder
    yy:         dw    0      ; y*y placeholder
    twox:       dw    0      ; 2*x placeholder
    xnew:       dw    0      ; temporary x placeholder
    row:        dw    0      ; current row
    col         dw    0      ; current col

    SECTION .text
    ORG 0x100                ; dos .com file starts at 0100h

    call setup               ; setup screen mode
    call draw                ; draw the fractal
    call waitkey             ; wait for a keypress

exit:
    mov ax, 3                ; back to text
    int 0x10                 ; mode
    mov ax, 0x4c00           ; clean dos
    int 0x21                 ; exit

setup:
    mov ax, 0x13             ; setup screen mode 13
    int 0x10                 ; 320x200x256
    mov ax, 0                ; setup grayscale palette
    mov dx, 0x03c8           ; setup register to receive
    out dx, al               ; full palette (768bytes of rgb data)
    inc dx                   ; the next register expects data
setpalette:
    out dx, al               ; red value
    out dx, al               ; green value
    out dx, al               ; blue value
    inc al                   ; next 'color'
    jnz setpalette
    mov ax, 0xa000           ; point es:di to
    mov es, ax               ; 0a000:0000
    xor di, di               ; so stos functions write to vram
    cld                      ; we move forward in memory
    xor ax,ax                ; clear
    mov cx,32000             ; screen
    rep stosw
    xor di, di               ; restore di to start of vram
    ret

waitkey:
    mov ax, 0                ; wait for
    int 0x16                 ; keypress
    jnz waitkey              ; none received, start over
    ret

draw:
    mov word [row], 200      ; 200 rows

yloop:
    mov ax, n15
    mov [cre], ax            ; start of left side

    mov word [col], 320      ; 320 columns
xloop:
    xor ax, ax
    xor cx, cx               ; iter = 0
    mov [x], ax              ; x = 0
    mov [y], ax              ; y = 0

whileloop:                   ; while ( iter < maxi && x*x + y*y < 4)
    cmp cx, maxi             ; if iter == maxi
    je escape                ; escape

    mov ax, [x]              ; x*x
    mov bx, ax
    imul bx
    mov bx, one
    idiv bx
    mov [xx], ax

    mov ax, [y]              ; y*y
    mov bx, ax
    imul bx
    mov bx, one
    idiv bx
    mov [yy], ax

    add ax, [xx]             ; if x*x + y*y ==
    cmp ax, four             ; four
    jge escape               ; escape

    mov ax, [xx]             ; xnew = x*x - y*y + cre
    sub ax, [yy]
    add ax, [cre]
    mov [xnew], ax

    mov ax, [x]              ; x * 2 * y
    mov bx, two
    imul bx
    mov bx, one
    idiv bx
    mov bx, [y]
    imul bx
    mov bx, one
    idiv bx
    add ax, [cim]            ; + cim

    mov [y], ax              ; y = x * 2 * y + cim

    mov ax, [xnew]           ; x = xnew
    mov [x], ax

    inc cx                   ; ++iter
    jmp whileloop

escape:
    mov al, cl               ; copy color index (iter)
    cmp al, maxi             ; plot pixel
    jne color                ; w/ black if maximum reached
    xor al, al
color:                       ; otherwise w/ palette value
    shl al, palscale         ; scale to fit palette
    stosb                    ; write pixel

    add word [cre], crestep  ; cre += crestep

    dec word [col]
    jnz xloop                ; next column

    sub word [cim], cimstep  ; cim -= cimstep

    dec word [row]           ; next row
    jnz yloop

    ret

