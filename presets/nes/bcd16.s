; bcd16.s
; version 20060201
;
; Copyright (C) 2006 Damian Yerrick
;
; Copying and distribution of this file, with or without
; modification, are permitted in any medium without royalty provided
; the copyright notice and this notice are preserved in any source
; code copies.  This file is offered as-is, without any warranty.
;

.p02

.exportzp bcdNum, bcdResult
.export bcdConvert

; bcdConvert
;
; Given a number in bcdNum (16-bit), converts it to 5 decimal digits
; in bcdResult.  Unlike most 6502 binary-to-decimal converters, this
; subroutine doesn't use the decimal mode that was removed from the
; 2A03 variant of the 6502 processor.
;
; For each value of n from 4 to 1, it compares the number to 8*10^n,
; then 4*10^n, then 2*10^n, then 1*10^n, each time subtracting if
; possible. After finishing all the comparisons and subtractions in
; each decimal place value, it writes the digit to the output array
; as a byte value in the range [0, 9].  Finally, it writes the
; remainder to element 0.
;
; Extension to 24-bit and larger numbers is straightforward:
; Add a third bcdTable, increase BCD_BITS, and extend the
; trial subtraction.

; Constants _________________________________________________________
; BCD_BITS
;   The highest possible number of bits in the BCD output. Should
;   roughly equal 4 * log10(2) * x, where x is the width in bits
;   of the largest binary number to be put in bcdNum.
; bcdTableLo[y], bcdTableHi[y]
;   Contains (1 << y) converted from BCD to binary.
BCD_BITS = 19

; Variables _________________________________________________________
; bcdNum (input)
;   Number to be converted to decimal (16-bit little endian).
;   Overwritten.
; bcdResult (output)
;   Decimal digits of result (5-digit little endian).
; X
;   Offset of current digit being worked on.
; Y
;   Offset into bcdTable*.
; curDigit
;   The lower holds the digit being constructed.
;   The upper nibble contains a sentinel value; when a 1 is shifted
;   out, the byte is complete and should be copied to result.
;   (This behavior is called a "ring counter".)
;   Overwritten.
; b
;   Low byte of the result of trial subtraction.
;   Overwritten.
bcdNum = 0
bcdResult = 2
curDigit = 7
b = 2

;
; Completes within 670 cycles.
;

bcdConvert:
  lda #$80 >> ((BCD_BITS - 1) & 3)
  sta curDigit
  ldx #(BCD_BITS - 1) >> 2
  ldy #BCD_BITS - 5

@loop:
  ; Trial subtract this bit to A:b
  sec
  lda bcdNum
  sbc bcdTableLo,y
  sta b
  lda bcdNum+1
  sbc bcdTableHi,y

  ; If A:b > bcdNum then bcdNum = A:b
  bcc @trial_lower
  sta bcdNum+1
  lda b
  sta bcdNum
@trial_lower:

  ; Copy bit from carry into digit and pick up 
  ; end-of-digit sentinel into carry
  rol curDigit
  dey
  bcc @loop

  ; Copy digit into result
  lda curDigit
  sta bcdResult,x
  lda #$10  ; Empty digit; sentinel at 4 bits
  sta curDigit
  ; If there are digits left, do those
  dex
  bne @loop
  lda bcdNum
  sta bcdResult
  rts

bcdTableLo:
  .byt <10, <20, <40, <80
  .byt <100, <200, <400, <800
  .byt <1000, <2000, <4000, <8000
  .byt <10000, <20000, <40000

bcdTableHi:
  .byt >10, >20, >40, >80
  .byt >100, >200, >400, >800
  .byt >1000, >2000, >4000, >8000
  .byt >10000, >20000, >40000
