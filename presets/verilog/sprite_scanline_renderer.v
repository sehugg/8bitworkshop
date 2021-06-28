
`include "hvsync_generator.v"
`include "ram.v"

/*
sprite_scanline_renderer - Module that renders multiple
  sprites whose attributes are fetched from shared RAM,
  and whose bitmaps are stored in ROM. Made to be paired
  with the FEMTO-16 CPU.
*/

module example_bitmap_rom(addr, data);
  
  input [15:0] addr;
  output [15:0] data;
  
  reg [15:0] bitarray[0:255];
  
  assign data = bitarray[addr & 15];
  
  initial begin/*{w:16,h:16,bpw:16,count:1}*/
    bitarray['h00] = 16'b11110000000;
    bitarray['h01] = 16'b100001000000;
    bitarray['h02] = 16'b1111111100000;
    bitarray['h03] = 16'b1111111100000;
    bitarray['h04] = 16'b11110000000;
    bitarray['h05] = 16'b11111111110000;
    bitarray['h06] = 16'b111100001111000;
    bitarray['h07] = 16'b1111101101111100;
    bitarray['h08] = 16'b1101100001101111;
    bitarray['h09] = 16'b1101111111100110;
    bitarray['h0a] = 16'b1001111111100000;
    bitarray['h0b] = 16'b1111111100000;
    bitarray['h0c] = 16'b1110011100000;
    bitarray['h0d] = 16'b1100001100000;
    bitarray['h0e] = 16'b1100001100000;
    bitarray['h0f] = 16'b11100001110000;
  end

endmodule

module sprite_scanline_renderer(clk, reset, hpos, vpos, rgb,
                               ram_addr, ram_data, ram_busy,
                               rom_addr, rom_data);

  parameter NB = 5; // 2^NB == number of sprites
  parameter MB = 3; // 2^MB == slots per scanline
  
  localparam N = 1<<NB; // number of sprites
  localparam M = 1<<MB; // slots per scanline
  
  input clk, reset;	// clock and reset inputs
  input [8:0] hpos;	// horiz. sync pos
  input [8:0] vpos;	// vert. sync pos
  output reg [3:0] rgb;	// rgb output

  output reg [NB:0] ram_addr; // RAM for sprite data
  input [15:0] ram_data;  // (2 words per sprite)
  output reg ram_busy;	  // set when accessing RAM
  
  output reg [15:0] rom_addr; // sprite ROM address
  input [15:0] rom_data;  // sprite ROM data
  
  // copy of sprite data from RAM (N entries)
  reg [7:0] sprite_xpos[0:N-1]; // X positions
  reg [7:0] sprite_ypos[0:N-1]; // Y positions
  reg [7:0] sprite_attr[0:N-1]; // attributes

  // M sprite slots
  reg [7:0] line_xpos[0:M-1]; // X pos for M slots
  reg [7:0] line_yofs[0:M-1]; // Y pos for M slots
  reg [7:0] line_attr[0:M-1]; // attr for M slots
  reg line_active[0:M-1];     // slot active?
  
  // temporary counters
  reg [NB-1:0] i; // read index for main array (0..N-1)
  reg [MB-1:0] j; // write index for slots (0..M-1)
  reg [MB-1:0] k; // read index for slots (0..M-1)
  reg [7:0] z; // relative y offset of sprite
  reg [8:0] write_ofs; // write index of scanline buffer
  reg [15:0] out_bitmap; // shift register while writing scanline
  reg [7:0] out_attr; // attribute while writing scanline
  reg romload; // 1 when ROM address bus is stable

  // which sprite are we currently reading?
  wire [NB-1:0] load_index = hpos[NB:1];

  // RGB dual scanline buffer
  reg [3:0] scanline[0:511];  
  
  // which offset in scanline buffer to read?
  wire [8:0] read_bufidx = {vpos[0], hpos[7:0]};

  // always block (every clock cycle)
  always @(posedge clk) begin
    
    ram_busy <= 0;
    // reset every frame, don't draw vpos >= 256
    if (reset || vpos[8]) begin
      // load sprites from RAM on line 260
      // 8 cycles per sprite
      // do first sprite twice b/c CPU might still be busy
      if (vpos == 260 && hpos < N*2+8) begin
        ram_busy <= 1;
        case (hpos[0])
          0: begin
            ram_addr <= {load_index, 1'b0};
            // load X and Y position (2 cycles ago)
            sprite_xpos[load_index] <= ram_data[7:0];
            sprite_ypos[load_index] <= ram_data[15:8];
          end
          1: begin
            ram_addr <= {load_index, 1'b1};
            // load attribute (2 cycles ago)
            sprite_attr[load_index] <= ram_data[7:0];
          end
        endcase
      end
    end else if (hpos < N*2) begin
      // setup vars for next phase
      k <= 0;
      romload <= 0;
      // select the sprites that will appear in this scanline
      case (hpos[0])
        // compute Y offset of sprite relative to scanline
        0: z <= 8'(vpos - sprite_ypos[i]);
        1: begin
          // sprite is active if Y offset is 0..15
          if (z < 16) begin
            line_xpos[j] <= sprite_xpos[i]; // save X pos
            line_yofs[j] <= z; // save Y offset
            line_attr[j] <= sprite_attr[i]; // save attr
            line_active[j] <= 1; // mark sprite active
            j <= j + 1; // inc counter
          end
          i <= i + 1; // inc main array counter
        end
      endcase
    end else if (hpos < N*2+M*18) begin
      // setup vars for next phase
      j <= 0;
      // if sprite shift register is empty, load new sprite
      if (out_bitmap == 0) begin
        case (romload)
          0: begin
            // set ROM address and fetch bitmap
            rom_addr <= {4'b0, line_attr[k][7:4], line_yofs[k]};
          end
          1: begin
            // load scanline buffer offset to write
            write_ofs <= {~vpos[0], line_xpos[k]};
            // fetch 0 if sprite is inactive
            out_bitmap <= line_active[k] ? rom_data : 0;
            // load attribute for sprite
            out_attr <= line_attr[k];
            // disable sprite for next scanline
            line_active[k] <= 0;
            // go to next sprite in 2ndary buffer
            k <= k + 1;
          end
        endcase
        romload <= !romload;
      end else begin
        // write color to scanline buffer if low bit == 1
        if (out_bitmap[0])
          scanline[write_ofs] <= out_attr[3:0];
        // shift bits right
        out_bitmap <= out_bitmap >> 1;
        // increment to next scanline pixel
        write_ofs <= write_ofs + 1;
      end
    end else begin
      // clear counters
      i <= 0;
    end
    
    // read and clear buffer
    rgb <= scanline[read_bufidx];
    scanline[read_bufidx] <= 0;
  end
  
endmodule

module test_scanline_render_top(clk, reset, hsync, vsync, rgb);

  input clk, reset;
  output hsync, vsync;
  output [3:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;

  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  wire [15:0] rom_addr;
  wire [15:0] rom_data;
  
  example_bitmap_rom bitmap_rom(
    .addr(rom_addr),
    .data(rom_data)
  );
  
  reg [5:0] ram_addr;
  wire [15:0] ram_read;
  reg [15:0] ram_write;
  reg ram_we;
  reg ram_busy;
  
  // 64-word RAM
  RAM_sync #(6,16) ram(
    .clk(clk),
    .addr(ram_addr),
    .dout(ram_read),
    .din(ram_write),
    .we(ram_we)
  );
  
  sprite_scanline_renderer ssr(
    .clk(clk),
    .reset(reset),
    .hpos(hpos),
    .vpos(vpos),
    .rgb(rgb),
    .ram_addr(ram_addr),
    .ram_data(ram_read),
    .ram_busy(ram_busy),
    .rom_addr(rom_addr),
    .rom_data(rom_data)
  );

  always @(posedge clk) begin
    // wiggle sprites randomly once per frame
    if (vpos == 256) begin
      ram_addr <= hpos[7:2];
      // 4 clocks per read/write cycle
      if (!hpos[1]) begin
        ram_we <= 0;
      end else begin
        ram_we <= 1;
        ram_write <= ram_read + 16'(($random&3)-1);
      end
    end else
      ram_we <= 0;
  end

endmodule
