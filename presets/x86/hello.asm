
; http://www.ablmcc.edu.hk/~scy/CIT/8086_bios_and_dos_interrupts.htm
org 100h		; EXE files start at 0x100
section .text		; code section

mov dx,msg		; DX = string address
mov ah,9		; 9 = "draw string"
int 21h
mov ah,4Ch		; 4ch = "exit to OS"
int 21h			

section .data		; data section
msg db 'Hello, World!',0Dh,0Ah,'$'
