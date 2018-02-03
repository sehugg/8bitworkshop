`ifndef HVSYNC_GENERATOR_H
`define HVSYNC_GENERATOR_H

// constant declarations for TV-simulator sync parameters
localparam H_DISPLAY       = 256; // horizontal display width
localparam H_BACK          =  23; // horizontal left border (back porch)
localparam H_FRONT         =   7; // horizontal right border (front porch)
localparam H_SYNC          =  23; // horizontal sync width
localparam H_SYNC_START    = H_DISPLAY + H_FRONT;
localparam H_SYNC_END      = H_DISPLAY + H_FRONT + H_SYNC - 1;
localparam H_MAX           = H_DISPLAY + H_BACK + H_FRONT + H_SYNC - 1;

localparam V_DISPLAY       = 240; // vertical display height
localparam V_TOP           =   5; // vertical top border
localparam V_BOTTOM        =  14; // vertical bottom border
localparam V_SYNC          =   3; // vertical sync # lines
localparam V_SYNC_START    = V_DISPLAY + V_BOTTOM;
localparam V_SYNC_END      = V_DISPLAY + V_BOTTOM + V_SYNC - 1;
localparam V_MAX           = V_DISPLAY + V_TOP + V_BOTTOM + V_SYNC - 1;

module hvsync_generator(
  input clk,
  input reset,
  output hsync, vsync,
  output display_on,
  output [8:0] hpos,
  output [8:0] vpos
);

  wire hmaxxed = (hpos == H_MAX) || reset;
  wire vmaxxed = (vpos == V_MAX) || reset;
  
  // increment horizontal position counter
  always @(posedge clk)
  begin
    if(hmaxxed)
      hpos <= 0;
    else
      hpos <= hpos + 1;
  end

  // increment vertical position counter
  always @(posedge clk)
  begin
    if(hmaxxed)
      if (!vmaxxed)
        vpos <= vpos + 1;
      else
        vpos <= 0;
  end
  
  // compute hsync + vsync + display_on signals
  always @(posedge clk)
  begin
    hsync <= (hpos>=H_SYNC_START && hpos<=H_SYNC_END);
    vsync <= (vpos>=V_SYNC_START && vpos<=V_SYNC_END);
    display_on <= (hpos<H_DISPLAY) && (vpos<V_DISPLAY);
  end

endmodule

`endif
