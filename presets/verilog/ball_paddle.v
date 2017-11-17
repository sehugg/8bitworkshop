`include "hvsync_generator.v"

module ball_paddle_top(clk, hpaddle, hsync, vsync, rgb);

  input clk;
  input hpaddle;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  reg [8:0] paddle_pos;
  
  reg [8:0] ball_x = 128;
  reg [8:0] ball_y = 128;
  reg signed [1:0] ball_vel_x = 0;
  reg ball_vel_y = BALL_VEL_DOWN;
  
  localparam BALL_VEL_DOWN = 1;
  localparam BALL_VEL_UP = 0;
  
  localparam PADDLE_WIDTH = 31;
  localparam BALL_SIZE = 8;
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );

  // TODO: only works when paddle at bottom of screen!
  always @(posedge hsync)
    if (!hpaddle)
      paddle_pos <= vpos;

  // TODO: unsigned compare doesn't work in JS
  wire [8:0] paddle_rel_x = ((hpos-paddle_pos) & 9'h1ff);
  wire paddle_gfx = paddle_rel_x < PADDLE_WIDTH;
  
  wire [8:0] ball_rel_x = (hpos-ball_x);
  wire [8:0] ball_rel_y = (vpos-ball_y);
  
  wire ball_gfx = ball_rel_x < BALL_SIZE
  	       && ball_rel_y < BALL_SIZE;
  
  wire [5:0] hcell = hpos[8:3];
  wire [5:0] vcell = vpos[8:3];
  wire lr_border = hcell==0 || hcell==31;

  wire main_gfx;
  
  always @(posedge clk)
    case (vpos[8:3])
      0: main_gfx = 1;
      28: main_gfx = paddle_gfx | lr_border;
      default: main_gfx = lr_border;
    endcase;
  
  wire ball_pixel_collide = main_gfx & ball_gfx;
  
  /* verilator lint_off MULTIDRIVEN */
  reg [4:0] ball_collide_bits = 0;
  /* verilator lint_on MULTIDRIVEN */

  always @(posedge clk)
    if (ball_pixel_collide) begin
      if (paddle_gfx) begin // did we collide w/ paddle?
        ball_collide_bits[4] <= 1;
      end else begin // collided with playfield
        if (!ball_rel_x[2] & !ball_rel_y[2]) ball_collide_bits[0] <= 1;
        if (ball_rel_x[2] & !ball_rel_y[2]) ball_collide_bits[1] <= 1;
        if (!ball_rel_x[2] & ball_rel_y[2]) ball_collide_bits[2] <= 1;
        if (ball_rel_x[2] & ball_rel_y[2]) ball_collide_bits[3] <= 1;
      end
    end
  
  always @(posedge vsync)
    begin
      if (ball_collide_bits[4]) begin // collided with paddle?
        reg signed [1:0] ball_paddle_dx = ball_x[6:5] - paddle_pos[6:5];
        ball_vel_y <= BALL_VEL_UP; // paddle top
        ball_vel_x <= ball_vel_x + ball_paddle_dx;
      end else casez (ball_collide_bits[3:0]) // collided with playfield
        0: ;
        4'b01?1: if (ball_vel_x<0) ball_vel_x <= -ball_vel_x-1; // left
        4'b101?: if (ball_vel_x>=0) ball_vel_x <= -ball_vel_x-1; // right
        4'b1100: ball_vel_y <= BALL_VEL_UP;
        4'b0011: ball_vel_y <= BALL_VEL_DOWN;
      endcase;
      ball_collide_bits <= 0;
      ball_x <= ball_x + 9'(ball_vel_x) + 9'(ball_vel_x>=0); // TODO: signed?
      ball_y <= ball_y + (ball_vel_y==BALL_VEL_DOWN?1:-1);
    end;
  
  wire grid_gfx = (((hpos&7)==0) || ((vpos&7)==0));

  wire r = display_on && (grid_gfx | ball_gfx);
  wire g = display_on && (main_gfx | ball_gfx);
  wire b = display_on && ball_gfx;
  assign rgb = {b,g,r};

endmodule
