`include "hvsync_generator.v"

module test_hvsync_top(clk, hsync, vsync, rgb);

  input clk;
  output hsync, vsync;
  output [2:0] rgb;
  wire inDisplayArea;
  wire [8:0] CounterX;
  wire [8:0] CounterY;

  hvsync_generator hvsync_gen(
    .clk(clk),
    .hsync(hsync),
    .vsync(vsync),
    .inDisplayArea(inDisplayArea),
    .CounterX(CounterX),
    .CounterY(CounterY)
  );

  wire r = inDisplayArea &&
    (((CounterX&7)==0) || ((CounterY&7)==0));
  wire g = inDisplayArea && CounterY[4];
  wire b = inDisplayArea && CounterX[4];
  assign rgb = {b,g,r};

endmodule
