 include fixed_point_math.asm
 rem Zombie Chase
 rem A fun game that may help you learn batari Basic!
 rem

 rem timed game, 16 levels
 rem Each level lasts about one minute
 rem you must score 1000 points to move on
 rem COLOR/BW switch selects joystick or DC
 rem left difficulty A=stop on collision; B=slow down on collision
 rem right difficulty A=L/R border; B=no border

 set kernel_options no_blank_lines player1colors
 playfieldpos=4
 set smartbranching on

 dim carpos=a
 dim turndelay=b
 dim collcount=b
 dim carframe=c
 dim gamebits=e
 dim velocity=f.f
 dim xvelocity=g.g
 dim yvelocity=h.h
 dim tempvel=i.i
 dim finalxvelocity=l.l
 dim finalyvelocity=m.m

 dim p0x=player0x.j
 dim p0y=player0y.k
 dim last=n

 dim scadd=o
 dim timer1=p
 dim timer2=q
 dim level=q
 rem level bits
 rem bit 0: zombie speed (slow/fast)
 rem bit 1: zombie movement (random/run away)
 rem bit 2: car speed (slow/fast)
 rem bit 3: road surface (pavement/ice)

 dim tempvel8=temp1.temp2

 dim zombievel=temp5.temp6
 dim zombiexvel=r
 dim zombieyvel=s
 dim zombiefinalxvel=t
 dim zombiefinalyvel=u
 dim zombiexpos=player1x.v
 dim zombieypos=player1y.w

 dim sc1=score
 dim sc2=score+1

 rem 
 rem velocity doesn't change when direction changes
 rem xvelocity and yvelocity change
 rem they change instantly when velocity <= 0.5 max
 rem they change gradually when velocity > 0.5 max

 carpos = 4
 rem turndelay = 0
 player0x = 40 : player0y = 40
startLoop
 if turndelay{1} then player1: 
        %00100010
        %00010100
        %00111110
        %00111111
        %00011011
        %11111001
        %00101000
        %00010000
end
 if !turndelay{1} then player1:
        %00010100
        %00100010
        %00111110
        %00111111
        %00011011
        %11111010
        %00101000
        %00010000
end

 player1color:
    $38;
    $3A;
    $F4;
    $F6;
    $0C;
    $1A;
    $D8;
    $D2;
end
 scorecolor=30
 if switchreset then reboot
 if switchrightb then PF0=0 else PF0=63 
 COLUPF=(level * 16)^244
 if gamebits{7} then gamerunning
 if !joy0fire then timer1=timer1+1
 if timer1=0 then nostartgame
 if joy0fire then score=0:timer1=0:timer2=0:gamebits{7}=1:pfclear
nostartgame
 AUDV0=0:AUDV1=0:goto hitwall
gamerunning
 timer1=timer1+1:if timer1=0 then timer2=timer2+$10
 if timer2<$C0 then notendlevel
 temp1=level & $0F
 temp2=sc1*16+sc2/16
 temp1=level & $0F
 if temp2<gonextlevel[temp1] && timer1{5} then scorecolor=64
 if timer2<$F0 then notendlevel
 if temp2>=gonextlevel[temp1] then level=level+$11:pfclear else gamebits{7}=0
notendlevel
 gosub movezombie
 if collcount<16 then skipcrashsound
 collcount=collcount-16
 AUDV0=collcount/16
 AUDC0=8
 if collcount{3} then AUDF0=(collcount&rand)/8 else AUDF0=17
 goto skipenginesound
skipcrashsound
 collcount{3}=0
 AUDV0=10:AUDC0=2
 AUDF0=18-f/4:if f>67 then AUDF0=1
skipenginesound

 if joy0fire then velocity=velocity+0.0625:goto nomove1
 gamebits=gamebits^%00000100
 if gamebits{2} then nomove1
 velocity=velocity-0.0625
nomove1
 if level{2} then temp1=96 else temp1=64
 if gamebits{4} then temp1=16
 if velocity > temp1 && velocity < 192 then velocity=velocity-0.0625
 if velocity>240 then velocity=0

 if !level{3} then COLUBK=0 else COLUBK=154

 on carpos goto a0 a1 a2 a3 a4 a5 a6 a7 a8 a9 a10 a11 a12 a13 a14 a15
a0 rem 0 (due north, or up)
 xvelocity=0:yvelocity=0-velocity
 goto skipskid
a1 rem 22.5
 tempvel=velocity/8
 xvelocity=tempvel:yvelocity=tempvel-velocity
 tempvel=velocity/4
 xvelocity=xvelocity+tempvel
 goto skipskid
a2 rem 45
 tempvel=velocity/4
 xvelocity=velocity/2
 if xvelocity{7} then xvelocity=xvelocity | %10000000
 xvelocity=xvelocity+tempvel:yvelocity=0-xvelocity
 goto skipskid
a3 rem 67.5
 tempvel=velocity/8
 xvelocity=velocity-tempvel:yvelocity=0-tempvel
 tempvel=velocity/4
 yvelocity=yvelocity-tempvel
 goto skipskid
a4 rem 90
 xvelocity=velocity:yvelocity=0
 goto skipskid
a5 rem 112.5
 tempvel=velocity/8
 xvelocity=velocity-tempvel:yvelocity=tempvel
 tempvel=velocity/4
 yvelocity=yvelocity+tempvel
 goto skipskid
a6 rem 135
 tempvel=velocity/4
 xvelocity=velocity/2
 if xvelocity{7} then xvelocity=xvelocity | %10000000
 xvelocity=xvelocity+tempvel:yvelocity=xvelocity
 goto skipskid
a7 rem 157.5
 tempvel=velocity/8
 xvelocity=tempvel:yvelocity=velocity-tempvel
 tempvel=velocity/4
 xvelocity=xvelocity+tempvel
 goto skipskid
a8 rem 180
 xvelocity=0:yvelocity=velocity
 goto skipskid
a9 rem 202.5
 tempvel=velocity/8
 xvelocity=0-tempvel:yvelocity=velocity-tempvel
 tempvel=velocity/4
 xvelocity=xvelocity-tempvel
 goto skipskid
a10 rem 225
 tempvel=velocity/4
 xvelocity=velocity/2
 yvelocity=tempvel+xvelocity:xvelocity=0-xvelocity
 goto skipskid
a11 rem 247.5
 tempvel=velocity/8
 xvelocity=tempvel-velocity:yvelocity=tempvel
 tempvel=velocity/4
 yvelocity=yvelocity+tempvel
 goto skipskid
a12 rem 270
 xvelocity=0-velocity:yvelocity=0
 goto skipskid
a13 rem 292.5
 tempvel=velocity/8
 xvelocity=tempvel-velocity:yvelocity=0-tempvel   
 tempvel=velocity/4
 yvelocity=yvelocity-tempvel
 goto skipskid
a14 rem 315
 tempvel=velocity/4
 xvelocity=velocity/2
 xvelocity=tempvel+xvelocity:xvelocity=0-xvelocity:yvelocity=xvelocity
 goto skipskid
a15 rem 337.5 
 tempvel=velocity/8
 xvelocity=0-tempvel:yvelocity=tempvel-velocity
 tempvel=velocity/4
 xvelocity=xvelocity-tempvel


skipskid
 if velocity{7} then reboot
 if !gamebits{0} then finalxvelocity=xvelocity:finalyvelocity=yvelocity:AUDV1=0:goto noskid else skid
 if velocity<32 then finalxvelocity=xvelocity:finalyvelocity=yvelocity:AUDV1=0:goto noskid
 if finalxvelocity = xvelocity && finalyvelocity = yvelocity then AUDV1=0:goto noskid
 
skid
 rem lost traction...skid
 gamebits{5}=0
 gamebits{6}=0

 if xvelocity>127 && finalxvelocity>127 then bothxneg
 if xvelocity<128 && finalxvelocity<128 then bothxpos
 if xvelocity>127 then subx else addx
bothxneg
 temp1=(finalxvelocity ^ xvelocity) & %11111100
 if temp1=0 then finalxvelocity=xvelocity:gamebits{5}=1:goto checky
 if finalxvelocity<xvelocity then addx
subx
 if level{3} then finalxvelocity=finalxvelocity-0.0625 else finalxvelocity=finalxvelocity-0.3
 goto checky

bothxpos
 temp1=(finalxvelocity ^ xvelocity) & %11111100
 if temp1=0 then finalxvelocity=xvelocity:gamebits{5}=1:goto checky
 if finalxvelocity>xvelocity then subx
addx
 if level{3} then finalxvelocity=finalxvelocity+0.0625 else finalxvelocity=finalxvelocity+0.3
 

checky
 if yvelocity>127 && finalyvelocity>127 then bothyneg
 if yvelocity<128 && finalyvelocity<128 then bothypos
 if yvelocity>127 then suby else addy
bothyneg
 temp1=(finalyvelocity ^ yvelocity) & %11111100
 if temp1=0 then finalyvelocity=yvelocity:gamebits{6}=1:goto doneskid
 if finalyvelocity<yvelocity then addy
suby
 if level{3} then finalyvelocity=finalyvelocity-0.0625 else finalyvelocity=finalyvelocity-0.3
 goto doneskid

bothypos
 temp1=(finalyvelocity ^ yvelocity) & %11111100
 if temp1=0 then finalyvelocity=yvelocity:gamebits{6}=1:goto doneskid
 if finalyvelocity>yvelocity then suby
addy
 if level{3} then finalyvelocity=finalyvelocity+0.0625 else finalyvelocity=finalyvelocity+0.3

doneskid
 if gamebits{5} && gamebits{6} then gamebits{0}=0:AUDV1=0:goto noskid

 rem skid sound
 temp6=rand
 if temp1{6} then AUDV1=9

 rem if temp6{0} then AUDC1=3:AUDF1=0 else AUDC1=3:AUDF1=1
 rem AUDV1=temp6&3
 if level{3} then temp1=8 else temp1=20
 AUDC1=temp1
 if temp6{0} then AUDF1=temp1+4 else AUDF1=temp1+5


noskid
 rem gamebits=gamebits^%00000010
 rem if gamebits{1} then donotadd
 
 tempvel8=finalxvelocity
 asm
 lda temp1
 asl
 ror temp1
 ror temp2
end
 p0x=p0x+tempvel8

 tempvel8=finalyvelocity
 asm
 lda temp1
 asl
 ror temp1
 ror temp2
end

 p0y=p0y+tempvel8
donotadd

 if player0x>200 then player0x=159:goto wrap
 if player0x>159 then player0x=0
wrap
 if player0y>200 then player0y=96
 if player0y>96 then player0y=0

 if switchbw then driving
 turndelay = turndelay + 1
 turndelay = turndelay & %11111011
 temp1=turndelay&3
 if temp1 <> 0 goto SameFrame


 if joy0left then carpos=carpos-1:gamebits{0}=1
 if joy0right then carpos=carpos+1:gamebits{0}=1
 goto nodriving

driving rem read driving controller
 temp1=SWCHA & %00110000
 temp1=temp1/16
 on last goto d00 d01 d10 d11
d00 on temp1 goto nomove left right nomove
d01 on temp1 goto right nomove nomove left
d11 on temp1 goto nomove right left nomove
d10 on temp1 goto left nomove nomove right
 rem done with reading code
left carpos=carpos-1:gamebits{0}=1
 goto nomove
right carpos=carpos+1:gamebits{0}=1
nomove
 last=temp1
nodriving
 carpos=carpos & 15

 gosub carFrame

SameFrame
 COLUP0 = 14
 REFP0=gamebits 
 if scadd>0 then scadd=scadd-1:score=score+1

 if !collision(player0,player1) then nohitzombie
 scadd=scadd+f
 collcount=collcount|$F8
 if player1x<16 || player1x>143 then notombstone
 temp1=(player1x-16)/4:temp2=(player1y-4)/8
 pfpixel temp1 temp2 on
notombstone
 player1x=rand&63+48:if player1x{0} then player1y=0 else player1y=90

nohitzombie
 if gamebits{4} then insidewall
 if collcount>16 then hitwall
 if !collision(player0,playfield) then insidewall
 if !switchleftb then velocity=0
 gamebits{4}=1:collcount=collcount | $F0:collcount{3}=0:goto hitwall
insidewall
 if !collision(player0,playfield) then gamebits{4}=0:goto hitwall
 if velocity>16 then velocity=velocity-0.1875

hitwall
 drawscreen

 goto startLoop


carFrame


 carframe = 0
 if carpos < 9 then carframe = carpos : gamebits{3}= 0
 if carpos >= 9 then carframe = 16 - carpos : gamebits{3} = 1




 on carframe goto 5 10 20 30 40 50 60 70 80 





5 player0:
  %11000011
  %11111111
  %11011011
  %00011000
  %11011011
  %11111111
  %11011011
  %00011000
end
 goto doneSetFrame

10 player0:
 %00000110
 %00111110
 %11110000
 %11011011
 %00011111
 %11111000
 %11001100
 %00000100

end
 goto doneSetFrame

20 player0:
 %00001100
 %00001100
 %00110011
 %00111011
 %11011100
 %11001100
 %00110010
 %00110000
end
 goto doneSetFrame

30 player0:
 %00110110
 %00110110
 %01100100
 %01111110
 %01011110
 %11001011
 %11011000
 %00011000
end
 goto doneSetFrame

40 player0:
 %11101110
 %11101110
 %01000100
 %01111111
 %01111111
 %01000100
 %11101110
 %11101110
end
 goto doneSetFrame

50 player0:
 %00011000
 %11011000
 %11001011
 %01011110
 %01111110
 %01100100
 %00110110
 %00110110
end
 goto doneSetFrame

60 player0:
 %00110000
 %00110010
 %11001100
 %11011100
 %00111011
 %00110011
 %00001100
 %00001100
end
 goto doneSetFrame

70 player0:
 %00000100
 %11001100
 %11111000
 %00011111
 %11011011
 %11110000
 %00111110
 %00000110
end
 goto doneSetFrame

80 player0:
  %00011000
  %11011011
  %11111111
  %11011011
  %00011000
  %11011011
  %11111111
  %11000011
end
doneSetFrame

 return

movezombie
 temp1=zombiexvel&252:temp2=zombieyvel&252:temp3=zombiefinalxvel&252:temp4=zombiefinalyvel&252
 if temp1<>temp3 then check24
 zombiefinalxvel=rand
 if level{1} then temp1=player1x-player0x:zombiefinalxvel{7}=temp1{7}
check24
 if temp2<>temp4 then donecheck24
 zombiefinalyvel=rand
 if level{1} then temp1=player1y-player0y:zombiefinalyvel{7}=temp1{7}
donecheck24
 if zombiexvel{7} && !zombiefinalxvel{7} then zombiexvel=zombiexvel+1:goto donex
 if !zombiexvel{7} && zombiefinalxvel{7} then zombiexvel=zombiexvel-1:goto donex
 if zombiexvel>zombiefinalxvel then zombiexvel=zombiexvel-1 else zombiexvel=zombiexvel+1
donex
 if zombieyvel{7} && !zombiefinalyvel{7} then zombieyvel=zombieyvel+1:goto doney
 if !zombieyvel{7} && zombiefinalyvel{7} then zombieyvel=zombieyvel-1:goto doney
 if zombieyvel>zombiefinalyvel then zombieyvel=zombieyvel-1 else zombieyvel=zombieyvel+1
doney
 temp5=0
 if zombiexvel{7} then temp5=255
 temp3=0
 if zombieyvel{7} then temp3=255
 temp6=zombiexvel:temp4=zombieyvel
 zombiexpos=zombiexpos+zombievel
 temp6=temp4:temp5=temp3
 zombieypos=zombieypos+zombievel
 if player1y>100 then player1y=0
 if player1y>$50 then zombiefinalyvel=(zombiefinalyvel^127)|128:zombieyvel=(zombieyvel^127)|128
 if player1y<10 then zombiefinalyvel=(zombiefinalyvel^127)&127:zombieyvel=(zombieyvel^127)&127
 if player1x>200 then player1x=player1x+160
 if player1x>160 then player1x=player1x-160
 REFP1=zombiexvel/16
 return

 data gonextlevel
 1,2,3,4,5,6,7,8,9,$10,$11,$12,$13,$14,$15,$99
end

 vblank
 if gamebits{7} && level{0} then gosub movezombie
 return
