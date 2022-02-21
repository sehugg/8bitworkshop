
module gates(clk, out_not, out_and, out_or, out_xor, in);
  
  input  clk;
  output out_not, out_and, out_or, out_xor;
  output reg [3:0] in;
  
  not U1(out_not,in[0]);
  and U2(out_and,in[0],in[1],in[2],in[3]);
  or  U3(out_or,in[0],in[1],in[2],in[3]);
  xor U4(out_xor,in[0],in[1],in[2]);
  
  always @(posedge clk) begin
    in <= in + 1;
  end
  
endmodule

