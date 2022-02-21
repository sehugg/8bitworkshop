OPTION DIALECT DEC:REM http://www.bitsavers.org/bits/DEC/pdp10/games/
00001 PRINT "	This is the latest version as of 2-Jun-82."
00005 DIM B$(30)
00010 F=0
00011 L=0
00012 M=0
00013 P8=0
00014 P9=0
00015 S5=0
00016 T1=1
00017 V=1
00020 FOR A=100 TO 400 STEP 100
00030 FOR B = 10 TO 50 STEP 10
00040 FOR C= 1 TO 4
00050 B(A+B+C)=0
00060 NEXT C
00070 NEXT B
00080 NEXT A
00090 DIM B(454)
00100 RANDOMIZE
00110 FOR N5=1 TO 12
00120 A=(INT(4*RND+1))*100
00130 B=(INT(5*RND+1))*10
00140 C=(INT(4*RND+1))
00142 IF (A+B+C)=151 THEN 120
00144 IF (A+B+C)=234 THEN 120
00150 IF B(A+B+C)<>0 THEN 120
00160 B(A+B+C)=N5
00170 B(N5)=0
00180 NEXT N5
00185 B(28)=0
00186 B(29)=0
00187 B(30)=0
00190 B$(1)="is nothing....it's empty"
00192 B$(30)="is a violin."
00193 B$(29)="are many trophies in the knapsack."
00194 B$(28)="is a large snake, with its head neatly sliced off!"
00200 B$(2)=B$(1)
00210 B$(3)=B$(1)
00220 B$(4)="is a key."
00230 B$(5)="is a key."
00240 B$(6)="are some batteries."
00250 B$(7)="is a large, poisonous snake..ready to bite!!!"
00260 B$(8)="is a beautiful gold pocket watch!"
00270 B$(9)="are some golden coins!!!"
00280 B$(10)="are some sparkling diamonds!!"
00285 B$(11)="is an ambiguity."
00288 B$(12)="is a knapsack."
00290 REM   This is the Haunted House Game. It was conceived
00300 REM   primarily by Rich Stratton, with Rich Gould and
00310 REM   Norm Hurst. 
00320 REM                                 November, 1979
00330 REM
00340 REM
00341 REM 20-May-82/Converted to run with BASIC-10/20/+2
00342 REM /Added remaining room on level 1/Allowed taking snake & text
00343 REM /Allow multi word commands for ON,OFF,READ,TIE,WIPE
00344 REM /Allow lower case commands/Allow second take on trophies
00345 REM /Made room descriptions unique/Allow INVEN for INVENTORY
00346 REM /Allow D for DOWN at window/Made INVEN say 'collected'
00347 REM /Count LOOK only as time, not movement (for scoring)
00348 REM /Allow READ to use next command if not a special word
00349 REM
00350 REM Scoring: <Points for escape; taking watch,coins,diamonds,snake,
00351 REM          batteries,violin,trophies>*level+number of moves made
00352 REM          Taking knapsack and either key does not count
00360 PRINT 
00361 PRINT "Welcome to the Haunted House."
00370 PRINT "Do you want Instructions";
00380 INPUT Q$
00382 GOSUB 30000
00390 if Q$="YES" then 400
00391 if Q$="Y" then 400
00392 GO TO 590
00400 PRINT "You are about to begin a perilous journey."
00410 PRINT "You will wake up and find yourself in one of"
00420 PRINT "the many rooms of an old mansion---a mansion"
00430 PRINT "which has been abandoned and is now infested with"
00440 PRINT "Evils and Unspeakable Deaths of many kinds."
00450 PRINT "You must escape from the confines of the house."
00460 PRINT "By using single-word comands you may move through"
00470 PRINT "the maze of old rooms. You have the following items"
00480 PRINT "with you:"
00490 PRINT "	TOILET PAPER"
00500 PRINT "	CROWBAR"
00510 PRINT "	LANTERN"
00520 PRINT "	FLASHLIGHT"
00530 PRINT "	RADAR JAMMER"
00540 PRINT "	MACHETE"
00550 PRINT "	A CAN OF GHOST REPELLANT"
00560 PRINT "	MATCHES"
00570 PRINT "	A DICTIONARY"
00575 PRINT "	FLY-SWATTER"
00580 PRINT "Use your common sense to tell you what to do...."
00585 PRINT "Type 'HELP' for help."
00590 PRINT "Select your difficulty level: 1 (easy) to 9 (hard)."
00600 INPUT K
00602 IF K<1 THEN 606
00603 IF K>9 THEN 606
00604 GO TO 610
00606 PRINT "Having a problem with your basic numbers?"
00607 GO TO 590
00610 S9=INT((-10*K)+110)
00620 B9=INT((-4.38*K)+64.38)
00630 K9=B9
00640 B4=B9
00641 K3=K9
00642 S1=S9
00645 G=G+1
00650 GOSUB 8710
00652 IF G<>3 THEN 660
00654 PRINT "....thunder wakes you and you have the clap...."
00656 GO TO 670
00660 PRINT "....a clap of thunder wakes you and ...."
00670 GOSUB 8710
00680 A=(INT(4*RND+1))*100
00690 B=(INT(5*RND+1))*10
00700 C=(INT(4*RND+1))
00710 GOSUB 8710
00720 N=0
00721 S=0
00722 E=0
00723 W=0
00724 U=0
00725 D=0
00730 P=0
00731 D1=0
00732 W1=0
00740 ON C THEN 760,770,780,790
00750 GO TO 710
00760 ON B/10 THEN 800,810,820,830,840
00770 ON B/10 THEN 850,860,870,880,890
00780 ON B/10 THEN 900,910,920,930,940
00790 ON B/10 THEN 950,960,970,980,990
00800 ON A/100 THEN 2280,2360,2410,2470
00810 ON A/100 THEN 2480,2530,2570,2620
00820 ON A/100 THEN 2720,2770,2810,2850
00830 ON A/100 THEN 2910,2960,3000,3050
00840 ON A/100 THEN 3100,3160,3190,3240
00850 ON A/100 THEN 3290,3340,3390,3440
00860 ON A/100 THEN 3490,3530,3580,3630
00870 ON A/100 THEN 3660,3710,3780,3840
00880 ON A/100 THEN 3900,3990,4040,4090
00890 ON A/100 THEN 4140,4190,4220,4270
00900 ON A/100 THEN 4330,4390,4430,4480
00910 ON A/100 THEN 4510,4550,4600,4630
00920 ON A/100 THEN 4680,4730,4770,4810
00930 ON A/100 THEN 4850,4880,4910,4940
00940 ON A/100 THEN 4970,5030,5060,5110
00950 ON A/100 THEN 5160,5220,5270,5320
00960 ON A/100 THEN 5360,5410,5460,5500
00970 ON A/100 THEN 5540,5600,5700,5740
00980 ON A/100 THEN 5770,5810,5850,5880
00990 ON A/100 THEN 5920,5960,5990,6030
01000 
01010 REM       		MOVEMENT CONTROL...
01020 PRINT N;S;E;W;U;D
01030 IF Q$="N" THEN 1170
01040 IF Q$="NORTH" THEN 1170
01050 IF Q$="S" THEN 1200
01060 IF Q$="SOUTH" THEN 1200
01070 IF Q$="E" THEN 1230
01080 IF Q$="EAST" THEN 1230
01090 IF Q$="W" THEN 1260
01100 IF Q$="WEST" THEN 1260
01110 IF Q$="U" THEN 1290
01120 IF Q$="UP" THEN 1290
01130 IF Q$="D" THEN 1320
01140 IF Q$="DOWN" THEN 1320
01150 GO TO 1540
01160 GO TO 1520
01170 IF N=0 THEN 1350
01180 A=A-100
01190 GO TO 750
01200 IF S=0 THEN 1350
01210 A=A+100
01220 GO TO 750
01230 IF E=0 THEN 1350
01240 B=B+10
01250 GO TO 750
01260 IF A+B+C=152 THEN 1342
01265 IF W=0 THEN 1350
01270 B=B-10
01280 GO TO 750
01290 IF U=0 THEN 1350
01300 C=C+1
01310 GO TO 750
01320 IF D=0 THEN 1350
01330 C=C-1
01340 GO TO 750
01342 IF W=1 THEN 1270
01345 PRINT "The door is far too heavy and refuses to budge."
01347 GO TO 1360
01350 PRINT "You can't go that way!"
01360 P=0
01370 GO TO 6110
01380 REM         Command Routine
01390 IF RND > .002 THEN 1410
01400 GO TO 9220
01410 PRINT "What next";
01420 INPUT Q$
01421 IF Q$="" THEN 1410
01423 GOSUB 30000
01425 Q1$=Q$
01426 Q$=Q$+" "
01427 Q$=LEFT$(Q$,INSTR(1,Q$," ")-1)
01430 IF P<>1 THEN 1530
01440 IF P$="ON" THEN 8620
01450 IF Q$<>P$ THEN 8380
01460 IF Q$="CHOP" THEN 7500
01470 IF Q$="SWAT" THEN 9570
01480 IF Q$="SPRAY" THEN 7470
01490 PRINT "What next";
01500 INPUT Q$
01501 IF Q$="" THEN 1490
01503 GOSUB 30000
01505 Q1$=Q$
01506 Q$=Q$+" "
01507 Q$=LEFT$(Q$,INSTR(1,Q$," ")-1)
01510 GO TO 1530
01520 GO TO 1490
01530 GO TO 1030
01540 IF Q$="OPEN" THEN 1762
01550 IF Q$="LOOK" THEN 10400
01560 IF Q$="READ" THEN 8950
01570 IF Q$="POINTS" THEN 7370
01580 IF Q$="TAKE" THEN 7800
01590 IF Q$="ON" THEN 6780
01600 IF Q$="EXTINGUISH" THEN 7100
01610 IF Q$="OFF" THEN 6780
01620 IF Q$="PRY" THEN 7160
01630 IF Q$="LIGHT" THEN 7230
01640 IF Q$="SPRAY" THEN 7400
01650 IF Q$="SWAT" THEN 9550
01660 IF Q$="DWEEB" THEN 8780
01665 IF Q$="HELP" THEN 20000
01670 IF Q$="DEFECATE" THEN 1690
01672 IF Q$="INVENTORY" THEN 10270
01674 IF Q$="INVE" THEN 10270
01676 IF Q$="INVEN" THEN 10270
01680 GO TO 1720
01690 X=1
01700 GO TO 6520
01710 GO TO 1520
01720 IF Q$="CHOP" THEN 7630
01730 IF Q$="FILL" THEN 7660
01740 IF Q$="REPLACE" THEN 7720
01750 PRINT "This instruction is not clear."
01760 GO TO 1520
01762 IF INSTR(1,Q1$," ")=0 THEN 1770
01763 S0=INSTR(1,Q1$," ")
01764 IF S0=LEN(Q1$) THEN 1770
01765 O$=MID$(Q1$,S0+1,LEN(Q1$)-S0)
01767 GO TO 1790
01770 PRINT "What do you want to open";
01780 INPUT O$
01781 R$=Q$
01782 Q$=O$
01783 GOSUB 30000
01784 O$=Q$
01785 Q$=R$
01790 IF O$="BOX" THEN 1840
01800 IF O$="DOOR" THEN 1860
01810 IF O$="WINDOW" THEN 1880
01820 PRINT "It is impossible to open the ";O$
01830 GO TO 1380
01840 IF B(A+B+C)=0 THEN 1900
01850 GO TO 2240
01860 IF D1=0 THEN 1900
01870 GO TO 2040
01880 IF W1 = 0   THEN 1900
01890 GO TO 1920
01900 PRINT "There is no ";O$;" in this room."
01910 GO TO 1520
01920 D=1
01930 PRINT "What next";
01940 INPUT Q$
01941 IF Q$="" GO TO 1520
01943 GOSUB 30000
01944 Q$=Q$+" "
01945 Q$=LEFT$(Q$,INSTR(1,Q$," ")-1)
01950 IF Q$<>"TIE" THEN 1530
01960 PRINT "You have tied the sheets together and they"
01970 PRINT "are lowered out of the window.  They don't"
01980 PRINT "look very strong.....What next";
01990 INPUT Q$
01992 GOSUB 30000
01993 Q$=Q$+" "
01994 Q$=LEFT$(Q$,INSTR(1,Q$," ")-1)
02000 IF Q$="D" THEN 2010
02005 IF Q$<>"DOWN" THEN 1530
02010 IF RND<.1 GO TO 2080
02020 IF RND<.7 THEN 8750
02030 GO TO 680
02040 IF B(4) = 1 THEN 2070
02050 IF B(5) = 1 THEN 2160
02060 GO TO 2210
02070 PRINT "You put the key in the lock and slowly turn...."
02080 GOSUB 8710
02090 PRINT "CONGRATULATIONS!!  You have overcome all odds"
02100 PRINT "and escaped from the house!"
02110 P9=P9+95
02120 PRINT
02130 PRINT
02140 PRINT
02150 GO TO 8410
02160 PRINT "You put the key in the lock and slowly turn...."
02170 GOSUB 8710
02180 PRINT "The key refuses to turn in the lock."
02190 PRINT "You need the proper key."
02200 GO TO 1520
02210 PRINT "The door is securely locked, and cannot be opened."
02220 GO TO 1520
02230 REM            Box Routine
02240 PRINT "Inside the box there ";B$(B(A+B+C))
02250 IF B(A+B+C)<>7 THEN 1520
02260 P=1
02261 P$="CHOP"
02270 GO TO 1410
02280  N=0
02281 S=1
02282 E=0
02283 W=0
02284 U=0
02285 D=0
02290 PRINT "You are in the Kerosene storage room. There is a"
02300 PRINT "tank of Kerosene and a door to the south."
02310 PRINT "The room is filled with kerosene fumes..."
02320 IF L<>1 THEN 2350
02330 PRINT "......K A B O O O M!!!!!! "
02340 GO TO 8540
02350 GO TO 6090
02360  N=1
02361 S=1
02362 E=1
02363 W=0
02364 U=0
02365 D=0
02370 PRINT "You are in the basement torture chamber. There is"
02380 PRINT "a door to the north. It's too dark to see "
02390 PRINT "anything else."
02400 GO TO 6090
02410  N=1
02411 S=1
02412 E=1
02413 W=0
02414 U=0
02415 D=0
02420 PRINT "You are in the torture chamber. Great place for"
02430 PRINT "some discipline. You can't see past your nose"
02440 PRINT "since it's so dark down here. The smell of death"
02450 PRINT "is omnipresent."
02460 GO TO 6090
02470 N=1
02471 S=0
02472 E=0
02473 W=0
02474 U=0
02475 D=0
02476 PRINT "You are in the torture chamber. You feel as if the"
02477 PRINT "walls are closing in on you. There is no telling"
02478 PRINT "any directions at all its so dark here."
02479 GO TO 6090
02480  N=0
02481 S=1
02482 E=1
02483 W=0
02484 U=0
02485 D=0
02490 PRINT "You are in the basement torture chamber. If you"
02500 PRINT "are into whips and chains, this is the place to be."
02510 PRINT "It's so dark you can't see too far."
02520 GO TO 6090
02530  N=1
02531 S=1
02532 E=1
02533 W=1
02534 U=0
02535 D=0
02540 PRINT "You are in the basement torture chamber. It's too"
02550 PRINT "dark to see."
02560 GO TO 6090
02570  N=1
02571 S=1
02572 E=1
02573 W=1
02574 U=0
02575 D=0
02580 PRINT "You are in the torture chamber. I'd get out before"
02590 PRINT "you undergo a little head shrinking. But who "
02600 PRINT "knows which way to go?"
02610 GO TO 6090
02620  N=1
02621 S=0
02622 E=0
02623 W=0
02624 U=0
02625 D=0
02630 PRINT "You are in the boiler room. There is an acrid smell"
02640 PRINT "of coal dust in the air. Many have died in here"
02650 PRINT "for some reason. One should be careful, or join"
02660 PRINT "them."
02670 IF L<>1 THEN 2710
02680 PRINT ".....K A B O O O M!!!!!!  Looks like you joined "
02690 PRINT "them....."
02700 GO TO 8540
02710 GO TO 6090
02720  N=0
02721 S=1
02722 E=1
02723 W=1
02724 U=0
02725 D=0
02730 PRINT "You are in the basement torture chamber. If you"
02740 PRINT "want to rest, there is a bed of nails. It's too"
02750 PRINT "dark to see very far."
02760 GO TO 6090
02770  N=1
02771 S=1
02772 E=1
02773 W=1
02774 U=0
02775 D=0
02780 PRINT "You are in the basement torture chamber. There is a"
02790 PRINT "nice comfortable rack if you want to stretch a bit."
02800 GO TO 6090
02810  N=1
02811 S=1
02812 E=1
02813 W=1
02820 PRINT "You are in the torture chamber. You'll have to "
02830 PRINT "find a way out fast, or learn to be a masochist."
02840 GO TO 6090
02850  U=1
02851 N=1
02852 E=1
02860 PRINT "You are in the torture chamber bathroom."
02870 PRINT "A toilet occupies the center of the room, its"
02880 PRINT "seat covered with metal spikes.  Looks mighty"
02890 PRINT "uncomfortable...."
02900 GO TO 6090
02910  S=1
02911 E=1
02912 W=1
02920 PRINT "You are in the basement torture room. Many have"
02930 PRINT "found both pleasure and pain here.  There is a"
02940 PRINT "door to the east.  You can't see anything else."
02950 GO TO 6090
02960  N=1
02961 S=1
02962 E=1
02963 W=1
02964 U=0
02965 D=0
02970 PRINT "You are in the basement torture chamber. There is a"
02980 PRINT "door to the east. You can't see anything else."
02990 GO TO 6090
03000  N=1
03001 S=0
03002 E=0
03003 W=1
03004 U=0
03005 D=0
03010 PRINT "You are in the basement torture chamber. All around"
03020 PRINT " are many interesting devices of pain. It's too"
03030 PRINT " dark to see which way to go."
03040 GO TO 6090
03050  E=1
03051 W=1
03060 PRINT "You find yourself in a dark tunnel.  The passageway"
03070 PRINT "gets much narrower and darker to the east.  There"
03080 PRINT "is an opening in the wall to the west."
03090 GO TO 6090
03100 PRINT "It is very caliginous...a cold wind sucks at you from"
03110 PRINT "all sides....it is getting stronger!!  You are being"
03120 PRINT "pulled through the air by invisible forces!!!"
03130 PRINT "WHHHOOOSSHHH!!!  Suddenly..."
03140 C=C+3
03150 GO TO 710
03160  N=0
03161 S=0
03162 E=0
03163 W=1
03164 U=1
03165 D=0
03170 PRINT "You are in the dumbwaiter."
03180 GO TO 6090
03190 S=1
03200 PRINT "You are in a dark tunnel. It appears as if the only"
03210 PRINT "to go is to the south...there are massive boulders"
03220 PRINT "blocking your way on all other sides."
03230 GO TO 6090
03240  N=1
03241 W=1
03250 PRINT "You are crawling on your hands and knees in a very"
03260 PRINT "low, narrow tunnel. It is cold and damp. To the "
03270 PRINT "west and north the tunnel extends into the darkness."
03280 GO TO 6090
03290  S=1
03291 D1=1
03300 PRINT "You are in the Foyer. There is a heavy oak door on"
03310 PRINT "the north wall. There is also a doorway to the "
03320 PRINT "south."
03330 GO TO 6090
03340  N=1
03341 S=1
03342 E=1
03343 W=0
03344 U=0
03345 D=0
03350 PRINT "You are in a Hallway. To the north and south are"
03360 PRINT "doorways. To the east is a large staircase "
03370 PRINT "heading up into the darkness."
03380 GO TO 6090
03390  N=1
03391 S=1
03392 E=1
03393 W=0
03394 U=0
03395 D=0
03400 PRINT "You are in a Hallway. To the north and south are"
03410 PRINT "doorways. To the east is an archway with darkness"
03420 PRINT "beyond."
03430 GO TO 6090
03440  N=1
03441 U=1
03450 PRINT "You are in an old Library. Books covered with dust"
03460 PRINT "line the walls. There is a door to the north, and there"
03470 PRINT "seems to be a small hatch in the ceiling."
03480 GO TO 6090
03490  N=0
03491 S=0
03492 E=1
03493 W=0
03494 U=0
03495 D=0
03500 PRINT "You are in a Closet. There is dust and debris"
03510 PRINT "everywhere."
03520 GO TO 6090
03530  U=1
03531 W=1
03540 PRINT "You are on a large Staircase. It extends from the"
03550 PRINT "darkness above to the darkness below. The stairs"
03560 PRINT "creak as you step. . . . "
03570 GO TO 6090
03580  N=0
03581 S=1
03582 E=1
03583 W=1
03584 U=0
03585 D=0
03590 PRINT "You are now in a huge Ballroom. Dust and cobwebs"
03600 PRINT "hang from the walls. To the west is an archway. To"
03610 PRINT "the south and east are doors leading into darkness."
03620 GO TO 6090
03630  N=1
03631 S=0
03632 E=1
03633 W=0
03634 U=0
03635 D=0
03640 PRINT "You are in a closet. It is completely empty."
03650 GO TO 6090
03660  N=0
03661 S=0
03662 E=1
03663 W=1
03664 U=0
03665 D=0
03670 PRINT "You are in an old Bathroom. A toilet sits ominously"
03680 PRINT "in the corner. There is a doorway to the east and "
03690 PRINT "one to the west."
03700 GO TO 6090
03710  N=0
03711 S=1
03712 E=1
03713 W=0
03714 U=0
03715 D=0
03720 PRINT "You are in a Study. An old desk is in the center of"
03730 PRINT "the room with years of dust and dirt caked upon it."
03740 PRINT "Fresh footprints lead through a door to the south."
03750 PRINT "Perhaps you are not alone. . . There is a doorway"
03760 PRINT "to the east."
03770 GO TO 6090
03780  N=1
03781 S=1
03782 E=1
03783 W=1
03784 U=0
03785 D=0
03790 PRINT "You are in the west end of a Living Room. The "
03800 PRINT "furniture is covered with sheets. To the north "
03810 PRINT "there is a doorway, and perhaps to the west and "
03820 PRINT "south as well. It is difficult to tell for sure."
03830 GO TO 6090
03840 P=1
03841 N=1
03842 W=1
03843 E=1
03844 D=1
03845 P$="ON"
03850 PRINT "You are in an Aviary, long since void of any birds."
03860 PRINT "To the east, west, and north are doors leading to"
03870 PRINT "darkness.  Suddenly you hear the sound of thousands"
03880 PRINT "of wings....BATS surround you!!!"
03890 GO TO 6090
03900  N=0
03901 S=1
03902 E=1
03903 W=1
03904 U=0
03905 D=0
03910 PRINT "You are in the Kitchen.  The smell of leaky gas is "
03920 PRINT "almost overwhelming... There are doors to the west"
03930 PRINT "and south, and a massive steel door to the east."
03940 PRINT "It is cold to the touch..."
03950 IF L<>1 THEN 3980
03960 PRINT "......K A B O O O M!!!!!"
03970 GO TO 8540
03980 GO TO 6090
03990  N=1
03991 S=1
03992 W=1
04000 PRINT "You are in an old Dining Hall.  Perhaps as many"
04010 PRINT "as 30 chairs line a huge table.  Doors lead to"
04020 PRINT "the west, and maybe elsewhere..."
04030 GO TO 6090
04040  N=1
04041 S=1
04042 E=1
04043 W=1
04050 PRINT "You are in the east end of a large Living Room."
04060 PRINT "There is darkness to the west, and a door to "
04070 PRINT "the south."
04080 GO TO 6090
04090  N=1
04091 E=1
04092 W=1
04100 PRINT "You are in a Sitting Room.  A ruined dust covered"
04110 PRINT "couch lines the east wall.  Somewhere nearby you"
04120 PRINT "can hear the sound of beating wings..."
04130 GO TO 6090
04140  N=0
04141 S=1
04142 E=0
04143 W=0
04144 U=1
04145 D=1
04150 PRINT "You are in a meat locker.  It is very cold."
04160 PRINT "To the west is a massive steel door. To the"
04170 PRINT "south is a tiny door, placed on the wall."
04180 GO TO 6090
04190  U=1
04191 D=1
04192 N=1
04200 PRINT "You are in a dumbwaiter."
04210 GO TO 6090
04220  W=1
04221 S=1
04230 PRINT "You are in a den. Rats scurry into holes as you"
04240 PRINT "enter.  A moose head on the wall watches your"
04250 PRINT "every move....."
04260 GO TO 6090
04270  N=1
04271 W=1
04280 PRINT "You have entered a room full of ghosts!!"
04290 PRINT "But wait.. they are engrossed in a game on"
04300 PRINT "a computer terminal...It looks like they are"
04310 PRINT "playing ADVENTURE......"
04320 GO TO 6090
04330  N=0
04331 S=1
04332 E=1
04333 W=0
04334 U=0
04335 D=0
04340 PRINT "You are in the west end of what appears to"
04350 PRINT "be the Master Bedroom.   To the east is "
04360 PRINT "darkness.  A doorway MIGHT be to the north,"
04370 PRINT "but it is dark...."
04380 GO TO 6090
04390  N=1
04391 S=1
04400 PRINT "You are in a Bathroom.  A toilet sits in the "
04410 PRINT "corner.  To the north and south are doors."
04420 GO TO 6090
04430  N=1
04431 S=1
04432 E=1
04440 PRINT "You are in the west end of a Bedroom. To the"
04450 PRINT "south is a door. To the east is darkness. There"
04460 PRINT "is a doorway to the north."
04470 GO TO 6090
04480 N=1
04490 PRINT "You are in a closet. The shelves are bare."
04500 GO TO 6090
04510  E=1
04511 W=1
04520 PRINT "You are in the center of the Master Bedroom."
04530 PRINT "You can see nothing but darkness in any direction."
04540 GO TO 6090
04550  D=1
04551 E=1
04560 PRINT "You are on a large Staircase. It extends from the"
04570 PRINT "darkness above to the darkness below. The stairs"
04580 PRINT "creak as you step."
04590 GO TO 6090
04600 W=1
04610 PRINT "You are in the east end of a Bedroom."
04620 GO TO 6090
04630  U=1
04631 E=1
04640 PRINT "You are in a large Staircase. It extends from the"
04650 PRINT "darkness above to the darkness below. The stairs"
04660 PRINT "creak as you step."
04670 GO TO 6090
04680  S=1
04681 W=1
04682 E=1
04690 PRINT "You are in the east end the Master Bedroom. There"
04700 PRINT "are doorways to the east and south with darkness"
04710 PRINT "to the west."
04720 GO TO 6090
04730  N=1
04731 E=1
04732 W=1
04740 PRINT "You are in a Hallway with door to the north"
04750 PRINT "and a large painting on the south wall."
04760 GO TO 6090
04770 E=1
04780 PRINT "You are in a sort of Reading Room. There is a "
04790 PRINT "door on the east wall."
04800 GO TO 6090
04810  E=1
04811 W=1
04820 PRINT "You are within a Hallway. There is a staircase"
04830 PRINT " to the west."
04840 GO TO 6090
04850  W=1
04851 S=1
04852 E=1
04860 PRINT "You are in a closet."
04870 GO TO 6090
04880  N=1
04881 W=1
04882 S=1
04890 PRINT "You are in a Hallway. There is darkness all around."
04900 GO TO 6090
04910  N=1
04911 W=1
04912 S=1
04920 PRINT "You are in a Hallway. There is darkness everywhere."
04930 GO TO 6090
04940  N=1
04941 W=1
04942 E=1
04950 PRINT "You are in a Hallway. It is too dark to see."
04960 GO TO 6090
04970  W=1
04971 P=1
04980 PRINT "You are in an empty room.  Suddenly flies begin"
04990 PRINT "to swarm around you!!!! A voice murmers.."
05000 PRINT ".....FOR GOD'S SAKE  GET OUT!!!!..."
05010 P$="SWAT"
05020 GO TO 6090
05030  U=1
05031 D=1
05032 S=1
05040 PRINT "You are in a Dumbwaiter."
05050 GO TO 6090
05060  N=1
05061 S=1
05070 PRINT "You are in a vomitorium. This is the room where"
05080 PRINT "the ghosts go after they overeat...the smell is "
05090 PRINT "disgusting."
05100 GO TO 6090
05110  W=1
05111 N=1
05120 PRINT "You are in an Observatory. An abandoned telescope"
05130 PRINT "points to the east, but the lense is old and "
05140 PRINT "cracked. There are doors to the north and west."
05150 GO TO 6090
05160  S=1
05161 E=1
05170 PRINT "You are in the Music Room. Old, dust covered"
05180 PRINT "musical instruments lie everywhere."
05190 GO TO 9820
05210 GO TO 6090
05220  E=1
05221 N=1
05230 PRINT "You are in a Trophy Room.  Hundreds of golden"
05232 PRINT "trophies cover the walls and fill the cabinets!"
05234 PRINT "There are doorways to the north and south."
05260 GO TO 6090
05270  S=1
05271 E=1
05280 PRINT "You are in a Bedroom filled with many spiders, just"
05290 PRINT "waiting for something or someone to fall entrapped"
05300 PRINT "in their webbing."
05310 GO TO 6090
05320 N=1
05330 PRINT "You are in an Old Bathroom. A toilet sits ominously"
05340 PRINT "in the corner."
05350 GO TO 6090
05360 E=1
05361 W=1
05362 S=1
05363 P=1
05364 P$="SPRAY"
05370 PRINT "You are in a Large Bedroom. Ghosts advance upon you"
05380 PRINT "with ominous toilets. There is darkness to the east"
05390 PRINT "and west, but a doorway lies to the south."
05400 GO TO 6090
05410 N=1
05411 W=1
05412 S=1
05413 E=1
05414 P=1
05415 P$="CHOP"
05420 PRINT "You are in the east end of the Greenhouse Room."
05430 PRINT "Man-eating plants lunge at you. There is a doorway "
05440 PRINT "to the east."
05450 GO TO 6090
05460  N=1
05461 W=1
05462 E=1
05470 PRINT "You are in a Bedroom that once belonged to a "
05480 PRINT "posessed child."
05490 GO TO 6090
05500  D=1
05501 W=1
05510 PRINT "You are on a Stairway. There is darkness in all"
05520 PRINT "directions. "
05530 GO TO 6090
05540 P=1
05541 W=1
05542 S=1
05543 E=1
05544 P$="SPRAY"
05550 PRINT "You are in a Large Bedroom. The ghosts are look-"
05560 PRINT "for recruits. There is a doorway to the east, "
05570 PRINT "darkness to the north and west. Who knows what"
05580 PRINT "lies to the south."
05590 GO TO 6090
05600 
05610 PRINT "CHEKOV HERE: IT'S A ROMULAN WITH A CLOAKING DEVICE!!"
05620 PRINT "153 UNIT HIT FROM QUADRANT (2,5): (243 REMAINING)"
05630 PRINT "167 UNIT HIT FROM QUADRANT (3,7): ( 76 REMAINING)"
05640 PRINT "112 UNIT HIT FROM QUADRANT (3,2): (-36 REMAINING)"
05650 PRINT
05660 PRINT "THE ENTERPRISE HAS BEEN DESTROYED."
05670 PRINT "THE FEDERATION WILL BE DESTR%^ &*$ #@$&*("
05680 PRINT "^&*GEBJ &*(SB +@^%^&*@  HS$@~W"
05690 GO TO 680
05700  W=1
05701 S=1
05702 E=1
05710 PRINT "You are in a Hallway. Your fate is in your"
05720 PRINT "own hands."
05730 GO TO 6090
05740  N=1
05741 W=1
05742 E=1
05750 PRINT "You are in a Bedroom."
05760 GO TO 6090
05770  W1=1
05771 W=1
05772 E=1
05780 PRINT "You are in the Ghost's Closet. Numerous sheets"
05790 PRINT "hang from hooks. There is a window to the north."
05800 GO TO 6090
05810  E=1
05811 S=1
05820 PRINT "You are in a Hallway. There is a doorway to the"
05830 PRINT "east. Darkness surrounds you."
05840 GO TO 6090
05850  N=1
05851 W=1
05852 E=1
05860 PRINT "You are in a Hallway."
05870 GO TO 6090
05880 W=1
05890 PRINT "You are in a closet. Who knows what queer things"
05900 PRINT "are hiding there?"
05910 GO TO 6090
05920  W=1
05921 S=1
05930 PRINT "You are in the Ghost's Study. It is filled with"
05940 PRINT "books and magazines about famous ghosts."
05950 GO TO 6090
05960  D=1
05961 W=1
05962 N=1
05970 PRINT "You are in the Dumbwaiter."
05980 GO TO 6090
05990  W=1
05991 S=1
06000 PRINT "You are in the servant's quarters, long since"
06010 PRINT "vacated. There is a door to the south."
06020 GO TO 6090
06030  W=1
06031 N=1
06040 PRINT "You are in the maids quarters, but it is empty."
06050 PRINT "There are broken boards on the west wall,"
06060 PRINT "perhaps you can squeeze through...."
06070 GO TO 6090
06080 REM  ************ C H E C K   R O U T I N E ********"
06090 IF B(A+B+C)=0 THEN 6110
06100 PRINT "There is a small box here."
06110 M=M+1
06120 S1=S1-1
06130 IF S1<=0 THEN 6250
06140 IF S1=1 THEN 6230
06150 IF S1=5 THEN 6210
06160 IF S1=10 THEN 6180
06170 GO TO 6270
06180 PRINT "Nature will soon call...You had better find a"
06190 PRINT "bathroom."
06200 GO TO 6270
06210 PRINT "You had better go soon!!"
06220 GO TO 6270
06230 PRINT "You can't hold it any longer!!!!"
06240 GO TO 6270
06250 X=0
06260 GO TO 6520
06270 IF F=1 THEN 6320
06280 IF L=1 THEN 6360
06290 IF F=1 THEN 6510
06300 IF M=1 THEN 1380
06310 GO TO 8420
06320 B4=B4-1
06330 IF B4=10 THEN 6400
06340 IF B4=0 THEN 6420
06350 GO TO 6280
06360 K3=K3-1
06370 IF K3=10 THEN 6470
06380 IF K3=0 THEN 6490
06390 GO TO 6510
06400 PRINT "Your flashlight is running low."
06410 GO TO 6280
06420 PRINT "Your flashlight is dead."
06430 F=0
06440 IF K3>0 THEN 6280
06450 GO TO 8420
06460 GO TO 6510
06470 PRINT "Your kerosene is running low."
06480 GO TO 6510
06490 PRINT "Your lantern is out of fuel."
06500 L=0
06510 GO TO 1380
06520 T=A+B+C
06530 IF T=132 THEN 6590
06540 IF T=213 THEN 6590
06550 IF T=414 THEN 6590
06560 IF T=431 THEN 6580
06570 GO TO 6710
06580 PRINT "OOUUCCHH!!  OOOOOO!! AAHHHHH!!!"
06590 PRINT "You have successfully gone to the bathroom."
06600 PRINT "What next";
06610 INPUT Q$
06611 IF Q$="" GO TO 6670
06612 GOSUB 30000
06613 Q$=Q$+" "
06614 Q$=LEFT$(Q$,INSTR(1,Q$," ")-1)
06620 IF Q$<>"WIPE" THEN 6670
06630 PRINT "Good.  You have saved yourself from the wolverines."
06640 S1=S9
06650 IF X=1 THEN 1520
06660 GO TO 6270
06670 PRINT "You neglected to clean up. A pack of wolverines"
06680 PRINT "have been attracted by the scent and have devoured"
06690 PRINT "you."
06700 GO TO 8540
06710 PRINT "You did it right on the floor! How gross!"
06720 PRINT "But worse, you have attracted the wolverines,"
06730 PRINT "which have eaten both the feces(first) and you"
06740 PRINT "(second), which says something about you."
06750 GO TO 8380
06760 IF X=1 THEN 1520
06770 GO TO 6270
06780 IF Q$="ON" THEN 6950
06781 IF INSTR(1,Q1$," ")=0 THEN 6790
06782 S0=INSTR(1,Q1$," ")
06783 IF S0=LEN(Q1$) THEN 6790
06784 Q$=MID$(Q1$,S0+1,LEN(Q1$)-S0)
06785 GO TO 6810
06790 PRINT "What do you want to turn off";
06800 INPUT Q$
06802 GOSUB 30000
06810 IF Q$="FLASHLIGHT" THEN 6860
06820 IF Q$="FLASH" THEN 6860
06830 IF Q$="RADAR" THEN 6930
06840 PRINT "What on earth is a ";Q$;" ?"
06850 GO TO 1520
06860 IF F=0 THEN 6900
06870 F=0
06880 PRINT "O.K.!!! Your flashlight is off."
06890 GO TO 1490
06900 PRINT "Are you stupid???!!? It's not on!!"
06910 GO TO 1490
06920 GO TO 1520
06930 PRINT "The Radar Jammer is not on."
06940 GO TO 1520
06950 IF INSTR(1,Q1$," ")=0 THEN 6955
06951 S0=INSTR(1,Q1$," ")
06952 IF S0=LEN(Q1$) THEN 6955
06953 Q$=MID$(Q1$,S0+1,LEN(Q1$)-S0)
06954 GO TO 6970
06955 PRINT "What do you want to turn on";
06960 INPUT Q$
06962 GOSUB 30000
06970 IF Q$="FLASHLIGHT" THEN 7040
06980 IF Q$="FLASH" THEN 7040
06990 IF Q$="RADAR" THEN 7020
07000 PRINT "A what?"
07010 GO TO 6955
07020 PRINT "The Radar Jammer does not seem to work here."
07030 GO TO 1490
07040 IF F=1 THEN 7080
07050 F=1
07060 PRINT "Your flashlight cuts a narrow swath in the darkness."
07070 GO TO 1490
07080 PRINT "What, are you blind?!? It's already on!"
07090 GO TO 1490
07100 IF L=0 THEN 7140
07110 PRINT "OK, the lantern is out."
07120 L=0
07130 GO TO 1520
07140 PRINT "It's already out, DUMMY!!"
07150 GO TO 1520
07160 W1=A+B+C
07170 IF W1=152 THEN 7200
07180 PRINT "There is nothing here to pry."
07190 GO TO 1520
07200 W=1
07210 PRINT "You have pried open the Meatlocker door."
07220 GO TO 1520
07230 IF L=1 THEN 7340
07240 E1=A+B+C
07250 IF E1=142 THEN 8930
07260 IF E1=111 THEN 8930
07270 IF E1=421 THEN 8930
07280 IF K3>0 THEN 7310
07290 PRINT "You can't light the lantern; you're out of fuel."
07300 GO TO 1520
07310 PRINT "The lantern casts eerie shadows on the wall."
07320 L=1
07330 GO TO 1520
07340 PRINT "You just burned your fingers because the lantern"
07350 PRINT "is already lit!  Boy, are you dumb."
07360 GO TO 1520
07370 P8=K*P9+M
07380 PRINT "You have accumulated ";P8;" points so far."
07390 GO TO 1490
07400 S2=A+B+C
07410 IF S2=114 THEN 7470
07420 IF S2=124 THEN 7470
07430 IF S2=134 THEN 7470
07440 PRINT "Your spraying has no effect on anything in the "
07450 PRINT "room. The spray does, however, smell pretty bad."
07460 GO TO 1520
07470 PRINT "The ghosts shy away from you, but still look at"
07480 PRINT "you hungrily..."
07490 GO TO 1520
07500 C1=A+B+C
07510 IF C1=214 THEN 7570
07520 IF C1=224 THEN 7570
07530 PRINT "You have severed the head of the snake.  There is "
07540 PRINT "nothing else in the box."
07550 B(A+B+C)=28
07560 GO TO 1520
07570 IF RND<-.05*K+.95 THEN 7600
07580 PRINT "You have damaged the plants, but it wasn't enough."
07590 GO TO 8460
07600 PRINT "You have damaged the plants in this part of the"
07610 PRINT "room enough to manuever safely for a short while."
07620 GO TO 1520
07630 PRINT "There is not much here to chop. If you continue"
07640 PRINT "to chop so freely, you may hurt yourself."
07650 GO TO 1520
07660 IF A+B+C=111 THEN 7690
07670 PRINT "There is nothing here to fill the lantern with."
07680 GO TO 1520
07690 PRINT "The lantern is now full."
07700 K3=K9
07710 GO TO 1520
07720 IF B(6)=1 THEN 7750
07730 PRINT "You don't have any spare batteries!"
07740  GO TO 1520
07750 PRINT "Duracell...the most MACHO battery you can buy!"
07760 B(6)=0
07770 B4=B9
07780 GO TO 1520
07790 REM		TAKE ROUTINE.....
07800 IF INSTR(1,Q1$," ")=0 THEN 7830
07810 S0=INSTR(1,Q1$," ")
07811 IF S0=LEN(Q1$) THEN 7830
07812 Q$=MID$(Q1$,S0+1,LEN(Q1$)-S0)
07820 GO TO 7850
07830 PRINT "Take? Take What";
07840 INPUT Q$
07842 GOSUB 30000
07850 IF Q$="KEY" THEN 8300
07860 IF Q$="WATCH" THEN 7930
07870 IF Q$="COINS" THEN 7990
07880 IF Q$="DIAMONDS" THEN 8050
07890 IF LEFT$(Q$,4)="BATT" THEN 8210
07900 IF Q$="SNAKE" THEN 8110
07910 GO TO 9950
07920 GO TO 1490
07930 IF B(A+B+C)=8 THEN 7960
07940 PRINT "Watch?  There is no watch here!"
07950 GO TO 1490
07960 PRINT "It looks good on you, too!"
07970 P9=P9+10
07975 B(8)=1
07980 GO TO 8280
07990 IF B(A+B+C)=9 THEN 8020
08000 PRINT "Coins?  There are no coins here!"
08010 GO TO 1490
08020 PRINT "Your pockets are now stuffed full of coins!"
08030 P9=P9+10
08035 B(9)=1
08040 GO TO 8280
08050 IF B(A+B+C)=10 THEN 8080
08060 PRINT "Diamonds are forever, but there are none here!"
08070 GO TO 1490
08080 PRINT "Your pockets are now full of diamonds! Lucky you!"
08090 P9=P9+10
08095 B(10)=1
08100 GO TO 8280
08110 IF B(A+B+C)=28 THEN 8140
08120 PRINT "There's no snake here!"
08130 GO TO 1520
08140 PRINT "What's that for? A souvenier to show "
08150 PRINT "the guys back home?  In any case, you now"
08160 PRINT "are carrying a dead snake with you."
08170 P9=P9+10
08180 B(28)=1
08190 B(A+B+C)=0
08200 GO TO 1520
08210 IF B(A+B+C)=6 THEN 8240
08220 PRINT "Sorry! No batteries in here!"
08230 GO TO 1520
08240 PRINT "And they're Duracells! Wise move!"
08250 B(A+B+C)=0
08260 P9=P9+10
08270 B(6)=1
08280 B(A+B+C)=0
08290 GO TO 1520
08300 IF B(A+B+C)=4 THEN 8340
08310 IF B(A+B+C)=5 THEN 8340
08320 PRINT "Key? There's no key in here!"
08330 GO TO 1520
08340 PRINT "O.K."
08350 B(B(A+B+C))=1
08360 B(A+B+C)=0
08370 GO TO 1520
08380 IF P$="CHOP" THEN 8460
08390 IF P$="SPRAY" THEN 8480
08400 IF P$="SWAT" THEN 9590
08410 GO TO 8540
08420 PRINT "You are surrounded by darkness.....thousands of"
08430 PRINT "dwarves and goblins, no longer afraid of you,"
08440 PRINT "attack and devour you!!!!  AAAAARRRRRRGGHHH!!!"
08450 GO TO 8540
08460 PRINT "You have been mercilously devoured!!!!"
08470 GO TO 8540
08480 PRINT "The ghosts have strapped you to the bed and"
08490 PRINT "smothered you!!!!"
08500 GO TO 8540
08510 PRINT "The bats have pecked your eyes out and you"
08520 PRINT "you have bled to a hideous death!!!!"
08530 GO TO 8540
08540 PRINT "You are no longer in the house or the game."
08550 PRINT "You were in the house for exactly ";M-1;" moves."
08560 P8=K*P9+M
08570 PRINT "You scored a total of ";P8;" points."
08580 PRINT "Do you want to play again";
08590 INPUT Q$
08592 GOSUB 30000
08600 IF Q$="YES" THEN 10
08601 IF Q$="Y" THEN 10
08610 GO TO 99999
08620 IF Q$<>P$ THEN 8510
08621 IF INSTR(1,Q1$," ")=0 THEN 8630
08622 S0=INSTR(1,Q1$," ")
08623 IF S0=LEN(Q1$) THEN 8630
08624 T$=MID$(Q1$,S0+1,LEN(Q1$)-S0)
08625 GO TO 8650
08630 PRINT "What do you want to turn on";
08640 INPUT T$
08641 R$=Q$
08642 Q$=T$
08643 GOSUB 30000
08644 T$=Q$
08645 Q$=R$
08650 IF T$="RADAR" THEN 8670
08660 GO TO 8510
08670 PRINT "By turning on your radar-jammer you have"
08680 PRINT "confused the bats into thinking that you "
08690 PRINT "are not in the room. You can move around."
08700 GO TO 1520
08710 FOR N9= 1 TO 5
08720 PRINT
08730 NEXT N9
08740 RETURN
08750 PRINT "The sheets have broken and you have fallen to a"
08760 PRINT "painful death."
08770 GO TO 8540
08780 PRINT "This instruction is not clear."
08790 PRINT "What next";
08800 INPUT Q$
08802 GOSUB 30000
08810 IF Q$<>"DWEEB" THEN 1530
08820 GOSUB 8710
08830 GOSUB 8710
08840 GOSUB 8710
08850 GOSUB 8710
08860 PRINT "INPUT ROOM COORDINATES: A,B,C:";
08870 INPUT A,B,C
08871 IF A>4 THEN 8921
08872 IF B>5 THEN 8921
08873 IF C>4 THEN 8921
08880  A=A*100
08881 B=B*10
08890 GOSUB 8710
08900 GOSUB 8710
08910 GOSUB 8710
08920 GO TO 750
08921 PRINT " You have just blasted yourself into the afterworld!!!"
08922 GO TO 8540
08930 PRINT ".......K A B O O O M!!!!!!"
08940 GO TO 8540
08950 IF INSTR(1,Q1$," ")=0 THEN 8955
08951 S0=INSTR(1,Q1$," ")
08952 IF S0=LEN(Q1$) THEN 8955
08953 Q$=MID$(Q1$,S0+1,LEN(Q1$)-S0)
08954 GO TO 8970
08955 PRINT "What do you want to read";
08960 INPUT Q$
08962 GOSUB 30000
08970 IF Q$<>"DICTIONARY" THEN 9040
08980 PRINT "You open the dictionary....it says..."
08990 PRINT "Ahhhh...too bad. It is written in ghost language."
09000 PRINT "Do you know how to read ghost language";
09010 INPUT Q$
09012 GOSUB 30000
09020 IF Q$="YES" THEN 9100
09021 if Q$="Y" THEN 9100
09030 GO TO 1520
09040 IF Q$="BOOK" THEN 9150
09050 IF Q$="BOOKS" THEN 9150
09060 IF Q$="MAGAZINE" THEN 9150
09070 IF Q$="MAGAZINES" THEN 9150
09080 PRINT "You can't read a ";Q$;" , FOOL!!"
09090 GO TO 1520
09100 PRINT "What does IARANDME mean";
09110 INPUT Q$
09111 GOSUB 30000
09112 IF Q$="IAMANERD" THEN 9141
09113 IF Q$="IAMA NERD" THEN 9141
09114 IF Q$="IAM ANERD" THEN 9141
09115 IF Q$="IAM A NERD" THEN 9141
09116 IF Q$="I AMANERD" THEN 9141
09117 IF Q$="I AMA NERD" THEN 9141
09118 IF Q$="I AM ANERD" THEN 9141
09119 IF Q$="I AM A NERD" THEN 9141
09120 PRINT "That is not correct. That means you lied, and"
09130 PRINT "this house does not like a LIAR!!"
09140 GO TO 8540
09141 PRINT "That is CORRECT!! You must be a NERD to understand"
09142 PRINT "ghost language."
09143 PRINT "All is not lost however. All you have to do is talk to ..."
09144 A9=1
09145 GO TO 9280
09150 R1=(A+B+C)
09160 IF R1=412 THEN 9620
09170 IF R1=333 THEN 9650
09180 IF R1=154 THEN 9730
09190 PRINT "There are none here to read!"
09200 GO TO 1490
09210 PRINT
09220 PRINT
09230 PRINT 
09240 PRINT "           SUDDENLY......"
09250 PRINT " an icy chill races down your spine; Someone is behind you!!"
09260 PRINT "         you turn........"
09270 PRINT "  It's"
09280 PRINT "        !! T E D   K E N N E D Y !!"
09290 PRINT
09300 PRINT " He offers to show you the way out; "
09310 PRINT " will you follow him";
09320 INPUT H$
09321 R$=Q$
09322 Q$=H$
09323 GOSUB 30000
09324 H$=Q$
09325 Q$=R$
09330 IF H$="YES" THEN 9430
09340 IF H$="NO" THEN 9390
09350 PRINT " Are you speaking English,son?? Now please "
09360 PRINT " say yes or no to the Senator."
09370 PRINT " Well";
09380 GO TO 9320
09390 PRINT
09400 PRINT
09401 IF A9=1 THEN 9421
09410 PRINT " At this, Ted shrugs and walks away, shaking his head.."
09420 GO TO 1410
09421 PRINT "'I HATE NERDS!!!'"
09422 PRINT "  shouts the good senator as he smashes you to a pulp."
09423 A9=0
09424 GO TO 8540
09430 IF RND>.50 THEN 9460
09440 PRINT
09441 IF A9<>1 THEN 9450
09442 PRINT " 'You got away with it this time.'"
09443 PRINT " theatens the good senator."
09444 A9=0
09450 GO TO 2080
09460 PRINT 
09470 PRINT " Ah Ted, shouldn't we be going left here??"
09480 PRINT "   TED, left.... NO TED, LEFT.....LEFT!!!!!"
09490 PRINT
09500 PRINT " ooops, looks like Ted missed that turn, but he'll"
09510 PRINT " be back in a week to pull you out (or rather dredge"
09520 PRINT " you up)."
09521 A9=0
09530 GO TO 8540
09540 GO TO 8540
09550 PRINT "There is nothing here to swat!"
09560 GO TO 1490
09570 PRINT "You have miraculously killed all the flies."
09580 GO TO 1490
09590 PRINT "The flies have eaten all the skin off your body!"
09600 PRINT "You have bled to a hideous skinless death!"
09610 GO TO 8540
09620 PRINT "All the pages are the same... they say"
09630 PRINT "'If here ye rise, thence shall ye not fall back.'"
09640 GO TO 1520
09650 PRINT "Every page is the same! The writing says..."
09660 PRINT
09670 PRINT "                 HICJACKET"
09680 PRINT "What next";
09690 INPUT Q$
09692 GOSUB 30000
09700 IF Q$<>"HICJACKET" THEN 1530
09710  A=100
09711 B=10
09712 C=2
09720 GO TO 750
09730 PRINT "Hmm..this seems to be written in Swedish!"
09740 PRINT "Each page says.."
09750 PRINT "       'Oh, yah...on chancer der boom-boom!"
09760 PRINT "        VIRDE  !'"
09770 PRINT "What next";
09780 INPUT Q$
09782 GOSUB 30000
09790 IF Q$<>"VIRDE" THEN 1530
09800  A=100
09801 B=10
09802 C=1
09810 GO TO 750
09820 IF V=0 THEN 6090
09830 PRINT "There is a beautiful Stradivarius violin here!"
09840 GO TO 6090
09950 IF Q$="VIOLIN" THEN 10000
09955 IF Q$="TROPHIES" THEN 10100
09957 IF Q$="KNAPSACK" THEN 10200
09960 PRINT "You can't take the ";Q$;" !!"
09970 GO TO 1490
10000 IF (A+B+C)=114 THEN 10020
10005 PRINT "There is no violin here!"
10010 GO TO 1490
10020 IF V=0 THEN 10005
10030 PRINT "You are now the proud owner of a violin!"
10035 P9=P9+K
10037 B(30)=1
10040 V=0
10050 GO TO 1490
10100 IF (A+B+C)=214 THEN 10130
10105 PRINT "There are no trophies here."
10110 GO TO 1490
10130 IF T1=0 THEN 10160
10140 IF S5=1 THEN 10180
10150 PRINT "You can't possibly carry any of these without"
10153 PRINT "some form of help."
10155 GO TO 1490
10160 PRINT "There are no trophies here which can be carried"
10165 PRINT "anywhere, except for the ones in your knapsack."
10167 PRINT "Getting awfully greedy, aren't we?"
10168 GO TO 1490
10180 PRINT "You have taken all the trophies in the room"
10190 PRINT "which will fit in your knapsack. These will"
10193 PRINT "look real nice on the mantel back home!"
10194 S5=0
10195 P9=P9+K
10196 B(29)=1
10197 T1=0
10198 GO TO 1490
10200 IF B(A+B+C)=12 THEN 10250
10210 PRINT "There is no knapsack here."
10220 GO TO 1490
10250 PRINT "You now are wearing a knapsack on your back."
10255 S5=1
10257 B(12)=1
10260 GO TO 8280
10270 PRINT "You have with you....."
10271 PRINT "    TOILET PAPER, a CROWBAR, a LANTERN, a FLASHLIGHT,"
10272 PRINT "    a RADAR JAMMER, a MACHETE, A CAN OF GHOST REPELLANT,"
10273 PRINT "    some MATCHES, A DICTIONARY, and a FLY-SWATTER."
10280 PRINT "You have collected....."
10285 FOR N8=1 TO 30
10286 IF B(N8)= 0 THEN 10290
10287 S0=INSTR(1,B$(N8)," ")
10288 PRINT "...";MID$(B$(N8),S0+1,LEN(B$(N8))-S0)
10289 I1=1
10290 NEXT N8
10302 IF I1=1 THEN 10304
10303 PRINT "....nothing at all!"
10304 I1 = 0
10305 GO TO 1520
10400 M=M-1
10410 GO TO 710
20000 PRINT "To move around the house, type map directions like"
20005 PRINT "NORTH (N), EAST (E), or UP (U). All other commands"
20010 PRINT "are action words such as 'LOOK' or 'LIGHT'. Some"
20015 PRINT "action words that take objects may be entered"
20020 PRINT "as two-word commands. Your common sense will help"
20025 PRINT "you the most. To see what you are carrying, type"
20030 PRINT "INVENTORY (INVE). Strange things will occur from"
20035 PRINT "time to time, so beware!"
20040 GO TO 1520
30000 DIM Z(80)
30010 CHANGE Q$ TO Z
30020 FOR Z0=1 TO Z(0)
30030 IF Z(Z0)<97 THEN 30060
30040 IF Z(Z0)>122 THEN 30060
30050 Z(Z0)=Z(Z0)-32
30060 NEXT Z0
30070 CHANGE Z TO Q$
30080 RETURN
99999 END
