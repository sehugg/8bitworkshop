 rem +-----------------------------------------+
 rem | Road Blaster        |  386 bytes free   |
 rem |   for batariBasic   |  -> tested using  |
 rem | by Steve Engelhardt |  bleeding edge    |
 rem | v0.65 (2/8/2006)    |  build 99a        |            
 rem +-----------------------------------------+
 rem
 rem Version Notes
 rem 0.42 working - car can now slow down by pressing down (Added 8.8 variables & fixed point math)
 rem 0.43 working - player car slows down when hitting side of road 
 rem 0.44 working - slowdown when player car hits enemy car
 rem 0.45 working - enemy missile causes car to bouce sideways a little
 rem 0.46 testing - added some audio code - can't test it yet (.048 removed audio code to save ROM Space)
 rem 0.47 working - Bugfix in diff A switch - made it so it only doubles size of car - no speed increase.
 rem 0.48 working - car changes colors when hit - game pauses at the end.
 rem 0.49 working - missile now properly disappears when it hits an enemy car (missile0y=0 & q=0).
 rem 0.50 working - Saved 840 bytes by changing title screen pf data to data tables. :)
 rem 0.51 working - Audio Routines added and working.
 rem 0.52 working - Bugfix - if you held down on the joystick - enemy missiles would fire from the top
 rem                of the screen before the cars appeared there.  It's been fixed.
 rem 0.53 working - Bugfix - Setting difficulty to A - now the missile fires from the center of the
 rem                double sized player car.
 rem 0.54 working - scoring change. 20pts every frame. -10 when you slow down, +10 when you speed up.
 rem 0.55 working - implementing difficulty level increase during game.
 rem                     cars start off in relatively straight track. (1st 4-7 scrolls)
 rem                     cars start zig zagging (scroll 8-21) - cars turn yellow
 rem                     cars start skidding l/r randomly (scroll 21+) - cars turn purple
 rem                     cars & missiles speed up (scroll 30+) - cars turn red
 rem 0.56 working - 2nd enemy car now turns into a powerup sprite when the other is hit.
 rem                     Powerup increases car's hitpoints by +1 per frame while it's touching it.
 rem 0.57 working - bugfix - left car doesn't disappear when shooting it at the beginning of the game.
 rem 0.58 working - bugfix - powerup code seems to be working correctly now.
 rem 0.59 working - revamping powerup code - now appears randomly, but stil causes damage to car.
 rem 0.60 working - random powerup code works.  Shooting one car will sometimes change the other
 rem                into a powerup, and sometimes it will remain a car.  The powerup that appears does actually
 rem                increase your health, and hitting the remaining car does damage...it seems to be working.
 rem 0.61 testing - Now back to trying to get that 2nd car to disappear when hit. :(. Widened the roadside.
 rem 0.62 testing - if you shoot the left car first, the cars dissappear individually now when you shoot them.
 rem                if you shoot the right car first, the left car then shifts position to the left instead
 rem                of disappearing.
 rem 0.63 working - you can now shoot each car individually, and they will both disappear individually.
 rem                powerups now appear at random, and will increase your car's health.
 rem 0.64 working - powerups now won't fire at you - the missile resets to 0 when they appear.
 rem 0.65 testing - color tweaking - road changed to brown, 3rd level cars brighter purple
 rem
 rem
 rem Dev Notes/To Do List for future revisions:
 rem
 rem X-1. Make the cars "do something" when they're hit - move down, left or right a little, or shake. Right now
 rem      enemy missiles and cars just pass right through you.
 rem        :::--> Done.
 rem X-2. Scroll Speed Tweaking -- I'll try to add the ability to slow your car down by pressing down on the
 rem      joystick make hitting the side of the road slow you down & hitting an enemy car should also slow you.
 rem        :::--> Done.
 rem X-3. Change Human Player sprite so the tires move when you go left and right.
 rem        :::--> Done.
 rem X-4. Variations on Enemy Car movement - it's pretty predictable right now.
 rem        :::--> Done, although it may need tweaking.
 rem X-5. I may play with the enemy car shots a bit - I like the moving missile now, but I could provide the option for
 rem      enemy car shots that don't move. 
 rem        :::--> I'm going to leave the enemy shots as they are.
 rem X-6. I need to add sound to the game.
 rem        :::--> Done.
 rem X-7. I may try and implement a "pause" feature with the color/bw switch -- just to see if I can do it. 
 rem        :::--> I Changed my mind - this game doesn't really need that, and I'm running out of free bytes. 
 rem X-8. Update Car Sprites - they're functional but could be better.
 rem        :::--> Done.
 rem X-9. Increase scoring rate when driving faster; decrease when driving slower.
 rem        :::--> Done.
 rem X10. Progressively increase difficulty
 rem        :::--> It works, but may need to be tweaked later.
 rem X11. Add in a way to repair your car; perhaps by picking up an object off the road or something;
 rem      or just repairing at certain point levels  rem (evey 20,000 points? Every 50,000?)
 rem        :::--> Cars are repaired by picking up powerups.  A powerup appears in place of the 2nd car when one is hit.
 rem X12. If a powerup appears, make sure it doesn't fire at you.
 rem        :::--> Done.
 rem  13. Make sure cars don't scroll off the road.
 rem        :::--> Testing, testing, testing.
 rem
 rem
 rem V103 Changes
 rem   Right Difficulty switch will now remove roadblocks
 rem   Color/BW switch toggles between normal mode and invincible (practice) mode
 rem   Title Screen Changed
 rem   Road narrowed, the wide road caused the screen to roll on real hardware
 rem   Erratic l/r movement removed on fastest enemy car speed
 rem
 rem V105 Changes
 rem   Audio sound added to death
 rem   Road flashes at death
 rem   time screen pauses at death increased a little bit
 rem   Powerups do not appear if you're pushing up on the joystick to go faster.
 rem   scroll speed slows when you slow down, does not increase when you push up.
 rem
init
 include fixed_point_math.asm
 set romsize 8k
 rem set debug cycles
 rem 
 rem ** Use 8.8 variables for enemy car & missile scrolling
 rem
 dim scroll=m.n
 dim mis=k.j
 rem
 rem -------------
 rem Set Variables
 rem -------------
 a=0  : rem A = The Enemy Car's X Position + 8
 b=82 : rem X Position of Ball
 c=0  : rem Hitpoint Counter for Enemy Car Collision
 d=0  : rem
 rem e is not used
 f=0  : rem counter
 rem g is not used
 h=0  : rem H is used as a flag to know when NUSIZ1 has been changed to 0
 i=0  : rem Flag for Displaying Title Screen
 j=0  : rem part of mis 8.8 variable
 k=0  : rem part of mis 8.8 variable
 rem l=0  : rem l is a random number generator for choosing enemy car sprites
 m=0  : rem part of scroll 8.8 variable
 n=0  : rem part of scroll 8.8 variable
 o=0  : rem counter
 p=85 : rem Y Position of Player 0 (Human Car)
 q=0  : rem missile0 firing
 r=0  : rem pause timer
 s=30
 scroll=1.0  : rem Y Position of Player 1 (Enemy Car)
 t=0  : rem Scroll counter 
 u=94 : rem X Position of Player 1 (Enemy Car)
 rem v=0  : rem V is random number generator for placing roadblocks
 W=0  : rem color flag
 x=75 : rem X Position of Player 0 (Human Car)
 y=16 : rem color cycler
 z=0  : rem Z is a flag - when it equals 1, an enemy car has been hit by a missile.
 mis=1.0
 missile0x=0:missile0y=0
 missile1x=0:missile1y=0
 COLUP1=208:COLUP0=0
 rem
 rem -------------
 rem Set Colors
 rem -------------
 COLUPF=160: rem was 144
 COLUBK=0
 CTRLPF=$35
 scorecolor=246
 rem
 rem -----------------------------
 rem Draw RoadBlaster Title Screen
 rem -----------------------------
intro
 g=g+1
 if g=2 then pfscroll down :g=0
 y=y+1
 if y<17 then y=16
 if y>29 then y=16
 rem
 rem -----------------------------
 rem Draw RoadBlaster Title Screen
 rem -----------------------------
 pfpixel 7 1 on : pfpixel 25 1 on 
 pfpixel 7 2 on : pfpixel 25 2 on 
 pfpixel 7 3 on : pfpixel 25 3 on
 pfpixel 7 4 on : pfpixel 25 4 on 
 pfpixel 7 5 on : pfpixel 25 5 on 
 pfpixel 7 6 on : pfpixel 25 6 on 
 pfpixel 7 7 on : pfpixel 25 7 on
 pfpixel 7 8 on : pfpixel 25 8 on 
 pfpixel 7 9 on : pfpixel 25 9 on 
 COLUP0=64
 COLUP1=y:rem was 46
 NUSIZ1=$05
 NUSIZ0=$27
 AUDV0=0:AUDV1=0
 player1:
 %00100011
 %00100100
 %00111110
 %00100001
 %00111110
 %00000000
 %00000000
 %00011111
 %00100000
 %00111100
 %00100000
 %00011111
 %00000000
 %00000000
 %00000100
 %00000100
 %00000100
 %00111111
 %00000000
 %00000000
 %00111111
 %00000001
 %00111111
 %00100000
 %00111111
 %00000000
 %00000000
 %00100001
 %00111111
 %00100001
 %00011110
 %00000000
 %00000000
 %00111111
 %00100000
 %00100000
 %00100000
 %00000000
 %00000000
 %00111110
 %00100001
 %00111110
 %00100001
 %00111110
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00111110
 %00100001
 %00100001
 %00111110
 %00000000
 %00000000
 %00100001
 %00111111
 %00100001
 %00011110
 %00000000
 %00000000
 %00111111
 %00100001
 %00100001
 %00111111
 %00000000
 %00000000
 %00100011
 %00100100
 %00111110
 %00100001
 %00111110
end
 player0:
 %00000000
 %01000010
 %01111110
 %01111110 
 %00111100 
 %00011000 
 %00011000 
 %00011000 
 %10011001 
 %10011001 
 %11111111 
 %11111111 
 %10011001 
 %10011001 
 %00011000 
 %00011000 
 %00011000 
 %00011000 
 %10011001 
 %10011001 
 %11111111 
 %11111111 
 %10011001
 %10011001 
 %00011000
 %00011000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00000000
 %00011000
 %00011000
 %10111101
 %10111101
 %11111111
 %11111111
 %10111101
 %10111101
 %00111100
 %00111100
 %00111100
 %10111101
 %10100101
 %11100111
 %11100111
 %11100111
 %10111101
 %10111101
 %00111100
 %00011000
 %01111110
 %01000010
 %01111110
 %01000010
end
 drawscreen
 player1x=68:player1y=82
 player0x=88:player0y=83
 missile0height=2
 e=e+1
 missile0x=104:missile0y=s
 if s>52 then s=30
 if e=2 then s=s+1:e=0
 rem if s>52 then s=30
 t=0
 if i=1 then goto main
 rem
 rem ** when the game starts, flip the titlscreen off to clear the playfield
 rem
 if joy0down then i=1 : score=0 : g=0:i=0:goto intro2         : rem restart game if joystick is pushed down
 if switchreset then i=1 : score=0 : g=0:i=0:goto intro2      : rem restart game if the reset switch is pressed
 if joy0fire then i=1: score=0 : g=0:i=0:goto intro2
 goto intro
intro2
 gosub MakeNewCar1
 s=0
 g=0
 e=0
 missile0x=0:missile0y=0
 rem --------------
 rem Main Game Loop
 rem --------------
main
 y=y+1
 if y>250 then y=1
 rem if u>120 then u=u-1
 rem if u<64 then u=u+1
 if c<1 then c=1
 if switchbw then c=0 : rem if c=0, invincible mode
 if joy0up then goto audskip
 if joy0down then goto audskip
 AUDF0=18:AUDC0=14:AUDV0=10
 rem if scroll counter goes over 240, reset it back to highest speed level.
 if t>240 then t=31
audskip
 if scroll > 90 then o=0
 if scroll > 96 then w=0 : h=0 
 if scroll > 96 then u=94
 rem
 rem ** scroll is the Y Position of Enemy Car -- If the Y Position is less than 94, Scroll car down.
 rem ** T is a scroll counter.  Every time the cars scroll through the screen once, t is incremented.
 rem
 e=e+1
 if e=2 && t < 10 then e=0:goto skipscroll
 if scroll < 97 then scroll=scroll+1.0 else scroll=0.0 : t=t+1
 if scroll < 97 && t > 35 then scroll=scroll+0.9 : mis=mis+0.9 : rem incr speed after 30 scrolls (Level 4)
skipscroll
 gosub CarCreate
 rem
 rem -------------------------------------
 rem Random Enemy Car & Roadblock Behavior
 rem -------------------------------------
 rem 
 rem if framecounter is less than 8, the cars will follow a straight track.
 v=rand 
 if t > 30 then skipmv
 if t < 8 then goto skipmv          : rem if framecounter is less than eight, skip l/r bouncing. (Level 1->2)
 rem if t > 20 && v > 215 then u=u-1    : rem randomly 'skids' computer car to the Left after 21 frames (Level 3)
 if t > 20 && v < 35 then u=u+1     : rem randomly 'skids' computer car to the Right after 21 frames
skipmv
 rem
 rem ** The following will randomly generate the roadblock at 9 different X Positions.
 rem ** B is the X Position of the Ball
 rem
 if v=2 && scroll > 86 then b = 75       : rem Create Roadblock at X Position 75 
 if v=234 && scroll > 86 then b = 105    : rem Create Roadblock at X Position 105
 if v=112 && scroll > 86 then b = 89     : rem Create Roadblock at X Position 89
 if v=50  && scroll > 86 then b = 81     : rem Create Roadblock at X Position 81
 if v=188 && scroll > 86 then b = 115    : rem Create Roadblock at X Position 115
 if v=166 && scroll > 86 then b = 79     : rem Create Roadblock at X Position 79
 if v=132 && scroll > 86 then b = 95     : rem Create Roadblock at X Position 95
 if v=176 && scroll > 86 then b = 111    : rem Create Roadblock at X Position 111
 rem if v=209 && scroll > 86 then b = 120: rem Create Roadblock at X Position 120
 if v < 10 then u=u+1  : rem cars start out in relatively straight track
 if v > 245 then u=u-2 : rem as soon as they hit a wall, they will start zig zagging
 if d>0 then COLUP1=22 : rem level 2 car color is yellow (if d is over 0, car is zigzagging)
 if t>20 && t<36 then COLUP1=104 : rem level 3 car color is purple
 if t>35 then COLUP1=68           : rem level 4 car color is red
 rem
 rem D is the left/right movement flag, set when the enemy car collides with playfield (side of road)
 rem
 if d=1 then u=u+1
 if d=2 then u=u-1 
skiplr
 rem
 rem ** Player 1 is the Computer Controlled Car
 rem
 rem ** Rem D will only equal zero once - when the game first starts.
 rem ** The next line is there to make sure a car is created when the game first starts.
 rem
 rem if d=0 then gosub MakeNewCar3
 rem
 rem ** Go to subroutine that randomly picks an enemy car sprite.
 rem
 rem gosub CarCreate
 rem
 rem ** Z is a flag - when it equals 1, an enemy car has been hit by a missile.
 rem ** If the cars have scrolled off the screen (scroll>94), this flag is reset to 0.
 rem ** W is a color flag set in the carhit subroutine 
 rem
 if scroll > 96 then z=0
 rem
 rem ** Z Flag is set to 1 when collision occurs and Reset to Zero when cars scroll off the bottom of the screen.
 rem
 if z=0 then NUSIZ1=$01
 rem
 rem ** If Left Difficulty is set to A, the human car is twice as wide
 rem
 if switchleftb then NUSIZ0=$00 else NUSIZ0=$05
 rem
 rem ** W Flag is set during the carhit subroutine
 rem ** if w is 1 Change Player1 Car Color to Black
 rem 
 rem if w=1 then COLUP1=0 else COLUP1=52
 rem
 rem ** Player1's X and Y Position.
 rem
 player1y=scroll : player1x=u
skiplrm
 rem
 rem  ** player0 is the Human car
 rem
 if joy0left then goto TurnCar1
 if joy0right then goto TurnCar2
 player0: 
 %01111110
 %01000010
 %00111100
 %10100101
 %11100111
 %10111101
 %00111100
 %10011001
 %11111111
 %10011001
end
turned
 rem
 rem ** Set Playfield to scroll down
 rem 
 if joy0down then skipscrl
 pfscroll down
skipscrl
 g=g+1
 if g=2 then pfscroll down:g=0
skipsc
 rem
 rem ** Set Human Car's Color and X/Y Position
 rem
 if c < 11 then COLUP0=128
 if c > 10 && c < 21 then COLUP0=60
 if c > 20 && c < 31 then COLUP0=30
 if c > 30 && c < 41 then COLUP0=64
 if c > 40 && c < 61 then COLUP0=y
 player0x=x : player0y=p
 rem 
 rem ** Create the 2 sides of the Road
 rem 
 pfpixel 7 1 on : pfpixel 25 1 on 
 pfpixel 7 3 on : pfpixel 25 3 on
 pfpixel 7 5 on : pfpixel 25 5 on 
 pfpixel 7 7 on : pfpixel 25 7 on
 pfpixel 7 9 on : pfpixel 25 9 on 
 drawscreen
 rem
 rem ** Create Roadblock
 rem
 if switchrightb then ballx=0:bally=0:goto skipb
 ballx=b : bally=scroll+15 : ballheight=2
skipb
 rem
 rem ** Move Human Car (Player0)
 rem
 if joy0left then x=x-1                  
 if joy0right then x=x+1                  
 if joy0up then scroll=scroll+0.3 : mis=mis+0.5 : score=score+10 : AUDF0=12:AUDC0=14:AUDV0=10
 if joy0down && scroll >=1 then scroll=scroll-0.3 : mis=mis-0.5 : score=score-10: AUDF0=24:AUDC0=14:AUDV0=10         
 rem
 rem ** Detect Joystick Button press - fire missile
 rem
 if joy0fire && q<1 then AUDF1=8:AUDC1=1:AUDV1=15 : goto playerfires
 if q>0 then q=q-2 : missile0y=q 
 if q>50 then AUDV1=0
 rem
 rem ** Enemy Cars fire back
 rem
 if scroll >35 && t<10 then goto fireskip : rem when car is really slow, don't fire twice
 if scroll >50 && t<36 then goto fireskip : rem in invincible mode, if cars are stuck together at bottom, don't fire again.
 if scroll >60 && t>35 then goto fireskip : rem let bullets get all the way to the bottom before resetting
 if h=1 then goto fireskip : rem if powerup is activated, don't fire.
 if scroll<=1 then mis=1.0 : AUDF1=13:AUDC1=1:AUDV1=9
 if mis > 18 then AUDV1=0
 missile1y=mis : missile1x=u : missile1height=6 
 mis=mis+2.0
 goto pskip
fireskip
 missile1y=0: missile1x=0
pskip
 rem
 rem ---------------------------
 rem Collision Routines
 rem ---------------------------
 rem
 rem
 rem ** Don't allow Human car to drive off the road
 rem 
 if collision(playfield,player0) && x > 75 then x=x-2
 if collision(playfield,player0) && x < 75 then x=x+2
 rem
 rem ** When Computer Controlled car hits the playfield, bounce the other direction
 rem
 if collision(player1,playfield) && u > 100 then d=2 
 if collision(player1,playfield) && u < 80 then d=1
 rem
 rem ** When Human Controlled car hits the playfield, slow the car down.
 rem
 if collision(player0,playfield) && scroll >=1 then scroll=scroll-0.5 : mis=mis-0.5  
 rem
 rem ** If Player Car hits Computer Car, increase hitpoint counter.  At 60, end Game
 rem ** C is increased by more than 1 during a collision - Don't know why.
 rem
 if collision(player1,player0) && w=1 then gosub addhitpoints 
 if w=1 then goto damageskip
 if collision(player1,player0) then c=c+1 : if c=60 then r=120: goto thisisit 
 if collision(player1,player0) && scroll >=1 then scroll=scroll-1.5 : mis=mis-1.5 
 rem
 rem ** If Player missile hits computer car, increase score by 1000
 rem
 if collision(player1,missile0) then missile0y=1 : goto carhit 
 rem
 rem ** If Enemy missile hits player car, add damage to player car
 rem
 if collision(player0,missile1) && x > 75 then c=c+1 : x=x-2 : if c=60 then r=160: goto thisisit
 if collision(player0,missile1) && x < 75 then c=c+1 : x=x+2 : if c=60 then r=160: goto thisisit
damageskip 
 rem
 rem ** If Player car hits roadblock bouce away from it
 rem
 if collision(player0,ball) && u > 90 then x=x-6 
 if collision(player0,ball) && u < 90 then x=x+6 
 rem
 rem ** Increase score by 20 (Just for staying alive)
 rem 
 score=score+20
 rem
 rem  ** Loop Back to Main
 rem
 goto main
 rem
 rem -----------------------
 rem Fire Missile Subroutine
 rem -----------------------
 rem
playerfires
 if !switchleftb then missile0x=x+10 else missile0x=x+4
 q=80 : missile0y=75
 missile0height=6
 rem
 goto main
 rem
thisisit
 rem
 rem -----------------------------
 rem 'Game Over' Screen Subroutine
 rem -----------------------------
 rem
 rem ** This subroutine is kind of a leftover from a previous revision -
 rem ** It changes some colors when the game ends.
 AUDV0=0
 rem COLUP0=0
 rem COLUP1=0
 rem scorecolor=208
 goto eog
end
 rem -----------------------------------
 rem Enemy Car hit by Missile Subroutine
 rem -----------------------------------
carhit
 a=u 
 rem ** Score is increased by 1000 when the missile hits the enemy car
 rem
 rem ** I originally set missle0x=60 to hide the missile behind the side of the road
 rem ** I changed this to missiley=0 to jump it up to the top of the screen when a car is hit.
 z=1 : score = score + 1000 : missile0y=0 : q=0
 rem
 rem ** A = The Enemy Car's X Position + 8
 rem 
 a=u+8
 rem 
 rem ** A = X Posiiton of Player1 (+8)
 rem ** If X Position of Missile0 Hit is less than (X+8) from Player1, set Nusiz1 to 0 to erase car
 rem
 if o<1 then goto skipblank
 if o>0 then goto blankcar
skipblank
 if missile0x < a then NUSIZ1=0 : o=o+1 : u=u+16 
 if missile0x > a then NUSIZ1=0 : o=o+1 
199 l=rand:if l>215 then 199 
 l=l/8:l=l+1
 if joy0up then goto main : rem skip powerups if you're travelling full speed
 if l < 10 && scroll > 1 then gosub powerup : w=1
 goto main
 rem 
 rem ----------------------------
 rem EOG (End of Game) Subroutine
 rem ----------------------------
 rem
 rem ** This routine turns all the "roadway" pixels off -- clearing the playfield for the title screen
 rem
eog
 if r<1 then r=88:goto eog2
 r=r-1
 gosub explode
 COLUPF=r
 AUDF0=160-r:AUDC0=1:AUDV0=6
 drawscreen
 goto eog
eog2
 COLUP0=68
 AUDV0=0
 r=r-1
 e=e+1
 if e=2 then pfscroll up:e=0
 player0y=r
 player1y=0 
 missile0y=0
 missile1y=0
 COLUPF=160
 drawscreen
 if r<1 then pfclear:goto init
 ballx=0:bally=0
 scroll=0
 t=0
 goto eog2
CarCreate
 if scroll<96 then return 
200 l=rand:if l>215 then 200 
 l=l/8:l=l+1
 if l>1 && l<6 then gosub MakeNewCar1    : return
 if l>5 && l<11 then gosub MakeNewCar2   : return
 if l>10 && l<16 then gosub MakeNewCar3  : return
 if l>15 && l<21 then gosub MakeNewCar4  : return
 if l>20 && l<28 then gosub MakeNewCar5  : return
 return
MakeNewCar1
 player1:
 %10011001
 %11111111
 %10011001
 %00011000
 %10111101
 %11111111
 %10011001
 %00111100
end
 return
MakeNewCar2
 player1:
 %10111101
 %11111111
 %10111101
 %00100100
 %11100111
 %10111101
 %01000010
 %01111110
end
 return
MakeNewCar3
 player1:
 %10011001
 %11111111
 %10011001
 %00011000
 %11011011
 %11111111
 %11011011
 %00100100
end
 return
MakeNewCar4
 player1:               
 %10011001 
 %11111111 
 %10011001 
 %00011000 
 %00011000 
 %10011001 
 %11111111 
 %10011001 

end
 return
MakeNewCar5
 player1:
 %10011001 
 %11111111 
 %10011001 
 %00111100 
 %10100101 
 %11111111 
 %10011001 
 %00100100

end
 return
TurnCar1
 player0: 
 %01111110
 %01000010
 %00111100
 %10100101
 %11100111
 %10111101
 %00111100
 %01011001
 %11111111
 %10011010
end
 goto turned
TurnCar2
 player0: 
 %01111110
 %01000010
 %00111100
 %10100101
 %11100111
 %10111101
 %00111100
 %10011010
 %11111111
 %01011001
end
 goto turned
powerup
 h=1
 missile0y=0: q=0
 player1:               
 %11111111 
 %10000001
 %10011001 
 %10011001 
 %10111101
 %10111101 
 %10011001 
 %10011001 
 %10000001
 %11111111
end
 return
addhitpoints
 if h=1 then c=c-1 
 return
 rem 
blankcar
 u=94
 player1:
 %00000000
end
 goto main

explode
 COLUPF=70
 COLUP0=64
 player0:
 %01111110
 %01000010
 %00111100
 %10100101
 %11110111
 %00111000
 %10001100
 %10011001
 %01101110
 %00000000
end
 return

 player0:
 %10000001
 %00100100
 %00000000
 %00011001
 %10011000
 %00000000
 %00100100
 %10000001
end
