
`include "hvsync_generator.v"
`include "lfsr.v"

/*
Scrolling starfield generator using a period (2^16-1) LFSR.
*/

module starfield_top(clk, reset, out);

  input clk, reset;
  output [1:0] out;
  wire hsync, vsync;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  wire [15:0] lfsr;

  reg clk2;
  always @(posedge clk) begin
    clk2 <= !clk2;
  end

  hvsync_generator #(256,60,40,25) hvsync_gen(
    .clk(clk2),
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
    .clk(clk2),
    .reset(reset),
    .enable(star_enable),
    .lfsr(lfsr));

  wire star_on = &lfsr[15:9];

  assign out = (hsync||vsync) ? 0 : star_on ? (1+lfsr[1]+lfsr[2]) : 1;

endmodule
