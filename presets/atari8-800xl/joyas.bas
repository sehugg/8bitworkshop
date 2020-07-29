'-------------------------------------
' Joyas: A match-three pieces game
'

' Character set redefinition
'/*{w:8,h:8,bpp:1,brev:1,count:13}*/
data charset() byte = $D0,$68,$34,$68,$D0,$68,$34,$68, ' 1: Wall 1
data           byte = $16,$2C,$58,$2C,$16,$2C,$58,$2C, ' 2: Wall 2
data           byte = $00,$18,$68,$44,$2C,$30,$00,$00, ' 3: Rotated square
data           byte = $00,$10,$38,$6C,$38,$10,$00,$00, ' 4: Diamond
data           byte = $00,$7C,$54,$7C,$54,$7C,$00,$00, ' 5: Filled Square
data           byte = $00,$64,$2C,$10,$68,$4C,$00,$00, ' 6: Cross
data           byte = $00,$38,$4C,$5C,$7C,$38,$00,$00, ' 7: Big ball
data           byte = $00,$5C,$40,$54,$04,$74,$00,$00, ' 8: Flag?
data           byte = $00,$00,$00,$00,$00,$00,$00,$00, ' 9: Explosion
data           byte = $7C,$82,$82,$82,$82,$82,$7C,$00, '10: Cursor
data           byte = $D1,$6A,$35,$1B,$0E,$04,$00,$00, ' B: Bottom-left
data           byte = $11,$AA,$55,$BB,$EE,$44,$00,$00, ' C: Bottom
data           byte = $16,$AC,$58,$B0,$E0,$40,$00,$00  ' D: Bottom-right
';
'/*{w:8,h:8,bpp:1,brev:1,count:4}*/
data explode() byte = $00,$00,$00,$38,$54,$38,$00,$00,
data           byte = $00,$00,$24,$40,$12,$08,$44,$00,
data           byte = $00,$42,$00,$80,$00,$01,$00,$82,
data           byte = $00,$00,$00,$00,$00,$00,$00,$00
';
' Our board pieces:
data pieces() byte = $03, $44, $85, $C6, $07, $48

' Our empty board (two lines)
data eboard() byte = $80,$40,$81,$09,$09,$09,$09,$09,$09,$09,$09,$09,$09,$82,$40,$80,
data          byte = $40,$80,$81,$09,$09,$09,$09,$09,$09,$09,$09,$09,$09,$82,$80,$40
data lboard() byte = $80,$40,$8B,$8C,$8C,$8C,$8C,$8C,$8C,$8C,$8C,$8C,$8C,$8D,$40,$80

' Set graphics mode and narrow screen
graphics 18
poke 559, 33

' Redefine character set
move $E000, $7C00, 512
move adr(charset), $7C08, 104
poke 756, $7C

' Set colors
if peek($d014) = 1
  ' PAL
  se. 0,3,8
  se. 1,11,10
  se. 2,8,6
  se. 3,14,14
else
  ' NTSC
  se. 0,4,8
  se. 1,12,10
  se. 2,9,6
  se. 3,2,14
endif

' Memory area for the board
mainBoard = $7000 + 19
fullBoard = $7000 + 16
' Clear board, needed to detect bad moves
mset $7000, 192, 0

hiScore = 0
screen = dpeek(88)
screenBoard = screen + 3
C = mainBoard - screenBoard

' Loop forever
do

  ' Clear board
  for i=0 to 4
    move adr(eboard), fullBoard+i*32, 32
  next i

  ' Init game variables
  score = 0     ' Score
  nmoves = 15   ' Remaining moves
  addMove = 16  ' Points to bonus
  crsPos = 0    ' Cursor pos

  ' Clear the screen
  mset screen, 176, 0
  position 0, 0

  ' Show game info
  print #6, , , " joyas", , , "HI SCORE:"; hiScore
  print #6, "BUTTON: game"

  ' Wait for button press and release
  repeat : until not strig(0)
  repeat : until strig(0)

  ' Disable attract mode
  poke 77,0
  ' Draw bottom of board
  move adr(lboard), screen+160, 16

  ' Call game loop
  while nmoves > 0
    exec GameLoop
  wend

  if hiScore < score then hiScore = score

loop

'-------------------------------------
' Move the cursor and wait for play
proc MoveCursor

  ' Loop
  do
    ' Disable attract mode
    poke 77,0

    ' Wait for valid move
    repeat
      ' Show cursor
      poke crsPos+screenBoard, 192+10
      pause 1
      ' Remove cursor
      poke crsPos+screenBoard, peek(crsPos+mainBoard)
      pause 1
      ' Move cursor
      i = stick(0)
      nxtPos = (i=7) - (i=11) + 16 * ((i=13) - (i=14)) + crsPos
    until nxtPos <> crsPos and peek(nxtPos + mainBoard) & 63 > 2

    ' If button is pressed, return
    if not strig(0) then Exit

    ' Move cursor
    crsPos = nxtPos
  loop

endproc


'-------------------------------------
' Make pieces fall in the board
proc FallPieces

  ' Loop until there are holes in the board
  repeat

    endFall = 1

    ' Move board to screen
    move fullBoard, screen, 160

    ' Search for holes in the board
    for A=mainBoard to mainBoard + 151 step 16
      for P=A to A+9
        if peek(P) & 63 = 9
          ' If we found a hole, fall pieces!
          i = P
          while i > mainBoard + 15
            poke i, peek(i-16)
            i = i-16
          wend
          ' Set new piece and set A to exit outer loop
          poke i, pieces(rand(6))
          A = mainBoard + 152
          endFall = 0
        endif
      next P
    next A
  until endFall

endproc

'-------------------------------------
' Search matching pieces and remove
proc MatchPieces

  ' Number of matches found
  lsize = 0

  ' Go through each line
  for A = screenBoard to screenBoard + 151 step 16
    ' And through each column
    for X=A to A+9
      P = peek(X)
      ' Test if equal to the next two pieces
      if P = peek(X+1) and P = peek(X+2)
        ' Transform screen pointer to board pointer
        Y = X + C
        ' Clean the three pieces found
        PC = (P & 192) + 9
        poke Y, PC
        poke Y+1, PC
        poke Y+2, PC
        inc lsize
      endif

      ' Test if equal to the two pieces bellow
      IF P = peek(X + 16) and P = peek(X + 32)
        ' Transform screen pointer to board pointer
        Y = X + C
        ' Clean the three pieces found
        PC = (P & 192) + 9
        poke Y, PC
        poke Y + 16, PC
        poke Y + 32, PC
        inc lsize
      endif
    next X
  next A

  if lsize
    ' Found a line, add to score and show a little animation
    score = score + lsize * lsize
    move fullBoard, screen, 160

    for i = 0 to 3
      sound 1, 80, 0, 10 - i * 3
      ' Set animation frame
      move i*8 + adr(explode), $7C48, 8
      pause 4
    next i
  endif

  ' Add one move at 16, 32, 64, etc. points
  if score >= addMove
    inc nmoves
    addMove = addMove * 2
  endif

  ' Print current score and moves left
  position 18, 8
  print #6, "score "; score; "/"; nmoves,
  sound

endproc

'-------------------------------------
' Our main game loop
proc GameLoop

  ' Update number of moves
  dec nmoves

  ' Loop until no pieces are left to move
  repeat
    exec FallPieces
    exec MatchPieces
  until not lsize

  ' Game over if no more moves
  if nmoves < 1 then exit

  exec MoveCursor

  ' Perform an exchange
  poke crsPos + mainBoard, peek(nxtPos + screenBoard)
  poke nxtPos + mainBoard, peek(crsPos + screenBoard)
  sound 0, 100, 10, 10
  pause 2
  sound

endproc

