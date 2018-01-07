`include "hvsync_generator.v"

module ball_paddle_top(clk, reset, hsync, vsync, rgb);

  input clk;
  input reset;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  reg [8:0] ball_htimer;
  reg [8:0] ball_vtimer;
  
  reg [8:0] ball_horiz_stop = 204;
  reg [8:0] ball_horiz_move = -2;
  reg [8:0] ball_vert_stop = 251;
  reg [8:0] ball_vert_move = 2;
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  // update horizontal timer
  always @(posedge clk or posedge reset)
  begin
    if (reset)
      ball_htimer <= ball_horiz_stop - 128;
    else if (ball_htimer == 0) begin
      if (ball_vtimer == 0)
        ball_htimer <= ball_horiz_stop + ball_horiz_move;
      else
        ball_htimer <= ball_horiz_stop;
    end else
      ball_htimer <= ball_htimer + 1;
  end;

  // update vertical timer
  always @(posedge hsync or posedge reset)
  begin
    if (reset)
      ball_vtimer <= ball_vert_stop - 128;
    else if (ball_vtimer == 0)
      ball_vtimer <= ball_vert_stop + ball_vert_move;
    else
      ball_vtimer <= ball_vtimer + 1;
  end;
  
  // vertical bounce
  always @(posedge ball_vert_collide)
  begin
    ball_vert_move <= -ball_vert_move;
  end;

  // horizontal bounce
  always @(posedge ball_horiz_collide)
  begin
    ball_horiz_move <= -ball_horiz_move;
  end;

  wire ball_hgfx = ball_htimer >= 508;
  wire ball_vgfx = ball_vtimer >= 508;
  wire ball_gfx = ball_hgfx && ball_vgfx;

  // collide with vertical and horizontal boundaries
  wire ball_vert_collide = ball_vgfx && vpos >= 240;
  wire ball_horiz_collide = ball_hgfx && hpos >= 256 && vpos == 255;
  
  wire grid_gfx = (((hpos&7)==0) && ((vpos&7)==0));

  wire r = display_on && (ball_hgfx | ball_gfx);
  wire g = display_on && (grid_gfx | ball_gfx);
  wire b = display_on && (ball_vgfx | ball_gfx);
  assign rgb = {b,g,r};

endmodule
