' P/M test program

graphics 0          ' Setups graphics mode
pmgraphics 2        ' And P/M mode
P0Mem = pmadr(0)    ' Get player 0 address
oldPos = P0Mem      ' and into "old position"

mset P0Mem, 128, 0  ' Clears P/M 0 Memory
setcolor -4, 1, 15

' P/M data and blank (to clear P/M)
DATA PMdata()  byte = $38,$44,$54,$44,$38

' Initial Conditions
xPos = 6400 : yPos = 2560
xSpd =   64 : ySpd =    0

repeat
 xPos = xPos + xSpd : yPos = yPos + ySpd
 ySpd = ySpd + 2
 if (ySpd > 0) and (yPos > 12800)
   ySpd = -ySpd
   xSpd = Rand(512) - 256
 endif
 if xSpd > 0
  if xPos > 25600 Then xSpd = -xSpd
 else
  if xPos <  6400 Then xSpd = -xSpd
 endif
 exec MovePm  ' Move P/M Graphics
until Key()

graphics 0

END

proc MovePm
 x = xPos / 128 : y = P0Mem + yPos / 128
 poke $D01A,$74 ' Change background color
 pause 0
 pmhpos 0, x            ' Set new horizontal position
 mset oldPos, 5, 0      ' Clear old sprite
 move adr(PMdata), y, 5 ' Draw at new vertical pos.
 oldPos = y
endproc
