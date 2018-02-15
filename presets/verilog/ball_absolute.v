`include "hvsync_generator.v"

module ball_absolute_top(clk, reset, hsync, vsync, rgb);

  input clk;
  input reset;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  reg [8:0] ball_hpos;
  reg [8:0] ball_vpos;
  
  reg [8:0] ball_horiz_initial = 128;
  reg [8:0] ball_horiz_move = -2;
  reg [8:0] ball_vert_initial = 128;
  reg [8:0] ball_vert_move = 2;
  
  localparam BALL_SIZE = 8;
  
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
      ball_hpos <= ball_horiz_initial;
      ball_vpos <= ball_vert_initial;
    end else begin
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
  
  wire [8:0] ball_hdiff = ball_hpos - hpos;
  wire [8:0] ball_vdiff = ball_vpos - vpos;

  wire ball_hgfx = ball_hdiff < BALL_SIZE;
  wire ball_vgfx = ball_vdiff < BALL_SIZE;
  wire ball_gfx = ball_hgfx && ball_vgfx;

  // collide with vertical and horizontal boundaries
  wire ball_vert_collide = ball_vgfx && (vpos==V_DISPLAY || vpos==0);
  wire ball_horiz_collide = ball_hgfx && vpos==0 && (hpos==H_DISPLAY || hpos==0);
  
  wire grid_gfx = (((hpos&7)==0) && ((vpos&7)==0));

  wire r = display_on && (ball_hgfx | ball_gfx);
  wire g = display_on && (grid_gfx | ball_gfx);
  wire b = display_on && (ball_vgfx | ball_gfx);
  assign rgb = {b,g,r};

endmodule
