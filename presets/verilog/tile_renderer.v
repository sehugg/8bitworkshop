
`include "hvsync_generator.v"
`include "font_cp437_8x8.v"
`include "ram.v"

/*
Displays a 32x30 grid of 8x8 tiles, whose attributes are
  fetched from RAM, and whose bitmap patterns are in ROM.
*/

module tile_renderer(clk, reset, hpos, vpos,
                     rgb,
                     ram_addr, ram_read, ram_busy,
                     rom_addr, rom_data);

  input clk, reset;
  input [8:0] hpos;
  input [8:0] vpos;
  output [3:0] rgb;
  
  // start loading cells from RAM at this hpos value
  // first column read will be ((HLOAD-2) % 32)
  parameter HLOAD = 272;

  output reg [15:0] ram_addr;
  input [15:0] ram_read;
  output reg ram_busy;

  output [10:0] rom_addr;
  input [7:0] rom_data;
  
  reg [7:0] page_base = 8'h7e;	// page table base (8 bits)
  reg [15:0] row_base;		// row table base (16 bits)
  reg [4:0] row;
  //wire [4:0] row = vpos[7:3];	// 5-bit row, vpos / 8
  wire [4:0] col = hpos[7:3];	// 5-bit column, hpos / 8
  wire [2:0] yofs = vpos[2:0];  // scanline of cell (0-7)
  wire [2:0] xofs = hpos[2:0];  // which pixel to draw (0-7)
  
  reg [15:0] cur_cell;
  wire [7:0] cur_char = cur_cell[7:0];
  wire [7:0] cur_attr = cur_cell[15:8];

  // tile ROM address
  assign rom_addr = {cur_char, yofs};
  
  reg [15:0] row_buffer[0:31];
  
  // lookup char and attr
  always @(posedge clk) begin
    // reset row to 0 when last row displayed
    if (vpos == 248) begin
      row <= 0;
    end
    // time to read a row?
    if (vpos[2:0] == 7) begin
      // read row_base from page table (2 bytes)
      case (hpos)
        // assert busy 5 cycles before first RAM read
        HLOAD-8: ram_busy <= 1;
        // set address for row in page base table
        HLOAD-3: ram_addr <= {page_base, 3'b000, row};
        // read row_base from page table (2 bytes)
        HLOAD-1: row_base <= ram_read;
        // deassert BUSY and increment row counter
        HLOAD+34: begin
          ram_busy <= 0;
          row <= row + 1;
        end
      endcase
      // load row of tile data from RAM
      // (last two twice)
      if (hpos >= HLOAD && hpos < HLOAD+34) begin
        // set address bus to (row_base + hpos)
        ram_addr <= row_base + 16'(hpos[4:0]);
        // store value on data bus from (row_base + hpos - 2)
        // which was read two cycles ago
        row_buffer[hpos[4:0] - 2] <= ram_read;
      end
    end
    // latch character data
    if (hpos < 256) begin
      case (hpos[2:0])
        7: begin
          // read next cell
          cur_cell <= row_buffer[col+1];
        end
      endcase
    end else if (hpos == 308) begin
      // read first cell of next row
      cur_cell <= row_buffer[0];
    end
  end
      
  // extract bit from ROM output
  assign rgb = rom_data[~xofs] ? cur_attr[3:0] : cur_attr[7:4];
  
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
  
  assign rgb = display_on ? rgb_tile : rgb_tile|8;

    // tile ROM
  font_cp437_8x8 tile_rom(
    .addr(rom_addr),
    .data(rom_data)
  );
  
  // draw border around edges of tile map
  initial begin
    for (int i=0; i<32; i++) begin
      ram.mem[16'h7e00 + 16'(i)] = 16'(i*32);
      ram.mem[16'(i*32)] = 16'hfa1b;
      ram.mem[16'(i*32+31)] = 16'hfb1a;
      ram.mem[16'(i)] = 16'hfc18;
      ram.mem[16'(28*32+i)] = 16'hfd19;
    end
  end

endmodule
