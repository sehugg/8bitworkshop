module clock_divider(
  input clk,
  output reg clk_div2,
  output reg clk_div4,
  output reg clk_div8,
  output reg clk_div16,
  output reg [3:0] counter,
  output cntr_div2,
  output cntr_div4,
  output cntr_div8,
  output cntr_div16
);

  // simple ripple clock divider
  
  always @(posedge clk)
    clk_div2 <= ~clk_div2;

  always @(posedge clk_div2)
    clk_div4 <= ~clk_div4;

  always @(posedge clk_div4)
    clk_div8 <= ~clk_div8;

  always @(posedge clk_div8)
    clk_div16 <= ~clk_div16;

  // use bits of (4-bit) counter to divide clocks
  
  always @(posedge clk)
    counter <= counter + 1;

  assign cntr_div2 = counter[0];
  assign cntr_div4 = counter[1];
  assign cntr_div8 = counter[2];
  assign cntr_div16 = counter[3];

endmodule
