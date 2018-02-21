`include "hvsync_generator.v"

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
                               rom_addr, rom_data);

  parameter NB = 5;
  parameter MB = 2;
  
  localparam N = 1<<NB;
  localparam M = 1<<MB;
  
  input clk, reset;
  input [8:0] hpos;
  input [8:0] vpos;
  output [3:0] rgb;
  
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
  wire [NB-1:0] move_index = hpos[NB-1:0];
  
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
      // initialize counters, even though it works w/o it
      i <= 0;
      j <= 0;
      k <= 0;
      // wiggle sprites randomly once per frame
      if (vpos == 256 && hpos < N) begin
        sprite_xpos[move_index] <= sprite_xpos[move_index] + 8'(($random&3)-1);
        sprite_ypos[move_index] <= sprite_ypos[move_index] + 8'(($random&3)-1);
      end
    end else
    if (hpos < N*2) begin
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
    end else if (hpos < N*2+M*4) begin
      // copy sprites from main array to local array
      case (hpos[1:0])
        0: i <= sprite_to_line[j];
        // transfer sprite X pos to line array
        1: line_xpos[j] <= sprite_xpos[i];
        // transfer sprite attribte to line array
        2: line_attr[j] <= sprite_attr[i];
        // increment 2nd array counter
        3: j <= j + 1;
      endcase
    end else if (hpos < N*2+M*4+M*32) begin
      i <= 0;
      j <= 0;
      if (hpos[4:0] < 16) begin
        // render sprites into write buffer
        case (hpos[4:0])
          // load scanline buffer offset to write
          0: write_ofs <= {~vpos[0], line_xpos[k]};
          // set ROM address and  fetch bitmap
          1: rom_addr <= {4'b0, line_attr[k][7:4], line_yofs[k]};
          // fetch 0 if sprite is inactive
          2: out_bitmap <= line_active[k] ? rom_data : 0;
          // load attribute for sprite
          3: out_attr <= line_attr[k];
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
  
  sprite_scanline_renderer ssr(
    .clk(clk),
    .reset(reset),
    .hpos(hpos),
    .vpos(vpos),
    .rgb(rgb),
    .rom_addr(rom_addr),
    .rom_data(rom_data)
  );

endmodule
