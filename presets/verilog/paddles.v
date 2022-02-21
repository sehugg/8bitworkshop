
`include "hvsync_generator.v"

/*
Paddle demonstration.
*/

module paddles_top(clk, reset, hsync, vsync, hpaddle, vpaddle, rgb);

  input clk, reset;
  input hpaddle, vpaddle;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;

  // player position (only set at VSYNC)
  reg [7:0] player_x;
  reg [7:0] player_y;
  
  // paddle position (set continuously during frame)
  reg [7:0] paddle_x;
  reg [7:0] paddle_y;

  // read horizontal paddle
  always @(posedge hpaddle)
    paddle_x <= vpos[7:0];

  // read vertical paddle
  always @(posedge vpaddle)
    paddle_y <= vpos[7:0];

  // update player_x and player_y
  always @(posedge vsync)
    begin
      player_x <= paddle_x;
      player_y <= paddle_y;
    end

  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  // display paddle positions on screen
  
  wire h = hpos[7:0] >= paddle_x;
  wire v = vpos[7:0] >= paddle_y;

  assign rgb = {1'b0, display_on && h, display_on && v};

endmodule
