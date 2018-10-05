
`include "hvsync_generator.v"
`include "digits10.v"
`include "ram.v"
`include "lfsr.v"

module test_ram2_top(
  input clk, reset,
  output [1:0] out
);
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  reg ram_writeenable = 0;
  wire [9:0] ram_addr = {row,col};
  reg [7:0] ram_write;
  reg [7:0] ram_read;
  reg [7:0] ram_write;
  reg [7:0] rand;
  
  reg clk2;
  
  always @(posedge clk) begin
    clk2 <= !clk2;
  end
    
  RAM_sync ram(
    .clk(clk2),
    .din(ram_write),
    .dout(ram_read),
    .addr(ram_addr),
    .we(ram_writeenable)
  );
  
  LFSR lfsr(
    .clk(clk2),
    .reset(reset),
    .enable(!reset),
    .lfsr(rand)
  );

  hvsync_generator #(256,60,40,25) hvsync_gen(
    .clk(clk2),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  wire [4:0] row = vpos[7:3];
  wire [4:0] col = hpos[7:3];
  wire [3:0] digit = ram_read[3:0];
  wire [2:0] xofs = hpos[2:0];
  wire [2:0] yofs = vpos[2:0];
  wire [7:0] bits; // TODO?
  
  digits10_case numbers(
    .digit(digit),
    .yofs(yofs),
    .bits(bits)
  );

  wire g = display_on && bits[xofs ^ 3'b111];

  assign out = (hsync||vsync) ? 0 : (1+g+g);

  always @(posedge clk2)
    if (display_on && vpos[2:0] == 7 && rand[0])
      case (hpos[2:0])
        6: begin
          ram_write <= ram_read + 1;
          ram_writeenable <= 1;
        end
        7: ram_writeenable <= 0;
      endcase
      
endmodule
