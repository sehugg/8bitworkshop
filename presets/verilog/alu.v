
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
  output reg [N:0] Y;	// Y output + carry
  
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
