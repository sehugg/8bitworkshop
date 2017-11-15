
module hvsync_generator(
  clk, hsync, vsync, inDisplayArea, CounterX, CounterY);

  input clk;
  output hsync, vsync;
  output inDisplayArea;
  output [8:0] CounterX;
  output [8:0] CounterY;

  // constant declarations for VGA sync parameters
  localparam H_DISPLAY       = 256; // horizontal display area
  localparam H_L_BORDER      =  12; // horizontal left border
  localparam H_R_BORDER      =   8; // horizontal right border
  localparam H_RETRACE       =  24; // horizontal retrace
  localparam H_MAX           = H_DISPLAY + H_L_BORDER + H_R_BORDER + H_RETRACE - 1;
  localparam START_H_RETRACE = H_DISPLAY + H_R_BORDER;
  localparam END_H_RETRACE   = H_DISPLAY + H_R_BORDER + H_RETRACE - 1;

  localparam V_DISPLAY       = 240; // vertical display area
  localparam V_T_BORDER      =  4; // vertical top border
  localparam V_B_BORDER      =  16; // vertical bottom border
  localparam V_RETRACE       =   2; // vertical retrace
  localparam V_MAX           = V_DISPLAY + V_T_BORDER + V_B_BORDER + V_RETRACE - 1;
  localparam START_V_RETRACE = V_DISPLAY + V_B_BORDER;
  localparam END_V_RETRACE   = V_DISPLAY + V_B_BORDER + V_RETRACE - 1;

  reg [8:0] CounterX;
  reg [8:0] CounterY;
  wire CounterXmaxed = (CounterX==H_MAX);
  wire CounterYmaxed = (CounterY==V_MAX);

  always @(posedge clk)   
    if(CounterXmaxed)
      CounterX <= 0;
    else
      CounterX <= CounterX + 1;

  always @(posedge clk)
    if(CounterXmaxed)
      if (!CounterYmaxed)
        CounterY <= CounterY + 1;
      else
        CounterY <= 0;

  reg vga_HS, vga_VS;
  always @(posedge clk)
  begin
    vga_HS <= (CounterX>=280 && CounterX<288); // change this value to move the display horizontally
    vga_VS <= (CounterY==START_V_RETRACE); // change this value to move the display vertically
  end

  reg inDisplayArea;
  always @(posedge clk)
  begin
    inDisplayArea <= (CounterX<H_DISPLAY) && (CounterY<V_DISPLAY);
  end

  assign hsync = ~vga_HS;
  assign vsync = ~vga_VS;

endmodule
