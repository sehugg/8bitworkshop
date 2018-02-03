`include "hvsync_generator.v"

module car_bitmap(
  input [3:0] yofs,
  output [7:0] bits
);
  reg [7:0] bitarray[16];
  assign bits = bitarray[yofs];
  initial begin/*{w:8,h:16}*/
    bitarray[0] = 8'b0;
    bitarray[1] = 8'b101110;
    bitarray[2] = 8'b11101110;
    bitarray[3] = 8'b11111110;
    bitarray[4] = 8'b11101110;
    bitarray[5] = 8'b1101110;
    bitarray[6] = 8'b110000;
    bitarray[7] = 8'b110000;
    bitarray[8] = 8'b110000;
    bitarray[9] = 8'b1110000;
    bitarray[10] = 8'b1100000;
    bitarray[11] = 8'b11100000;
    bitarray[12] = 8'b11101100;
    bitarray[13] = 8'b11111100;
    bitarray[14] = 8'b11001100;
    bitarray[15] = 8'b1100;
  end
endmodule

module sprite_bitmap_top(clk, reset, hsync, vsync, rgb);

  input clk, reset;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;

  reg sprite_active;
  reg [3:0] car_sprite_xofs;
  reg [3:0] car_sprite_yofs;
  wire [7:0] car_sprite_bits;
  
  reg [8:0] player_x = 128;
  reg [8:0] player_y = 128;
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  car_bitmap car(
    .yofs(car_sprite_yofs), 
    .bits(car_sprite_bits));

  always @(posedge hsync)
    // start sprite?
    if (vpos == player_y)
      car_sprite_yofs <= 15;
    else if (car_sprite_yofs != 0)
      car_sprite_yofs <= car_sprite_yofs - 1;
  
  always @(posedge clk)
    if (hpos == player_x)
      car_sprite_xofs <= 15;
    else if (car_sprite_xofs != 0)
      car_sprite_xofs <= car_sprite_xofs - 1;

  // mirror sprite in X direction
  wire [3:0] car_bit = car_sprite_xofs>=8 ? 
                                 15-car_sprite_xofs:
                                 car_sprite_xofs;
  wire car_gfx = car_sprite_bits[3'(car_bit)];

  wire r = display_on && car_gfx;
  wire g = display_on && car_gfx;
  wire b = display_on && car_gfx;
  assign rgb = {b,g,r};

endmodule
