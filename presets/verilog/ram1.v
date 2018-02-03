`include "hvsync_generator.v"
`include "digits10.v"

module RAM_1KB(clk, addr, din, dout, we);
  input  clk;		// clock
  input  [9:0] addr;	// 10-bit address
  input  [7:0] din;	// 8-bit data input
  output [7:0] dout;	// 8-bit data output
  input  we;		// write enable
  
  reg [7:0] mem [1024]; // 1024x8 bit memory
  
  always @(posedge clk) begin
    if (we)		// if write enabled
      mem[addr] <= din;	// write memory from din
    dout <= mem[addr];	// read memory to dout
  end
endmodule

module test_framebuf_top(
  input clk, reset,
  output hsync, vsync,
  output [2:0] rgb
);
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  wire [9:0] ram_addr;
  wire [7:0] ram_read;
  reg [7:0] ram_write;
  reg ram_writeenable = 0;
  
  RAM_1KB ram(
    .clk(clk),
    .dout(ram_read),
    .din(ram_write),
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
  wire [2:0] xofs = hpos[2:0];
  wire [4:0] bits;
  
  assign ram_addr = {row,col};
  
  digits10_case numbers(
    .digit(digit),
    .yofs(yofs),
    .bits(bits)
  );

  wire r = display_on && 0;
  wire g = display_on && bits[~xofs];
  wire b = display_on && 0;
  assign rgb = {b,g,r};

  always @(posedge clk)
    if (display_on && vpos[2:0] == 7)
      case (hpos[2:0])
        6: begin
          ram_write <= (ram_read + 1);
          ram_writeenable <= 1;
        end
        7: ram_writeenable <= 0;
      endcase
      
endmodule
