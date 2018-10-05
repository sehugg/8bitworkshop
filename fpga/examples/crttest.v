
`include "hvsync_generator.v"

/*
A simple test pattern using the hvsync_generator module.

12000000/15734/2
381.33977373840091521545
381-256-23-7 = 95
*/

module test_hvsync_top(clk, reset, out, led);

  input clk, reset;
  output [1:0] out;
  wire hsync;
  wire vsync;
  wire [8:0] hpos;
  wire [8:0] vpos;
  reg [5:0] frame;
  output led;

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

  wire r = display_on && (((hpos&7)==0) || (((vpos+frame)&7)==0));
  wire g = display_on && vpos[4];
  wire b = display_on && hpos[4];
  
  assign out = (hsync||vsync) ? 0 : (1+g+(r|b));
  
  always @(posedge vsync) begin
    frame <= frame + 1;
  end
  
  assign led = frame[5];

endmodule

// TODO: PWM grey scales
