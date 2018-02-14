`include "hvsync_generator.v"
`include "lfsr.v"

module top(clk, reset, hsync, vsync, rgb);

  input clk, reset;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  wire [15:0] lfsr;

  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  wire star_enable = !hpos[8] & !vpos[8];
  
  // LFSR with period = 2^16-1 = 256*256-1
  LFSR #(16,16'b1000000001011,0) lfsr_gen(
    .clk(clk),
    .reset(reset),
    .enable(star_enable),
    .lfsr(lfsr));

  wire star_on = &lfsr[15:9];
  wire r = display_on && star_on && lfsr[0];
  wire g = display_on && star_on && lfsr[1];
  wire b = display_on && star_on && lfsr[2];
  assign rgb = {b,g,r};

endmodule
