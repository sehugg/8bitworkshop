/* for Silice: https://github.com/sylefeb/Silice */

`define VERILATOR         1
`define COLOR_DEPTH       8

/*verilator lint_off pinmissing */
/*verilator lint_off undriven */
/*verilator lint_off width */

$$VERILATOR   = 1
$$NUM_LEDS    = 0
$$SIMULATION  = 1
$$color_depth = 8
$$color_max   = 255

`timescale 1ns / 1ps
`default_nettype none

module top(
`ifdef NTSC
  // NTSC
  output reg [31:0] rgb,
  output hsync,
  output vsync,
`endif
  input clk,
  input reset
  );

wire [7:0]  __main_video_r;
wire [7:0]  __main_video_g;
wire [7:0]  __main_video_b;
wire        __main_video_hs;
wire        __main_video_vs;

// main

wire   run_main;
assign run_main = 1'b1;
wire done_main;

M_main __main(
  .clock(clk),
  .reset(reset),
`ifdef NTSC
  .out_video_r(__main_video_r),
  .out_video_g(__main_video_g),
  .out_video_b(__main_video_b),
  .out_video_hs(__main_video_hs),
  .out_video_vs(__main_video_vs),
`endif  
  .in_run(run_main),
  .out_done(done_main)
);

assign rgb     = {8'hff, __main_video_b, __main_video_g, __main_video_r};
assign hsync    = __main_video_hs;
assign vsync    = __main_video_vs;

endmodule
