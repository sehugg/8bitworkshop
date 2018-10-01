
`include "hvsync_generator.v"

/*
A bouncing ball using the "slipping counter" method, as
used in Pong, Computer Space, and other early arcade games.
*/

module ball_slip_counter_top(clk, reset, hsync, vsync, rgb);

  input clk;
  input reset;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  // 9-bit ball timers
  reg [8:0] ball_htimer;
  reg [8:0] ball_vtimer;
  
  // 4-bit motion codes
  reg [3:0] ball_horiz_move;
  reg [3:0] ball_vert_move;

  // 4-bit stop codes
  localparam ball_horiz_stop = 4'd11;
  localparam ball_vert_stop = 4'd10;

  // 5-bit constants to load into counters
  localparam ball_horiz_prefix = 5'b01100; // 192
  localparam ball_vert_prefix = 5'b01111; // 240

  // reset ball; will be unset when video beam reaches center position
  reg ball_reset;
  
  // video sync generator
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
  always @(posedge clk or posedge ball_reset)
  begin
    if (ball_reset || &ball_htimer) begin
      if (ball_reset || &ball_vtimer) // nudge ball in horiz. dir
        ball_htimer <= {ball_horiz_prefix, ball_horiz_move};
      else // reset timer but don't move ball horizontally
        ball_htimer <= {ball_horiz_prefix, ball_horiz_stop};
    end else
      ball_htimer <= ball_htimer + 1;
  end

  // update vertical timer
  always @(posedge hsync or posedge ball_reset)
  begin
    if (ball_reset || &ball_vtimer) // reset timer
      ball_vtimer <= {ball_vert_prefix, ball_vert_move};
    else
      ball_vtimer <= ball_vtimer + 1;
  end

  // reset ball position
  always @(posedge clk or posedge reset)
    begin
      if (reset)
        ball_reset <= 1;
      else if (hpos == 128 && vpos == 128)
        ball_reset <= 0;	// un-reset when beam reaches center position
    end
  
  // collide with vertical and horizontal boundaries?
  wire ball_vert_collide = ball_vgfx && vpos >= 240;
  wire ball_horiz_collide = ball_hgfx && hpos >= 256 && vpos == 255;
  
  // vertical bounce
  always @(posedge ball_vert_collide or posedge reset)
  begin
    if (reset)
      ball_vert_move <= 4'd9; // initial vertical velocity
    else
      ball_vert_move <= (4'd9 ^ 4'd11) ^ ball_vert_move; // change dir.
  end

  // horizontal bounce
  always @(posedge ball_horiz_collide or posedge reset)
  begin
    if (reset)
      ball_horiz_move <= 4'd10;	// initial horizontal velocity
    else
      ball_horiz_move <= (4'd10 ^ 4'd12) ^ ball_horiz_move; // change dir.
  end

  // compute ball display
  wire ball_hgfx = ball_htimer >= 508;	// 512-508 = 4 pixel ball
  wire ball_vgfx = ball_vtimer >= 508;
  wire ball_gfx = ball_hgfx && ball_vgfx;

  // compute grid display
  wire grid_gfx = (((hpos&7)==0) && ((vpos&7)==0));

  // combine into RGB signals
  wire r = display_on && (ball_hgfx | ball_gfx);
  wire g = display_on && (grid_gfx | ball_gfx);
  wire b = display_on && (ball_vgfx | ball_gfx);
  assign rgb = {b,g,r};

endmodule
