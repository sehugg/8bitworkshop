`include "hvsync_generator.v"
`include "sprite_bitmap.v"
`include "sprite_renderer.v"

module sprite_multiple_top(clk, hsync, vsync, rgb, hpaddle, vpaddle);

  input clk;
  input hpaddle, vpaddle;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;

  reg [7:0] player_x;
  reg [7:0] player_y;  
  reg [7:0] paddle_x;
  reg [7:0] paddle_y;
  reg [7:0] enemy_x = 128;
  reg [7:0] enemy_y = 128;
  reg enemy_dir = 0;
  
  reg [15:0] track_pos = 0;
  reg [7:0] speed = 31;
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(0),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  wire [3:0] car_sprite_yofs;
  wire [7:0] car_sprite_bits;
  
  car_bitmap car(
    .yofs(car_sprite_yofs), 
    .bits(car_sprite_bits));
  
  wire player_vstart = {1'd0,player_y} == vpos;
  wire player_hstart = {1'd0,player_x} == hpos;
  wire player_gfx;
  wire player_is_drawing;

  wire enemy_vstart = {1'd0,enemy_y} == vpos;
  wire enemy_hstart = {1'd0,enemy_x} == hpos;
  wire enemy_gfx;
  wire enemy_is_drawing;
  
  sprite_renderer player_renderer(
    .clk(clk),
    .vstart(player_vstart),
    .load(hpos == 256),
    .hstart(player_hstart),
    .rom_addr(car_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(player_gfx),
    .in_progress(player_is_drawing));

  sprite_renderer enemy_renderer(
    .clk(clk),
    .vstart(enemy_vstart),
    .load(hpos == 257),
    .hstart(enemy_hstart),
    .rom_addr(car_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(enemy_gfx),
    .in_progress(player_is_drawing));
  
  always @(posedge hsync)
    begin
      if (!hpaddle) paddle_x <= vpos[7:0];
      if (!vpaddle) paddle_y <= vpos[7:0];
    end
  
  wire enemy_hit_left = (enemy_x == 64);
  wire enemy_hit_right = (enemy_x == 192);
  wire enemy_hit_edge = enemy_hit_left || enemy_hit_right;
  
  always @(posedge vsync)
    begin
      player_x <= paddle_x;
      player_y <= 180;
      track_pos <= track_pos + {11'b0,speed[7:4]};
      enemy_y <= enemy_y + {3'b0, speed[7:4]};
      if (enemy_hit_edge)
        enemy_dir <= !enemy_dir;
      if (enemy_dir ^ enemy_hit_edge)
        enemy_x <= enemy_x + 1;
      else
        enemy_x <= enemy_x - 1;
      // collision check?
      if (frame_collision)
        speed <= 16;
      else if (speed < ~paddle_y)
        speed <= speed + 1;
      else
        speed <= speed - 1;
    end
  
  reg frame_collision;
  
  always @(posedge clk)
    if (player_gfx && (enemy_gfx || track_gfx))
      frame_collision <= 1;
    else if (vsync)
      frame_collision <= 0;
  
  wire track_offside = (hpos[7:5]==0) || (hpos[7:5]==7);
  wire track_shoulder = (hpos[7:3]==3) || (hpos[7:3]==28);
  wire track_gfx = (vpos[5:1]!=track_pos[5:1]) && track_offside;
  
  wire r = display_on && (player_gfx || enemy_gfx || track_shoulder);
  wire g = display_on && (player_gfx || track_gfx);
  wire b = display_on && (enemy_gfx || track_shoulder);
  assign rgb = {b,g,r};

endmodule
