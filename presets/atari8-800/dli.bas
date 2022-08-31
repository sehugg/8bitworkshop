' Define the DLI: set background
' color to $24 = dark red.
DLI SET d1 = $24 INTO $D01A
' Setups screen
GRAPHICS 0
' Alter the Display List, adds
' a DLI at line 11 on the screen
POKE DPEEK(560) + 16, 130
' Activate DLI
DLI d1
' Wait for any keyu
? "Press a Key" : GET K
' Disable the DLI
DLI

? "Again..."
GET K

' An array with color values
DATA Colors() BYTE = $24,$46,$68
' Define the DLI: set background
' color from the Color() array
' and text color with value $80
DLI SET d2 = Colors INTO $D01A, $80 INTO $D018
' Setups screen
GRAPHICS 0
' Adds DLI at three lines:
POKE DPEEK(560) + 13, 130
POKE DPEEK(560) + 16, 130
POKE DPEEK(560) + 19, 130
' Activate DLI
DLI d2
' Wait for any keyu
? "Press a Key" : GET K
' Disable the DLI
DLI

? "Again..."
GET K

' Player shapes, positions and colors
DATA p1() BYTE = $E7,$81,$81,$E7
DATA p2() BYTE = $18,$3C,$3C,$18
DATA pos() BYTE = $40,$60,$80,$A0
DATA c1() BYTE = $28,$88,$C8,$08
DATA c2() BYTE = $2E,$80,$CE,$06
' Our DLI writes the position and
' colors to Player 1 and Player 2
DLI SET d3 = pos INTO $D000, pos INTO $D001,
DLI        = c1 INTO $D012, c2 INTO $D013
GRAPHICS 0 : PMGRAPHICS 2
' Setup our 4 DLI and Players
FOR I = 8 TO 20 STEP 4
  POKE DPEEK(560) + I, 130
  MOVE ADR(p1), PMADR(0)+I*4+5,4
  MOVE ADR(p2), PMADR(1)+I*4+5,4
NEXT
' Activate DLI
DLI d3
? "Press a Key"
REPEAT
  PAUSE 0
  pos(0) = pos(0) + 2
  pos(1) = pos(1) + 1
  pos(2) = pos(2) - 1
  pos(3) = pos(3) - 2
UNTIL KEY()
DLI

? "Key to end..."
GET K

