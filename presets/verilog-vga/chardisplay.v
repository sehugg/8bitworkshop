
`include "hvsync_generator.v"
`include "digits10.v"
`include "ram.v"

/*
Displays a grid of digits on the CRT using a RAM module.
*/

module test_ram1_top(clk, reset, hsync, vsync, rgb);

  input clk, reset;
  output hsync, vsync;
  output [2:0] rgb;

  wire display_on;
  wire [9:0] hpos;
  wire [9:0] vpos;
  
  wire [9:0] ram_addr;
  wire [7:0] ram_read;
  reg [7:0] ram_write;
  reg ram_writeenable = 0;
  
  // RAM to hold 32x32 array of bytes
  RAM_sync ram(
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
 
  wire [4:0] row = vpos[7:3];	// 5-bit row, vpos / 8
  wire [4:0] col = hpos[7:3];	// 5-bit column, hpos / 8
  wire [2:0] rom_yofs = vpos[2:0]; // scanline of cell
  wire [4:0] rom_bits;		   // 5 pixels per scanline
  
  wire [3:0] digit = ram_read[3:0]; // read digit from RAM
  wire [2:0] xofs = hpos[2:0];      // which pixel to draw (0-7)
  
  assign ram_addr = {row,col};	// 10-bit RAM address

  // digits ROM
  digits10_case numbers(
    .digit(digit),
    .yofs(rom_yofs),
    .bits(rom_bits)
  );

  // extract bit from ROM output
  wire r = display_on && 0;
  wire g = display_on && rom_bits[~xofs];
  wire b = display_on && 0;
  assign rgb = {b,g,r};

  // increment the current RAM cell
  always @(posedge clk)
    case (hpos[2:0])
      // on 7th pixel of cell
      6: begin
        // increment RAM cell
        ram_write <= (ram_read + 1);
        // only enable write on last scanline of cell
        ram_writeenable <= (vpos[2:0] == 7);
      end
      // on 8th pixel of cell
      7: begin
        // disable write
        ram_writeenable <= 0;
      end
    endcase
      
endmodule
