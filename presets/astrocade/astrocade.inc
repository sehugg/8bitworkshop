
; ****** HVGLIB.H (formally called ballyequ.h) (C)1977,78
; *** Bally Astrocade Equates and Macros Header File ***
; From the nutting_manual and reformatted using Mixed Case
; Version 3.01 - thru December 29, 2010
;                by Richard C Degler, from scratch
;
; > Retyped and proofread by Adam Trionfo and Lance F. Squire
; > Version 1.0 (as ballyequ.h) - January 17, 2002
; > Version 2.52 (Version 1.0 of HVGLIB.H) - March 28, 2003
; > Version 2.6 - March 2, 2004 - as seen on BallyAlley.com
; > Version 3.0 - 2009
; > Version 3.01 - Changed "FonT BASE character" comment
;
; ***************************
; * Home Video Game =ates *
; ***************************
;
;  ASSEMBLY CONTROL
;
XPNDON  =    1          ; ** SET TO 1 WHEN HARDWARE EXP
NWHDWR  =    1          ; ** SET TO 1 WHEN NEW HARDWARE
;
; General goodies (HEX and Decimal values):
NORMEM  =     0x4000   ; 8192  ; NORmal MEMory start
FIRSTC  =     0x2000   ; 4096  ; FIRST address in Cartridge
SCREEN  =     0x0000   ;    0  ; magic SCREEN start
BYTEPL  =     0x28     ;   40  ; BYTEs Per Line
BITSPL  =     0xA0     ;  160  ; BITS Per Line
;
; Stuff in SYSTEM DOPE VECTOR (valid for ALL system ROMs):
STIMER  =     0x0200   ; Seconds and game TIMER, music
CTIMER  =     0x0203   ; Custom TIMERs
FNTSYS  =     0x0206   ; FoNT descriptor for SYStem font
FNTSML  =     0x020D   ; FoNT descriptor for SMaLl font
ALKEYS  =     0x0214   ; ALl KEYS keypad mask
MENUST  =     0x0218   ; head of onboard MENU STart
MXSCR   =     0x021E   ; address of 'MaX SCoRe' text string
NOPLAY  =     0x0228   ; address of 'Number Of PLAYers' string
NOGAME  =     0x0235   ; address of 'Number Of GAMEs' string
;
; BITS in PROCESSOR FLAG byte:
PSWCY   =     0       ; Processor Status Word, CarrY bit
PSWPV   =     2       ; Processor Status Word, Parity or oVerflow bit
PSWZRO  =     6       ; Processor Status Word, ZeRO bit
PSWSGN  =     7       ; Processor Status Word, SiGN bit
;
; BITS in GAME STATUS Byte:
GSBTIM  =     0       ; Game Status Byte, if TIMe is up set end bit
GSBSCR  =     1       ; Game Status Byte, if SCoRe reached set end bit
GSBEND  =     7       ; Game Status Byte, END flag bit
;
; Standard VECTOR DISPLACEMENTS and bits:
VBMR    =     0x00     ;  +0   ; Vector Block, Magic Register
VBSTAT  =     0x01     ;  +1   ; Vector Block, STATus byte
VBTIMB  =     0x02     ;  +2   ; Vector Block, TIMe Base
VBDXL   =     0x03     ;  +3   ; Vector Block, Delta for X Low
VBDXH   =     0x04     ;  +4   ; Vector Block, Delta for X Hi
VBXL    =     0x05     ;  +5   ; Vector Block, X coord Low
VBXH    =     0x06     ;  +6   ; Vector Block, X coord Hi
VBXCHK  =     0x07     ;  +7   ; Vector Block, X CHecK flags
VBDYL   =     0x08     ;  +8   ; Vector Block, Delta for Y Low
VBDYH   =     0x09     ;  +9   ; Vector Block, Delta for Y Hi
VBYL    =     0x0A     ; +10   ; Vector Block, Y coord Low
VBYH    =     0x0B     ; +11   ; Vector Block, Y coord Hi
VBYCHK  =     0x0C     ; +12   ; Vector Block, Y CHecK flags
VBOAL   =     0x0D     ; +13   ; Vector Block, Old Address Low
VBOAH   =     0x0E     ; +14   ; Vector Block, Old Address Hi
;
; DISPLACEMENTS from start of COORDINATE AREA (X or Y):
VBDCL   =     0x00     ;  +0   ; Vector Block, Delta for Coord Low
VBDCH   =     0x01     ;  +1   ; Vector Block, Delta for Coord Hi
VBCL    =     0x02     ;  +2   ; Vector Block, Coord Low
VBCH    =     0x03     ;  +3   ; Vector Block, Coord Hi
VBCCHK  =     0x04     ;  +4   ; Vector Block, Coord CHecK flags
;
; BITS in STATUS byte:
VBBLNK  =     6       ; Vector Block status, BLaNK bit
VBSACT  =     7       ; Vector Block Status, ACTive bit
;
;  BITS in (X or Y) VB CHECK FLAG bit mask:
VBCLMT  =     0       ; Vector Block Check, LiMiT bit
VBCREV  =     1       ; Vector Block Check, REVerse delta on limit attain
VBCLAT  =     3       ; Vector Block Check, coordinate Limit ATtained
;
; FONT TABLE DISPLACEMENTS for CHARACTER DESCRIPTOR BLOCK:
FTBASE  =     0x00     ;  +0   ; FonT BASE character (normally 0xA0)
FTFSX   =     0x01     ;  +1   ; FonT Frame X Size width
FTFSY   =     0x02     ;  +2   ; FonT Frame Y Size height
FTBYTE  =     0x03     ;  +3   ; FonT X size for char in BYTEs
FTYSIZ  =     0x04     ;  +4   ; FonT Y SIZe height in rows
FTPTL   =     0x05     ;  +5   ; FonT Pattern Table address Low
FTPTH   =     0x06     ;  +6   ; FonT Pattern Table address Hi
;
; BITS for MAGIC REGISTER (write option) byte:
MRSHFT  =     0x03     ; Magic Register, mask of SHiFT amount 0-3
MRROT   =     2       ; Magic Register, write with ROTata bit
MRXPND  =     3       ; Magic Register, write with eXPaND bit
MROR    =     4       ; Magic Register, write with OR bit
MRXOR   =     5       ; Magic Register, write with eXclusive-OR bit
MRFLOP  =     6       ; Magic Register, write with FLOP bit
;
; BITS of CONTROL HANDLE Input port:
CHUP    =     0       ; Control Handle, UP bit
CHDOWN  =     1       ; Control Handle, DOWN bit
CHLEFT  =     2       ; Control Handle, joystick LEFT bit
CHRIGH  =     3       ; Control Handle, joystick RIGHT bit
CHTRIG  =     4       ; Control Handle, TRIGger bit
;
; CONTEXT BLOCK Register DISPLACEMENTS:
CBIYL   =     0x00     ;  +0   ; Context Block, IY register Low
CBIYH   =     0x01     ;  +1   ; Context Block, IY register Hi
CBIXL   =     0x02     ;  +2   ; Context Block, IX register Low
CBIXH   =     0x03     ;  +3   ; Context Block, IX register Hi
CBE     =     0x04     ;  +4   ; Context Block, E register
CBD     =     0x05     ;  +5   ; Context Block, D register
CBC     =     0x06     ;  +6   ; Context Block, C register
CBB     =     0x07     ;  +7   ; Context Block, B register
CBFLAG  =     0x08     ;  +8   ; Context Block, FLAGs register
CBA     =     0x09     ;  +9   ; Context Block, A register
CBL     =     0x0A     ; +10   ; Context Block, L register
CBH     =     0x0B     ; +11   ; Context Block, H register
;
; SENTRY RETURN Codes =ates:
SNUL    =     0x00     ; Sentry return NULl, nothing happened
SCT0    =     0x01     ; Sentry, Counter-Timer 0 has counted down
SCT1    =     0x02     ; Sentry, Counter-Timer 1 has counted down
SCT2    =     0x03     ; Sentry, Counter-Timer 2 has counted down
SCT3    =     0x04     ; Sentry, Counter-Timer 3 has counted down
SCT4    =     0x05     ; Sentry, Counter-Timer 4 has counted down
SCT5    =     0x06     ; Sentry, Counter-Timer 5 has counted down
SCT6    =     0x07     ; Sentry, Counter-Timer 6 has counted down
SCT7    =     0x08     ; Sentry, Counter-Timer 7 has counted down
SF0     =     0x09     ; Sentry, Flag bit 0 has changed
SF1     =     0x0A     ; Sentry, Flag bit 1 has changed
SF2     =     0x0B     ; Sentry, Flag bit 2 has changed
SF3     =     0x0C     ; Sentry, Flag bit 3 has changed
SF4     =     0x0D     ; Sentry, Flag bit 4 has changed
SF5     =     0x0E     ; Sentry, Flag bit 5 has changed
SF6     =     0x0F     ; Sentry, Flag bit 6 has changed
SF7     =     0x10     ; Sentry, Flag bit 7 has changed
SSEC    =     0x11     ; Sentry, SEConds timer has counted down
SKYU    =     0x12     ; Sentry, KeY is now Up
SKYD    =     0x13     ; Sentry, KeY is now Down
ST0     =     0x14     ; Sentry, Trigger 0 for player 1 has changed
SJ0     =     0x15     ; Sentry, Joystick 0 for player 1 has changed
ST1     =     0x16     ; Sentry, Trigger 1 for player 2 has changed
SJ1     =     0x17     ; Sentry, Joystick 1 for player 2 has changed
ST2     =     0x18     ; Sentry, Trigger 2 for player 3 has changed
SJ2     =     0x19     ; Sentry, Joystick 2 for player 3 has changed
ST3     =     0x1A     ; Sentry, Trigger 3 for player 4 has changed
SJ3     =     0x1B     ; Sentry, Joystick 3 for player 4 has changed
SP0     =     0x1C     ; Sentry, POTentiometer 0 has changed
SP1     =     0x1D     ; Sentry, POTentiometer 1 has changed
SP2     =     0x1E     ; Sentry, POTentiometer 2 has changed
SP3     =     0x1F     ; Sentry, POTentiometer 3 has changed
;
;
; ********************************
; * Home Video Game PORT =ates *
; ********************************
;
; OUTPUT Ports for VIRTUAL COLOR:
COL0R   =     0x00     ; &(0)= ; write COLor 0 Right
COL1R   =     0x01     ; &(1)= ; write COLor 1 Right
COL2R   =     0x02     ; &(2)= ; write COLor 2 Right
COL3R   =     0x03     ; &(3)= ; write COLor 3 Right
COL0L   =     0x04     ; &(4)= ; write COLor 0 Left
COL1L   =     0x05     ; &(5)= ; write COLor 1 Left
COL2L   =     0x06     ; &(6)= ; write COLor 2 Left
COL3L   =     0x07     ; &(7)= ; write COLor 3 Left
HORCB   =     0x09     ; &(9)= ; write HORizontal Color Boundary
VERBL   =     0x0A     ;&(10)= ; write VERtical Blanking Line
COLBX   =     0x0B     ;&(11)= ; write COLor BloCK multi-port
;
; OUTPUT Ports for MUSIC and SOUNDS:
TONMO   =     0x10     ;&(16)= ; write TONe Master Oscillator
TONEA   =     0x11     ;&(17)= ; write TONe A oscillator
TONEB   =     0x12     ;&(18)= ; write TONe B oscillator
TONEC   =     0x13     ;&(19)= ; write TONe C oscillator
VIBRA   =     0x14     ;&(20)= ; write VIBRAto frequency & range
VOLC    =     0x15     ;&(21)= ; write VOLume of tone C
VOLAB   =     0x16     ;&(22)= ; write VOLumes of tones A & B
VOLN    =     0x17     ;&(23)= ; write VOLume of Noise
SNDBX   =     0x18     ;&(24)= ; write SouND BloCK multi-port
;
; INTERRUPT and CONTROL OUTPUT Ports:
CONCM   =     0x08     ; &(8)= ; write 0 for CONsumer, 1 for CoMmercial mode
MAGIC   =     0x0C     ;&(12)= ; write MAGIC register
INFBK   =     0x0D     ;&(13)= ; write INterrupt FeedBacK
INMOD   =     0x0E     ;&(14)= ; write INterrupt MODe
INLIN   =     0x0F     ;&(15)= ; write INterrupt LINe
XPAND   =     0x19     ;&(25)= ; eXPANDer pixel definition port
;
; INTERRUPT and INTERCEPT INPUT Ports:
INTST   =     0x08     ; =&(8) ; read INTercept STatus
VERAF   =     0x0E     ;=&(14) ; read VERtical Address Feedback
HORAF   =     0x0F     ;=&(15) ; read HORizontal Address Feedback
 ;
; HAND CONTROL INPUT Ports:
SW0     =     0x10     ;=&(16) ; read SWitch bank 0 for player 1 hand control
SW1     =     0x11     ;=&(17) ; read SWitch bank 1 for player 2 hand control
SW2     =     0x12     ;=&(18) ; read SWitch bank 2 for player 3 hand control
SW3     =     0x13     ;=&(19) ; read SWitch bank 3 for player 4 hand control
POT0    =     0x1C     ;=&(28) ; read POTentiometer 0 for player 1 knob
POT1    =     0x1D     ;=&(29) ; read POTentiometer 1 for player 2 knob
POT2    =     0x1E     ;=&(30) ; read POTentiometer 2 for player 3 knob
POT3    =     0x1F     ;=&(31) ; read POTentiometer 3 for player 4 knob
;
; KEYBOARD INPUT Ports:
KEY0    =     0x14     ;=&(20) ; KEYboard column 0 (right side)
KEY1    =     0x15     ;=&(21) ; KEYboard column 1 (center right)
KEY2    =     0x16     ;=&(22) ; KEYboard column 2 (center left)
KEY3    =     0x17     ;=&(23) ; KEYboard column 3 (left side)
;
;
; ***************************************
; * Home Video Game SYSTEM CALL Indexes *
; ***************************************
;
; USER PROGRAM Interface:
INTPC   =     0x00     ;  # 0  ; INTerPret with Context create
XINTC   =     0x02     ;  # 2  ; eXit INTerpreter with Context
RCALL   =     0x04     ;  # 4  ; Real CALL asm language subroutine
MCALL   =     0x06     ;  # 6  ; Macro CALL interpreter subroutine
MRET    =     0x08     ;  # 8  ; Macro RETurn from interpreter subroutine
MJUMP   =     0x0A     ; # 10  ; Macro JUMP to interpreter subroutine
SUCK    =     0x0C     ; # 12  ; SUCK inline args into context block
;
; SCHEDULER Routines:
ACTINT  =     0x0E     ; # 14  ; ACTivate sub timer INTerrupts
DECCTS  =     0x10     ; # 16  ; DECrement CTS under mask
;
; MUSIC and SOUNDS:
BMUSIC  =     0x12     ; # 18  ; Begin playing MUSIC
EMUSIC  =     0x14     ; # 20  ; End playing MUSIC
;
; SCREEN HANDLER Routines:
SETOUT  =     0x16     ; # 22  ; SET some OUTput ports
COLSET  =     0x18     ; # 24  ; COLors SET
FILL    =     0x1A     ; # 26  ; FILL memory with data
RECTAN  =     0x1C     ; # 28  ; paint a RECTANgle
VWRITR  =     0x1E     ; # 30  ; Vector WRITe Relative
WRITR   =     0x20     ; # 32  ; WRITe Relative
WRITP   =     0x22     ; # 34  ; WRITe with Pattern size lookup
WRIT    =     0x24     ; # 36  ; WRITe with sizes provided
WRITA   =     0x26     ; # 38  ; WRITe Absolute
VBLANK  =     0x28     ; # 40  ; Vector BLANK area
BLANK   =     0x2A     ; # 42  ; BLANK area
SAVE    =     0x2C     ; # 44  ; SAVE area
RESTOR  =     0x2E     ; # 46  ; RESTORe area
SCROLL  =     0x30     ; # 48  ; SCROLL area of screen
;
CHRDIS  =     0x32     ; # 50  ; CHaRacter DISplay
STRDIS  =     0x34     ; # 52  ; STRing DISplay
DISNUM  =     0x36     ; # 54  ; DISplay NUMber
;
RELABS  =     0x38     ; # 56  ; RELative to ABSolute conversion
RELAB1  =     0x3A     ; # 58  ; RELative to non-magic ABSolute
VECTC   =     0x3C     ; # 60  ; VECTor move single Coordinate
VECT    =     0x3E     ; # 62  ; VECTor move coordinate pair
;
; HUMAN INTERFACE Routines:
KCTASC  =     0x40     ; # 64  ; Key Code in B To ASCii
SENTRY  =     0x42     ; # 66  ; SENse TRansition Y
DOIT    =     0x44     ; # 68  ; DOIT table, branch to translation handler
DOITB   =     0x46     ; # 70  ; DOIT table, use B instead of A
PIZBRK  =     0x48     ; # 72  ; take a PIZza BReaK
MENU    =     0x4A     ; # 74  ; display a MENU
GETPAR  =     0x4C     ; # 76  ; GET game PARameter from user
GETNUM  =     0x4E     ; # 78  ; GET NUMber from user
PAWS    =     0x50     ; # 80  ; PAUSE
DISTIM  =     0x52     ; # 82  ; DISplay TIMe
INCSCR  =     0x54     ; # 84  ; INCrement SCoRe
;
; MATH Routines:
INDEXN  =     0x56     ; # 86  ; INDEX Nibble by C
STOREN  =     0x58     ; # 88  ; STORE Nibble in A by C
INDEXW  =     0x5A     ; # 90  ; INDEX Word by A
INDEXB  =     0x5C     ; # 92  ; INDEX Byte by A
MOVE    =     0x5E     ; # 94  ; MOVE block transfer
SHIFTU  =     0x60     ; # 96  ; SHIFT Up digit in A
BCDADD  =     0x62     ; # 98  ; BCD ADDition
BCDSUB  =     0x64     ;# 100  ; BCD SUBtraction
BCDMUL  =     0x66     ;# 102  ; BCD MULtiplication
BCDDIV  =     0x68     ;# 104  ; BCD DIVision
BCDCHS  =     0x6A     ;# 106  ; BCD CHange Sign
BCDNEG  =     0x6C     ;# 108  ; BCD NEGate to decimal
DADD    =     0x6E     ;# 110  ; Decimal ADDition
DSMG    =     0x70     ;# 112  ; Decimal convert to Sign MaGnitude
DABS    =     0x72     ;# 114  ; Decimal ABSolute value
NEGT    =     0x74     ;# 116  ; decimal NEGaTe
RANGED  =     0x76     ;# 118  ; RANGED random number
QUIT    =     0x78     ;# 120  ; QUIT cassette execution
SETB    =     0x7A     ;# 122  ; SET Byte
SETW    =     0x7C     ;# 124  ; SET Word
MSKTD   =     0x7E     ;# 127  ; MaSK joystick in B To Deltas
;
;
; ***************************
; * SYSTEM RAM MEMORY Cells *
; ***************************
WASTE   =     0x0FFF
WASTER  =     WASTE
;
SYSRAM  =     0x4FCE   ; Resides at the highest possible address
BEGRAM  =     SYSRAM  ; typically used for initial Stack Pointer
; Used by MUSIC PROCESSOR:
MUZPC   =     0x4FCE   ; MUSic Program Counter
MUZSP   =     0x4FD0   ; MUSic Stack Pointer
PVOLAB  =     0x4FD2   ; Preset VOLume for tones A and B
PVOLMC  =     0x4FD3   ; Preset VOLuMe for tone C and Noise Mode
VOICES  =     0x4FD4   ; music VOICES mask
; COUNTER TIMERS (used by DECCTS,ACTINT,CTIMER):
CT0     =     0x4FD5   ; Counter Timer 0
CT1     =     0x4FD6   ; Counter Timer 1
CT2     =     0x4FD7   ; Counter Timer 2
CT3     =     0x4FD8   ; Counter Timer 3
CT4     =     0x4FD9   ; Counter Timer 4
CT5     =     0x4FDA   ; Counter Timer 5
CT6     =     0x4FDB   ; Counter Timer 6
CT7     =     0x4FDC   ; Counter Timer 7
;Used by SENTRY to track controls:
CNT     =     0x4FDD   ; Counter update & Number Tracking
SEMI4S  =     0x4FDE   ; SEMAPHORE flag bitS
OPOT0   =     0x4FDF   ; Old POT 0 tracking byte
OPOT1   =     0x4FE0   ; Old POT 1 tracking byte
OPOT2   =     0x4FE1   ; Old POT 2 tracking byte
OPOT3   =     0x4FE2   ; Old POT 3 tracking byte
KEYSEX  =     0x4FE3   ; KEYS-EX tracking byte
OSW0    =     0x4FE4   ; Old SWitch 0 tracking byte
OSW1    =     0x4FE5   ; Old SWitch 1 tracking byte
OSW2    =     0x4FE6   ; Old SWitch 2 tracking byte
OSW3    =     0x4FE7   ; Old SWitch 3 tracking byte
COLLST  =     0x4FE8   ; COLset LaST address for P.B. A
; Used by STIMER:
DURAT   =     0x4FEA   ; note DURATion
TMR60   =     0x4FEB   ; TiMeR for SIXTYths of sec
TIMOUT  =     0x4FEC   ; TIMer for blackOUT
GTSECS  =     0x4FED   ; Game Time SECondS
GTMINS  =     0x4FEE   ; Game Time MINuteS
; Used by MENU:
RANSHT  =     0x4FEF   ; RANdom number SHifT register
NUMPLY  =     0x4FF3   ; NUMber of PLaYers
ENDSCR  =     0x4FF4   ; END SCoRe to 'play to'
MRLOCK  =     0x4FF7   ; Magic Register LOCK out flag
GAMSTB  =     0x4FF8   ; GAMe STatus Byte
PRIOR   =     0x4FF9   ; PRIOR music protect flag
SENFLG  =     0x4FFA   ; SENtry control seizure FLaG
; User UPI Routines, even numbers from 0x80 to 0xFE ( + 1 for SUCK):
UMARGT  =     0x4FFB   ; User Mask ARGument Table + (routine / 2)
USERTB  =     0x4FFD   ; USER Table Base + routine = JumP address
;
URINAL  =     0x4FFF   ; WASTER flushes here!
;
;

;
; MACROs to generate SYSTEM CALLs:
	.macro	SYSTEM NUMBA
        rst     0x38
        .db     NUMBA
;        .if     NUMBA = INTPC
;INTPCC  =    1
;        .endif
        .endm
; MACRO to generate SYSTEM CALL with SUCK option ON:
	.macro	SYSSUK UMBA
        rst     0x38
        .db     UMBA + 1
;        .if     UMBA = INTPC
;INTPCC  =    1
;        .endif
        .endm
; MACROs to generate MACRO INTERPRETER CALLs:
; INTERPRET without INLINE SUCK:
	.macro	DONT CID
        .db     CID
        .endm
; INTERPRET with INLINE SUCK option ON:
	.macro	DO CID
       	.db     CID + 1
        .endm
