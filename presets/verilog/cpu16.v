`ifndef CPU16_H
`define CPU16_H

`include "cpu8.v"

/*
00000aaa 0++++bbb	operation A+B->A
00001aaa 0++++bbb	operation A+[B]->A
00011aaa 0++++000	operation A+imm16 -> A
00101aaa ########	load zero page
00110aaa ########	store zero page
01001aaa #####bbb	load [B+#] -> A
01010aaa #####bbb	store A -> [B+#]
01101aaa 0++++000	operation A+[imm16] -> A
01110aaa 00cccbbb	store A -> [B+#], C -> IP
1000tttt ########	conditional branch
11+++aaa ########	immediate binary operation
*/

module CPU16(clk, reset, halt, busy,
             address, data_in, data_out, write);

  input         clk;
  input         reset;
  input		halt;
  output	busy;
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
  wire Bconst = opcode[15]; // TODO
  wire Bload  = opcode[11]; // TODO

  localparam S_RESET   = 0;
  localparam S_SELECT  = 1;
  localparam S_DECODE  = 2;
  localparam S_COMPUTE = 3;
  
  localparam SP = 6; // stack ptr = register 6
  localparam IP = 7; // IP = register 7
  
  ALU #(16) alu(
    .A(regs[rdest]),
    .B(Bconst ? {8'b0, opcode[7:0]} 
      : Bload ? data_in 
              : regs[rsrc]),
    .Y(Y),
    .aluop(aluop),
    .carry(carry));

  always @(posedge clk)
    if (reset) begin
      state <= S_RESET;
      busy <= 1;
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
          write <= 0;
          if (halt) begin
            busy <= 1;
            state <= S_SELECT;
          end else begin
            busy <= 0;
            address <= regs[IP];
            regs[IP] <= regs[IP] + 1;
            state <= S_DECODE;
          end
        end
        // state 2: read/decode opcode
        S_DECODE: begin
          opcode <= data_in; // (only use opcode next cycle)
          casez (data_in)
            //  00000aaa0++++bbb	operation A+B->A
            16'b00000???0???????: begin
              aluop <= data_in[6:3];
              state <= S_COMPUTE;
            end
            //  00001aaa01+++bbb	operation A+[B]->A
            16'b00001???01??????: begin
              address <= regs[data_in[2:0]];
              aluop <= data_in[6:3];
              state <= S_COMPUTE;
              if (data_in[2:0] == SP)
                regs[SP] <= regs[SP] + 1;
            end
            //  00011aaa0++++000	operation A+imm16 -> A
            16'b00011???0????000: begin
              address <= regs[IP];
              regs[IP] <= regs[IP] + 1;
              aluop <= data_in[6:3];
              state <= S_COMPUTE;
            end
            //  11+++aaa########	immediate binary operation
            16'b11??????????????: begin
              aluop <= data_in[14:11];
              state <= S_COMPUTE;
            end
	    //  00101aaa########	load ZP memory
            16'b00101???????????: begin
              address <= {8'b0, data_in[7:0]};
              aluop <= `OP_LOAD_B;
              state <= S_COMPUTE;
            end
	    //  00110aaa########	store ZP memory
            16'b00110???????????: begin
              address <= {8'b0, data_in[7:0]};
              data_out <= regs[data_in[10:8]];
              write <= 1;
              state <= S_SELECT;
            end
            //  01001aaa#####bbb	[B+#] -> A
            16'b01001???????????: begin
              address <= regs[data_in[2:0]] + 16'($signed(data_in[7:3]));
              aluop <= `OP_LOAD_B;
              state <= S_COMPUTE;
              if (data_in[2:0] == SP)
                regs[SP] <= regs[SP] + 1;
            end
            //  01010aaa#####bbb	store A -> [B+#]
            16'b01010???????????: begin
              address <= regs[data_in[2:0]] + 16'($signed(data_in[7:3]));
              data_out <= regs[data_in[10:8]];
              write <= 1;
              state <= S_SELECT;
              if (data_in[2:0] == SP)
                regs[SP] <= regs[SP] - 1;
            end
            //  01011aaa0++++000	operation A+[imm16] -> A
            16'b01011????????000: begin
              address <= regs[IP];
              regs[IP] <= regs[IP] + 1;
              aluop <= data_in[6:3];
              state <= S_COMPUTE;
            end
            //  01110aaa00cccbbb	store A -> [B+#], C -> IP
            16'b01110???00??????: begin
              address <= regs[data_in[2:0]] + 16'($signed(data_in[7:3]));
              data_out <= regs[data_in[10:8]];
              write <= 1;
              state <= S_SELECT;
              if (data_in[2:0] == SP)
                regs[SP] <= regs[SP] - 1;
              regs[IP] <= regs[data_in[5:3]];
            end
            //  1000????########	conditional branch
            16'b1000????????????: begin
              if (
                (data_in[8] && (data_in[11] == carry)) ||
                (data_in[9] && (data_in[11] == zero)) ||
                (data_in[10] && (data_in[11] == neg))) 
              begin
                // relative branch, sign extended
                regs[IP] <= regs[IP] + 16'($signed(data_in[7:0]));
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
  output carry,
  output busy
);

  reg [15:0] ram[0:65535];
  reg [15:0] rom[0:255];
  
  assign IP = cpu.regs[7];
  assign zero = cpu.zero;
  assign carry = cpu.carry;
  
  CPU16 cpu(
          .clk(clk),
          .reset(reset),
          .halt(0),
          .busy(busy),
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
      to_cpu = rom[address_bus[7:0]];
  
`ifdef EXT_INLINE_ASM
  initial begin
    rom = '{
      __asm
.arch femto16
.org 0x8000
.len 256
      mov dx,@Fib
      jsr dx
      reset
Fib:
      mov	ax,#1
      mov	bx,#0
      mov	sp,@$6fff
Loop:
      mov	cx,ax
      add	ax,bx
      mov	bx,cx
      push ax
      pop ax
      mov	[42],ax
      mov	ax,[42]
      bcc	Loop
      rts
      __endasm
    };
  end
`endif

endmodule

`endif
