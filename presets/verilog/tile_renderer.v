`include "hvsync_generator.v"
`include "font_cp437_8x8.v"
`include "ram.v"

module tile_renderer(clk, reset, hpos, vpos, display_on,
                     rgb,
                     ram_addr, ram_read,
                     rom_addr, rom_data);

  input clk, reset;
  input [8:0] hpos;
  input [8:0] vpos;
  input display_on;
  output [3:0] rgb;

  output reg [15:0] ram_addr;
  input [7:0] ram_read;

  output [10:0] rom_addr;
  input [7:0] rom_data;
  
  reg [7:0] page_base = 0;	// page table base (8 bits)
  reg [15:0] row_base;		// row table base (16 bits)

  wire [4:0] row = vpos[7:3];	// 5-bit row, vpos / 8
  wire [4:0] col = hpos[7:3];	// 5-bit column, hpos / 8
  wire [2:0] yofs = vpos[2:0];  // scanline of cell (0-7)
  wire [2:0] xofs = hpos[2:0];  // which pixel to draw (0-7)
  
  reg [7:0] char;
  reg [7:0] attr;
  reg [7:0] next_char;
  reg [7:0] next_attr;

  // tile ROM address
  assign rom_addr = {char, yofs};

  // lookup char and attr
  always @(posedge clk)
    if (hpos[8]) begin
      case (hpos[7:0])
        // read row_base from page table (2 bytes)
        // TODO: why 2 cycles?
        0: ram_addr <= {page_base, row, 3'b000};
        2: row_base[7:0] <= ram_read;
        3: ram_addr <= {page_base, row, 3'b001};
        5: row_base[15:8] <= ram_read;
      endcase
    end else begin
      case (hpos[2:0])
        0: ram_addr <= row_base + 16'(col);
        2: next_char <= ram_read;
        3: ram_addr <= row_base + 16'(col) + 32;
        5: next_attr <= ram_read;
        7: begin
          char <= next_char;
          attr <= next_attr;
        end
      endcase
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
  wire [7:0] ram_read;
  reg [7:0] ram_write = 0;
  reg ram_writeenable = 0;
  
  wire [10:0] rom_addr;
  wire [7:0] rom_data;
  
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
  RAM #(16,8) ram(
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
