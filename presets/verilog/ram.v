`ifndef RAM_H
`define RAM_H

`include "hvsync_generator.v"

module RAM_sync(clk, addr, din, dout, we);
  
  parameter A = 10; // # of address bits
  parameter D = 8;  // # of data bits
  
  input  clk;		// clock
  input  [A-1:0] addr;	// 10-bit address
  input  [D-1:0] din;	// 8-bit data input
  output [D-1:0] dout;	// 8-bit data output
  input  we;		// write enable
  
  reg [D-1:0] mem [0:(1<<A)-1]; // 1024x8 bit memory
  
  always @(posedge clk) begin
    if (we)		// if write enabled
      mem[addr] <= din;	// write memory from din
    dout <= mem[addr];	// read memory to dout (sync)
  end

endmodule

module RAM_async(clk, addr, din, dout, we);
  
  parameter A = 10; // # of address bits
  parameter D = 8;  // # of data bits
  
  input  clk;		// clock
  input  [A-1:0] addr;	// 10-bit address
  input  [D-1:0] din;	// 8-bit data input
  output [D-1:0] dout;	// 8-bit data output
  input  we;		// write enable
  
  reg [D-1:0] mem [0:(1<<A)-1]; // 1024x8 bit memory
  
  always @(posedge clk) begin
    if (we)		// if write enabled
      mem[addr] <= din;	// write memory from din
  end

  assign dout = mem[addr]; // read memory to dout (async)

endmodule

`endif
