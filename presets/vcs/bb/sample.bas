 set smartbranching on
10 player1x = 40 : player1y = 40:player0x = 50 : player0y = 50
20 COLUPF = 90:missile0height=4:missile0y=255
25 score=10000
30 COLUP0 = 120
35 COLUP1 = 14
40 scorecolor = 10:NUSIZ0=16
45 player0:
 %01000010
 %11111111
 %11111111
 %01111110
 %00111100
 %00011000
 %00011000
 %00011000
end
46 player1:
 %00111100
 %00011000
 %00011000
 %00011000
 %11100111
 %10100101
 %10011001
 %00100100
end
47 a = a + 1 : if a < 3 then 55
49 a = 0
50 if player1y < player0y then player1y = player1y + 1
51 if player1y > player0y then player1y = player1y - 1
52 if player1x < player0x then player1x = player1x + 1
53 if player1x > player0x then player1x = player1x - 1
54 player1x = player1x : player1y = player1y
55 if missile0y>240 then 58
57 missile0y=missile0y-2:goto 59
58 if joy0fire then missile0y=player0y-2:missile0x=player0x+4
59 drawscreen
60 if collision(missile0,player1) then score=score+1:player1x=rand/2:player1y=0:missile0y=255
65 if collision(player0,player1) then score=score-1
70 if joy0up then player0y = player0y - 1
80 if joy0down then player0y = player0y + 1
100 if joy0left then player0x = player0x - 1
120 if joy0right then player0x = player0x + 1
140 goto 30
