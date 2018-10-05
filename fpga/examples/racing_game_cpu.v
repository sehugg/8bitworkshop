
`include "hvsync_generator.v"
`include "sprite_bitmap.v"
`include "sprite_renderer.v"
`include "cpu8.v"

/*
A simple racing game with two sprites and a scrolling playfield.
This version uses the 8-bit CPU.
*/

// uncomment to see scope view
//`define DEBUG

module racing_game_top(clk, reset, out, hpaddle, vpaddle);

  input clk, reset;
  input hpaddle, vpaddle;
  output [1:0] out;
  wire hsync, vsync;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
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
  
  reg clk2;
  always @(posedge clk) begin
    clk2 <= !clk2;
  end

  // 8-bit CPU module
  CPU cpu(.clk(clk2),
          .reset(reset),
          .address(address_bus),
          .data_in(to_cpu),
          .data_out(from_cpu),
          .write(write_enable));

  // RAM write from CPU
  always @(posedge clk2)
    if (write_enable)
      ram[address_bus[5:0]] <= from_cpu;
  
  // RAM read from CPU
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
      8'b1???????: to_cpu = rom[address_bus[6:0]];
      default: to_cpu = 8'bxxxxxxxx;
    endcase

  // video sync generator
  hvsync_generator #(256,60,40,25) hvsync_gen(
    .clk(clk2),
    .reset(reset),
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
    .clk(clk2),
    .reset(reset),
    .vstart(player_vstart),
    .hstart(player_hstart),
    .load(player_load),
    .rom_addr(player_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(player_gfx),
    .in_progress(player_is_drawing));

  // enemy sprite renderer
  sprite_renderer enemy_renderer(
    .clk(clk2),
    .reset(reset),
    .vstart(enemy_vstart),
    .hstart(enemy_hstart),
    .load(enemy_load),
    .rom_addr(enemy_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(enemy_gfx),
    .in_progress(enemy_is_drawing));

  // collision detection logic
  reg frame_collision;
  always @(posedge clk2)
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

  assign out = (hsync||vsync) ? 0 : (1+g+(r|b));
  
  //////////// CPU program code

  initial begin
    $readmemh("racing.hex", rom);
  end
  
endmodule

