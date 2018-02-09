`include "hvsync_generator.v"

module car_bitmap(yofs, bits);
  
  input [3:0] yofs;
  output [7:0] bits;
  
  reg [7:0] bitarray[16];
  
  assign bits = bitarray[yofs];
  
  initial begin/*{w:8,h:16}*/
    bitarray[0] = 8'b1100;
    bitarray[1] = 8'b11001100;
    bitarray[2] = 8'b11111100;
    bitarray[3] = 8'b11101100;
    bitarray[4] = 8'b11100000;
    bitarray[5] = 8'b1100000;
    bitarray[6] = 8'b1110000;
    bitarray[7] = 8'b110000;
    bitarray[8] = 8'b110000;
    bitarray[9] = 8'b110000;
    bitarray[10] = 8'b1100111;
    bitarray[11] = 8'b11100110;
    bitarray[12] = 8'b11111111;
    bitarray[13] = 8'b11100110;
    bitarray[14] = 8'b1110111;
    bitarray[15] = 8'b110000;
  end
  
endmodule

module sprite_renderer(clk, vstart, load, hstart, rom_addr, rom_bits, 
                       gfx, in_progress);
  
  input clk, vstart, load, hstart;
  output [3:0] rom_addr;
  input [7:0] rom_bits;
  output gfx;
  output in_progress = state != WAIT_FOR_VSTART;

  reg [2:0] state;
  reg [3:0] ycount;
  reg [3:0] xcount;
  
  reg [7:0] outbits;
  
  localparam WAIT_FOR_VSTART = 0;
  localparam WAIT_FOR_LOAD   = 1;
  localparam LOAD1_SETUP     = 2;
  localparam LOAD1_FETCH     = 3;
  localparam WAIT_FOR_HSTART = 4;
  localparam DRAW            = 5;
  
  always @(posedge clk)
    begin
      case (state)
        WAIT_FOR_VSTART: begin
          ycount <= 0;
          // set a default value (blank) for pixel output
          // note: multiple non-blocking assignments are vendor-specific
	  gfx <= 0;
          if (vstart) state <= WAIT_FOR_LOAD;
        end
        WAIT_FOR_LOAD: begin
          xcount <= 0;
	  gfx <= 0;
          if (load) state <= LOAD1_SETUP;
        end
        LOAD1_SETUP: begin
          rom_addr <= ycount;
	  gfx <= 0;
          state <= LOAD1_FETCH;
        end
        LOAD1_FETCH: begin
	  outbits[7:0] <= rom_bits;
	  gfx <= 0;
          state <= WAIT_FOR_HSTART;
        end
        WAIT_FOR_HSTART: begin
          if (hstart) state <= DRAW;
	  gfx <= 0;
        end
        DRAW: begin
          // mirror graphics left/right
          gfx <= outbits[xcount<8 ? xcount[2:0] : ~xcount[2:0]];
          xcount <= xcount + 1;
          if (xcount == 15) begin // pre-increment value
            ycount <= ycount + 1;
            if (ycount == 15) // pre-increment value
              state <= WAIT_FOR_VSTART; // done drawing sprite
            else
	      state <= WAIT_FOR_LOAD; // done drawing this scanline
          end
        end
        default: begin
          state <= 0; // TODO: reset
	  gfx <= 0;
        end
      endcase
    end
  
endmodule


module test_top(clk, hsync, vsync, rgb, hpaddle, vpaddle);

  input clk;
  input hpaddle, vpaddle;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;

  reg [7:0] player_x;
  reg [7:0] player_y;
  
  reg [7:0] paddle_x;
  reg [7:0] paddle_y;
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(0),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  wire [3:0] car_sprite_yofs;
  wire [7:0] car_sprite_bits;
  
  car_bitmap car(
    .yofs(car_sprite_yofs), 
    .bits(car_sprite_bits));
  
  wire vstart = {1'0,player_y} == vpos;
  wire hstart = {1'0,player_x} == hpos;
  wire car_gfx;
  wire unused;
  
  sprite_renderer renderer(
    .clk(clk),
    .vstart(vstart),
    .load(hsync),
    .hstart(hstart),
    .rom_addr(car_sprite_yofs),
    .rom_bits(car_sprite_bits),
    .gfx(car_gfx),
    .in_progress(unused));
  
  always @(posedge hsync)
    begin
      if (!hpaddle) paddle_x <= vpos[7:0];
      if (!vpaddle) paddle_y <= vpos[7:0];
    end
  
  always @(posedge vsync)
    begin
      player_x <= paddle_x;
      player_y <= paddle_y;
    end

  wire r = display_on && car_gfx;
  wire g = display_on && car_gfx;
  wire b = display_on && car_gfx;
  assign rgb = {b,g,r};

endmodule
