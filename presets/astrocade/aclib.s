
	.include "astrocade.inc"

;;; C functions

	.area	_CODE_ACLIB

; set entire palette at once (8 bytes to port 0xb)
; bytes in array should be in reverse
;void set_palette(byte palette[8]) __z88dk_fastcall {
.globl	_set_palette
_set_palette:
  ld bc,#0x80b	; B -> 8, C -> 0xb
  otir		; write C bytes from HL to port[B]
  ret

; set entire sound registers at once (8 bytes to port 0x18)
; bytes in array should be in reverse
;void set_sound_registers(byte regs[8]) __z88dk_fastcall {
.globl	_set_sound_registers
_set_sound_registers:
  ld bc,#0x818	; B -> 8, C -> 0x18
  otir		; write C bytes from HL to port[B]
  ret

; set interrupt vector
; pass address of 16-bit pointer to routine
.globl	_set_interrupt_vector
_set_interrupt_vector:
  di
  ld	a,l
  out	(INFBK),a
  ld	a,h	; upper 8 bits of address
  ld	i,a	; -> I
  im	2	; mode 2
  ei		; enable interrupts
  ret
