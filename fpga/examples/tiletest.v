
`include "hvsync_generator.v"
`include "font_cp437_8x8.v"
`include "ram.v"
`include "tile_renderer.v"

module test_tilerender_top(clk, reset, out);

  input clk, reset;
  output [1:0] out;
  wire hsync, vsync;

  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  reg [15:0] ram_addr;
  wire [15:0] ram_read;
  reg [15:0] ram_write = 0;
  reg ram_writeenable = 0;
  
  wire [10:0] rom_addr;
  wire [7:0] rom_data;
  wire ram_busy;
  
  hvsync_generator #(256,60,40,25) hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
 
  // RAM 
  RAM_sync #(10,16) ram(
    .clk(clk),
    .dout(ram_read),
    .din(ram_write),
    .addr(ram_addr),
    .we(ram_writeenable)
  );

  wire [3:0] rgb_tile;

  tile_renderer tile_gen(
    .clk(clk),
    .reset(reset),
    .hpos(hpos),
    .vpos(vpos),
    .ram_addr(ram_addr),
    .ram_read(ram_read),
    .ram_busy(ram_busy),
    .rom_addr(rom_addr),
    .rom_data(rom_data),
    .rgb(rgb_tile)
  );
  
  assign out = (hsync||vsync) ? 0 : (1+rgb_tile[0]+rgb_tile[1]);

    // tile ROM
  font_cp437_8x8 tile_rom(
    .addr(rom_addr),
    .data(rom_data)
  );
  
endmodule
