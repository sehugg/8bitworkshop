`define NTSC 1
/* for Silice: https://github.com/sylefeb/Silice */

`define VERILATOR         1
`define COLOR_DEPTH       8

/*verilator lint_off pinmissing */
/*verilator lint_off undriven */
/*verilator lint_off width */


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

module M_ntsc (
out_ntsc_hs,
out_ntsc_vs,
out_active,
out_vblank,
out_ntsc_x,
out_ntsc_y,
in_run,
out_done,
reset,
out_clock,
clock
);
output  [0:0] out_ntsc_hs;
output  [0:0] out_ntsc_vs;
output  [0:0] out_active;
output  [0:0] out_vblank;
output  [9:0] out_ntsc_x;
output  [9:0] out_ntsc_y;
input in_run;
output out_done;
input reset;
output out_clock;
input clock;
assign out_clock = clock;
wire  [9:0] _c_H_FRT_PORCH;
assign _c_H_FRT_PORCH = 7;
wire  [9:0] _c_H_SYNCH;
assign _c_H_SYNCH = 23;
wire  [9:0] _c_H_BCK_PORCH;
assign _c_H_BCK_PORCH = 23;
wire  [9:0] _c_H_RES;
assign _c_H_RES = 256;
wire  [9:0] _c_V_FRT_PORCH;
assign _c_V_FRT_PORCH = 5;
wire  [9:0] _c_V_SYNCH;
assign _c_V_SYNCH = 3;
wire  [9:0] _c_V_BCK_PORCH;
assign _c_V_BCK_PORCH = 14;
wire  [9:0] _c_V_RES;
assign _c_V_RES = 240;
reg  [9:0] _t_HS_START;
reg  [9:0] _t_HS_END;
reg  [9:0] _t_HA_START;
reg  [9:0] _t_H_END;
reg  [9:0] _t_VS_START;
reg  [9:0] _t_VS_END;
reg  [9:0] _t_VA_START;
reg  [9:0] _t_V_END;

reg  [9:0] _d_xcount;
reg  [9:0] _q_xcount;
reg  [9:0] _d_ycount;
reg  [9:0] _q_ycount;
reg  [0:0] _d_ntsc_hs,_q_ntsc_hs;
reg  [0:0] _d_ntsc_vs,_q_ntsc_vs;
reg  [0:0] _d_active,_q_active;
reg  [0:0] _d_vblank,_q_vblank;
reg  [9:0] _d_ntsc_x,_q_ntsc_x;
reg  [9:0] _d_ntsc_y,_q_ntsc_y;
reg  [1:0] _d_index,_q_index;
assign out_ntsc_hs = _d_ntsc_hs;
assign out_ntsc_vs = _d_ntsc_vs;
assign out_active = _d_active;
assign out_vblank = _d_vblank;
assign out_ntsc_x = _d_ntsc_x;
assign out_ntsc_y = _d_ntsc_y;
assign out_done = (_q_index == 3);

always @(posedge clock) begin
  if (reset || !in_run) begin
_q_xcount <= 0;
_q_ycount <= 0;
  if (reset) begin
_q_index <= 0;
end else begin
_q_index <= 0;
end
  end else begin
_q_xcount <= _d_xcount;
_q_ycount <= _d_ycount;
_q_ntsc_hs <= _d_ntsc_hs;
_q_ntsc_vs <= _d_ntsc_vs;
_q_active <= _d_active;
_q_vblank <= _d_vblank;
_q_ntsc_x <= _d_ntsc_x;
_q_ntsc_y <= _d_ntsc_y;
_q_index <= _d_index;
  end
end




always @* begin
_d_xcount = _q_xcount;
_d_ycount = _q_ycount;
_d_ntsc_hs = _q_ntsc_hs;
_d_ntsc_vs = _q_ntsc_vs;
_d_active = _q_active;
_d_vblank = _q_vblank;
_d_ntsc_x = _q_ntsc_x;
_d_ntsc_y = _q_ntsc_y;
_d_index = _q_index;
_t_HS_START = 0;
_t_HS_END = 0;
_t_HA_START = 0;
_t_H_END = 0;
_t_VS_START = 0;
_t_VS_END = 0;
_t_VA_START = 0;
_t_V_END = 0;
// _always_pre
_t_HS_START = _c_H_FRT_PORCH;
_t_HS_END = _c_H_FRT_PORCH+_c_H_SYNCH;
_t_HA_START = _c_H_FRT_PORCH+_c_H_SYNCH+_c_H_BCK_PORCH;
_t_H_END = _c_H_FRT_PORCH+_c_H_SYNCH+_c_H_BCK_PORCH+_c_H_RES;
_t_VS_START = _c_V_FRT_PORCH;
_t_VS_END = _c_V_FRT_PORCH+_c_V_SYNCH;
_t_VA_START = _c_V_FRT_PORCH+_c_V_SYNCH+_c_V_BCK_PORCH;
_t_V_END = _c_V_FRT_PORCH+_c_V_SYNCH+_c_V_BCK_PORCH+_c_V_RES;
_d_ntsc_hs = ((_q_xcount>=_t_HS_START&&_q_xcount<_t_HS_END));
_d_ntsc_vs = ((_q_ycount>=_t_VS_START&&_q_ycount<_t_VS_END));
_d_active = (_q_xcount>=_t_HA_START&&_q_xcount<_t_H_END)&&(_q_ycount>=_t_VA_START&&_q_ycount<_t_V_END);
_d_vblank = (_q_ycount<_t_VA_START);
_d_index = 3;
(* full_case *)
case (_q_index)
0: begin
// _top
// var inits
_t_HS_START = 0;
_t_HS_END = 0;
_t_HA_START = 0;
_t_H_END = 0;
_t_VS_START = 0;
_t_VS_END = 0;
_t_VA_START = 0;
_t_V_END = 0;
_d_xcount = 0;
_d_ycount = 0;
// --
_d_xcount = 0;
_d_ycount = 0;
_d_index = 1;
end
1: begin
// __while__block_1
if (1) begin
// __block_2
// __block_4
_d_ntsc_x = (_d_active)?_q_xcount-_t_HA_START:0;
_d_ntsc_y = (_d_vblank)?0:_q_ycount-_t_VA_START;
if (_q_xcount==_t_H_END-1) begin
// __block_5
// __block_7
_d_xcount = 0;
if (_q_ycount==_t_V_END-1) begin
// __block_8
// __block_10
_d_ycount = 0;
// __block_11
end else begin
// __block_9
// __block_12
_d_ycount = _q_ycount+1;
// __block_13
end
// __block_14
// __block_15
end else begin
// __block_6
// __block_16
_d_xcount = _q_xcount+1;
// __block_17
end
// __block_18
// __block_19
_d_index = 1;
end else begin
_d_index = 2;
end
end
2: begin
// __block_3
_d_index = 3;
end
3: begin // end of ntsc
end
default: begin 
_d_index = 3;
 end
endcase
end
endmodule


module M_frame_display (
in_pix_x,
in_pix_y,
in_pix_active,
in_pix_vblank,
out_pix_r,
out_pix_g,
out_pix_b,
in_run,
out_done,
reset,
out_clock,
clock
);
input  [9:0] in_pix_x;
input  [9:0] in_pix_y;
input  [0:0] in_pix_active;
input  [0:0] in_pix_vblank;
output  [7:0] out_pix_r;
output  [7:0] out_pix_g;
output  [7:0] out_pix_b;
input in_run;
output out_done;
input reset;
output out_clock;
input clock;
assign out_clock = clock;
wire  [6:0] _c_wave[63:0];
assign _c_wave[0] = 0;
assign _c_wave[1] = 0;
assign _c_wave[2] = 1;
assign _c_wave[3] = 2;
assign _c_wave[4] = 4;
assign _c_wave[5] = 7;
assign _c_wave[6] = 11;
assign _c_wave[7] = 14;
assign _c_wave[8] = 19;
assign _c_wave[9] = 23;
assign _c_wave[10] = 29;
assign _c_wave[11] = 34;
assign _c_wave[12] = 40;
assign _c_wave[13] = 46;
assign _c_wave[14] = 52;
assign _c_wave[15] = 58;
assign _c_wave[16] = 65;
assign _c_wave[17] = 71;
assign _c_wave[18] = 77;
assign _c_wave[19] = 83;
assign _c_wave[20] = 89;
assign _c_wave[21] = 95;
assign _c_wave[22] = 100;
assign _c_wave[23] = 105;
assign _c_wave[24] = 110;
assign _c_wave[25] = 114;
assign _c_wave[26] = 117;
assign _c_wave[27] = 120;
assign _c_wave[28] = 123;
assign _c_wave[29] = 125;
assign _c_wave[30] = 126;
assign _c_wave[31] = 126;
assign _c_wave[32] = 126;
assign _c_wave[33] = 126;
assign _c_wave[34] = 125;
assign _c_wave[35] = 123;
assign _c_wave[36] = 120;
assign _c_wave[37] = 117;
assign _c_wave[38] = 114;
assign _c_wave[39] = 110;
assign _c_wave[40] = 105;
assign _c_wave[41] = 100;
assign _c_wave[42] = 95;
assign _c_wave[43] = 89;
assign _c_wave[44] = 83;
assign _c_wave[45] = 77;
assign _c_wave[46] = 71;
assign _c_wave[47] = 65;
assign _c_wave[48] = 58;
assign _c_wave[49] = 52;
assign _c_wave[50] = 46;
assign _c_wave[51] = 40;
assign _c_wave[52] = 34;
assign _c_wave[53] = 29;
assign _c_wave[54] = 23;
assign _c_wave[55] = 19;
assign _c_wave[56] = 14;
assign _c_wave[57] = 11;
assign _c_wave[58] = 7;
assign _c_wave[59] = 4;
assign _c_wave[60] = 2;
assign _c_wave[61] = 1;
assign _c_wave[62] = 0;
assign _c_wave[63] = 0;
reg  [7:0] _t_v;

reg  [5:0] _d_frame;
reg  [5:0] _q_frame;
reg signed [8:0] _d_pos[3:0];
reg signed [8:0] _q_pos[3:0];
reg  [7:0] _d_pix_r,_q_pix_r;
reg  [7:0] _d_pix_g,_q_pix_g;
reg  [7:0] _d_pix_b,_q_pix_b;
reg  [2:0] _d_index,_q_index;
assign out_pix_r = _d_pix_r;
assign out_pix_g = _d_pix_g;
assign out_pix_b = _d_pix_b;
assign out_done = (_q_index == 6);

always @(posedge clock) begin
  if (reset || !in_run) begin
_q_frame <= 0;
_q_pos[0] <= 0;
_q_pos[1] <= 0;
_q_pos[2] <= 0;
_q_pos[3] <= 0;
  if (reset) begin
_q_index <= 0;
end else begin
_q_index <= 0;
end
  end else begin
_q_frame <= _d_frame;
_q_pos[0] <= _d_pos[0];
_q_pos[1] <= _d_pos[1];
_q_pos[2] <= _d_pos[2];
_q_pos[3] <= _d_pos[3];
_q_pix_r <= _d_pix_r;
_q_pix_g <= _d_pix_g;
_q_pix_b <= _d_pix_b;
_q_index <= _d_index;
  end
end




always @* begin
_d_frame = _q_frame;
_d_pos[0] = _q_pos[0];
_d_pos[1] = _q_pos[1];
_d_pos[2] = _q_pos[2];
_d_pos[3] = _q_pos[3];
_d_pix_r = _q_pix_r;
_d_pix_g = _q_pix_g;
_d_pix_b = _q_pix_b;
_d_index = _q_index;
_t_v = 0;
// _always_pre
_d_pix_r = 0;
_d_pix_g = 0;
_d_pix_b = 0;
_d_index = 6;
(* full_case *)
case (_q_index)
0: begin
// _top
// var inits
_t_v = 0;
_d_frame = 0;
_d_pos[0] = 0;
_d_pos[1] = 0;
_d_pos[2] = 0;
_d_pos[3] = 0;
// --
_d_index = 1;
end
1: begin
// __while__block_1
if (1) begin
// __block_2
// __block_4
_d_index = 3;
end else begin
_d_index = 2;
end
end
3: begin
// __while__block_5
if (in_pix_vblank==0) begin
// __block_6
// __block_8
if (in_pix_active) begin
// __block_9
// __block_11
if (in_pix_y+20>_q_pos[0]&&in_pix_y<_q_pos[0]+20) begin
// __block_12
// __block_14
_t_v = ((_c_wave[in_pix_y-_q_pos[0]+32]>>1)*(0+5))>>3;
_d_pix_r = _t_v*4;
_d_pix_g = _t_v*3;
_d_pix_b = _t_v*2;
// __block_15
end else begin
// __block_13
end
// __block_16
if (in_pix_y+20>_q_pos[1]&&in_pix_y<_q_pos[1]+20) begin
// __block_17
// __block_19
_t_v = ((_c_wave[in_pix_y-_q_pos[1]+32]>>1)*(1+5))>>3;
_d_pix_r = _t_v*4;
_d_pix_g = _t_v*3;
_d_pix_b = _t_v*2;
// __block_20
end else begin
// __block_18
end
// __block_21
if (in_pix_y+20>_q_pos[2]&&in_pix_y<_q_pos[2]+20) begin
// __block_22
// __block_24
_t_v = ((_c_wave[in_pix_y-_q_pos[2]+32]>>1)*(2+5))>>3;
_d_pix_r = _t_v*4;
_d_pix_g = _t_v*3;
_d_pix_b = _t_v*2;
// __block_25
end else begin
// __block_23
end
// __block_26
if (in_pix_y+20>_q_pos[3]&&in_pix_y<_q_pos[3]+20) begin
// __block_27
// __block_29
_t_v = ((_c_wave[in_pix_y-_q_pos[3]+32]>>1)*(3+5))>>3;
_d_pix_r = _t_v*4;
_d_pix_g = _t_v*3;
_d_pix_b = _t_v*2;
// __block_30
end else begin
// __block_28
end
// __block_31
// __block_32
end else begin
// __block_10
end
// __block_33
// __block_34
_d_index = 3;
end else begin
_d_index = 4;
end
end
2: begin
// __block_3
_d_index = 6;
end
4: begin
// __block_7
_d_frame = _q_frame+1;
_d_pos[0] = 113+(_c_wave[(_d_frame+(0<<3))&63]<<1);
_d_pos[1] = 113+(_c_wave[(_d_frame+(1<<3))&63]<<1);
_d_pos[2] = 113+(_c_wave[(_d_frame+(2<<3))&63]<<1);
_d_pos[3] = 113+(_c_wave[(_d_frame+(3<<3))&63]<<1);
_d_index = 5;
end
5: begin
// __while__block_35
if (in_pix_vblank==1) begin
// __block_36
// __block_38
// __block_39
_d_index = 5;
end else begin
_d_index = 1;
end
end
6: begin // end of frame_display
end
default: begin 
_d_index = 6;
 end
endcase
end
endmodule


module M_main (
out_video_r,
out_video_g,
out_video_b,
out_video_hs,
out_video_vs,
in_run,
out_done,
reset,
out_clock,
clock
);
output  [7:0] out_video_r;
output  [7:0] out_video_g;
output  [7:0] out_video_b;
output  [0:0] out_video_hs;
output  [0:0] out_video_vs;
input in_run;
output out_done;
input reset;
output out_clock;
input clock;
assign out_clock = clock;
wire  [0:0] _w_ntsc_driver_ntsc_hs;
wire  [0:0] _w_ntsc_driver_ntsc_vs;
wire  [0:0] _w_ntsc_driver_active;
wire  [0:0] _w_ntsc_driver_vblank;
wire  [9:0] _w_ntsc_driver_ntsc_x;
wire  [9:0] _w_ntsc_driver_ntsc_y;
wire _w_ntsc_driver_done;
wire  [7:0] _w_display_pix_r;
wire  [7:0] _w_display_pix_g;
wire  [7:0] _w_display_pix_b;
wire _w_display_done;

reg  [7:0] _d_frame;
reg  [7:0] _q_frame;
reg  [2:0] _d_index,_q_index;
reg  _ntsc_driver_run;
reg  _display_run;
assign out_video_r = _w_display_pix_r;
assign out_video_g = _w_display_pix_g;
assign out_video_b = _w_display_pix_b;
assign out_video_hs = _w_ntsc_driver_ntsc_hs;
assign out_video_vs = _w_ntsc_driver_ntsc_vs;
assign out_done = (_q_index == 5);

always @(posedge clock) begin
  if (reset || !in_run) begin
_q_frame <= 0;
  if (reset) begin
_q_index <= 0;
end else begin
_q_index <= 0;
end
  end else begin
_q_frame <= _d_frame;
_q_index <= _d_index;
  end
end

M_ntsc ntsc_driver (
.out_ntsc_hs(_w_ntsc_driver_ntsc_hs),
.out_ntsc_vs(_w_ntsc_driver_ntsc_vs),
.out_active(_w_ntsc_driver_active),
.out_vblank(_w_ntsc_driver_vblank),
.out_ntsc_x(_w_ntsc_driver_ntsc_x),
.out_ntsc_y(_w_ntsc_driver_ntsc_y),
.out_done(_w_ntsc_driver_done),
.in_run(_ntsc_driver_run),
.reset(reset),
.clock(clock)
);
M_frame_display display (
.in_pix_x(_w_ntsc_driver_ntsc_x),
.in_pix_y(_w_ntsc_driver_ntsc_y),
.in_pix_active(_w_ntsc_driver_active),
.in_pix_vblank(_w_ntsc_driver_vblank),
.out_pix_r(_w_display_pix_r),
.out_pix_g(_w_display_pix_g),
.out_pix_b(_w_display_pix_b),
.out_done(_w_display_done),
.in_run(_display_run),
.reset(reset),
.clock(clock)
);



always @* begin
_d_frame = _q_frame;
_d_index = _q_index;
_ntsc_driver_run = 1;
_display_run = 1;
// _always_pre
_d_index = 5;
(* full_case *)
case (_q_index)
0: begin
// _top
// var inits
_d_frame = 0;
// --
_d_index = 1;
end
1: begin
// __while__block_1
if (1) begin
// __block_2
// __block_4
_d_index = 3;
end else begin
_d_index = 2;
end
end
3: begin
// __while__block_5
if (_w_ntsc_driver_vblank==0) begin
// __block_6
// __block_8
// __block_9
_d_index = 3;
end else begin
_d_index = 4;
end
end
2: begin
// __block_3
_d_index = 5;
end
4: begin
// __block_7
_d_frame = _q_frame+1;
// __block_10
_d_index = 1;
end
5: begin // end of main
end
default: begin 
_d_index = 5;
 end
endcase
end
endmodule

