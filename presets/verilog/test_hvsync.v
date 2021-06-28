
`include "hvsync_generator.v"

/*
A simple test pattern using the hvsync_generator module.
*/

module test_hvsync_top(clk, reset, hsync, vsync, rgb);

  input clk, reset;	// clock and reset signals (input)
  output hsync, vsync;	// H/V sync signals (output)
  output [2:0] rgb;	// RGB output (BGR order)
  wire display_on;	// display_on signal
  wire [8:0] hpos;	// 9-bit horizontal position
  wire [8:0] vpos;	// 9-bit vertical position

  // Include the H-V Sync Generator module and
  // wire it to inputs, outputs, and wires.
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(0),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );

  // Assign each color bit to individual wires.
  wire r = display_on & (((hpos&7)==0) | ((vpos&7)==0));
  wire g = display_on & vpos[4];
  wire b = display_on & hpos[4];
  
  // Concatenation operator merges the red, green, and blue signals
  // into a single 3-bit vector, which is assigned to the 'rgb'
  // output. The IDE expects this value in BGR order.
  assign rgb = {b,g,r};

endmodule
