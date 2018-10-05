
`include "hvsync_generator.v"
`include "sprite_bitmap.v"
`include "sprite_renderer.v"

/*
A simple racing game with two sprites and a scrolling playfield.
This version does not use a CPU; all logic is straight Verilog.
*/

module racing_game_top(clk, reset, out);

  input clk, reset;
  output [1:0] out;
  
  wire hsync, vsync;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;

  // player car position (set at VSYNC)
  reg [7:0] player_x;
  reg [7:0] player_y;  

  reg clk2;
  always @(posedge clk) begin
    clk2 <= !clk2;
  end

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

  // select player or enemy access to ROM
  wire player_load = (hpos >= 256);
  // wire up car sprite ROM
  wire [3:0] car_sprite_yofs;
  wire [7:0] car_sprite_bits;  
  car_bitmap car(
    .yofs(car_sprite_yofs), 
    .bits(car_sprite_bits));
  
  // signals for player sprite generator
  wire player_vstart = player_y == vpos;
  wire player_hstart = player_x == hpos;
  wire player_gfx;
  wire player_is_drawing;

  // player sprite generator
  sprite_renderer player_renderer(
    .clk(clk2),
    .reset(reset),
    .vstart(player_vstart),
    .load(player_load),
    .hstart(player_hstart),
    .rom_addr(car_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(player_gfx),
    .in_progress(player_is_drawing));

  // runs once per frame
  always @(posedge vsync)
    begin
      player_x <= player_x + 1;
      player_y <= player_y + 1;
    end

  assign out = (hsync||vsync) ? 0 : display_on ? (1+player_gfx+(player_vstart|player_hstart|player_is_drawing)) : 1;

endmodule
