`include "hvsync_generator.v"
`include "font_cp437_8x8.v"
`include "ram.v"

module tile_renderer(clk, reset, hpos, vpos, display_on,
                     rgb,
                     ram_addr, ram_read, ram_busy,
                     rom_addr, rom_data);

  input clk, reset;
  input [8:0] hpos;
  input [8:0] vpos;
  input display_on;
  output [3:0] rgb;

  output reg [15:0] ram_addr;
  input [15:0] ram_read;
  output reg ram_busy;

  output [10:0] rom_addr;
  input [7:0] rom_data;
  
  reg [7:0] page_base = 8'h7e;	// page table base (8 bits)
  reg [15:0] row_base;		// row table base (16 bits)

  wire [4:0] row = vpos[7:3];	// 5-bit row, vpos / 8
  wire [4:0] col = hpos[7:3];	// 5-bit column, hpos / 8
  wire [2:0] yofs = vpos[2:0];  // scanline of cell (0-7)
  wire [2:0] xofs = hpos[2:0];  // which pixel to draw (0-7)
  
  reg [7:0] char;
  reg [7:0] attr;

  // tile ROM address
  assign rom_addr = {char, yofs};
  
  reg [15:0] row_buffer[0:31];

  // lookup char and attr
  always @(posedge clk) begin
    // time to read a row?
    if (vpos[2:0] == 7) begin
      // read row_base from page table (2 bytes)
      case (hpos[7:0])
        186: ram_busy <= 1;
        190: ram_addr <= {page_base, 3'b000, row};
        192: row_base <= ram_read;
        192+32: ram_busy <= 0;
      endcase
      // load row of tile data from RAM
      if (hpos >= 192 && hpos < 192+32) begin
        ram_addr <= row_base + 16'(hpos[4:0]);
        row_buffer[hpos[4:0]-2] <= ram_read;
      end
    end
    // latch character data
    if (hpos < 256) begin
      case (hpos[2:0])
        7: begin
          char <= row_buffer[col][7:0];
          attr <= row_buffer[col][15:8];
        end
      endcase
    end
  end
      
  // extract bit from ROM output
  assign rgb = display_on
    ? (rom_data[~xofs] ? attr[3:0] : attr[7:4])
    : 0;
  
endmodule

module test_tilerender_top(clk, reset, hsync, vsync, rgb);

  input clk, reset;
  output hsync, vsync;
  output [3:0] rgb;

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
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
 
  // RAM 
  RAM_sync #(16,16) ram(
    .clk(clk),
    .dout(ram_read),
    .din(ram_write),
    .addr(ram_addr),
    .we(ram_writeenable)
  );
  
  tile_renderer tile_gen(
    .clk(clk),
    .reset(reset),
    .hpos(hpos),
    .vpos(vpos),
    .display_on(display_on),
    .ram_addr(ram_addr),
    .ram_read(ram_read),
    .ram_busy(ram_busy),
    .rom_addr(rom_addr),
    .rom_data(rom_data),
    .rgb(rgb)
  );

    // tile ROM
  font_cp437_8x8 tile_rom(
    .addr(rom_addr),
    .data(rom_data)
  );


endmodule
