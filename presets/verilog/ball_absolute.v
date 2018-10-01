
`include "hvsync_generator.v"

/*
A bouncing ball using absolute coordinates.
*/

module ball_absolute_top(clk, reset, hsync, vsync, rgb);

  input clk;
  input reset;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  reg [8:0] ball_hpos;	// ball current X position
  reg [8:0] ball_vpos;	// ball current Y position
  
  reg [8:0] ball_horiz_move = -2;	// ball current X velocity
  reg [8:0] ball_vert_move = 2;		// ball current Y velocity
  
  localparam ball_horiz_initial = 128;	// ball initial X position
  localparam ball_vert_initial = 128;	// ball initial Y position
  
  localparam BALL_SIZE = 4;		// ball size (in pixels)

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
  always @(posedge vsync or posedge reset)
  begin
    if (reset) begin
      // reset ball position to center
      ball_hpos <= ball_horiz_initial;
      ball_vpos <= ball_vert_initial;
    end else begin
      // add velocity vector to ball position
      ball_hpos <= ball_hpos + ball_horiz_move;
      ball_vpos <= ball_vpos + ball_vert_move;
    end
  end

  // vertical bounce
  always @(posedge ball_vert_collide)
  begin
    ball_vert_move <= -ball_vert_move;
  end

  // horizontal bounce
  always @(posedge ball_horiz_collide)
  begin
    ball_horiz_move <= -ball_horiz_move;
  end
  
  // offset of ball position from video beam
  wire [8:0] ball_hdiff = hpos - ball_hpos;
  wire [8:0] ball_vdiff = vpos - ball_vpos;

  // ball graphics output
  wire ball_hgfx = ball_hdiff < BALL_SIZE;
  wire ball_vgfx = ball_vdiff < BALL_SIZE;
  wire ball_gfx = ball_hgfx && ball_vgfx;

  // collide with vertical and horizontal boundaries
  // these are set when the ball touches a border
  wire ball_vert_collide = ball_vpos >= 240 - BALL_SIZE;
  wire ball_horiz_collide = ball_hpos >= 256 - BALL_SIZE;

  // combine signals to RGB output
  wire grid_gfx = (((hpos&7)==0) && ((vpos&7)==0));
  wire r = display_on && (ball_hgfx | ball_gfx);
  wire g = display_on && (grid_gfx | ball_gfx);
  wire b = display_on && (ball_vgfx | ball_gfx);
  assign rgb = {b,g,r};

endmodule
