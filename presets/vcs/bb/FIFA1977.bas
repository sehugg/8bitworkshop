 rem **************************************************************************
 rem Fifa 1977 (1977 is when the Atari2600 came out) 
 rem 1v1 soccer match between two players
 rem Players can move about using the joystick directions
 rem ball moves in front of the player currently in possesion of it
 rem Players cannot get too close to opponents goal
 rem Players can shoot the ball using joystick fire button
 rem Players can intercept the ball when it is kicked to gain posession
 rem Players can also steal the ball from the other player
 rem Reset game by pressing reset button
 rem **************************************************************************

 set tv ntsc
 set romsize 4k
 rem **************************************************************************
 rem Playfield and players setup:
 rem - shape of the playfield and player sprites
 rem **************************************************************************
 playfield:
 XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 X....X...................X....X
 X.............................X
 X.............................X
 X.............................X
 X.............................X
 X.............................X
 X.............................X
 X.............................X
 X....X...................X....X
 XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
end

 player0:
 %00100010
 %00010100
 %00001000
 %00111110
 %00001000
 %00011100
 %00011100
 %00011100
end

 player1:
 %01000100
 %00101000
 %00010000
 %01111100
 %00010000
 %00111000
 %00111000
 %00111000
end


 rem **************************************************************************
 rem Setup: 
 rem - set initial values
 rem **************************************************************************
 COLUBK = $0F
 NUSIZ0 = $30
 score = 00000 :  scorecolor = $08
 a = 75
 b = 75
 c = 75
 d = 25
 z = 0
 p = 0
 player0x = a : player0y = b
 player1x = c : player1y = d
 ballx = x : bally = y

 rem **************************************************************************
 rem Main loop: 
 rem - set colors and record last coordinates of player sprites
 rem **************************************************************************
main
 COLUP1 = $80
 COLUP0 = $40
 COLUBK = $C4
 COLUPF = $0E
 e = a
 f = b
 g = c
 h = d

 rem **************************************************************************
 rem Draw loop: 
 rem - Draws the screen and handles user input. Moves the sprites and
 rem - the ball's position and handles collisions
 rem **************************************************************************
draw
 drawscreen

 if joy0left then a = a - 1
 if joy0up then b = b - 1
 if joy0down then b = b + 1
 if joy0right then a = a + 1
 if joy1left then c = c - 1
 if joy1up then d = d -1
 if joy1down then d = d + 1
 if joy1right then c = c + 1
 if p = 0 &&  joy0fire then z = 1
 if p = 1 && joy1fire then z = 2
 if z = 0 && p = 0 then ballx = a + 5 : bally = b - 10
 if z = 0 && p = 1 then ballx = c + 4 : bally = d + 2
 if z = 1 then bally = bally - 1 
 if z = 2 then bally = bally + 1
 player0x = a : player0y = b
 player1x = c : player1y = d
 if switchreset then goto hardReset
 if collision(ball, player0) then goto save0
 if collision(ball, player1) then goto save1 
 if collision(player0, playfield) then goto player0HitWall
 if collision(player1, playfield) then goto player1HitWall
 if player0y < 30 then goto player0HitWall
 if player1y > 66 then goto player1HitWall
 if collision(ball, playfield) then goto shoot
 goto main

 rem **************************************************************************
 rem Player collision:
 rem - moves player0 back to previous location entering invalid area
 rem **************************************************************************
player0HitWall
 a = e
 b = f
 goto main

player1HitWall
 c = g
 d = h
 goto main

 rem **************************************************************************
 rem Player and ball collision:
 rem - switches possession of the ball as well as making the ball 
 rem - stop moving if it was shot
 rem **************************************************************************
save0
 p = 0
 z = 0
 goto main

save1
 p = 1
 z = 0
 goto main

 rem **************************************************************************
 rem Ball collides with playfield:
 rem - handles scoring based on where in the playfield the ball collided
 rem - as well as switching who possesses the ball after scoring
 rem **************************************************************************
shoot
 if ballx > 41 && ballx < 119 then goto hit
 goto reset

hit
 if bally < 50 then goto player0Score
 if bally > 50 then goto player1Score
 goto reset

player0Score
 score = score + 1
 p = 1
 goto reset

player1Score
 score = score + 1000
 p = 0
 goto reset

 rem **************************************************************************
 rem Variable reset: 
 rem - resets player to initial positions
 rem **************************************************************************
reset
 a = 75
 b = 75
 c = 75
 d = 25
 z = 0
 goto main

 rem **************************************************************************
 rem Hard Reset:
 rem - resets the score to 0, players to initial positions, and possession
 rem - of the ball to player0
 rem **************************************************************************
hardReset
 score = 000000
 p = 0
 goto reset 