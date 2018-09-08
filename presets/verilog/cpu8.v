
`ifndef ALU_H
`define ALU_H

// ALU operations
`define OP_ZERO		4'h0
`define OP_LOAD_A	4'h1
`define OP_INC		4'h2
`define OP_DEC		4'h3
`define OP_ASL		4'h4
`define OP_LSR		4'h5
`define OP_ROL		4'h6
`define OP_ROR		4'h7
`define OP_OR		4'h8
`define OP_AND		4'h9
`define OP_XOR		4'ha
`define OP_LOAD_B	4'hb
`define OP_ADD		4'hc
`define OP_SUB		4'hd
`define OP_ADC		4'he
`define OP_SBB		4'hf

// ALU module
module ALU(A, B, carry, aluop, Y);

  parameter N = 8;	// default width = 8 bits
  input  [N-1:0] A;	// A input
  input  [N-1:0] B;	// B input
  input  carry;		// carry input
  input  [3:0] aluop;	// alu operation
  output [N:0] Y;	// Y output + carry
  
  always @(*)
    case (aluop)
      // unary operations
      `OP_ZERO:		Y = 0;
      `OP_LOAD_A:	Y = {1'b0, A};
      `OP_INC:		Y = A + 1;
      `OP_DEC:		Y = A - 1;
      // unary operations that generate and/or use carry
      `OP_ASL:		Y = {A, 1'b0};
      `OP_LSR:		Y = {A[0], 1'b0, A[N-1:1]};
      `OP_ROL:		Y = {A, carry};
      `OP_ROR:		Y = {A[0], carry, A[N-1:1]};
      // binary operations
      `OP_OR:		Y = {1'b0, A | B};
      `OP_AND:		Y = {1'b0, A & B};
      `OP_XOR:		Y = {1'b0, A ^ B};
      `OP_LOAD_B:	Y = {1'b0, B};
      // binary operations that generate and/or use carry
      `OP_ADD:		Y = A + B;
      `OP_SUB:		Y = A - B;
      `OP_ADC:		Y = A + B + (carry?1:0);
      `OP_SBB:		Y = A - B - (carry?1:0);
    endcase
  
endmodule

/*
Bits       Description

00ddaaaa   A @ B -> dest
01ddaaaa   A @ immediate -> dest
11ddaaaa   A @ read [B] -> dest
10000001   swap A <-> B
1001nnnn   A -> write [nnnn]
1010tttt   conditional branch

  dd = destination (00=A, 01=B, 10=IP, 11=none)
aaaa = ALU operation (@ operator)
nnnn = 4-bit constant
tttt = flags test for conditional branch
*/

// destinations for COMPUTE instructions
`define DEST_A   2'b00
`define DEST_B   2'b01
`define DEST_IP  2'b10
`define DEST_NOP 2'b11
  
// instruction macros
`define I_COMPUTE(dest,op) { 2'b00, (dest), (op) }
`define I_COMPUTE_IMM(dest,op) { 2'b01, (dest), (op) }
`define I_COMPUTE_READB(dest,op) { 2'b11, (dest), (op) }
`define I_CONST_IMM_A { 2'b01, `DEST_A, `OP_LOAD_B }
`define I_CONST_IMM_B { 2'b01, `DEST_B, `OP_LOAD_B }
`define I_JUMP_IMM { 2'b01, `DEST_IP, `OP_LOAD_B }
`define I_STORE_A(addr) { 4'b1001, (addr) }
`define I_BRANCH_IF(zv,zu,cv,cu) { 4'b1010, (zv), (zu), (cv), (cu) }
`define I_CLEAR_CARRY { 8'b10001000 }
`define I_SWAP_AB { 8'b10000001 }
`define I_RESET { 8'b10111111 }
// convenience macros
`define I_ZERO_A `I_COMPUTE(`DEST_A, `OP_ZERO)
`define I_ZERO_B `I_COMPUTE(`DEST_B, `OP_ZERO)
`define I_BRANCH_IF_CARRY(carry) `I_BRANCH_IF(1'b0, 1'b0, carry, 1'b1)
`define I_BRANCH_IF_ZERO(zero) `I_BRANCH_IF(zero, 1'b1, 1'b0, 1'b0)
`define I_CLEAR_ZERO `I_COMPUTE(`DEST_NOP, `OP_ZERO)

module CPU(clk, reset, address, data_in, data_out, write);

  input        clk;
  input        reset;
  output [7:0] address;
  input  [7:0] data_in;
  output [7:0] data_out;
  output       write;
  
  reg [7:0] IP;
  reg [7:0] A, B;
  reg [8:0] Y;
  reg [2:0] state;
  
  reg carry;
  reg zero;
  wire [1:0] flags = { zero, carry };

  reg [7:0] opcode;
  wire [3:0] aluop = opcode[3:0];
  wire [1:0] opdest = opcode[5:4];
  wire B_or_data = opcode[6];

  localparam S_RESET = 0;
  localparam S_SELECT = 1;
  localparam S_DECODE = 2;
  localparam S_COMPUTE = 3;
  localparam S_READ_IP = 4;

  ALU alu(
    .A(A), 
    .B(B_or_data ? data_in : B), 
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
          IP <= 8'h80;
          write <= 0;
          state <= S_SELECT;
        end
	// state 1: select opcode address
        S_SELECT: begin
          address <= IP;
          IP <= IP + 1;
          write <= 0;
          state <= S_DECODE;
        end
        // state 2: read/decode opcode
        S_DECODE: begin
          opcode <= data_in; // (only use opcode next cycle)
          casez (data_in)
            // ALU A + B -> dest
            8'b00??????: begin
              state <= S_COMPUTE;
            end
            // ALU A + immediate -> dest
            8'b01??????: begin
	      address <= IP;
       	      IP <= IP + 1;
              state <= S_COMPUTE;
            end
            // ALU A + read [B] -> dest
            8'b11??????: begin
              address <= B;
              state <= S_COMPUTE;
            end
            // A -> write [nnnn]
            8'b1001????: begin
              address <= {4'b0, data_in[3:0]};
              data_out <= A;
              write <= 1;
              state <= S_SELECT;
            end
            // swap A,B
            8'b10000001: begin
              A <= B;
              B <= A;
              state <= S_SELECT;
            end
            // conditional branch
            8'b1010????: begin
              if (
                (data_in[0] && (data_in[1] == carry)) ||
                (data_in[2] && (data_in[3] == zero))) 
              begin
                address <= IP;
                state <= S_READ_IP;
              end else begin
                state <= S_SELECT;
              end
              IP <= IP + 1; // skip immediate
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
          case (opdest)
            `DEST_A: A <= Y[7:0];
            `DEST_B: B <= Y[7:0];
            `DEST_IP: IP <= Y[7:0];
            `DEST_NOP: ;
          endcase
          // set carry for certain operations (4-7,12-15)
          if (aluop[2]) carry <= Y[8];
          // set zero flag
          zero <= ~|Y[7:0];
          // repeat CPU loop
          state <= S_SELECT;
        end
        // state 4: read new IP from memory (immediate mode)
        S_READ_IP: begin
          IP <= data_in;
          state <= S_SELECT;
        end
      endcase
    end

endmodule

`ifdef TOPMOD__test_CPU_top

module test_CPU_top(
  input  clk,
  input  reset,
  output [7:0] address_bus,
  output reg [7:0] to_cpu,
  output [7:0] from_cpu,
  output write_enable,
  output [7:0] IP,
  output [7:0] A,
  output [7:0] B,
  output zero,
  output carry
);

  reg [7:0] ram[0:127];
  reg [7:0] rom[0:127];
  
  assign IP = cpu.IP;
  assign A = cpu.A;
  assign B = cpu.B;
  assign zero = cpu.zero;
  assign carry = cpu.carry;
  
  CPU cpu(.clk(clk),
          .reset(reset),
          .address(address_bus),
          .data_in(to_cpu),
          .data_out(from_cpu),
          .write(write_enable));

  always @(posedge clk)
    if (write_enable) begin
      ram[address_bus[6:0]] <= from_cpu;
    end
  
  always @(*)
    if (address_bus[7] == 0)
      to_cpu = ram[address_bus[6:0]];
    else
      to_cpu = rom[address_bus[6:0]];
  
  initial begin
`ifdef EXT_INLINE_ASM
    // example code: Fibonacci sequence
    rom = '{
      __asm
      
.arch femto8
.org 128
.len 128
      
Start:
      zero A	; A <= 0
      ldb #1	; B <= 1
Loop:
      add A,B	; A <= A + B
      swapab	; swap A,B
      bcc Loop	; repeat until carry set
      reset	; end of loop; reset CPU

      __endasm
    };
`endif
  end

endmodule

`endif

`endif
