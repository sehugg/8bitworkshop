`ifndef CPU16_H
`define CPU16_H

`include "cpu8.v"

/*
00000aaa 0++++bbb	operation A+B->A
00001ttt ########	conditional branch
00100aaa ########	load constant
00101aaa ########	load memory
00110aaa ########	store memory
01000aaa #####bbb	load [B+#] -> A
01010aaa #####bbb	store A -> [B+#]
10+++aaa 10+++aaa	dual unary operation
11+++aaa ########	immediate binary operation
*/

module CPU16(clk, reset, address, data_in, data_out, write);

  input         clk;
  input         reset;
  output [15:0] address;
  input  [15:0] data_in;
  output [15:0] data_out;
  output        write;
  
  reg [15:0] regs[0:7];
  reg [2:0] state;
  
  reg carry;
  reg zero;
  reg neg;
  wire [2:0] flags = { neg, zero, carry };

  reg [15:0] opcode;
  wire [16:0] Y;
  reg [3:0] aluop;
  wire [2:0] rdest = opcode[10:8];
  wire [2:0] rsrc = opcode[2:0];
  wire Bload = opcode[11]; // TODO

  localparam S_RESET   = 0;
  localparam S_SELECT  = 1;
  localparam S_DECODE  = 2;
  localparam S_COMPUTE = 3;
  
  localparam IP = 7; // IP = register 7
  
  ALU #(16) alu(
    .A(regs[rdest]),
    .B(regs[rsrc]),
    .Y(Y),
    .aluop(aluop),
    .carry(carry));

  always @(posedge clk)
    if (reset) begin
      state <= 0;
      write <= 0;
    end else begin
      case (state)
        // state 0: reset
        S_RESET: begin
          regs[IP] <= 16'h8000;
          write <= 0;
          state <= S_SELECT;
        end
	// state 1: select opcode address
        S_SELECT: begin
          address <= regs[IP];
          regs[IP] <= regs[IP] + 1;
          write <= 0;
          state <= S_DECODE;
        end
        // state 2: read/decode opcode
        S_DECODE: begin
          opcode <= data_in; // (only use opcode next cycle)
          casez (data_in)
            // 00000aaa 0++++bbb	operation A+B->A
            16'b00000???0???????: begin
              aluop <= data_in[6:3];
              state <= S_COMPUTE;
            end
            // 00100aaa ########	load constant
            16'b00100???????????: begin
              regs[rdest] <= {8'b0, data_in[7:0]};
              state <= S_SELECT;
            end
	    // 00101aaa ########	load memory
            16'b00101???????????: begin
              address <= {8'b0, data_in[7:0]};
              aluop <= `OP_LOAD_B;
              state <= S_COMPUTE;
            end
	    // 00110aaa ########	store memory
            16'b00110???????????: begin
              address <= {8'b0, data_in[7:0]};
              data_out <= regs[data_in[10:8]];
              write <= 1;
              state <= S_SELECT;
            end
            // 00001ttt ########	conditional branch
            16'b00001???????????: begin
              if (
                (data_in[8] && (data_in[10] == carry)) ||
                (data_in[9] && (data_in[10] == zero))) 
              begin
                // relative branch, sign extended
                regs[IP] <= regs[IP] + { {8{data_in[7]}}, data_in[7:0]};
              end
              state <= S_SELECT;
            end
            // fall-through RESET
            default: begin
              state <= S_RESET; // reset
            end
          endcase
        end
        // state 3: compute ALU op and flags
        S_COMPUTE: begin
          // transfer ALU output to destination
          regs[rdest] <= Y[15:0];
          // set carry for certain operations (4-7,12-15)
          if (aluop[2]) carry <= Y[16];
          // set zero flag
          zero <= ~|Y[15:0];
          neg <= Y[15];
          // repeat CPU loop
          state <= S_SELECT;
        end
      endcase
    end

endmodule

module test_CPU16_top(
  input  clk,
  input  reset,
  output [15:0] address_bus,
  output reg [15:0] to_cpu,
  output [15:0] from_cpu,
  output write_enable,
  output [15:0] IP,
  output zero,
  output carry
);

  reg [15:0] ram[0:65535];
  reg [15:0] rom[0:65535];
  
  assign IP = cpu.regs[7];
  assign zero = cpu.zero;
  assign carry = cpu.carry;
  
  CPU16 cpu(.clk(clk),
          .reset(reset),
          .address(address_bus),
          .data_in(to_cpu),
          .data_out(from_cpu),
          .write(write_enable));

  always @(posedge clk)
    if (write_enable) begin
      ram[address_bus] <= from_cpu;
    end
  
  always @(*)
    if (address_bus[15] == 0)
      to_cpu = ram[address_bus];
    else
      to_cpu = rom[address_bus];
  
endmodule

`endif
