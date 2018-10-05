
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
        // read page base for row
        HLOAD-3: ram_addr <= {page_base, 3'b000, row};
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
        ram_addr <= row_base + hpos[4:0];
        row_buffer[hpos[4:0] - 5'd2] <= ram_read;
      end
    end
    // latch character data
    if (hpos < 256) begin
      case (hpos[2:0])
        7: begin
          cur_cell <= row_buffer[col+1];
        end
      endcase
    end else if (hpos == 308) begin
      cur_cell <= row_buffer[0];
    end
  end
      
  // extract bit from ROM output
  assign rgb = rom_data[~xofs] ? cur_attr[3:0] : cur_attr[7:4];
  
endmodule

