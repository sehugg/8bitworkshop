 include div_mul.asm
 set kernel_options no_blank_lines
 set romsize 8kSC
 set smartbranching on
 const pfres=32
 pfclear
 player0x=10:player0y=7
 player0:
 %11000000
 %01100000
 %00110001
 %00011011
 %00001111
 %00011111
 %00111111
end
gameloop
 COLUP0=15
 COLUPF=203
 if joy0left then player0x=player0x-1:if player0x<10 then player0x=10
 if joy0right then player0x=player0x+1:if player0x>137 then player0x=137
 if joy0up then player0y=player0y-1:if player0y<7 then player0y=7
 if joy0down then player0y=player0y+1:if player0y>99 then player0y=99
skipjoy
 if joy0fire then gosub plot
 drawscreen
 goto gameloop
plot
 rem convert player position to playfield pixel
 rem divide by 3 vertically
 g=(player0y-7)/3
 h=(player0x-10)/4
 if g=i && j=h then return
 i=g:j=h
 pfpixel h g flip
 return
