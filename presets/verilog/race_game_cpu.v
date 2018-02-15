`include "hvsync_generator.v"
`include "sprite_renderer.v"
`include "cpu8.v"

// uncomment to see scope view
//`define DEBUG

module sprite_multiple_top(clk, reset, hsync, vsync, hpaddle, vpaddle,
                           address_bus, to_cpu, from_cpu, write_enable
`ifdef DEBUG
                           , output [7:0] A
                           , output [7:0] B
                           , output [7:0] IP
                           , output carry
                           , output zero
`else
                           , output [2:0] rgb
`endif
);

  input clk, reset;
  input hpaddle, vpaddle;
  output hsync, vsync;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
`ifdef DEBUG
  wire [2:0] rgb;
  assign IP = cpu.IP;
  assign A = cpu.A;
  assign B = cpu.B;
  assign carry = cpu.carry;
  assign zero = cpu.zero;
`endif
  
  parameter PADDLE_X = 0;
  parameter PADDLE_Y = 1;
  parameter PLAYER_X = 2;
  parameter PLAYER_Y = 3;
  parameter ENEMY_X = 4;
  parameter ENEMY_Y = 5;
  parameter ENEMY_DIR = 6;
  parameter SPEED = 7;
  parameter TRACKPOS_LO = 8;
  parameter TRACKPOS_HI = 9;

  parameter IN_HPOS = 8'b01000000;
  parameter IN_VPOS = 8'b01000001;
  parameter IN_FLAGS = 8'b01000010;

  reg [7:0] ram[0:63];
  reg [7:0] rom[0:255];
  
  output wire [7:0] address_bus;
  output reg  [7:0] to_cpu;
  output wire [7:0] from_cpu;
  output wire write_enable;
  
  CPU cpu(.clk(clk),
          .reset(reset),
          .address(address_bus),
          .data_in(to_cpu),
          .data_out(from_cpu),
          .write(write_enable));

  always @(posedge clk)
    if (write_enable)
      ram[address_bus[5:0]] <= from_cpu;
  
  always @(*)
    casez (address_bus)
      // RAM
      8'b00??????: to_cpu = ram[address_bus[5:0]];
      // special read registers
      IN_HPOS:  to_cpu = hpos[7:0];
      IN_VPOS:  to_cpu = vpos[7:0];
      IN_FLAGS: to_cpu = {2'b0, frame_collision,
                          vsync, hsync, vpaddle, hpaddle, display_on};
      // ROM
      8'b1???????: to_cpu = rom[address_bus[6:0] + 128];
      default: ;
    endcase
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(0),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  wire player_vstart = {1'0,ram[PLAYER_Y]} == vpos;
  wire player_hstart = {1'0,ram[PLAYER_X]} == hpos;
  wire player_gfx;
  wire player_is_drawing;

  wire enemy_vstart = {1'0,ram[ENEMY_Y]} == vpos;
  wire enemy_hstart = {1'0,ram[ENEMY_X]} == hpos;
  wire enemy_gfx;
  wire enemy_is_drawing;

  wire [3:0] car_sprite_yofs;
  wire [7:0] car_sprite_bits;
  
  car_bitmap car(
    .yofs(car_sprite_yofs), 
    .bits(car_sprite_bits));
  
  sprite_renderer player_renderer(
    .clk(clk),
    .vstart(player_vstart),
    .hstart(player_hstart),
    .load(hpos == 256), //TODO?
    .rom_addr(car_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(player_gfx),
    .in_progress(player_is_drawing));

  sprite_renderer enemy_renderer(
    .clk(clk),
    .vstart(enemy_vstart),
    .hstart(enemy_hstart),
    .load(hpos == 260), //TODO?
    .rom_addr(car_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(enemy_gfx),
    .in_progress(player_is_drawing));
  
  initial begin
    rom = '{
      __asm
.arch nano8
.org 128

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
	lda	128
	sta	PLAYER_X
	sta	ENEMY_X
	sta 	ENEMY_Y
	lda	180
	sta	PLAYER_Y
	zero	A
	sta	SPEED
        inc	A
        sta	ENEMY_DIR
; test hpaddle flag
DisplayLoop:
	lda	F_HPADDLE
	ldb	IN_FLAGS
	andrb	NOP
	bz	DisplayLoop
; [vpos] -> paddle_x
	ldb	IN_VPOS
	movrb	A
	sta	PLAYER_X
; wait for vsync=1 then vsync=0
	lda	F_VSYNC
	ldb	IN_FLAGS
WaitForVsyncOn:
	andrb	NOP
	bz	WaitForVsyncOn
WaitForVsyncOff:
	andrb	NOP
	bnz	WaitForVsyncOff
; check collision
	lda	F_COLLIDE
	ldb	IN_FLAGS
	andrb	NOP
	bz	NoCollision
; load slow speed
	lda	16
	sta	SPEED
NoCollision:
; update speed
	ldb	SPEED
	movrb	A
	inc	A
; don't store if == 0
	bz	MaxSpeed
	sta	SPEED
MaxSpeed:
	movrb	A
	lsr	A
	lsr	A
	lsr	A
	lsr	A
; add to lo byte of track pos
	ldb	TRACKPOS_LO
	addrb	B
	swapab
	sta	TRACKPOS_LO
	swapab
; update enemy vert pos
	ldb	ENEMY_Y
	addrb	A
	sta	ENEMY_Y
; update enemy horiz pos
      	ldb	ENEMY_X
        movrb	A
        ldb	ENEMY_DIR
        addrb	A
        sta	ENEMY_X
        subi	A 64
        andi    A 127
        bnz     SkipXReverse
; load ENEMY_DIR and negate
      	zero	A
        subrb	A
        sta	ENEMY_DIR
; back to display loop
SkipXReverse:
	jmp	DisplayLoop
      __endasm
    };
  end
  
  reg frame_collision;
  
  always @(posedge clk)
    if (player_gfx && (enemy_gfx || track_gfx))
      frame_collision <= 1;
    else if (vpos==0)
      frame_collision <= 0;
  
  wire track_offside = (hpos[7:5]==0) || (hpos[7:5]==7);
  wire track_shoulder = (hpos[7:3]==3) || (hpos[7:3]==28);
  wire track_gfx = (vpos[5:1]!=ram[TRACKPOS_LO][5:1]) && track_offside;
  
  wire r = display_on && (player_gfx || enemy_gfx || track_shoulder);
  wire g = display_on && (player_gfx || track_gfx);
  wire b = display_on && (enemy_gfx || track_shoulder);
  assign rgb = {b,g,r};

endmodule
