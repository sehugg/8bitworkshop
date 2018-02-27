`include "hvsync_generator.v"
`include "font_cp437_8x8.v"
`include "ram.v"
`include "tile_renderer.v"
`include "sprite_scanline_renderer.v"
`include "lfsr.v"
`include "sound_generator.v"
`include "cpu8.v"
`include "cpu16.v"

module maze_game_top(clk, reset, hsync, vsync, rgb);

  input clk, reset;
  output hsync, vsync;
  output [3:0] rgb;

  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  // video RAM bus
  wire [7:0] vram_read;
  reg [7:0] vram_write = 0;
  reg vram_writeenable = 0;

  // multiplex sprite and tile RAM
  wire sprite_ram_select = (vpos == 256);
  reg [15:0] tile_ram_addr;
  reg [6:0] sprite_ram_addr;
  
  // tile and sprite ROM
  wire [10:0] tile_rom_addr;
  wire [7:0] tile_rom_data;
  wire [15:0] sprite_rom_addr;
  wire [15:0] sprite_rom_data;
  
  // gfx outputs
  wire [3:0] tile_rgb;
  wire [3:0] sprite_rgb;
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
 
  // video RAM (16k)
  RAM #(14,8) vram(
    .clk(clk),
    .dout(vram_read),
    .din(vram_write),
    .addr(sprite_ram_select 
      ? {7'b0111111, sprite_ram_addr}
      : tile_ram_addr[13:0]),
    .we(vram_writeenable)
  );
  
  tile_renderer tile_gen(
    .clk(clk),
    .reset(reset),
    .hpos(hpos),
    .vpos(vpos),
    .display_on(display_on),
    .ram_addr(tile_ram_addr),
    .ram_read(vram_read),
    .rom_addr(tile_rom_addr),
    .rom_data(tile_rom_data),
    .rgb(tile_rgb)
  );

  sprite_scanline_renderer ssr(
    .clk(clk),
    .reset(reset),
    .hpos(hpos),
    .vpos(vpos),
    .ram_addr(sprite_ram_addr),
    .ram_data(vram_read),
    .rom_addr(sprite_rom_addr),
    .rom_data(sprite_rom_data),
    .rgb(sprite_rgb)
  );
  
  font_cp437_8x8 tile_rom(
    .addr(tile_rom_addr),
    .data(tile_rom_data)
  );

  example_bitmap_rom bitmap_rom(
    .addr(sprite_rom_addr),
    .data(sprite_rom_data)
  );
  
  assign rgb = display_on
    ? (sprite_rgb>0 ? sprite_rgb : tile_rgb)
    : 0;

  // CPU RAM (32k x 16 bits)
  RAM #(15,16) mram(
    .clk(clk),
    .dout(cpuram_read),
    .din(cpuram_write),
    .addr(cpuram_addr[14:0]),
    .we(cpuram_writeenable)
  );
  
  reg [15:0] cpuram_read;
  reg [15:0] cpuram_write;
  reg [15:0] cpuram_addr;
  reg cpuram_writeenable;
  wire busy;
  
  CPU16 cpu(
    .clk(clk),
    .reset(reset),
    .hold(0),
    .busy(busy),
    .address(cpuram_addr),
    .data_in(cpuram_read),
    .data_out(cpuram_write),
    .write(cpuram_writeenable));
  
endmodule
