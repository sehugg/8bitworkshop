`include "hvsync_generator.v"

module ball_paddle_top(clk, reset, hsync, vsync, rgb);

  input clk;
  input reset;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  reg [7:0] ball_htimer;
  reg [7:0] ball_vtimer;
  
  reg [3:0] ball_horiz_vel;
  reg [3:0] ball_vert_vel;
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  always @(posedge clk)
  begin
    if (hpos == 0 && vpos == 0)
      ball_htimer <= ball_htimer + 8'(ball_horiz_vel) - 4;
    else if (display_on)
      ball_htimer <= ball_htimer + 1;
  end;

  always @(posedge hsync)
  begin
    if (vpos > 9'(ball_vert_vel))
      ball_vtimer <= ball_vtimer + 1;
  end;

  wire ball_hgfx = ball_htimer < 8;
  wire ball_vgfx = ball_vtimer < 8;
  wire ball_gfx = ball_hgfx & ball_vgfx;
  
  wire grid_gfx = (((hpos&7)==0) || ((vpos&7)==0));

  wire r = display_on && (grid_gfx | ball_gfx);
  wire g = display_on && ball_gfx;
  wire b = display_on && ball_gfx;
  assign rgb = {b,g,r};

endmodule
