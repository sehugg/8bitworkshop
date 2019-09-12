
; From: http://www.deater.net/weave/vmwprod/tb1/tb_6502.html

	.segment "INIT"
	.segment "ONCE"
; don't use $800-$1fff :(
	.segment "STARTUP"
        jmp Start
; use $4000- :)
	.segment "CODE"

.define EQU =

; blt = bcc
; bge = bcs

;; ZERO PAGE
CH      EQU $24
CV      EQU $25
BASL    EQU $28
BASH    EQU $29
H2	EQU $2C
COLOR   EQU $30
YSAV    EQU $34
YSAV1   EQU $35
RANDOM_SEED EQU $43

;; Our Zero Page Allocations

PADDLE_STATUS  EQU $CA
HISCORE_1      EQU $CB
HISCORE_2      EQU $CC
HISCORE_3      EQU $CD
HISCORE_H      EQU $CE
HISCORE_L      EQU $CF

BOSS_X 	       EQU $D0
BOSS_XADD      EQU $D1
BOSS_COUNT     EQU $D2
BOSS_SMOKE     EQU $D3
BOSS_EXPLODING EQU $D4
BOSS_WAITING   EQU $D5
BOSS_HITS      EQU $D6
BOSS_SHOOTING  EQU $D7

ENEMIES_SPAWNED     EQU $D8
ENEMY_TYPE          EQU $D9
ENEMY_WAVE          EQU $DA
CURRENT_INIT_X      EQU $DB
CURRENT_ENEMY_KIND  EQU $DC
TOTAL_ENEMIES_OUT   EQU $DD
SCROLL		    EQU $DE
SOUND_ON	    EQU $DF

SHIPX	     EQU $E0
SHIPXADD     EQU $E1 
ENEMY_PL     EQU $E2
ENEMY_PH     EQU $E3
MISSILE_PL   EQU $E4
MISSILE_PH   EQU $E5
GR_PAGE	     EQU $E6
LEVEL	     EQU $E7
SHIELDS	     EQU $E8
SCOREL	     EQU $E9
SCOREH	     EQU $EA
BONUS_FLAGS  EQU $EB

BCD_BYTEH    EQU $EC
BCD_BYTE     EQU $ED

COL_X1	     EQU $EC
COL_X2	     EQU $ED
COL_X3	     EQU $EE
COL_X4	     EQU $EF

ENEMY_EXPLODING EQU $F0
ENEMY_KIND	EQU $F1
ENEMY_X	        EQU $F2
ENEMY_Y	        EQU $F3
ENEMY_XADD      EQU $F4
ENEMY_YADD      EQU $F5
ENEMY_XMIN      EQU $F6
ENEMY_XMAX      EQU $F7

BETWEEN_DELAY   EQU $F8
ENEMY_WAIT      EQU $F9

STRINGL    EQU $FA
STRINGH    EQU $FB
PARAM2     EQU $FC
RESULT     EQU $FD
LASTKEY    EQU $FE
TEMP	   EQU $FF

;; VECTORS
BASIC EQU $3D0			       ;; VECTOR for return to Applesoft

KEYPRESS EQU $C000
KEYRESET EQU $C010

SPEAKER EQU $C030

;; SOFT SWITCHES
GR      EQU $C050
TEXT    EQU $C051
FULLGR  EQU $C052
TEXTGR  EQU $C053
PAGE0   EQU $C054
PAGE1   EQU $C055
LORES   EQU $C056
HIRES   EQU $C057

PADDLE_BUTTON0 EQU $C061
PADDL0  EQU $C064
PTRIG   EQU $C070

;; MONITOR ROUTINES
HLINE	EQU $F819  		       ;; HLINE Y,$2C at A
VLINE   EQU $F828		       ;; VLINE A,$2D at Y
CLRSCR  EQU $F832		       ;; Clear low-res screen
CLRTOP  EQU $F836		       ;; clear only top of low-res screen
SETCOL  EQU $F864		       ;; COLOR=A
BASCALC EQU $FBC1		       ;; 
HOME    EQU $FC58		       ;; Clear the text screen
WAIT    EQU $FCA8		       ;; delay 1/2(26+27A+5A^2) us
SETINV  EQU $FE80		       ;; INVERSE
SETNORM EQU $FE84		       ;; NORMAL
COUT1   EQU $FDF0		       ;; output A to screen


;; GAME PARAMETERS
NUM_MISSILES    EQU  2
NUM_ENEMIES     EQU  6
UP_SHIELDS      EQU 32
WAVE_SIZE       EQU 16
WAVES_TILL_BOSS EQU  5

;; BONUS_FLAGS
PERFECT_SHIELDS EQU $80
PERFECT_KILLS   EQU $40
PERFECT_AIM     EQU $1


;==========================================================
; MAIN()
;==========================================================


  ;==============================
  ; back up part of the zero page
  ;==============================
Start:
	lda	#>zero_page_save
	sta	BASH
	lda	#<zero_page_save
	sta	BASL

	ldy	#0
save_zp_loop:	
	lda	$C8,Y		       ; copy $C8-$FF
	sta	(BASL),Y	       ; to (zero_page_save)
	iny
	cpy	#$38		       ; we copy 56 bytes
	bne	save_zp_loop
	
	lda	#$ff
	sta	SOUND_ON


  ;==========================
  ; set graphics mode, page 0
  ;==========================
	jsr     HOME
	jsr	set_page0_gr
	
  ;=================  
  ; clear the screen   
  ;=================	   
	jsr	CLRTOP

  ;====================
  ; setup the high score
  ;=====================

        lda	#$01
	sta	HISCORE_H
	lda	#$00
	sta	HISCORE_L
	sta	PADDLE_STATUS
	
	; modestly make me the high scorer
	lda     #$D6
	sta	HISCORE_1
	lda	#$CD
	sta	HISCORE_2
	lda	#$D7
	sta	HISCORE_3

	lda	#>(score_string+31)
	sta	STRINGH
	lda	#<(score_string+31)
	sta	STRINGL
	jsr	print_high_score

  ;=============
  ; put vmw logo
  ;=============
  
	lda     #$7    		       ; y=7
	sta	CV
	lda	#$8		       ; x=8
	sta	CH
	lda	#>vmw_sprite
	sta	STRINGH
	lda	#<vmw_sprite
	sta	STRINGL
	jsr	blit   		       ; blit the vmw sprite
	
  ;==================================
  ; Write "A VMW SOFTWARE PRODUCTION"
  ;==================================
  
	lda	#>vmw_string	       ; string = vmw_string
	sta	STRINGH
	lda	#<vmw_string
	sta	STRINGL
	jsr	print_text_xy	       ; print the string

  ;======================
  ; wait until keypressed
  ;======================
	jsr	wait_until_keypressed
	
	
	
  ;======================
  ; Opening Graphic
  ;======================
opener:

   ;=================  
   ; clear the screen   
   ;=================
        jsr     set_page0_gr
		
	jsr	HOME		       ; clear the screen
	jsr	CLRTOP

   ;=======================
   ; put opening graphic up
   ;=======================
	lda     #$0    		       ; y=0
	sta	CV
	sta	CH
	lda	#>opener_sprite
	sta	STRINGH
	lda	#<opener_sprite
	sta	STRINGL
	jsr	blit   		       ; blit the opener sprite
	
	lda     #$A    		       ; y=10 (we had to split in two)
	sta	CV
	lda	#>opener_sprite_2
	sta	STRINGH
	lda	#<opener_sprite_2
	sta	STRINGL
	jsr	blit   		       ; blit the second half of sprite	


   ;================================================
   ; Write "MERCILESS MALICIOUS MARAUDING MARKETERS"
   ;================================================
   
	lda	#>mercy_string	       ; string = MMMM
	sta	STRINGH
	lda	#<mercy_string
	sta	STRINGL
	jsr	print_text_xy	       ; print the string

	jsr	wait_until_keypressed  ; wait until key pressed


;==========================================================
; The MAIN MENU
;==========================================================

main_menu:
	jsr     set_page0_text	       ; enter text mode
	jsr	HOME		       ; clear screen

	lda	#>help_string	       ; string = "H FOR HELP"
	sta	STRINGH
	lda	#<help_string
	sta	STRINGL
	jsr	print_text_xy	       ; print the string

	lda	#$5
	sta	PARAM2


	jsr	do_menu		       ; do the menu

	lda	RESULT		       ; load menu item from page0
	
	cmp	#$0		       ; is it zero?
	bne	check_1		       ; if not move ahead
	jmp	do_new_game	       ; yes, start new game
	
check_1:	
	cmp	#$1		       ; is it one?
	bne	check_2		       ; if not, move ahead
	jmp	do_about	       ; else, show about into
	
check_2:	
	cmp	#$2		       ; is it two?
	bne	check_3		       ; if not, move ahead
	jmp	do_story	       ; else, do the story info
	
check_3:	
	cmp	#$3		       ; is it three?
	bne	check_4		       ; if not, move ahead
	jmp	do_hi_score	       ; else, show hi-score
	
check_4:
	cmp	#$4		       ; is it four?
	bne	check_5		       ; if not move ahead
	jmp	exit		       ; if so exit

check_5:
	jsr	do_help

	jmp	main_menu	       ; return to main_menu loop


;==========================================================
; EXIT back to BASIC
;==========================================================

exit:
	jsr	SETNORM		       ; NORMAL text	
	jsr	set_page0_text
		
  ;======================
  ; restore the zero page
  ;======================
  
	lda	#>zero_page_save
	sta	BASH
	lda	#<zero_page_save
	sta	BASL

	ldy	#0
restore_zp_loop:	
	lda	(BASL),Y	       ; copy (zero_page_save)
	sta	$C8,Y	       	       ; back to $C8-$FF
	iny
	cpy	#$38		       ; we copy 56 bytes
	bne	restore_zp_loop
	
	jsr	HOME		       ; clear screen	
     	jmp 	(BASIC)		       ; return to BASIC



;==========================================================
; do_menu
;==========================================================
	; draw a text-mode menu

do_menu:
	lda	#$0		       ; start with menu=0
	sta	RESULT

menu:
	lda	#$8		       ; y=8
	sta	CV
	
	
	lda	#>new_game_string      ; string starts at "NEW GAME"
	sta	STRINGH
	lda	#<new_game_string
	sta	STRINGL


	ldy	#$0		       ; clear string offset pointer
	
	ldx	#$0		       ; clear line count

next_line:
	lda	#$8D		       ; carriage return
	jsr	COUT1
	
	lda	#$10   		       ; x=16
	sta	CH
	
	sty	TEMP		       ; save Y as NORM/INV changes it
	
	jsr	SETNORM		       ; set text style to normal
	
	cpx	RESULT		       ; are we at the selected entry?
	bne	menu_restore_y	       ; if not, move on
	
	jsr  	SETINV		       ; if so, reverse text

menu_restore_y:
	ldy	TEMP		       ; restore Y we saved earlier

menu_char:	

	
	lda	(STRINGL),Y	       ; get char from strings
	beq	done_line	       ; if 0, done this line
	jsr	COUT1		       ; monitor char output line
	iny			       ; indexY ++
	jmp	menu_char	       ; loop till done line
	
done_line:
	inx			       ; move to next line
	iny			       ; pointer after null
	cpx	PARAM2		       ; are we past end of menu?
	bne	next_line	       ; if not, print next line
	
menu_wait:
	jsr	wait_until_keypressed
	
	lda	LASTKEY

	cmp	#('Q')
	bne	check_h
	lda	#$4
	sta	RESULT
	rts
	
check_h:	
	cmp	#('H')
	bne	check_i
	lda	#$5    		       ; if help, set RESULT=5
	sta	RESULT
	rts
		
check_i:	
	cmp	#('I')
	bne	check_m
	dec	RESULT
	jmp	check_menu_values
	
check_m:	
	cmp	#('M')
       
	bne     check_cr

	inc	RESULT
	jmp	check_menu_values
check_cr:
	cmp	#(13)
	bne	menu_wait
	rts
	


check_menu_values:	
	
	lda	RESULT
	bpl	check_menu_over
	lda	PARAM2
	sbc	#$1
	sta	RESULT
	
check_menu_over:	
	cmp     PARAM2
	bne	menu
	lda	#$0
	sta	RESULT
	
	jmp	menu



	

;==========================================================
; do_about
;==========================================================
	; print the "about" info
	
do_about:
	bit	GR
	jsr	CLRTOP

	lda     #$0    		       ; x,y= 12,0
	sta	CV
	lda	#$C
	sta	CH
	
	lda	#>vince_sprite
	sta	STRINGH
	lda	#<vince_sprite
	sta	STRINGL
	jsr	blit   		       ; blit the pic of vince

	lda	#>about_lines
	sta	STRINGH
	lda	#<about_lines
	sta	STRINGL
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	
	jsr	wait_until_keypressed
	
	lda  #$6		       ; only want to clear bottom 3 lines
	sta  BASH		       ; so set pointer to $6D0
	lda  #$D0
	sta  BASL
	ldx  #$01		       ; set X already to 1
	jsr  bottom_y		       ; and jump midway into clear_bottom
		
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	

	jsr	wait_until_keypressed

	jmp	opener

;==========================================================
; do_help
;==========================================================
	; print the "help" info
	
do_help:
	jsr	set_page0_text
	jsr	HOME

	lda	#>help_lines
	sta	STRINGH
	lda	#<help_lines
	sta	STRINGL
	
	ldx	#$14
	jsr	print_x_strings          ; print text
				

	jsr	wait_until_keypressed

	rts
	

	
;==========================================================
; do_story
;==========================================================
	; the story routine
	
do_story:
	bit	GR
	jsr	CLRTOP

	;
	; draw the mars map
	;


	lda     #$0    		       ; y=0
	sta	CV
	sta	CH
	lda	#>phobos_sprite
	sta	STRINGH
	lda	#<phobos_sprite
	sta	STRINGL
	jsr	blit   		       ; blit the phobos sprite


	lda	#>story_lines
	sta	STRINGH
	lda	#<story_lines
	sta	STRINGL
	
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text

	jsr	wait_until_keypressed
	
	
	;
	; animate the droid launch
	;
	
	jsr	clear_bottom

	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	
	lda	#$12		       ; x=18
	sta	CH
	lda	#$7
	sta	CV 		       ; y=7

phobos_loop:

	lda	#>evil_ship_sprite
	sta	STRINGH
	lda	#<evil_ship_sprite
	sta	STRINGL
	jsr	blit   		       ; blit the droid sprite
	
	; delay
	; wait 1/2 (26+27A+5A^2) us
	
	lda     #$8B		       ; 107 = 30080us = 30ms
	jsr	WAIT
	
	lda	#$0 		       ; set color to zero
	jsr	SETCOL
	
		      		       ; HLINE H1,H2 at V1
	lda	CH    		       ; get x value
	tay			       ; move it to H1
	adc	#$3		       ; add 3
	sta	H2		       ; move it to H2
	lda	#$e		       ; set V1
	jsr	HLINE
	
	ldy	CH   		       ; reset H1
	lda	#$f		       ; set V1 to bottom value
	jsr	HLINE
		
	; move ship	
		
	inc	CH		       ; incrememnt X
	lda	CH
	cmp	#$25		       ; have we reached 37? (edge)
	bne	phobos_loop
	
	
	
	jsr	wait_until_keypressed
	
	;
	; "you are tom..."
	;
	
	jsr	clear_bottom
	jsr	CLRTOP
	
	lda     #$1    		       ; y=0
	sta	CV
	lda	#$C		       ; x=12
	sta	CH
	lda	#>tom_sprite
	sta	STRINGH
	lda	#<tom_sprite
	sta	STRINGL
	jsr	blit   		       ; blit the tom sprite

	lda	#>you_are_tom
	sta	STRINGH
	lda	#<you_are_tom
	sta	STRINGL

	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	
	jsr	wait_until_keypressed

	jmp	opener
	
	
;==========================================================
; do_ending
;==========================================================
	; the ending you get after level 1
	
do_ending:
	jsr	set_page0_gr	       ; set graphics mode
	jsr	CLRTOP
	jsr	clear_bottom
	
	;
	; draw the earth
	;

	lda     #$7    		       ; y=7
	sta	CV
	lda	#$F		       ; x=15
	sta	CH
	lda	#>earth_sprite
	sta	STRINGH
	lda	#<earth_sprite
	sta	STRINGL
	jsr	blit   		       ; blit the earth sprite


	lda	#>ending_lines
	sta	STRINGH
	lda	#<ending_lines
	sta	STRINGL
	
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text

	ldx	#30
	jsr	wait_X_100msec	       ; pause for 3 seconds
	bit	KEYRESET	       ; clear keyboard

	jsr	wait_until_keypressed
	
	
	;
	; second page
	;




	jsr	clear_bottom

	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
	jsr	print_text_xy          ; print text
			
	jsr	wait_until_keypressed
	
	;
	; third page
	;

	jsr	CLRTOP
	jsr	clear_bottom

	;
	; draw Susie
	;

	lda     #$7    		       ; y=7
	sta	CV
	lda	#$A		       ; x=10
	sta	CH
	lda	#>susie_sprite
	sta	STRINGH
	lda	#<susie_sprite
	sta	STRINGL
	jsr	blit   		       ; blit the susie sprite


	lda	#>susie_lines
	sta	STRINGH
	lda	#<susie_lines
	sta	STRINGL

	jsr	print_text_xy          ; print text
	jsr	wait_until_keypressed
	
	;
	; fourth page
	;

	jsr	CLRTOP
	jsr	clear_bottom

	;
	; draw Tom's head
	;

	lda     #$7    		       ; y=7
	sta	CV
	lda	#$F		       ; x=15
	sta	CH
	lda	#>tom_head_sprite
	sta	STRINGH
	lda	#<tom_head_sprite
	sta	STRINGL
	jsr	blit   		       ; blit Tom's head


	lda	#>tom_sigh
	sta	STRINGH
	lda	#<tom_sigh
	sta	STRINGL

	jsr	print_text_xy          ; print text
	jsr	wait_until_keypressed
	
	jmp	no_ending


;==========================================================
; START NEW GAME 
;==========================================================


do_new_game:


	;; set up struct pointers

	lda	#>missile_0	       ; clear the missile struct
	sta	MISSILE_PH	       ; should make this clear all BSS
	lda	#<missile_0	       ; at some point
	sta	MISSILE_PL
	
	lda	#>enemy_0
	sta	ENEMY_PH
	lda	#<enemy_0
	sta	ENEMY_PL

	;; Clear BSS

	ldy	#$0
	lda	#$0
clear_bss:
	sta     start_bss,Y
	iny
	cpy	#end_bss-start_bss
	bne	clear_bss
	
	;; Init one-time vars
	
	lda	#$8
	sta	SHIELDS		       ; shields start at 8
	jsr	update_shields

	lda	#$12
	sta	SHIPX		       ; shipx at start is 18
	
	lda	#$1
	sta	LEVEL		       ; start at level 1

	lda	#$0
	sta	SCOREL
	sta	SCOREH
	jsr	print_score
	
new_level:	

	;========================
	; Setup various variables
	;========================
	


	lda	#(PERFECT_AIM|PERFECT_SHIELDS|PERFECT_KILLS)
	sta	BONUS_FLAGS	       ; set perfect shot/shield/enemies

	lda	#$14
	sta	ENEMY_WAIT

	lda	#$0
	sta	BETWEEN_DELAY
	sta	SHIPXADD	       ; clear shipxadd
	sta	ENEMY_WAVE
	sta	TOTAL_ENEMIES_OUT
	sta	ENEMIES_SPAWNED
	sta	ENEMY_TYPE

	;=======================
	; Print "LEVEL X"
	;=======================
	
	jsr	set_page0_text
	jsr	HOME
	
	;===================
	; set level to level
	;===================
	
	lda	#>(level_string+9)
	sta	STRINGH
	lda	#<(level_string+9)
	sta	STRINGL

	lda	#0
	sta	BCD_BYTEH
	lda	LEVEL
	sta	BCD_BYTE
	jsr	print_bcd_byte
	

	;======================
	; Print level on screen
	;======================
	
	lda	#>(level_string_xy)
	sta	STRINGH
	lda	#<(level_string_xy)
	sta	STRINGL

	jsr	print_text_xy
	
	ldx	#20
	jsr	wait_X_100msec	       ; pause for 3 seconds
	bit	KEYRESET	       ; clear keyboard	

	;==================================
	; Enter graphics mode, clear screen
	;==================================

	jsr	set_page0_gr	       ; set graphics mode
	jsr	clear_screen	       ; clear screen


draw_stars:

	;=====================
	; Setup star field
	;=====================

	lda	#>(star_field)
	sta	STRINGH
	lda	#<(star_field)
	sta	STRINGL
	
	ldy	#$0
star_init:	
	jsr	random_number
	and	#$9f
	clc
	adc	#$4
	sta	(STRINGL),Y
	iny
	lda	#$0
	sta	(STRINGL),Y
	iny
	bne	star_init

	lda	#$0
	sta	SCROLL
	

        ;/========================\
	;+                        +
	;+    MAIN GAME LOOP      +
	;+                        +
	;\========================/

main_game_loop:
	jsr	clear_screen	       ; clear screen
	jsr	show_stars



	

done_scrolling:

        ; ================================
	;  put out new enemies (if needed)
	; ================================
	
	inc     BETWEEN_DELAY          ; inc how long we've delayed
	lda	BETWEEN_DELAY          ; load it in
	cmp	ENEMY_WAIT	       ; have we waited long enough?
	beq     reset_delay
	
	jmp	move_enemies	       ; if not, go on to movement
reset_delay:

	; delay==wait, so attempt to put out new enemy

	lda	BETWEEN_DELAY
	and	#$1
	sta	BETWEEN_DELAY          ; reset delay

	; special case for boss
  
	lda	#$9		       ; if boss, don't keep track of
	cmp	ENEMY_TYPE	       ; how many enemies were spawned
	bne	not_boss_dont_clear
	
	lda	#$1		       ; store 1 so we don't increment wave
	sta	ENEMIES_SPAWNED

not_boss_dont_clear:

	; see if we are at a new wave
	; basically, if 16 have been spawned, change
	
	lda   	ENEMIES_SPAWNED
	and	#$0f
        bne	same_enemy_type	       ; if not 16 gone by, move on
	
	;=======================
	; change  the enemy type

	inc	ENEMIES_SPAWNED

	jsr	random_number
	and	#$7	     	       ; get a random number 0-7
	sta	ENEMY_TYPE
	
	inc	ENEMY_WAVE
	
	lda	ENEMY_WAVE		; have we gone enough waves to reach boss?
	cmp	#WAVES_TILL_BOSS
	bne	not_boss_yet
	
	lda	#$8
	sta	ENEMY_TYPE
	
	
	
not_boss_yet:	

	; set various constants
	; these may be overriden later
	
	
	lda	#20
	sec	
	sbc	LEVEL
	sta	ENEMY_WAIT		; enemy_wait=20-level
	
	; set kind and init x to be random by default
	
	lda	#$ff
	sta	CURRENT_ENEMY_KIND
	sta	CURRENT_INIT_X



same_enemy_type:

	; find empty enemy slot
	
	ldy	#$0		       ; point to enemies[0]
	tya

find_empty_enemy:
	pha
	lda     (ENEMY_PL),Y	       ; get enemy[y].out	
	beq	add_enemy
	
	pla
        clc
	adc	#$9
	tay
	cpy	#(NUM_ENEMIES*9)
	bne	find_empty_enemy
	
	
	jmp	move_enemies	       ; no empty, slots, move on
	
	
add_enemy:
	pla
	
	;==============================================
	; First see if we must wait for enemy to clear
	; types 2 and 8
	
	lda	ENEMY_TYPE
	cmp	#$2
	
	bne	check_type_8
	
	lda	TOTAL_ENEMIES_OUT
	beq     change_to_type_3
	jmp	move_enemies
change_to_type_3:
	lda	#$3
	sta	ENEMY_TYPE
	
	jsr	random_number
	and	#$8
	sta	CURRENT_ENEMY_KIND
	
	jsr	random_number
	and	#$1F	      	       ; mask off so 0-31
	clc
	adc	#$2
	asl	A
	sta	CURRENT_INIT_X
	jmp	setup_enemy_defaults
	
check_type_8:	

        cmp	#$8
	beq	before_boss_stuff
	jmp	check_type_9

before_boss_stuff:

	;======================
	; before boss stuff
	
	lda	TOTAL_ENEMIES_OUT
	beq	prepare_for_boss
	jmp	move_enemies

prepare_for_boss:

	;===============
	; HANDLE BONUSES
	;===============
	
	; Set text mode
	
	jsr	set_page0_text
	jsr	HOME
	
	; Print "BONUS POINTS"
	
	lda	#>bonus_string
	sta	STRINGH
	lda	#<bonus_string
	sta	STRINGL
	
	jsr	print_text_xy          ; print text

	; Check to see if we had any bonuses

	lda	#$C1
	bit	BONUS_FLAGS
	beq	no_bonus
	
	
	; Check if we had no hits on shields
	
perfect_shields:
	bpl 	perfect_kills

	jsr	score_plus_50
		
	lda	#>bonus_shields
	sta	STRINGH
	lda	#<bonus_shields
	sta	STRINGL
	
	jsr	print_text_xy          ; print text
	

	; See if we killed all the enemies

perfect_kills:
	bit	BONUS_FLAGS
	bvc	perfect_aim

	jsr	score_plus_50
	
	lda	#>bonus_kills
	sta	STRINGH
	lda	#<bonus_kills
	sta	STRINGL
	
	jsr	print_text_xy          ; print text
	
	; See if no missiles missed

perfect_aim:
	lda 	#$01
	bit	BONUS_FLAGS
	beq	done_bonus
	
	jsr	score_plus_50
	
        lda	#>bonus_aim
	sta	STRINGH
	lda	#<bonus_aim
	sta	STRINGL
	
	jsr	print_text_xy          ; print text
	
	jmp 	done_bonus
	
	; we had no bonuses
	
no_bonus:
	lda	#>no_bonus_string
	sta	STRINGH
	lda	#<no_bonus_string
	sta	STRINGL
	
	jsr	print_text_xy          ; print text

	; Wait until a keypress, and return to graphics mode

done_bonus:

	ldx	#30
	jsr	wait_X_100msec	       ; pause for 3 seconds
	bit	KEYRESET	       ; clear keyboard
	
	jsr	wait_until_keypressed
	jsr     set_page0_gr
		      
	
	;======================
	; setup boss

	lda	#$0C
	sta	BOSS_X			; boss_x = 13
	
	lda	#$1
	sta	BOSS_XADD		; boss_xadd=1
	sta	BOSS_WAITING		; boss_waiting=1
			
	jsr	random_number
	and	#$1f
	sta	BOSS_COUNT		; boss_count = rand%32
	
	lda	#$0
	sta	BOSS_SMOKE		; boss_smoke=0
	sta	BOSS_EXPLODING		; boss_exploding=0
	sta	BOSS_SHOOTING		; boss_shooting=0
	
	lda	LEVEL
	asl	A
	clc
	adc	#$10
	sta	BOSS_HITS		; boss_hits=(level*2)+20

	lda	#$9
	sta	ENEMY_TYPE		; enemy_type=9
	
	jmp	move_enemies
	
	
check_type_9:

	; if boss, and he's waiting,
	; don't produce enemies
	
	cmp	#$9
	bne	setup_enemy_defaults
	lda	BOSS_WAITING
	beq	setup_enemy_defaults
	jmp     move_enemies
	
	
	;========================
	; setup enemy defaults
setup_enemy_defaults:
	inc	ENEMIES_SPAWNED
	inc	TOTAL_ENEMIES_OUT

	lda	#$1
	sta	(ENEMY_PL),Y	       ; enemy[i].out=1
	
	lda	#$0
	iny	; exploding
	sta	(ENEMY_PL),Y	       ; enemy[i].exploding=0
	
	iny	; kind
	
	lda	CURRENT_ENEMY_KIND     ; if kind <0 then random
	bpl	store_enemy_kind
	
	jsr	random_number
	and	#$38

	jmp	store_enemy_kind

store_enemy_kind:
	sta	(ENEMY_PL),Y

	; determine enemy _x
	; if < 0, make random between 2->34
	
	lda     CURRENT_INIT_X
	bpl	store_init_x
	
	jsr	random_number
	and	#$1f
	clc
	adc	#$2
	asl

store_init_x:
	iny	; X
	sta	(ENEMY_PL),Y

	; enemy_y is always 0 by default

	iny	; Y
	lda	#$0
	sta	(ENEMY_PL),Y
	
	lda	#$0
	iny
	sta	(ENEMY_PL),Y	       ; xadd
	iny
	sta	(ENEMY_PL),Y	       ; yadd
	lda	#$2
	iny
	sta	(ENEMY_PL),Y	       ; xmin
	iny
	lda	#$24
	sta	(ENEMY_PL),Y	       ; ymin

	dey			       ; xmin
	dey			       ; yadd
	dey			       ; xadd


	;===========================================
	; Enemy specific inits
	
	lda	ENEMY_TYPE
	beq	enemy_type_0
	cmp	#$1
	beq	enemy_type_1
	jmp	enemy_type_2
   
enemy_type_0:
enemy_type_1:

	;================================
	; ENEMY TYPE 0 and 1
	; diagonal, no wait
	; movement proportional to level

	lda	LEVEL		       ; xadd = level
	sta	(ENEMY_PL),Y

	iny

	lsr	A
	ora	#$1		       
	sta	(ENEMY_PL),Y	       ; yadd = level/2
	jmp	move_enemies

enemy_type_2:
	;=====================
	; Enemy Type 2
	; just a place-holder
	; waits for enemies to die then moves on to 3
	
	cmp	#$2
	bne	enemy_type_3
	jmp	move_enemies


enemy_type_3:

	cmp  	#$3
	bne	enemy_type_4

	;======================
	; Enemy type 3
	
	lda	#$1
	sta	(ENEMY_PL),Y		; xadd=1
	
	iny
	
	lda	LEVEL
	sta	(ENEMY_PL),Y		; yadd=level
	
	jmp	move_enemies

enemy_type_4:

	cmp	#$4
	bne	enemy_type_5


	;=========================
	; Enemy Type 4
	; Horizontal, then fall
	
	lda	#$2
	sta	(ENEMY_PL),Y		; xadd = 2
	
	iny
	
	jsr	random_number
	ora	#$80	     		; set negative
	sta	(ENEMY_PL),y		; yadd = -(random%128)
					; this means bop back and forth a random
					; time, then drop
					
	jmp	move_enemies


enemy_type_5:
	cmp     #$5
	bne	enemy_type_6
	
	;========================
	; Enemy Type 5
	; "wiggle"
	
	lda	#$1
	sta	(ENEMY_PL),y		; xadd=1
	
	iny
	lda	LEVEL
	sta	(ENEMY_PL),y		; yadd=2
	
	iny
	jsr	random_number
	and	#$0f
	clc
	adc	#$2
	sta	(ENEMY_PL),y		; xmin=(rand%16)+2


	dey ; yadd
	dey ; xadd
	dey ; y
	dey ;x
	asl    A
	sta    (ENEMY_PL),y
	iny ;y
	iny ; xadd
	iny ; yadd
	iny ; xmin

	jsr	random_number
	and	#$0f
	clc
	adc	(ENEMY_PL),Y
	adc	#$02
	iny
	sta	(ENEMY_PL),Y		; xmax = xmin+(rand%16)+2
	
	jmp	move_enemies
	

enemy_type_6:
	cmp     #$6
	beq	enemy_type_7
	cmp	#$7
	beq	enemy_type_7
	jmp	enemy_type_8
enemy_type_7:
	;=====================
	; Enemy Types 6+7
	; "Rain"



	jsr	random_number
	and	#6
	bne	no_use_own_x

	dey ; y
	dey ; x

	lda	SHIPX
	cmp	#$2
	bpl	shipx_ok
	lda	#$2			; stupid bug where gets stuck is < xmin
	
shipx_ok:	
	
	asl	A
	sta	(ENEMY_PL),Y		; one-in-four chance we use shipx as X
	
	iny ; y
	iny ; xadd
	
no_use_own_x:	

	lda	#$0
	sta	(ENEMY_PL),Y		; xadd=0
	iny
	lda	#$1
	sta	(ENEMY_PL),Y		; yadd = 1

	jmp	move_enemies

enemy_type_8:
enemy_type_9:

	;======================
	; Things flung by boss


	dey	       	      		; y
	dey				; x
	
	lda	BOSS_X
	clc
	adc	#$5
	asl	A
	sta	(ENEMY_PL),Y		; enemy_x=boss_x+5
	
	iny
	lda	#$3
	asl	A
	asl	A
	sta	(ENEMY_PL),Y		; enemy_y=3


	iny
	lda	#$0
	sta	(ENEMY_PL),Y		; xadd=0
	
	iny
	lda	#$2
	sta	(ENEMY_PL),Y		; yadd=2
	
	


	
move_enemies:

  ;==============================================
  ; Move Enemies!  (first thing, if no new added)
  ;==============================================

	ldy	#$0		       ; point to enemies[0]
handle_enemies:

	tya
	pha			       ; store y on stack
	
	lda     (ENEMY_PL),Y	       ; get enemy[y].out
	bne	load_enemy_zero_page   ; if enemy.out then we are good

	jmp	skip_to_next_enemy     ; enemy is not out, so skip to next



   ;==========================================
   ; load this enemy stuff into zero page for
   ; easier access
   ;==========================================
	
load_enemy_zero_page:	
	ldx	#ENEMY_EXPLODING
load_to_zero_page:
	iny			       ; point to exploding
	lda	(ENEMY_PL),Y
	sta	0,X	    	       ; store to zero page	
	inx
	cpx	#(ENEMY_XMAX+1)	       ; see if reached end
	bne	load_to_zero_page      ; if not keep copying

   ;================================
   ; skip all movement and collision
   ; if exploding
   ;================================
   
        lda	ENEMY_EXPLODING
	beq     move_enemy_x
	jmp	draw_enemy

   ;================================
   ; Start the enemy movement engine
   ;================================

  
     ;========
     ; Move X
     ;========
     
move_enemy_x:
	clc
	lda	ENEMY_X	       	       ; X
	adc	ENEMY_XADD	       ; x+=xadd
	sta	ENEMY_X

	lsr	A

	cmp	ENEMY_XMIN	       ; are we less than xmin?
        bmi	switch_dir_enemy_x     ; if so, switch direction

	cmp	ENEMY_XMAX	       ; are we greater than xmax?
	bpl	switch_dir_enemy_x     ; if so, switch direction
	
	jmp	move_enemy_y


switch_dir_enemy_x:

	; switch X direction

	lda	#$0	    	       ; load zero
	sec			       
	sbc	ENEMY_XADD	       ; 0 - ENEMY_XADD
	sta	ENEMY_XADD	       ; store it back out, negated
	jmp	move_enemy_x	       ; re-add it in

     ;========
     ; Move Y
     ;========
     
move_enemy_y:

	lda	#$0		       ; load in zero
	cmp	ENEMY_YADD	       ; compare to YADD
	
	bmi	no_y_special_case      ; if minus, we have special case

	inc	ENEMY_YADD
	bne	done_enemy_y
	
	lda	#$0
	sta	ENEMY_XADD
	lda	#$2
	sta	ENEMY_YADD

	; increment y
	; is it > 0?
	; if not keep going
	; if so, yadd=level*2
	
	jmp	done_enemy_y
	
no_y_special_case:	
	clc
	lda	ENEMY_Y		       ; get Y
	adc	ENEMY_YADD	       ; y+=yadd
	sta	ENEMY_Y	       	       ; store back out
	
	lsr	A
	lsr	A
	
	cmp	#$12		       ; is y<=12?
	bmi	done_enemy_y	       ; if so no need to do anything
	beq	done_enemy_y	       
	
	; off screen
	
	pla   	    		       ; pop saved Y off stack
	tay
	pha			       ; push y back on stack
	
	lda	#$0
	sta	(ENEMY_PL),Y	       ; set enemy[i].out=0
	
	dec	TOTAL_ENEMIES_OUT
	
	lda	BONUS_FLAGS
	and	#<(~PERFECT_KILLS)
	sta	BONUS_FLAGS
	
	jmp	skip_to_next_enemy     ; skip to next enemy	
	

done_enemy_y:

   ;===============
   ; Done Movement
   ;===============


   ;======================
   ; Check for Collisions
   ;======================


     ;==================================
     ; Check ENEMY <> MISSILE collision
     ;==================================
     
check_enemy_missile_collision:	
	
	ldy     #$0
	sty	YSAV
check_missile_loop:	
	lda	(MISSILE_PL),Y
	beq	missile_not_out
	
	iny		       	       ; point to missile.x
	lda	(MISSILE_PL),Y	       ; load missile.x
	
	sta	COL_X1
	sta	COL_X2
	
	lda	ENEMY_X
	lsr	A
	sta	COL_X3
	clc
	adc	#3
	sta	COL_X4
	
	jsr	check_inside
	
	bcc	missile_done
	
x_in_range:

	iny
	lda	(MISSILE_PL),Y	       ; load missile.y
	
	sta	COL_X3
	clc
	adc	#2
	sta	COL_X4
	
	lda	ENEMY_Y
	lsr	A
	lsr	A
	sta	COL_X1
	clc
	adc	#1
	sta	COL_X2
	
	jsr	check_inside
	
	bcc	missile_done
	

horrible_explosion:
	
	; clear missile
	
	ldy	YSAV
	lda	#$0
	sta	(MISSILE_PL),Y
	
	; clear enemy
	
	lda	#$1
	sta	ENEMY_EXPLODING
	lda	#$40
	sta	ENEMY_KIND
	
	jsr inc_score
	
	jmp	draw_enemy
		
	
missile_done:	
missile_not_out:
	ldy	YSAV
	iny
	iny
	iny
	sty	YSAV
	cpy     #(NUM_MISSILES*3)
	bne	check_missile_loop

     ;=================================
     ; Done missile <> enemy collision
     ;=================================
     
     
     ;====================================
     ; check for ship <-> enemy collision
     ;====================================
	
	lda     SHIPX
	sta	COL_X3
	clc
	adc	#8
	sta	COL_X4		       ; big check is shipx - shipx+8
	
	lda	ENEMY_X
	lsr	A
	sta	COL_X1
	clc
	adc	#2
	sta	COL_X2		       ; small check enemy_x - enemy_x+2
	
	jsr	check_inside	       ; check if overlap

	bcc	draw_enemy	       ; if not, move ahead

	lda	#16
	sta	COL_X3
	lda	#18
	sta	COL_X4		       ; big check is 16 - 18
	
	lda	ENEMY_Y
	lsr	A
	lsr	A
	sta	COL_X1
	clc
	adc	#$1
	sta	COL_X2		       ; little check is enemy_y - enemy_y+1
	
	jsr	check_inside	       ; check if overlap

	bcc	draw_enemy  	       ; if not, move ahead
	
	; make the enemy explode
	
	lda	#$1
	sta	ENEMY_EXPLODING
	lda	#$40
	sta	ENEMY_KIND
	
	dec     SHIELDS
	jsr 	update_shields	       ; move shields down
	
	lda	#<(~PERFECT_SHIELDS)   ; (~PERFECT_SHIELDS)
	and    	BONUS_FLAGS	       ; remove perfect shield bonus
	sta	BONUS_FLAGS


     ;=====================================
     ; Done ship <> enemy collision detect
     ;=====================================


draw_enemy:

	; See if the enemy is currently exploding
	; if so, do explosion stuff

check_enemy_explode:
	lda	ENEMY_EXPLODING	       ; load enemy[i].exploding
	beq	not_exploding	       ; if 0 then not exploding
	
handle_exploding:

	jsr	click		       ; make some noise
	
	clc
	lda	ENEMY_KIND	       ; move to next step in explosion
	adc	#$4
	sta	ENEMY_KIND	

	cmp	#$58		       ; have we cycles through explosion?
	bne	draw_enemy_sprite      ; if not, we are still exploding

	dec	TOTAL_ENEMIES_OUT      ; total_enemies_out--

	pla
	tay			       ; load y
	pha
	
	lda	#$0		       ; enemy[i].out=0
	sta	(ENEMY_PL),Y
	
	jmp	skip_to_next_enemy	
	
	
        ; point to enemies_x
	; goto enemies_xy


not_exploding:



draw_enemy_sprite:
        
        ; point to proper sprite
    
        lda	#>enemy_sprite0       ; point to the missile sprite
	sta	STRINGH
	lda	#<enemy_sprite0
	sta	STRINGL

        lda	ENEMY_KIND	      ; get kind
	and	#$F8

	clc
	adc	STRINGL
	
	sta	STRINGL	
	lda	#0
	adc	STRINGH
	sta	STRINGH


enemies_xy:
	lda	ENEMY_X	       	       ; get X
	lsr	A
	sta	CH
	lda	ENEMY_Y	       	       ; load it
	lsr	A
	lsr	A
	sta	CV

	jsr	blit   		       ; blit the missile sprite




save_zp_enemy_back:
	; save zero page copy back to RAM

	ldx	#ENEMY_EXPLODING

	pla
	tay			       ; restore y pointer
	pha
	
save_from_zero_page:

	
	iny			       ; point to exploding
	lda	0,X
	sta	(ENEMY_PL),Y
		
	inx
	cpx	#(ENEMY_XMAX+1)	       ; see if reached end
	bne	save_from_zero_page    ; if not keep copying


skip_to_next_enemy:

	pla	  		       ; get saved value of Y
	clc			       
	adc	#$9		       ; add 9 to point to next
	tay

	cpy	#NUM_ENEMIES*9	       ; have we looped through them all?
	beq	draw_the_boss	       ; if not, loop
	jmp	handle_enemies


	;===================================================
	;===================================================
	; BOSS STUFF
	

draw_the_boss:
	      
	;=======================
	; if enemy_type==9
	; we have a boss out

	lda     ENEMY_TYPE
	cmp	#$9
	
	beq	check_boss_exploding
	jmp	done_with_boss
check_boss_exploding:	
	;================================
	; if not exploding, draw the boss
	
	lda	BOSS_EXPLODING
	bne	skip_draw_boss
	
	lda     #$0    	       	       ; boss_y=0
	sta	CV
	lda	BOSS_X
	sta	CH   		       ; boss_x

	lda	#>boss_sprite
	sta	STRINGH
	lda	#<boss_sprite
	sta	STRINGL
	jsr	blit   		       ; blit the ship sprite
	
skip_draw_boss:
	;================================
	; Draw Smoke
	
	lda     BOSS_SMOKE
	beq	skip_draw_smoke
	
	
        ; point to proper sprite
    
        lda	#>smoke_sprite0       ; point to the missile sprite
	sta	STRINGH
	lda	#<smoke_sprite0
	sta	STRINGL

        lda	BOSS_SMOKE	      ; get kind
	
	and	#$fc		      ; mask off bottom 2 bits
	
	clc
	adc	STRINGL
	
	sta	STRINGL	
	lda	#0
	adc	STRINGH
	sta	STRINGH

	lda	BOSS_X	       	       ; get X
	clc
	adc	#$5
	sta	CH
	lda	#$3	       	       ; load it
	sta	CV

	jsr	blit   		       ; blit the missile sprite

	lda	BOSS_X
	clc
	adc 	#$5
	sec
	sbc	BOSS_XADD
	sta	CH

	lda	#$4
	sta	CV

	jsr	blit

	dec	BOSS_SMOKE

skip_draw_smoke:

	;======================
	; BOSS Laser Shoot
	
	lda     BOSS_SHOOTING
	beq	skip_boss_shooting

	dec	BOSS_SHOOTING
	
	jsr	click
	

	ldx	#$0
boss_shoot_loop:
	txa
	pha
	
	; point to proper sprite
    
        lda	#>laser_sprite0       ; point to the missile sprite
	sta	STRINGH
	lda	#<laser_sprite0
	sta	STRINGL

        lda	BOSS_SHOOTING	      ; get shooting
	and	#$1

	beq	got_right_laser
	
	clc
	lda	#$5
	adc	STRINGL
	
	sta	STRINGL	
	lda	#0
	adc	STRINGH
	sta	STRINGH

got_right_laser:

	lda	BOSS_X
	sta	CH

	txa
	asl
	
	clc
	adc	#$3
	sta	CV
	
	jsr	blit   		       ; blit the laser sprite
	
	lda	BOSS_X
	clc
	adc	#$C
	sta	CH
	
	pla
	pha
	asl
	clc
	adc	#$3
	sta	CV
	
	
	jsr	blit
	

	pla
	tax
	inx
	cpx	#$8
	bne	boss_shoot_loop
	jsr	click


skip_boss_shooting:

	;=============================
	; boss is dead

	lda     BOSS_EXPLODING
	beq	boss_is_not_exploding

	lda	#$1
	sta	BOSS_WAITING
	
	ldx	#$20	
big_explosion:
	txa
	pha

	; point to proper sprite
    
        lda	#>smoke_sprite0       ; point to the missile sprite
	sta	STRINGH
	lda	#<smoke_sprite0
	sta	STRINGL

        lda	BOSS_EXPLODING	      ; get kind
	lsr	A
	lsr	A
	and	#$0c		      ; mask off bottom 2 bits
	
	clc
	adc	STRINGL
	
	sta	STRINGL	
	lda	#0
	adc	STRINGH
	sta	STRINGH

	jsr	random_number
	and	#$03
	sta	CV
	
	jsr	random_number
	and	#$07
	clc
	adc	BOSS_X
	sta	CH
	
	jsr	blit   		       ; blit the missile sprite

	pla
	tax
	dex
	bne	big_explosion

	jsr	click
	dec	BOSS_EXPLODING
	
	bne	not_dead_yet

	lda	LEVEL	    		; only show ending after level 1
	cmp	#$1
	bne	no_ending

	jmp	do_ending
	
no_ending:

	inc	SCOREH			; add 100 to score
	jsr	print_score
	
	lda	LEVEL
	cmp	#$7  			; level can't be higher than 7
	beq	start_new_level
	inc	LEVEL

	inc	SHIELDS
	inc	SHIELDS
	
	lda	#$A
	cmp	SHIELDS
	bpl	start_new_level
	sta	SHIELDS

start_new_level:
	jsr	update_shields
        jmp	new_level

not_dead_yet:
	jmp  	move_boss
	
boss_is_not_exploding:

	dec     BOSS_COUNT
	bne	move_boss

        ;=========================================
	; Toggle boss waiting state if count is up

	lda	BOSS_WAITING
	beq	make_boss_wait
stop_boss_waiting:
	lda	#$0
	sta	BOSS_WAITING		; boss_waiting=0
	jsr	random_number
	sta	BOSS_COUNT   		; boss_count=rand%256
	jmp	move_boss

make_boss_wait:
	lda     #$1
	sta	BOSS_WAITING
	
	jsr	random_number
	and	#$01f
	clc
	adc	#$30
	sta	BOSS_COUNT
	
	lda	#$20
	sta	BOSS_SHOOTING
	
move_boss:
	lda	BOSS_WAITING
	bne	laser_collision
	
	lda	BOSS_X
	clc
	adc	BOSS_XADD
	sta	BOSS_X
	
	cmp	#26
	bpl	boss_reverse
	
boss_under:
	cmp	#$0
	bpl	laser_collision
	
boss_reverse:

	lda	#$0	    	       ; load zero
	sec			       
	sbc	BOSS_XADD	       ; 0 - ENEMY_XADD
	sta	BOSS_XADD	       ; store it back out, negated
	jmp	move_boss	       ; re-add it in


laser_collision:

        ;================================
        ; Collision detection for lasers
	;
	
	lda	BOSS_SHOOTING
	beq	done_with_boss

left_laser:
	lda	BOSS_X
	sta	COL_X1
	sta	COL_X2
	lda	SHIPX
	sta	COL_X3
	lda	#$6
	clc
	adc	SHIPX
	sta	COL_X4
	jsr	check_inside
	bcs	laser_hit

right_laser:
        lda  	BOSS_X
        clc
        adc	#$C
        sta	COL_X1
        sta	COL_X2
        jsr	check_inside
        bcc	done_with_boss
       
laser_hit:
	lda	BOSS_SHOOTING
	and	#$3	     		; only take damage 1/8 the time
	bne	done_with_boss
	
	dec	SHIELDS
	jsr	update_shields




done_with_boss:

	ldy     #$0		       		 ; point to missile[0]
move_missiles:
	lda     (MISSILE_PL),Y			 ; get missile[y]
	beq	loop_move_missiles		 ; if missile.out==0 skip
	
	iny					 ; move to missile.y
	iny
	clc					 ; clear carry
	lda	(MISSILE_PL),Y			 ; get missile.y
	adc	#$FF				 ; move up (subtract 1)
	sta	(MISSILE_PL),Y			 ; store missile.y
	bpl	missile_collision_detection	 ; if not off screen, contine
	
	dey					 ; back up to missile.out
	dey
	lda	#$0
	sta	(MISSILE_PL),Y			 ; set missile.out=0
	
	lda	#<(~PERFECT_AIM)		 ; shot missed!
	and	BONUS_FLAGS     		 ; clear perfect shot flag
	sta	BONUS_FLAGS

	jmp	loop_move_missiles		 ; continue 

missile_collision_detection:

check_missile_boss:
	lda	ENEMY_TYPE
	cmp	#$9
	bne	done_missile_collision
	dey	; missile x
	lda	(MISSILE_PL),Y
	iny		      		; fix y
	sta	COL_X1
	sta	COL_X2
	lda	BOSS_X
	sta	COL_X3
	clc
	adc	#$0d
	sta	COL_X4
	jsr	check_inside
	
	bcc	done_missile_collision
	
check_boss_y:
	lda  	(MISSILE_PL),Y
	sta	COL_X1
	clc
	adc	#$2
	sta	COL_X2
	lda	#$0
	sta	COL_X3
	lda	#$3
	sta	COL_X4
	jsr	check_inside
	
	bcc	done_missile_collision

hit_the_boss:
	dey
	dey
	lda	#$0
	sta	(MISSILE_PL),Y		; missile_out=0
	lda	#$B
	sta	BOSS_SMOKE
	
	dec	BOSS_HITS
	bne	loop_move_missiles
	
	lda	#$2F
	sta	BOSS_EXPLODING
	lda	#$0
	sta	BOSS_SHOOTING
	
	jmp	loop_move_missiles

done_missile_collision:

	jmp	loop_move_at_y

loop_move_missiles:
	iny
	iny
loop_move_at_y:		
	iny
	cpy	#NUM_MISSILES*3	       ; have we checked all missiles?
	bne	move_missiles	       ; if not, loop

done_move_missiles:

	ldy	#$0		       ; point to missiles[0]
draw_missiles:
	lda     (MISSILE_PL),Y	       ; get missile[y]
	beq	loop_draw_missiles     ; if missile.out==0 skip

	iny			       ; point to missile.x
	lda	(MISSILE_PL),Y	       ; load it
	sta	CH
	iny	  		       ; point to missile.y
	lda	(MISSILE_PL),Y	       ; load it
	sta	CV

	sty	YSAV1		       ; save Y

	lda	#>missile_sprite       ; point to the missile sprite
	sta	STRINGH
	lda	#<missile_sprite
	sta	STRINGL
	jsr	blit   		       ; blit the missile sprite

	ldy	YSAV1		       ; restore Y

	jmp	loop_draw_missiles_noadd

loop_draw_missiles:
	iny
	iny
	
loop_draw_missiles_noadd:	
	iny

	cpy	#NUM_MISSILES*3	       ; have we looped through them all?
	bne	draw_missiles	       ; if not, loop
	


game_read_keyboard:
	jsr	get_key
	lda	LASTKEY
	bne	game_q
	jmp	move_ship	       ; if no keypressed, move the ship

game_q:
	cmp	#'Q'
	bne	game_j
	;; call verify_quit
	jmp	done_game
	;; jmp set_pause_flag

game_j:
	cmp	#'J'
	bne	game_k
	
	lda	SHIPXADD       	       ; load xadd
	beq	game_j_sub
	bpl	game_j_0	       ; is switch dir, then 0 it
game_j_sub:	
	dec	SHIPXADD	       ; else, dec XADD
	jmp	move_ship
game_j_0:
	lda	#$0
	sta	SHIPXADD
	jmp	move_ship

game_k:
	cmp     #'K'
	bne	game_c
	
	lda	SHIPXADD	       ; load xadd
	bmi	game_j_0	       ; if we are switching dirs, set to zero
	inc	SHIPXADD	       ; else xadd++
	jmp	move_ship

game_c:
        cmp	#'C'
	bne	game_p

	lda	PADDLE_STATUS
	eor	#$80
	sta	PADDLE_STATUS

	jmp	move_ship

game_p:
	cmp	#'P'
	bne	game_s
        bit	KEYRESET
	jsr	wait_until_keypressed
	jmp	move_ship

game_s:
	cmp     #'S'
        bne	game_h
	lda	SOUND_ON
	eor	#$ff
	sta	SOUND_ON
	jmp	move_ship

game_h:
	cmp	#'H'
	bne	game_space
	jsr	do_help
	jsr	set_page0_gr

game_space:
	cmp     #' '+128	       ; +128 because of get_key 'feature'
	bne	game_unknown

	ldy	#$0	    	       ; point to missile[y]
fire_missiles:
	lda     (MISSILE_PL),Y	       ; get missile[y].out
	bne	end_fire_loop	       ; if not out, skip ahead
	
	lda	#$1		       ; set missile[y].out=1
	sta	(MISSILE_PL),Y
	iny		      	       ; point to missile[y].x
	lda	#$3
	clc
	adc	SHIPX		       ; missile[y].x=shipx+3
	sta	(MISSILE_PL),Y
	iny		      	       ; point to missile[y].y
	lda	#$10		       ; set to 16
	sta	(MISSILE_PL),Y
	jmp	done_fire_missiles
	
end_fire_loop:	
	iny
	iny
	iny

	cpy	#NUM_MISSILES*3	       ; see if we have more missiles
	bne	fire_missiles	       ; if so, loop
done_fire_missiles:

	jmp	move_ship

game_unknown:




move_ship:
	clc			       ; Clear carry
	lda	SHIPX		       ; load ship_x
	adc	SHIPXADD	       ; ship_x+=xadd
	sta	SHIPX		       ; store it back

check_x_under:
	bpl	check_x_over	       ; if positive, keep going
	lda	#$0		       ; we were below zero
	sta	SHIPX		       ; so shipx=0
	sta	SHIPXADD	       ; xadd=0
	jmp	blit_ship	       ; go to blit
		
check_x_over:	
	cmp	#$21		       ; are we over 33?
	bmi	blit_ship	       ; if not, blit ship
	lda	#$0		       ; shipxadd=0
	sta	SHIPXADD
	lda	#$21		       ; shipx=33
	sta	SHIPX
	
blit_ship:
	lda     #$10    	       ; shipy=16
	sta	CV
	lda	SHIPX
	sta	CH   		       ; load shipx


	lda	#>ship_sprite
	sta	STRINGH
	lda	#<ship_sprite
	sta	STRINGL
	jsr	blit   		       ; blit the ship sprite

	jsr	clear_bottom
	
	lda	#>shields_string
	sta	STRINGH
	lda	#<shields_string
	sta	STRINGL
	
	clc
	lda	#$2
	adc	GR_PAGE
	sta	BASH
	lda	#$50
	sta	BASL
	
	ldy	#$0
	
shield_print_loop:	

        ;=============================
	; CHECK TO SEE IF GAME IS OVER
	;=============================
	
	lda	SHIELDS
	bmi	done_game
	

	lda	(STRINGL),Y
	sta	(BASL),Y
	iny
	cpy	#$1E		       ; string is 30 long
	bne	shield_print_loop

	inc	BASH		       ; move to line 23

	lda	#>score_string
	sta	STRINGH
	lda	#<score_string
	sta	STRINGL

	ldy	#$0
	
score_print_loop:
	lda	(STRINGL),Y
	sta	(BASL),Y
	iny
	cpy	#$26		       ; string is 38 long
	bne	score_print_loop
	
	clc
	lda	#$80
	adc	BASL
	sta	BASL		       ; move to line 24

;OPTIMIZE

	lda	#>level_string
	sta	STRINGH
	lda	#<level_string
	sta	STRINGL
	
	ldy	#$0
level_print_loop:
	lda	(STRINGL),Y
	sta	(BASL),Y
	iny
	cpy	#$C		       ; string is 12 long
	bne	level_print_loop
	
	
	


	;==========
	; Flip Pages

	lda	#$4
	bit     GR_PAGE
	bne	gr_page_1
	
gr_page_0:	
	bit	PAGE1	 	       ; switch to page 0
	lda	#$4
	jmp	write_out_gr_page	
gr_page_1:
	bit	PAGE0		       ; switch to page 1
	lda	#$8
write_out_gr_page:
	sta     GR_PAGE

;	lda     #$8B		       ; 107 = 30080us = 30ms
	lda	#$65
	jsr	WAIT


	jmp	main_game_loop

done_game:


	ldx	#30
	jsr	wait_X_100msec	       ; pause for 3 seconds
	bit	KEYRESET	       ; clear keyboard
	
	jsr	set_page0_text
	jsr	HOME
	
	lda	#>game_over_string
	sta	STRINGH
	lda	#<game_over_string
	sta	STRINGL

	jsr	print_text_xy
	
	jsr	wait_until_keypressed

	jsr	set_page0_text

see_if_new_hi_score:

	sed
	lda	SCOREH
	cmp	HISCORE_H
	cld
	
	beq	too_close
	bpl	new_high
	jmp	do_hi_score

	
too_close:
	sed
        lda	SCOREL
	cmp	HISCORE_L
	cld
	
	bpl	new_high
	jmp	do_hi_score
	
new_high:	

	; Actually set the high score
	
	lda	SCOREL
	sta	HISCORE_L
	lda	SCOREH
	sta	HISCORE_H

	lda	#>(score_string+31)
	sta	STRINGH
	lda	#<(score_string+31)
	sta	STRINGL
	jsr	print_high_score

	jsr	HOME

	; print new high score message
	
	lda	#>new_high_score_string
	sta	STRINGH
	lda	#<new_high_score_string
	sta	STRINGL

	jsr	print_text_xy
	jsr	print_text_xy
	
	; set high score to AAA
	
	lda	#$C1
	sta	HISCORE_1
	sta	HISCORE_2
	sta	HISCORE_3

    
	; load initials address
	
	lda	#$06
	sta	STRINGH
	lda	#$12
	sta	STRINGL


	; load pointer address
	
	lda     #$06
	sta	BASH
	lda	#$92
	sta	BASL

	ldy	#$0
	ldx	#$0

initials_loop:

	; erase old pointer
	
	ldy	#$0
	lda	#$A0
	sta	(BASL),Y
	iny	
	sta	(BASL),Y
	iny
	sta	(BASL),Y
	
	txa
	tay

	; draw pointer
	
	lda     #$DE			; '^'
	sta	(BASL),Y

	
	ldy	#$0

	; draw initials
       
	lda	HISCORE_1
	sta	(STRINGL),Y
	
	iny
	lda	HISCORE_2
	sta	(STRINGL),Y
	
	iny	
	lda	HISCORE_3
	sta	(STRINGL),Y

in_key:
	jsr	wait_until_keypressed
	lda	LASTKEY
	beq	in_key
	
	cmp	#$D
	beq	do_hi_score
	
	cmp	#'I'
	bne	in_down
	inc	HISCORE_1,X
	
in_down:	
	
	cmp	#'M'
	bne	in_left
	dec	HISCORE_1,X

in_left:
	cmp	#'K'
	bne	in_right
	inx

in_right:
	cmp	#'J'
	bne	fix_limits
	dex	
fix_limits:	

	; Make sure X is between 0 and 2

	cpx     #$0
	bpl	x_high
	ldx	#$2
x_high:	
	cpx	#$3
	bmi	x_lo
	ldx	#$0
x_lo:	
	
	jmp	initials_loop


do_hi_score:
	
	jsr	HOME
	
	lda	#>high_score_string
	sta	STRINGH
	lda	#<high_score_string
	sta	STRINGL

	jsr	print_text_xy


	; go to screen co-ords 15x12

	lda	#$06
	sta	STRINGH
	lda	#$37
	sta	STRINGL
	
	; put the initials up
	
	lda	HISCORE_1
	ldy	#$0
	sta	(STRINGL),Y
	
	lda	HISCORE_2
	iny
	sta	(STRINGL),Y
	
	lda	HISCORE_3
	iny
	sta	(STRINGL),Y
	
	; Print score to screen
	;

	lda	#$06
	sta	STRINGH
	lda	#$3D
	sta	STRINGL

	jsr	print_high_score
	
	jsr 	wait_until_keypressed
	
	jmp 	opener



;=========================================================
; CLICK
;=========================================================

click:
      	lda	SOUND_ON
	beq	no_click
	bit     SPEAKER
no_click:	
	rts
	


;==========================================================
; Wait X 100 msec
;==========================================================
	;
wait_X_100msec:
	lda	#$86		       ; constant ~ 100msec
	jsr	WAIT
	dex
	bne	wait_X_100msec	
	rts




;==========================================================
; Update Shields
;==========================================================
	;
	
update_shields:

	lda	#>shields_string
	sta	STRINGH
	lda	#<shields_string
	sta	STRINGL


	ldy	#0
	
	lda	SHIELDS
	bne	normal_shields
	

flash_shields:
	lda	#$7f
	and	(STRINGL),Y
	sta	(STRINGL),Y
	iny
	cpy	#$7
	bne	flash_shields
	jmp	shields_line	

normal_shields:	
	lda	#$80
	ora	(STRINGL),Y
	sta	(STRINGL),Y
	iny
	cpy	#$7
	bne	normal_shields
	
shields_line:

	ldy  	#$A
	ldx	#$0
shield_line_loop:	
	
	cpx	SHIELDS
	bmi	shield_box
	lda	#'_'+128
	jmp	shield_char
shield_box:
	lda	#' '
shield_char:	
	sta	(STRINGL),Y
	iny
	iny
	inx
	cpx	#$A
	bne	shield_line_loop

	rts


;==========================================================
; Random Number Generator
;==========================================================
	; from dlyons@Apple.COM (David A Lyons)
	; posting to comps.sys.apple2 24 November 1992
	; algorithm from Pop Science ~1980s
	; when seeded with non-zero, will generate all 255 values
	; before repeating
	
random_number:
	lda   RANDOM_SEED
	bne   random_not_zero
	lda   #$D
random_not_zero:	
	asl   A
	bcc   random_num_done
	eor   #$87
random_num_done:
	sta   RANDOM_SEED
	rts
	



;==========================================================
; Wait until keypressed
;==========================================================
	;

wait_until_keypressed:
	inc	RANDOM_SEED		    ; seed random num counter
	lda	KEYPRESS		    ; check if keypressed
	bpl	wait_until_keypressed	    ; if not, loop
	jmp	figure_out_key


;==========================================================
; Get Key
;==========================================================
        ;	
	
get_key:



check_paddle_button:

	; check for paddle button
	
	bit	PADDLE_BUTTON0
	bpl	no_button
	lda	#' '+128
	jmp	save_key

no_button:
	lda	KEYPRESS
	bpl	no_key
	
figure_out_key:	
	cmp	#' '+128	       ; the mask destroys space
	beq	save_key	       ; so handle it specially
	
	and	#$5f  		       ; mask, to make upper-case
check_right_arrow:	
	cmp     #$15
	bne	check_left_arrow
	lda	#'K'
check_left_arrow:	
	cmp	#$08
	bne	check_up_arrow
	lda	#'J'
check_up_arrow:
	cmp	#$0B
	bne	check_down_arrow
	lda	#'I'
check_down_arrow:
	cmp	#$0A
	bne	check_escape
	lda	#'M'
check_escape:
	cmp  	#$1B
	bne	save_key
	lda	#'Q'	
	jmp	save_key

no_key:

        bit  PADDLE_STATUS
	bpl  no_key_store
	
	; check for paddle action
	; code from http://web.pdx.edu/~heiss/technotes/aiie/tn.aiie.06.html

	inc  PADDLE_STATUS
	lda  PADDLE_STATUS
	and  #$03
	beq  check_paddles
	jmp  no_key_store
	
check_paddles:

	lda  PADDLE_STATUS
	and  #$80
	sta  PADDLE_STATUS
	
	ldx  #$0
	LDA  PTRIG     ;TRIGGER PADDLES
	LDY  #0        ;INIT COUNTER
	NOP            ;COMPENSATE FOR 1ST COUNT
	NOP
PREAD2:	LDA  PADDL0,X  ;COUNT EVERY 11 uSEC.
	BPL  RTS2D     ;BRANCH WHEN TIMED OUT
	INY            ;INCREMENT COUNTER
	BNE  PREAD2    ;CONTINUE COUNTING
	DEY            ;COUNTER OVERFLOWED
RTS2D:                 ;RETURN W/VALUE 0-255

	cpy  #96
	bmi  paddle_left
	cpy  #160
	bmi  no_key_store
	lda  #'K'
	jmp  save_key

paddle_left:

	lda  #'J'
	jmp  save_key
	
no_key_store:
	lda	#0		       ; no key, so save a zero
	
save_key:	
	sta	LASTKEY		       ; save the key to our buffer
	bit	KEYRESET	       ; clear the keyboard buffer
	rts


	
;==========================================================
; score_plus_50
;==========================================================
        ;
score_plus_50:
	

	sed				; enter decimal mode
	clc
	lda	SCOREL
	adc	#$50
	sta	SCOREL			; score+=50

	lda	SCOREH
	adc	#$0
	sta	SCOREH			; carry into high byte if needed
	
	cld	      			; leave decimal mode

	jmp	print_score
	
;==========================================================
; inc_score
;==========================================================
        ;
inc_score:
	

	sed				; enter decimal mode
	clc
	lda	SCOREL
	adc	#$5
	sta	SCOREL			; score+=5

	lda	SCOREH
	adc	#$0
	sta	SCOREH			; carry into high byte if needed
	
	cld	      			; leave decimal mode


	lda	SCOREL			; if score /100 =0 then inc shields
	bne	print_score
	
	lda	SHIELDS
	
	cmp	#$0A   			; don't raise shields higher than 10
	bpl	print_score
	
	inc	SHIELDS
	jsr	update_shields

print_score:
	lda	#>(score_string+7)
	sta	STRINGH
	lda	#<(score_string+7)
	sta	STRINGL

	tya
	pha				; save Y on stack
	

	ldy     #$0
	
	lda	SCOREH
	sta	BCD_BYTEH

	lda	SCOREL
	sta	BCD_BYTE
	jsr	print_bcd_word
	
	pla				; restore Y
	tay
	
	rts

;======================
; print high_score
;======================
   ; location to output to in STRINGH/STRINGL

print_high_score:
	tya
	pha				; save Y on stack
	
	ldy     #$0
	
	lda	HISCORE_H
	sta	BCD_BYTEH

	lda	HISCORE_L
	sta	BCD_BYTE
	jsr	print_bcd_word
	
	pla				; restore Y
	tay
	
	rts

;==========================================================
; print_bcd_word
;==========================================================
	; string to output in STRINGH/STRINGL
	; byte to output in BCD_BYTE
	
print_bcd_word:


	lda	BCD_BYTEH
	lsr	A
	lsr	A
	lsr	A
	lsr	A
	and	#$f   			; mask low nybble
	bne	to_ascii_thou	
		
	lda	#$A0	  		; load a space

	jmp	write_thousands
to_ascii_thou:	
	adc	#$B0			; covert to ascii
	
write_thousands:
	sta	(STRINGL),Y		; store output
	
	iny
	
	lda	BCD_BYTEH

	and	#$f
	bne	to_ascii_hun
	
	cmp	BCD_BYTEH
	
	bne	to_ascii_hun
	
	lda	#$A0
	jmp	write_hundreds
	
to_ascii_hun:	
	adc	#$B0
write_hundreds:
	sta	(STRINGL),Y
	
	iny


print_bcd_byte:
	
	lda	BCD_BYTE
	lsr	A
	lsr	A
	lsr	A
	lsr	A
	and	#$f   			; mask low nybble
	bne	to_ascii_tens		; if not zero, convert to ascii

	cmp	BCD_BYTEH

	bne	to_ascii_tens

	lda	#$A0
	
	jmp	write_tens
to_ascii_tens:	
	adc	#$B0			; covert to ascii
     
write_tens:
	sta	(STRINGL),Y		; store output
	
	iny				; point one lower


	lda	BCD_BYTE
	clc
	and	#$f
	adc	#$B0

	sta	(STRINGL),Y
	

	rts

;==========================================================
; check inside
;==========================================================	
	; Simple collision detection.  Have small line x1<->x2 
	; Want to see if it overlaps long line x3<---------->x4
	; so:
	;    if ((x1>x3)&&(x1<x4)) || ((x2>x3) && (x2<x4)) inside
	;    else outside
	
check_inside:	
	
	lda	COL_X1
	cmp	COL_X3
	bmi	check_higher
	cmp	COL_X4
	bmi	inside
check_higher:	
	lda	COL_X2
	cmp	COL_X3
	bmi	outside
	cmp	COL_X4
	bpl	outside
	
inside:	
	sec
	rts
outside:	
	clc
	rts


;==========================================================
; set_page0_text
;==========================================================
        ;
set_page0_text:
        bit     PAGE0		       ; set page0
	bit	TEXT 		       ; set text mode
        rts
	

;==========================================================
; set_page0_gr
;==========================================================
        ;
	
set_page0_gr:
        lda     #4
	sta	GR_PAGE		       
	bit	PAGE0  		       ; set page 0
	bit	LORES		       ; Lo-res graphics
	bit	TEXTGR 		       ; mixed gr/text mode
	bit	GR		       ; set graphics
        rts

;==========================================================
; clear bottom
;==========================================================
	;
clear_bottom:
	lda     #$2
	clc
	adc	GR_PAGE
	sta  	BASH   		       ; point to line 21
	
	lda  	#$50
	sta  	BASL
		
	ldx  	#$00		       ; line counter
bottom_y:	
	lda  	#' '+128	       ; want to put a space
	ldy  	#$0		       ; column count
bottom_loop:	
	sta  	(BASL),Y	       ; store a space
	iny  			       ; incrememnt
	cpy  	#$28		       ; are we > 40?
	bmi 	bottom_loop    	       ; if not, loop

	lda  	#$80		       ; go to next line [they are $80 apart]
	clc
	adc  	BASL		       ; increment base
	sta  	BASL		       ; store it out
	lda  	#$0		       ; load 0 into A
	adc  	BASH		       ; carry into top byte if need be
	sta  	BASH		       ; and store out
	
	inx  			       ; increment line count
	cpx  	#$4		       ; have we done 4
	bcc  	bottom_y       	       ; if not, loop

	rts


;==========================================================
; print X strings
;==========================================================
	;
	;
print_x_strings:
	stx	TEMP
	jsr	print_text_xy
	ldx	TEMP
	dex
	bne	print_x_strings
	rts
	

;==========================================================
; Print text x,y
;==========================================================
	; x=ch y=cv
	; string=string_addr

print_text_xy:
	ldy	#$0		       ; clear IY
	lda	(STRINGL),Y	       ; load x from memory
	sta	CH		       ; store to CH
	iny			       ; point to next value
	
	lda	(STRINGL),Y	       ; load y from memory
	sta	CV		       ; store to CV
				       ; point to beginning of string

	clc
	lda	#$2
	adc	STRINGL
	sta	STRINGL
	lda	#$0
	adc	STRINGH
	sta	STRINGH

print_text:
	ldy	#$0
	lda	CV
	jsr	BASCALC		       ; get the address of y in BASH:BASL
	clc			       ; clear the carry
	lda	BASL		       ; load BASL
	adc	CH		       ; add x
	sta	BASL		       ; store BASL back out

output_loop:	
	lda	(STRINGL),Y	       ; load char from string_addr+y
	beq	print_done	       ; if null terminated, done
	sta	(BASL),Y	       ; store to BASH:BASL
	iny			       ; IY++
	jmp	output_loop	       ; loop
	
print_done:
	iny
	tya			       ; transfer y to accumulator
	

	adc	STRINGL		       ; add y and stringl
	sta	STRINGL		       ; and store it out
	lda	#$0		       ; clear accumulator
	adc	STRINGH		       ; add with carry from prev stringh
	sta	STRINGH		       ; and save it
	

	rts
	



;==========================================================
; clear_screen
;==========================================================
	;

clear_screen:

	ldx	#$0
clear_0:
	cpx	#$0
	bne	clear_1
	lda	GR_PAGE
	sta	BASH
	lda	#$0
	sta	BASL
	ldy	#$78
	jmp	clear_it
clear_1:
	cpx	#$1
	bne	clear_2
	lda	#$80
	sta	BASL
	ldy	#$78
	jmp	clear_it
clear_2:	
	cpx	#$2
	bne	clear_3
	clc
	lda	#$1
	adc	GR_PAGE
	
	sta	BASH
	ldy	#$78	
	jmp	clear_it
clear_3:
	cpx	#$3
	bne	clear_4
	lda	#$0
	sta	BASL
	ldy	#$78	
	jmp	clear_it
clear_4:
	cpx	#$4
	bne	clear_5
	clc
	lda	#$2
	adc	GR_PAGE
	sta	BASH
	ldy	#$50
	jmp	clear_it
clear_5:
	cpx	#$5
	bne	clear_6
	lda	#$80
	sta	BASL
	ldy	#$50
	jmp	clear_it
clear_6:
	cpx	#$6
	bne	clear_7
	clc
	lda	#$3
	adc	GR_PAGE
	sta	BASH
	ldy	#$50
	jmp	clear_it
clear_7:
	cpx	#$7
	bne	clear_8
	lda	#$0
	sta	BASL
	ldy	#$50
	jmp	clear_it
clear_8:

	rts

clear_it:
	lda	#$00
clear_loop:	
	dey
	
	sta	(BASL),Y

	bne	clear_loop
	
	inx
	jmp	clear_0
	
;==========================================================
; show_stars
;==========================================================
;

show_stars:


	lda	#>star_field		; Load the star offsets
	sta	STRINGH			; array into
	lda	#<star_field		; STRINGH/STRINGL
	sta	STRINGL

	lda	BETWEEN_DELAY
	and	#$1
	beq	star_7
	dec	SCROLL 			; decrement the scroll count

star_7:
	ldy	SCROLL			; load the scroll offset into Y


	ldx	#$8			; We initially repeat 8 times
	lda	#$0			; And have L of 0 
	sta	TEMP			; This is stupid interlace stuff
	sta	COL_X1

star_4:
	lda	GR_PAGE			; we loop here, it resets
	sta	BASH			; to the proper page

star_0:
	
	lda	(STRINGL),Y		; get star offset
	beq	star_5
	pha				; save for later
	
	bmi	light_star		; check color
	lda	#$5
	jmp	done_star
light_star:
	lda	#$A
done_star:	
	sta	COL_X2			; save color for later
	
	pla				; restore offset
	clc
	and	#$7f			; clear color flag
	adc	TEMP			; add in offset
	sta	BASL			; store as offset

	tya				; save y on stack
	pha				;
	
	lda	COL_X2
	ldy	#$0
	sta	(BASL),Y		; plot star
	
	pla				; restore y from stack
	tay

star_5:	
	iny				; increase y (offset pointer)
	
	

	lda	(STRINGL),Y		; get star offset
	beq	star_6
	pha				; save for later
	
	bmi	light_star2		; check color
	lda	#$50
	jmp	done_star2
light_star2:
	lda	#$A0
done_star2:	
	sta	COL_X2			; save color for later
	
	pla				; restore offset
	clc
	and	#$7f			; clear color flag
	adc	TEMP			; add in offset
	sta	BASL			; store as offset

	tya				; save y on stack
	pha				;
	
	lda	COL_X2
	ldy	#$0
	sta	(BASL),Y		; plot star
	
	pla				; restore y from stack
	tay
star_6:

	iny				; increase y (offset pointer)
	
	

	lda	TEMP			; get offset
	clc
	adc	#$80			; increment to next line
	sta	TEMP			; and save back

	bcc	overflow_line		; if overflow, increase BASH
	inc	BASH
overflow_line:	

	dex				; repeat X times
	bne	star_0

	inc	COL_X1			; check if first time through
	lda	#$1
	cmp	COL_X1
star_1:
	bne	star_2			; reload for second 8 lines
	ldx	#$8
	lda	#$28
	sta	TEMP
	jmp	star_4
star_2:		      			; check if second time through
	lda	#$2
	cmp	COL_X1
	bne	star_3
	ldx	#$4   			; reload for another 4 lines
	lda	#$50
	sta	TEMP
	jmp	star_4

star_3:
	rts
	

;==========================================================
; blit
;==========================================================
	; x=ch y=cv
	; string=addr of sprite
	; only works on sprites < 256 bytes!!!


blit:

	ldy	#$00		       ; clear IY

big_blit_loop:	

	lda     CV		       ; Load y
	jsr	BASCALC	       	       ; we only do 40x20 so just use text mode
	
	lda	#$4
	bit	GR_PAGE
	bne	keep_blitting
	clc
	adc	BASH
	sta	BASH
	
keep_blitting:	
	
	clc			       ; clear the carry
	lda	BASL		       ; load BASL
	adc	CH		       ; add x
	sta	BASL		       ; store BASL back out
	bcc	blit_loop	       ; if carry we overflowed
	inc	BASH		       ; add overflow into BASH
	
	
	
blit_loop:	
	lda	(STRINGL),Y	       ; load char from string_addr+y
	beq	blit_x_done	       ; if null terminated, done this row
	sty	YSAV		       ; save IY

	pha			       ; save run/color on stack
	jsr	SETCOL		       ; make low/high both col
				       ; and save in in COLOR
				       
	pla			       ; restore run/color
	lsr	
	lsr	
	lsr	
	lsr			       ; shift A right by 4 to get run-length
	tax			       ; store in IX
	
	ldy	#$0		       ; clear IY
	lda	COLOR		       ; load back COLOR
	
	bne	rle_loop	       ; if not zero, plot it
skip_color:
	inc	BASL		       ; increment pointer
	dex			       ; count down IX
	bne	skip_color	       ; and skip ahead
	jmp	rle_loop_done	       ; done
	

rle_loop:	
	sta	(BASL),Y		; store our color to the line
	inc	BASL			; increment output pointer
	dex				; decrement count
	bne	rle_loop		; until done
	
rle_loop_done:		
	ldy	YSAV		       ; restore SPRITE pointer
	iny			       ; IY++
	jmp	blit_loop	       ; loop until row done
	
blit_x_done:
	iny        		       ; point past 0
	lda 	(STRINGL),Y	       ; get next
	beq	blit_done	       ; if 0 as well, done with sprite
	inc	CV		       ; otherwise y++
	jmp	big_blit_loop	       ; and loop
	
blit_done:	
	rts


;; *********************
;; BSS
;; *********************
.bss

start_bss:
missile_0:	  .res NUM_MISSILES*3
enemy_0:	  .res NUM_ENEMIES*9



end_bss:

star_field:	  .res 255
zero_page_save:	  .res 56


;; *********************
;; DATA
;; *********************
.data


     		  ; SHIELDS: plus 22 spaces (30 total)
shields_string:
	       	  .byte $D3,$C8,$C9,$C5,$CC,$C4,$D3,$BA
		  .byte $A0,$A0,$A0,$A0,$A0,$A0,$A0,$A0,$A0,$A0
		  .byte $A0,$A0,$A0,$A0,$A0,$A0,$A0,$A0,$A0,$A0
		  .byte $A0,$A0
		  
		  ; SCORE and HISCORE: (38 Total)
score_string:
	     	  .byte $D3,$C3,$CF,$D2,$C5,$BA,$A0,$A0,$A0,$A0
		  .byte $A0
		  .byte $A0,$A0,$A0,$A0,$A0,$A0,$A0,$A0,$A0
		  .byte $C8,$C9,$D3,$C3,$CF,$D2,$C5,$BA,$A0,$A0,$A0,$A0
		  .byte $B5,$B0,$B0,$A0,$A0,$A0	
		  

		  ; LEVEL:
level_string_xy:
		  .byte $0E,$0A
level_string:
	     	  .byte $CC,$C5,$D6,$C5,$CC,$BA,$A0,$A0,$A0,$A0,$B1,$A0,$00




	          ; A VMW SOFTWARE PRODUCTION
vmw_string:	  .byte	$07,$14
		  .byte	$C1,$A0,$D6,$CD,$D7,$A0,$D3,$CF,$C6,$D4,$D7,$C1,$D2
		  .byte $C5,$A0,$D0,$D2,$CF,$C4,$D5,$C3,$D4,$C9,$CF,$CE,$00

		  ; MERCILESS MARAUDING MALICIOUS MARKETERS
mercy_string:	  .byte $00,$14
		  .byte	$CD,$C5,$D2,$C3,$C9,$CC,$C5,$D3,$D3,$A0,$CD,$C1,$D2
		  .byte $C1,$D5,$C4,$C9,$CE,$C7,$A0,$CD,$C1,$CC,$C9,$C3,$C9
		  .byte $CF,$D5,$D3,$A0,$CD,$C1,$D2,$CB,$C5,$D4,$C5,$D2,$D3
		  .byte $00

		  ; GAME OVER
game_over_string:
		  .byte $0F,$0A
		  .byte $C7,$C1,$CD,$C5,$A0,$CF,$D6,$C5,$D2,$00

		  ; NEW GAME
new_game_string:  .byte	$CE,$C5,$D7,$A0,$C7,$C1,$CD,$C5,$00
		  ; ABOUT
about_string:	  .byte	$C1,$C2,$CF,$D5,$D4,$00
		  ; STORY
story_string:	  .byte	$D3,$D4,$CF,$D2,$D9,$00
		  ; HISCORE
hiscore_string:   .byte	$C8,$C9,$A0,$D3,$C3,$CF,$D2,$C5,$00
		  ; QUIT
quit_string:	  .byte	$D1,$D5,$C9,$D4,$00
		  ; H FOR HELP
help_string:      .byte $0,$14
		  .byte	$C8,$A0,$C6,$CF,$D2,$A0,$C8,$C5,$CC,$D0,$00
		  ; QUIT? ARE YOU SURE?
quit_conf_string: .byte	$D1,$D5,$C9,$D4,$BF,$A0,$C1,$D2,$C5,$A0,$D9,$CF,$D5
		  .byte $A0,$D3,$D5,$D2,$C5,$BF,$00
		  ; YES
yes_string:	  .byte	$D9,$C5,$D3,$00
		  ; NO
no_string:	  .byte	$CE,$CF,$00


about_lines:
	    	  ; TOM BOMBEM  BY VINCE WEAVER (PIC ABOVE)
		  .byte $0,$14
		  .byte $D4,$CF,$CD,$A0,$C2,$CF,$CD,$C2,$C5,$CD
		  .byte $A0,$A0,$C2,$D9,$A0,$D6,$C9,$CE,$C3,$C5
		  .byte $A0,$D7,$C5,$C1,$D6,$C5,$D2,$A0,$A8,$D0
		  .byte $C9,$C3,$A0,$C1,$C2,$CF,$D6,$C5,$A9,$00
		  
		  ; BASED ON LINUX TB_ASM - APPLE II FOREVER
		  .byte $0,$16
		  .byte $C2,$C1,$D3,$C5,$C4,$A0,$CF,$CE,$A0,$CC
		  .byte $C9,$CE,$D5,$D8,$A0,$D4,$C2,$DF,$C1,$D3
		  .byte $CD,$A0,$AD,$A0,$C1,$D0,$D0,$CC,$C5,$A0
		  .byte $C9,$C9,$A0,$C6,$CF,$D2,$C5,$D6,$C5,$D2,$00
		  
		  ; VINCE@DEATER.NET
		  .byte $0,$16
		  .byte $D6,$C9,$CE,$C3,$C5,$C0,$C4,$C5,$C1,$D4
		  .byte $C5,$D2,$AE,$CE,$C5,$D4,$00
		  
		  ; HTTP://WWW.DEATER.NET/WEAVE/VMWPROD/TB1/
		  .byte $0,$17
		  .byte	$C8,$D4,$D4,$D0,$BA,$AF,$AF,$D7,$D7,$D7
		  .byte $AE,$C4,$C5,$C1,$D4,$C5,$D2,$AE,$CE,$C5
		  .byte $D4,$AF,$D7,$C5,$C1,$D6,$C5,$AF,$D6,$CD
		  .byte $D7,$D0,$D2,$CF,$C4,$AF,$D4,$C2,$B1,$AF,$00

ending_lines:
	     	  ; *** MESSAGE FROM EARTH ***
                  .byte $7,$14
		  .byte $AA,$AA,$AA,$A0,$CD,$C5,$D3,$D3,$C1,$C7
		  .byte $C5,$A0,$C6,$D2,$CF,$CD,$A0,$C5,$C1,$D2
		  .byte $D4,$C8,$A0,$AA,$AA,$AA,$00
		  
		  ; CONGRATULATIONS TOM, YOU'VE DESTROYED
		  .byte $0,$16
		  .byte $C3,$CF,$CE,$C7,$D2,$C1,$D4,$D5,$CC,$C1
		  .byte $D4,$C9,$CF,$CE,$D3,$A0,$D4,$CF,$CD,$AC
		  .byte $A0,$D9,$CF,$D5,$A7,$D6,$C5,$A0,$C4,$C5
		  .byte $D3,$D4,$D2,$CF,$D9,$C5,$C4,$00

  		  ;   THE MENACE!
  		  .byte $2,$17
  		  .byte $D4,$C8,$C5,$A0,$CD,$C5,$CE,$C1,$C3,$C5
		  .byte $A1,$00

		  ; BUT WAIT!  SENSORS ARE DETECTING NEW
		  .byte $0,$14		  
		  .byte $C2,$D5,$D4,$A0,$D7,$C1,$C9,$D4,$A1,$A0
		  .byte $A0,$D3,$C5,$CE,$D3,$CF,$D2,$D3,$A0,$C1
		  .byte $D2,$C5,$A0,$C4,$C5,$D4,$C5,$C3,$D4,$C9
		  .byte $CE,$C7,$A0,$CE,$C5,$D7,$00

		  ; INCOMING TARGETS.
		  .byte $2,$15
		  .byte $C9,$CE,$C3,$CF,$CD,$C9,$CE,$C7,$A0,$D4
		  .byte $C1,$D2,$C7,$C5,$D4,$D3,$AE,$00
		  
		  ; REMEMBER, YOU DON'T GET PAID UNTIL ALL
		  .byte $0,$16
		  .byte $D2,$C5,$CD,$C5,$CD,$C2,$C5,$D2,$AC,$A0
		  .byte $D9,$CF,$D5,$A0,$C4,$CF,$CE,$A7,$D4,$A0
		  .byte $C7,$C5,$D4,$A0,$D0,$C1,$C9,$C4,$A0,$D5
		  .byte $CE,$D4,$C9,$CC,$A0,$C1,$CC,$CC,$00

		  ; ARE DESTROYED
		  .byte $2,$17
		  .byte $C1,$D2,$C5,$A0,$C4,$C5,$D3,$D4,$D2,$CF
		  .byte $D9,$C5,$C4,$00
		  
susie_lines:
		  ; PS.  YOUR PET GUINEA PIG IS DOING FINE
		  .byte $0,$14
		  .byte $D0,$D3,$AE,$A0,$A0,$D9,$CF,$D5,$D2,$A0
		  .byte $D0,$C5,$D4,$A0,$C7,$D5,$C9,$CE,$C5,$C1
		  .byte $A0,$D0,$C9,$C7,$A0,$C9,$D3,$A0,$C4,$CF
		  .byte $C9,$CE,$C7,$A0,$C6,$C9,$CE,$C5,$00

tom_sigh:
		  ; TOM: *SIGH*
		  .byte $0,$14
		  .byte $D4,$CF,$CD,$BA,$A0,$AA,$D3,$C9,$C7,$C8,$AA,$00

story_lines:

	    ; IT IS THE YEAR 2025.
	    .byte $0,$14
	    .byte $C9,$D4,$A0,$C9,$D3,$A0,$D4,$C8,$C5,$A0
	    .byte $D9,$C5,$C1,$D2,$A0,$B2,$B0,$B2,$B5,$AE,$00

  	    ; ALL TELEMARKETERS AND UNSOLICITED
  
  	    .byte $2,$15
  	    .byte $C1,$CC,$CC,$A0,$D4,$C5,$CC,$C5,$CD,$C1
	    .byte $D2,$CB,$C5,$D4,$C5,$D2,$D3,$A0,$C1,$CE
	    .byte $C4,$A0,$D5,$CE,$D3,$CF,$CC,$C9,$C3,$C9
	    .byte $D4,$C5,$C4,$00
	    
    	    ; BULK E-MAILERS HAVE BEEN EXILED
 	    .byte $4,$16   
    	    .byte $C2,$D5,$CC,$CB,$A0,$C5,$AD,$CD,$C1,$C9
	    .byte $CC,$C5,$D2,$D3,$A0,$C8,$C1,$D6,$C5,$A0
	    .byte $C2,$C5,$C5,$CE,$A0,$C5,$D8,$C9,$CC,$C5
	    .byte $C4,$00
    
    	    ; TO PHOBOS.
    	    .byte $6,$17
    	    .byte $D4,$CF,$A0,$D0,$C8,$CF,$C2,$CF,$D3,$AE,$00

	    ; RIGHT BEFORE BEING TRAPPED FOREVER
	    .byte $0,$14
	    .byte $D2,$C9,$C7,$C8,$D4,$A0,$C2,$C5,$C6,$CF
	    .byte $D2,$C5,$A0,$C2,$C5,$C9,$CE,$C7,$A0,$D4
	    .byte $D2,$C1,$D0,$D0,$C5,$C4,$A0,$C6,$CF,$D2
	    .byte $C5,$D6,$C5,$D2,$00

	    ; THEY MANAGE TO LAUNCH ONE LAST
	    .byte $2,$15
	    .byte $D4,$C8,$C5,$D9,$A0,$CD,$C1,$CE,$C1,$C7
	    .byte $C5,$A0,$D4,$CF,$A0,$CC,$C1,$D5,$CE,$C3
	    .byte $C8,$A0,$CF,$CE,$C5,$A0,$CC,$C1,$D3,$D4,$00
	    
	    ; MARKETING DROID.
	    .byte $4,$16
	    .byte $CD,$C1,$D2,$CB,$C5,$D4,$C9,$CE,$C7,$A0
	    .byte $C4,$D2,$CF,$C9,$C4,$AE,$00

help_lines:
	    ; TOM BOMBEM
	    .byte $A,$0
	    .byte $D4,$CF,$CD,$A0,$C2,$CF,$CD,$C2,$C5,$CD,$00
	    ; BY
	    .byte $E,$1
	    .byte $C2,$D9,$00
	    ; VINCE WEAVER
	    .byte $9,$2
	    .byte $D6,$C9,$CE,$C3,$C5,$A0,$D7,$C5,$C1,$D6
	    .byte $C5,$D2,$00
	    ; KEY BINDINGS:
	    .byte $0,$4
	    .byte $CB,$C5,$D9,$A0,$C2,$C9,$CE,$C4,$C9,$CE
	    .byte $C7,$D3,$BA,$00
	    ; UP OR 'I'    : MOVE MENU UP
	    .byte $2,$6
	    .byte $D5,$D0,$A0,$CF,$D2,$A0,$A7,$C9,$A7,$A0
	    .byte $A0,$A0,$A0,$BA,$A0,$CD,$CF,$D6,$C5,$A0
	    .byte $CD,$C5,$CE,$D5,$A0,$D5,$D0,$00
	    ; DOWN OR 'M'  : MOVE MENU DOWN
	    .byte $2,$7
	    .byte $C4,$CF,$D7,$CE,$A0,$CF,$D2,$A0,$A7,$CD
	    .byte $A7,$A0,$A0,$BA,$A0,$CD,$CF,$D6,$C5,$A0
	    .byte $CD,$C5,$CE,$D5,$A0,$C4,$CF,$D7,$CE,$00
	    ; ENTER        : SELECTS CURRENT OPTION
	    .byte $2,$8
	    .byte $C5,$CE,$D4,$C5,$D2,$00
	    .byte $F,$8
	    .byte $BA,$A0,$D3,$C5,$CC,$C5,$C3,$D4,$D3,$A0
	    .byte $C3,$D5,$D2,$D2,$C5,$CE,$D4,$A0,$CF,$D0
	    .byte $D4,$C9,$CF,$CE,$00
	    ; RIGHT OR 'K' : MOVES SHIP RIGHT
	    .byte $2,$A
	    .byte $D2,$C9,$C7,$C8,$D4,$A0,$CF,$D2,$A0,$A7
	    .byte $CB,$A7,$A0,$BA,$A0,$CD,$CF,$D6,$C5,$D3
	    .byte $A0,$D3,$C8,$C9,$D0,$A0,$D2,$C9,$C7,$C8
	    .byte $D4,$00
	    ; LEFT OR 'J'  : MOVES SHIP LEFT
	    .byte $2,$B
	    .byte $CC,$C5,$C6,$D4,$A0,$CF,$D2,$A0,$A7,$CA
	    .byte $A7,$A0,$A0,$BA,$A0,$CD,$CF,$D6,$C5,$D3
	    .byte $A0,$D3,$C8,$C9,$D0,$A0,$CC,$C5,$C6,$D4,$00
	    ; SPACEBAR     : SHOOTS
	    .byte $2,$C
	    .byte $D3,$D0,$C1,$C3,$C5,$C2,$C1,$D2,$A0,$A0
	    .byte $A0,$A0,$A0,$BA,$A0,$D3,$C8,$CF,$CF,$D4
	    .byte $D3,$00
	    ; 'H'          : DISPLAYS HELP
	    .byte $2,$E
	    .byte $A7,$C8,$A7,$00
	    .byte $F,$E
	    .byte $BA,$A0,$C4,$C9,$D3,$D0,$CC,$C1,$D9,$D3
	    .byte $A0,$C8,$C5,$CC,$D0,$00
	    ; ESC OR 'Q'   : QUITS
	    .byte $2,$F
	    .byte $C5,$D3,$C3,$A0,$CF,$D2,$A0,$A7,$D1,$A7
	    .byte $A0,$A0,$A0,$BA,$A0,$D1,$D5,$C9,$D4,$D3,$00
	    ; 'P'          : PAUSES
	    .byte $2,$10
	    .byte $A7,$D0,$A7,$00
	    .byte $F,$10
	    .byte $BA,$A0,$D0,$C1,$D5,$D3,$C5,$D3,$00
	    ; 'S'          : TOGGLES SOUND
	    .byte $2,$11
	    .byte $A7,$D3,$A7,$00
	    .byte $F,$11
	    .byte $BA,$A0,$D4,$CF,$C7,$C7,$CC,$C5,$D3,$A0
	    .byte $D3,$CF,$D5,$CE,$C4,$00
	    ; 'C'          : ENABLES PADDLES
	    .byte $2,$12
	    .byte $A7,$C3,$A7,$00
	    .byte $F,$12
	    .byte $BA,$A0,$C5,$CE,$C1,$C2,$CC,$C5,$D3,$A0
	    .byte $D0,$C1,$C4,$C4,$CC,$C5,$D3,$00


you_are_tom:	
	    ; YOU ARE TOM BOMBEM.
	    .byte $0,$14
	    .byte $D9,$CF,$D5,$A0,$C1,$D2,$C5,$A0,$D4,$CF
	    .byte $CD,$A0,$C2,$CF,$CD,$C2,$C5,$CD,$AE,$00

	    ; YOU DREW THE SHORT STRAW
	    .byte $1,$15
	    .byte $D9,$CF,$D5,$A0,$C4,$D2,$C5,$D7,$A0,$D4
	    .byte $C8,$C5,$A0,$D3,$C8,$CF,$D2,$D4,$A0,$D3
	    .byte $D4,$D2,$C1,$D7,$00
	    
	    ; IT IS UP TO YOU TO DESTROY THE EVIL
	    .byte $2,$16
	    .byte $C9,$D4,$A0,$C9,$D3,$A0,$D5,$D0,$A0,$D4
	    .byte $CF,$A0,$D9,$CF,$D5,$A0,$D4,$CF,$A0,$C4
	    .byte $C5,$D3,$D4,$D2,$CF,$D9,$A0,$D4,$C8,$C5
	    .byte $A0,$C5,$D6,$C9,$CC,$00

	    ; AND RESTORE PEACE TO THE SOL SYSTEM.
	    .byte $3,$17
	    .byte $C1,$CE,$C4,$A0,$D2,$C5,$D3,$D4,$CF,$D2
	    .byte $C5,$A0,$D0,$C5,$C1,$C3,$C5,$A0,$D4,$CF
	    .byte $A0,$D4,$C8,$C5,$A0,$D3,$CF,$CC,$A0,$D3
	    .byte $D9,$D3,$D4,$C5,$CD,$AE,$00


bonus_string:
	    ; BONUS POINTS
	    .byte $E,$0
	    .byte $C2,$CF,$CE,$D5,$D3,$A0,$D0,$CF,$C9,$CE
	    .byte $D4,$D3,$00

no_bonus_string:
	    ; NONE
	    .byte $12,$2
	    .byte $CE,$CF,$CE,$C5,$00
	    
bonus_shields:
	    ; PERFECT SHIELDS   +50
	    .byte $9,$2
	    .byte $D0,$C5,$D2,$C6,$C5,$C3,$D4,$A0,$D3,$C8
	    .byte $C9,$C5,$CC,$C4,$D3,$A0,$A0,$A0,$AB,$B5
	    .byte $B0,$00

bonus_aim:
	    ; PERFECT AIM       +50
	    .byte $9,$3
	    .byte $D0,$C5,$D2,$C6,$C5,$C3,$D4,$A0,$C1,$C9
	    .byte $CD,$A0,$A0,$A0,$A0,$A0,$A0,$A0,$AB,$B5
	    .byte $B0,$00

bonus_kills:
	    ; PERFECT KILLS     +50
	    .byte $9,$4
	    .byte $D0,$C5,$D2,$C6,$C5,$C3,$D4,$A0,$CB,$C9
	    .byte $CC,$CC,$D3,$A0,$A0,$A0,$A0,$A0,$AB,$B5
	    .byte $B0,$00


high_score_string:
	    ; HIGH SCORE
	    .byte $F,$A
	    .byte $C8,$C9,$C7,$C8,$A0,$D3,$C3,$CF,$D2,$C5,$00
	    
new_high_score_string:
	    ; NEW HIGH SCORE
	    .byte $D,$0
	    .byte $CE,$C5,$D7,$A0,$C8,$C9,$C7,$C8,$A0,$D3
	    .byte $C3,$CF,$D2,$C5,$00

	    ; USE ARROWS TO ENTER INITIALS
	    .byte $6,$2
	    .byte $D5,$D3,$C5,$A0,$C1,$D2,$D2,$CF,$D7,$D3
	    .byte $A0,$D4,$CF,$A0,$C5,$CE,$D4,$C5,$D2,$A0
	    .byte $C9,$CE,$C9,$D4,$C9,$C1,$CC,$D3,$00


vmw_sprite:
	.byte $71,$14,$72,$14,$72,$00
	.byte $71,$14,$72,$14,$72,$00
	.byte $10,$51,$34,$52,$34,$52,$00
	.byte $10,$51,$34,$52,$34,$52,$00
	.byte $20,$31,$54,$32,$54,$32,$00
	.byte $20,$31,$54,$32,$54,$32,$00
	.byte $30,$11,$74,$12,$74,$12,$00
	.byte $30,$11,$74,$12,$74,$12,$00
	.byte $00
opener_sprite:
	.byte $36,$10,$36,$10,$16,$30,$16,$10,$29,$20,$39,$10,$19,$30,$19,$10,$29,$20,$29,$10,$19,$30,$19,$00
	.byte $10,$16,$20,$16,$10,$16,$10,$26,$10,$26,$10,$19,$10,$19,$10,$19,$10,$19,$10,$29,$10,$29,$10,$19,$10,$19,$10,$19,$20,$29,$10,$29,$00
	.byte $10,$16,$20,$16,$10,$16,$10,$16,$10,$16,$10,$16,$10,$29,$20,$19,$10,$19,$10,$19,$10,$19,$10,$19,$10,$29,$20,$29,$10,$19,$10,$19,$10,$19,$00
	.byte $10,$16,$20,$16,$10,$16,$10,$16,$30,$16,$10,$19,$10,$19,$10,$19,$10,$19,$10,$19,$30,$19,$10,$19,$10,$19,$10,$19,$20,$19,$30,$19,$00
	.byte $10,$16,$20,$36,$10,$16,$30,$16,$10,$29,$20,$39,$10,$19,$30,$19,$10,$29,$20,$29,$10,$19,$30,$19,$00
	.byte $F0,$F0,$00
	.byte $F0,$A0,$1A,$A0,$1A,$00
	.byte $30,$1A,$70,$1F,$F0,$40,$15,$00
	.byte $F0,$F0,$00
	.byte $50,$1A,$A0,$15,$C0,$1F,$00
	.byte $00	
opener_sprite_2:	
	.byte $50,$2A,$F0,$1A,$D0,$1E,$00
	.byte $10,$1D,$30,$3A,$F0,$E0,$1E,$21,$00
	.byte $10,$3D,$16,$8F,$36,$F0,$60,$1E,$29,$00
	.byte $2D,$11,$19,$16,$1F,$11,$14,$16,$14,$16,$2F,$46,$F0,$40,$1E,$10,$29,$00
	.byte $10,$2D,$19,$16,$1F,$11,$14,$16,$14,$16,$2F,$56,$60,$11,$D0,$29,$00
	.byte $30,$1D,$16,$8A,$6F,$40,$1D,$4A,$A0,$29,$00
	.byte $F0,$90,$11,$80,$1F,$40,$21,$00
	.byte $40,$15,$50,$1A,$F0,$00
	.byte $10,$1F,$F0,$1F,$90,$15,$00
	.byte $F0,$F0,$80,$1A,$00
	.byte $00
	
vince_sprite:
	.byte $20,$15,$8F,$15,$00
	.byte $10,$15,$1A,$4F,$1A,$4F,$2A,$00
	.byte $15,$5A,$15,$1A,$1F,$2A,$3F,$1A,$00
	.byte $1A,$15,$10,$15,$3A,$8F,$15,$00
	.byte $1A,$10,$15,$CF,$1A,$00
	.byte $15,$10,$1A,$7F,$1A,$1F,$2A,$25,$00
	.byte $25,$9F,$25,$10,$15,$1A,$00
	.byte $15,$1A,$4F,$1A,$3F,$1A,$10,$15,$10,$15,$1A,$00
	.byte $1A,$25,$1A,$1F,$15,$10,$15,$1A,$1F,$1A,$40,$15,$00
	.byte $10,$1A,$10,$15,$1F,$20,$15,$10,$15,$1F,$15,$30,$15,$00
	.byte $10,$1A,$15,$1A,$1F,$15,$20,$1A,$2F,$1A,$30,$1A,$00
	.byte $10,$1F,$15,$3F,$2A,$4F,$30,$1A,$00
	.byte $10,$1F,$1A,$25,$1A,$5F,$35,$2A,$00
	.byte $10,$2F,$15,$10,$1A,$4F,$1A,$10,$3A,$00
	.byte $10,$2F,$1A,$15,$2A,$3F,$1A,$10,$2A,$15,$00
	.byte $10,$2A,$10,$15,$20,$2A,$20,$1F,$15,$1A,$00
	.byte $10,$15,$2F,$15,$2F,$1A,$20,$15,$2A,$15,$00
	.byte $20,$1F,$3A,$1F,$2A,$25,$1F,$1A,$00
	.byte $20,$1A,$4F,$25,$10,$15,$1F,$15,$00
	.byte $30,$25,$50,$1A,$1F,$15,$00
	.byte $00
	
phobos_sprite:
	.byte $F0,$30,$1A,$F0,$00
	.byte $F0,$F0,$60,$1F,$00
	.byte $F0,$F0,$00
	.byte $50,$1A,$4F,$F0,$00
	.byte $40,$11,$69,$E0,$1F,$00
	.byte $30,$11,$59,$11,$29,$F0,$00
	.byte $30,$11,$89,$F0,$00
	.byte $30,$11,$39,$11,$49,$50,$15,$18,$F0,$00
	.byte $30,$11,$89,$50,$18,$F0,$00
	.byte $30,$11,$59,$11,$29,$F0,$40,$1F,$00
	.byte $40,$11,$69,$F0,$1A,$00
	.byte $50,$1A,$4F,$F0,$00
	.byte $F0,$F0,$00
	.byte $F0,$F0,$00
	.byte $30,$1F,$D0,$1A,$C0,$1A,$00
	.byte $00
evil_ship_sprite:
	.byte $17,$1E,$17,$00
	.byte $00


tom_sprite:
	.byte $20,$62,$46,$00
	.byte $20,$22,$40,$25,$26,$00
	.byte $20,$22,$40,$25,$26,$00
	.byte $20,$22,$40,$25,$26,$00
	.byte $20,$22,$40,$25,$26,$00
	.byte $40,$42,$26,$00
	.byte $82,$86,$00
	.byte $22,$26,$42,$26,$29,$22,$26,$00
	.byte $22,$26,$42,$46,$22,$26,$00
	.byte $22,$26,$42,$46,$22,$26,$00
	.byte $22,$26,$42,$46,$22,$26,$00
	.byte $22,$26,$42,$46,$22,$26,$00
	.byte $27,$2E,$22,$26,$22,$26,$27,$2E,$00
	.byte $40,$22,$26,$22,$26,$00
	.byte $40,$22,$26,$22,$26,$00
	.byte $40,$22,$26,$22,$26,$00
	.byte $40,$27,$2E,$27,$2E,$00
	.byte $40,$25,$2A,$25,$2A,$00
	.byte $00

ship_sprite:
	.byte $20,$36,$00
	.byte $10,$1A,$3F,$1A,$00
	.byte $2A,$1F,$1A,$1F,$2A,$00
	.byte $30,$1D,$00
	.byte $00

missile_sprite:
	.byte $1A,$00
	.byte $1A,$00
	.byte $1D,$00
	.byte $00

enemy_sprites:
enemy_sprite0:
	.byte $2F,$11,$00
	.byte $3F,$00
	.byte $00,$00,$00
enemy_sprite1:
	.byte $16,$10,$16,$00
	.byte $10,$16,$00
	.byte $00
enemy_sprite2:
	.byte $17,$28,$00
	.byte $17,$28,$00
	.byte $00,$00
enemy_sprite3:
	.byte $10,$1D,$00
	.byte $1D,$10,$1D,$00
	.byte $00
enemy_sprite4:
	.byte $19,$2F,$00
	.byte $19,$2A,$00
	.byte $00,$00
enemy_sprite5:
	.byte $14,$1C,$14,$00
	.byte $34,$00
;	.byte $14,$1C,$14,$00
	.byte $00,$00
enemy_sprite6:
	.byte $1F,$20,$00
	.byte $3C,$00
	.byte $00,$00,$00
enemy_sprite7:
	.byte $33,$00
	.byte $13,$10,$13,$00
	.byte $00,$00

explosion_sprites:
explosion_sprite0:
	.byte $2D,$19,$00
	.byte $19,$1D,$15,$00
	.byte $00
explosion_sprite1:
	.byte $2A,$11,$00
	.byte $11,$1A,$00
	.byte $00,$00
explosion_sprite2:
	.byte $25,$00
	.byte $10,$25,$00
	.byte $00

smoke_sprites:
smoke_sprite0:
	.byte $10,$15,$00
	.byte $00
smoke_sprite1:
	.byte $25,$1A,$00
	.byte $00
smoke_sprite2:
	.byte $2A,$11,$00
	.byte $00

boss_sprite:
	.byte $1F,$1A,$11,$79,$11,$1A,$1F,$00
	.byte $1F,$15,$1A,$21,$17,$1E,$17,$21,$1A,$15,$1F,$00
	.byte $1F,$10,$15,$1A,$17,$1E,$1D,$1E,$17,$1A,$15,$10,$1F,$00
	.byte $00

laser_sprites:
laser_sprite0:
	.byte $1B,$00
	.byte $13,$00
	.byte $00
laser_sprite1:
	.byte $13,$00
	.byte $1B,$00
	.byte $00

tom_head_sprite:
	.byte $10,$32,$26,$00
	.byte $10,$12,$20,$15,$16,$00
	.byte $10,$12,$20,$15,$16,$00
	.byte $10,$12,$20,$15,$16,$00
	.byte $10,$12,$20,$15,$16,$00
	.byte $20,$22,$16,$00
	.byte $42,$36,$00
	.byte $00

earth_sprite:
	.byte $10,$1A,$2F,$00
	.byte $14,$2C,$26,$00
	.byte $12,$1C,$36,$00
	.byte $12,$16,$2C,$16,$00
	.byte $12,$16,$1C,$26,$00
	.byte $10,$1A,$2F,$00
	.byte $00

susie_sprite:
	.byte $BA,$15,$10,$2F,$10,$3A,$00
	.byte $2A,$90,$15,$20,$15,$20,$2A,$00
	.byte $1A,$F0,$20,$1A,$00
	.byte $1A,$F0,$20,$1A,$00
	.byte $1A,$F0,$3A,$00
	.byte $2A,$C0,$5A,$00
	.byte $4A,$35,$5A,$35,$4A,$00
