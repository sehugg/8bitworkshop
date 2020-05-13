
`include "hvsync_generator.v"
`include "sprite_bitmap.v"
`include "sprite_renderer.v"
`include "cpu8.v"

/*
A simple racing game with two sprites and a scrolling playfield.
This version uses the 8-bit CPU.
*/

module racing_game_cpu_top(clk, reset, hsync, vsync, hpaddle, vpaddle, rgb);

  input clk, reset;
  input hpaddle, vpaddle;
  output hsync, vsync;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  output [3:0] rgb;
  
  parameter PADDLE_X = 0;	// paddle X coordinate
  parameter PADDLE_Y = 1;	// paddle Y coordinate
  parameter PLAYER_X = 2;	// player X coordinate
  parameter PLAYER_Y = 3;	// player Y coordinate
  parameter ENEMY_X = 4;	// enemy X coordinate
  parameter ENEMY_Y = 5;	// enemy Y coordinate
  parameter ENEMY_DIR = 6;	// enemy direction (1, -1)
  parameter SPEED = 7;		// player speed
  parameter TRACKPOS_LO = 8;	// track position (lo byte)
  parameter TRACKPOS_HI = 9;	// track position (hi byte)

  parameter IN_HPOS = 8'h40;	// CRT horizontal position
  parameter IN_VPOS = 8'h41;	// CRT vertical position
  // flags: [0, 0, collision, vsync, hsync, vpaddle, hpaddle, display_on]
  parameter IN_FLAGS = 8'h42;

  reg [7:0] ram[0:15];	// 16 bytes of RAM
  reg [7:0] rom[0:127];	// 128 bytes of ROM
  
  wire [7:0] address_bus;	// CPU address bus
  reg  [7:0] to_cpu;		// data bus to CPU
  wire [7:0] from_cpu;		// data bus from CPU
  wire write_enable;		// write enable bit from CPU
  
  // 8-bit CPU module
  CPU cpu(.clk(clk),
          .reset(reset),
          .address(address_bus),
          .data_in(to_cpu),
          .data_out(from_cpu),
          .write(write_enable));

  // RAM write from CPU
  always @(posedge clk)
    if (write_enable)
      ram[address_bus[3:0]] <= from_cpu;
  
  // RAM read from CPU
  always @(*)
    casez (address_bus)
      // RAM
      8'b00??????: to_cpu = ram[address_bus[3:0]];
      // special read registers
      IN_HPOS:  to_cpu = hpos[7:0];
      IN_VPOS:  to_cpu = vpos[7:0];
      IN_FLAGS: to_cpu = {2'b0, frame_collision,
                          vsync, hsync, vpaddle, hpaddle, display_on};
      // ROM
      8'b1???????: to_cpu = rom[address_bus[6:0]];
      default: to_cpu = 8'bxxxxxxxx;
    endcase

  // sync generator module
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(0),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  // flags for player sprite renderer module
  wire player_vstart = {1'b0,ram[PLAYER_Y]} == vpos;
  wire player_hstart = {1'b0,ram[PLAYER_X]} == hpos;
  wire player_gfx;
  wire player_is_drawing;

  // flags for enemy sprite renderer module
  wire enemy_vstart = {1'b0,ram[ENEMY_Y]} == vpos;
  wire enemy_hstart = {1'b0,ram[ENEMY_X]} == hpos;
  wire enemy_gfx;
  wire enemy_is_drawing;

  // select player or enemy access to ROM
  wire player_load = (hpos >= 256) && (hpos < 260);
  wire enemy_load = (hpos >= 260);
  // wire up car sprite ROM
  // multiplex between player and enemy ROM address
  wire [3:0] player_sprite_yofs;
  wire [3:0] enemy_sprite_yofs;
  wire [3:0] car_sprite_yofs = player_load ? player_sprite_yofs : enemy_sprite_yofs;  
  wire [7:0] car_sprite_bits;  
  car_bitmap car(
    .yofs(car_sprite_yofs), 
    .bits(car_sprite_bits));
  
  // player sprite renderer
  sprite_renderer player_renderer(
    .clk(clk),
    .vstart(player_vstart),
    .hstart(player_hstart),
    .load(player_load),
    .rom_addr(player_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(player_gfx),
    .in_progress(player_is_drawing));

  // enemy sprite renderer
  sprite_renderer enemy_renderer(
    .clk(clk),
    .vstart(enemy_vstart),
    .hstart(enemy_hstart),
    .load(enemy_load),
    .rom_addr(enemy_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(enemy_gfx),
    .in_progress(enemy_is_drawing));
  
  // collision detection logic
  reg frame_collision;
  always @(posedge clk)
    if (player_gfx && (enemy_gfx || track_gfx))
      frame_collision <= 1;
    else if (vpos==0)
      frame_collision <= 0;
  
  // track graphics
  wire track_offside = (hpos[7:5]==0) || (hpos[7:5]==7);
  wire track_shoulder = (hpos[7:3]==3) || (hpos[7:3]==28);
  wire track_gfx = (vpos[5:1]!=ram[TRACKPOS_LO][5:1]) && track_offside;
  
  // RGB output
  wire r = display_on && (player_gfx || enemy_gfx || track_shoulder);
  wire g = display_on && (player_gfx || track_gfx);
  wire b = display_on && (enemy_gfx || track_shoulder);
  // RGBI (in IBGR order, intensity is 4th bit)
  assign rgb = {1'b0,b,g,r};
  
  //////////// CPU program code

`ifdef EXT_INLINE_ASM
  initial begin
    rom = '{
      __asm
.arch femto8		; FEMTO-8 architecture
.org 128		; origin = 128 ($80)
.len 128		; length = 128 ($80)

; define constants
.define PADDLE_X 0
.define PADDLE_Y 1
.define PLAYER_X 2
.define PLAYER_Y 3
.define ENEMY_X 4
.define ENEMY_Y 5
.define ENEMY_DIR 6
.define SPEED 7
.define TRACKPOS_LO 8
.define TRACKPOS_HI 9

.define IN_HPOS  $40
.define IN_VPOS  $41
.define IN_FLAGS $42

.define F_DISPLAY 1
.define F_HPADDLE 2
.define F_VPADDLE 4
.define F_HSYNC 8
.define F_VSYNC 16
.define F_COLLIDE 32

Start:
	lda	#128		; load initial positions
	sta	PLAYER_X	; player_x = 128
	sta	ENEMY_X		; enemy_x = 128
	sta	ENEMY_Y		; enemy_y = 128
	lda	#180
	sta	PLAYER_Y	; player_y = 180
	zero	A
	sta	SPEED		; player speed = 0
        inc	A
        sta	ENEMY_DIR	; enemy dir = 1 (right)
; read horizontal paddle position
DisplayLoop:
	lda	#F_HPADDLE	; paddle flag -> A
	ldb	#IN_FLAGS	; addr of IN_FLAGS -> B
        and	none,[B]	; read B, AND with A
	bz	DisplayLoop	; loop until paddle flag set
	ldb	#IN_VPOS
        mov	A,[B]		; load vertical position -> A
	sta	PLAYER_X	; store player x position
; wait for vsync
	lda	#F_VSYNC
	ldb	#IN_FLAGS
WaitForVsyncOn:
        and	none,[B]
	bz	WaitForVsyncOn	; wait until VSYNC on
WaitForVsyncOff:
        and	none,[B]
	bnz	WaitForVsyncOff	; wait until VSYNC off
; check collision
	lda	#F_COLLIDE
	ldb	#IN_FLAGS
        and	none,[B]	; collision flag set?
	bz	NoCollision	; skip ahead if not
	lda	#16
	sta	SPEED		; speed = 16
NoCollision:
; update speed
	ldb	#SPEED
        mov	A,[B]		; speed -> A
	inc	A		; increment speed
	bz	MaxSpeed	; speed wraps to 0?
	sta	SPEED		; no, store speed
MaxSpeed:
	mov	A,[B]		; reload speed -> A
	lsr	A
	lsr	A
	lsr	A
	lsr	A		; divide speed by 16
; add to lo byte of track pos
	ldb	#TRACKPOS_LO
	add	B,[B]		; B <- speed/16 + trackpos_lo
	swapab			; swap A <-> B
	sta	TRACKPOS_LO	; A -> trackpos_lo
	swapab			; swap A <-> B again
	bcc	NoCarry		; carry flag from earlier add op
; add to hi byte of track pos
	ldb	#TRACKPOS_HI
	mov	B,[B]		; B <- trackpos_hi
	inc	b		; increment B
	swapab			; swap A <-> B
	sta	TRACKPOS_HI	; A -> trackpos_hi
	swapab			; swap A <-> B again
NoCarry:
; update enemy vert pos
	ldb	#ENEMY_Y
        add	A,[B]
	sta	ENEMY_Y		; enemy_y = enemy_y + speed/16
; update enemy horiz pos
      	ldb	#ENEMY_X
        mov	A,[B]
        ldb	#ENEMY_DIR
        add	A,[B]
        sta	ENEMY_X		; enemy_x = enemy_x + enemy_dir
        sub	A,#64
      	and     A,#127		; A <- (enemy_x-64) & 127
      	bnz     SkipXReverse	; skip if enemy_x is in range
; load ENEMY_DIR and negate
      	zero	A
        sub	A,[B]
        sta	ENEMY_DIR	; enemy_dir = -enemy_dir
SkipXReverse:
; back to display loop
	jmp	DisplayLoop
      __endasm
    };
  end
`endif
  
endmodule
