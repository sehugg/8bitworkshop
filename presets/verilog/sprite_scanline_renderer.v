`include "hvsync_generator.v"
`include "ram.v"

module example_bitmap_rom(addr, data);
  
  input [15:0] addr;
  output [15:0] data;
  
  reg [15:0] bitarray[0:255];
  
  assign data = bitarray[addr & 15];
  
  initial begin/*{w:16,h:16,bpw:16,count:1}*/
    bitarray[8'h00] = 16'b11110000000;
    bitarray[8'h01] = 16'b100001000000;
    bitarray[8'h02] = 16'b1111111100000;
    bitarray[8'h03] = 16'b1111111100000;
    bitarray[8'h04] = 16'b11110000000;
    bitarray[8'h05] = 16'b11111111110000;
    bitarray[8'h06] = 16'b111100001111000;
    bitarray[8'h07] = 16'b1111101101111100;
    bitarray[8'h08] = 16'b1101100001101111;
    bitarray[8'h09] = 16'b1101111111100110;
    bitarray[8'h0a] = 16'b1001111111100000;
    bitarray[8'h0b] = 16'b1111111100000;
    bitarray[8'h0c] = 16'b1110011100000;
    bitarray[8'h0d] = 16'b1100001100000;
    bitarray[8'h0e] = 16'b1100001100000;
    bitarray[8'h0f] = 16'b11100001110000;
  end

endmodule

module sprite_scanline_renderer(clk, reset, hpos, vpos, rgb,
                               ram_addr, ram_data,
                               rom_addr, rom_data);

  parameter NB = 5;
  parameter MB = 3;
  
  localparam N = 1<<NB;
  localparam M = 1<<MB;
  
  input clk, reset;
  input [8:0] hpos;
  input [8:0] vpos;
  output [3:0] rgb;

  output [NB+1:0] ram_addr;
  input [7:0] ram_data;
  output [15:0] rom_addr;
  input [15:0] rom_data;
  
  reg [7:0] sprite_xpos[0:N-1];
  reg [7:0] sprite_ypos[0:N-1];
  reg [7:0] sprite_attr[0:N-1];
  
  reg [NB-1:0] sprite_to_line[0:M-1];
  reg [7:0] line_xpos[0:M-1];
  reg [7:0] line_yofs[0:M-1];
  reg [7:0] line_attr[0:M-1];
  reg line_active[0:M-1];
  reg [3:0] scanline[0:511];
  reg [NB-1:0] i; // 0..N-1
  reg [MB-1:0] j; // 0..M-1
  reg [MB-1:0] k; // 0..M-1
  reg [7:0] z;
  reg [8:0] write_ofs;
  
  wire [8:0] read_bufidx = {vpos[0], hpos[7:0]};
  reg [15:0] out_bitmap;
  reg [7:0] out_attr;
  wire [NB-1:0] load_index = hpos[NB+2:3];
  
  /*
  0: read sprite_ypos[i]
  1: check ypos, write line_ypos[j]
  ...
  0: read line_xpos[0]
  1: store xpos
  2: read line_ypos[0]
  3: store ypos
  4: read line_attr[0]
  5: store attr
  8: write 16 pixels
  */
  
  always @(posedge clk) begin
    
    // reset every frame, don't draw vpos >= 256
    if (reset || vpos[8]) begin
      // load sprites from RAM on line 260
      // 8 cycles per sprite
      if (vpos == 260 && hpos < N*8) begin
        case (hpos[2:0])
          0: begin
            ram_addr <= {load_index, 2'b00};
          end
          2: begin
            sprite_xpos[load_index] <= ram_data;
            ram_addr <= {load_index, 2'b01};
          end
          4: begin
            sprite_ypos[load_index] <= ram_data;
            ram_addr <= {load_index, 2'b10};
          end
          6: begin
            sprite_attr[load_index] <= ram_data;
          end
        endcase
      end
    end else if (hpos < N*2) begin
      k <= 0;
      // select the sprites that will appear in this scanline
      case (hpos[0])
        // compute Y offset of sprite relative to scanline
        0: z <= 8'(vpos - sprite_ypos[i]);
        // sprite is active if Y offset is 0..15
        1: begin
          if (z < 16) begin
            line_yofs[j] <= z; // save Y offset
            sprite_to_line[j] <= i; // save main array index
            line_active[j] <= 1; // mark sprite active
            j <= j + 1; // inc counter
          end
          i <= i + 1; // inc main array counter
        end
      endcase
    end else if (hpos < N*2+M*24) begin
      j <= 0;
      // divide hpos by 24 (8 setup + 16 render)
      if ((hpos[3:0] < 8) ^^ hpos[4]) begin
        // render sprites into write buffer
        case (hpos[3:0])
          // grab index into main sprite array
          0: i <= sprite_to_line[k];
          // load scanline buffer offset to write
          1: write_ofs <= {~vpos[0], sprite_xpos[i]};
          // set ROM address and fetch bitmap
          2: rom_addr <= {4'b0, sprite_attr[i][7:4], line_yofs[k]};
          // fetch 0 if sprite is inactive
          3: out_bitmap <= line_active[k] ? rom_data : 0;
          // load attribute for sprite
          4: out_attr <= sprite_attr[i];
          // disable sprite for next scanline
          6: line_active[k] <= 0;
          // go to next sprite in 2ndary buffer
          7: k <= k + 1;
        endcase
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
  
  initial
    begin
      sprite_xpos[0] = 0;
      sprite_ypos[0] = 0;
      sprite_attr[0] = 1;
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
  
  wire [6:0] ram_addr;
  wire [7:0] ram_read;
  reg [7:0] ram_write;
  reg ram_we;
  
  // 128-byte RAM
  RAM #(7,8) ram(
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
    .rom_addr(rom_addr),
    .rom_data(rom_data)
  );

  always @(posedge clk) begin
    // wiggle sprites randomly once per frame
    if (vpos == 256) begin
      ram_addr <= hpos[8:2];
      // 4 clocks per read/write cycle
      if (!hpos[1]) begin
        ram_we <= 0;
      end else begin
        ram_we <= 1;
        ram_write <= ram_read + 8'(($random&3)-1);
      end
    end else
      ram_we <= 0;
  end

endmodule
