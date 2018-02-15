`include "hvsync_generator.v"
`include "digits10.v"

module RAM_1KB_tri(clk, addr, data, we);
  input  clk;
  input  [9:0] addr;
  inout  [7:0] data;
  input  we;
  
  reg [7:0] mem [1023:0];
  assign data = !we ? mem[addr] : 8'bz;
  always @(posedge clk) begin
    if (we)
      mem[addr] <= data;
  end
endmodule

module test_ram2_top(
  input clk, reset,
  output hsync, vsync,
  output [2:0] rgb
);
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  reg ram_writeenable = 0;
  wire [9:0] ram_addr = {row,col};
  wire [7:0] ram_data = ram_writeenable ? ram_write : 8'bz;
  wire [7:0] ram_read = ram_writeenable ? 8'bz : ram_data;
  reg [7:0] ram_write;
  
  RAM_1KB_tri ram(
    .clk(clk),
    .data(ram_data),
    .addr(ram_addr),
    .we(ram_writeenable)
  );
  
  hvsync_generator hvsync_gen(
    .clk(clk),
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
  wire [2:0] yofs = vpos[2:0];
  wire [4:0] bits;
  
  digits10_array numbers(
    .digit(digit),
    .yofs(yofs),
    .bits(bits)
  );

  wire r = display_on && 0;
  wire g = display_on && bits[hpos[2:0] ^ 3'b111];
  wire b = display_on && 0;
  assign rgb = {b,g,r};
  
  always @(posedge clk)
    if (display_on && vpos[2:0] == 7)
      case (hpos[2:0])
        6: begin
          ram_write <= ram_read + 1;
          ram_writeenable <= 1;
        end
        7: ram_writeenable <= 0;
      endcase
      
endmodule
