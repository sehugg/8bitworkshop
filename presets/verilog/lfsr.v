`ifndef LFSR_V
`define LFSR_V

module LFSR(clk,reset,enable,lfsr);
  
  parameter NBITS  = 8;
  parameter TAPS   = 8'b11101;
  parameter INVERT = 0;
  
  input clk, reset;
  input enable;
  output reg [NBITS-1:0] lfsr;

  wire feedback = lfsr[NBITS-1] ^ INVERT;

  always @(posedge clk)
  begin
    if (reset)
      lfsr <= {lfsr[NBITS-2:0], ~lfsr[0]};
    else if (enable)
      lfsr <= {lfsr[NBITS-2:0], 1'b0} ^ (feedback ? TAPS : 0);
  end

endmodule

`endif
