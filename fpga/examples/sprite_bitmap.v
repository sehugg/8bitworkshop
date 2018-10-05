
`ifndef SPRITE_BITMAP_H
`define SPRITE_BITMAP_H

`include "hvsync_generator.v"

/*
Simple sprite renderer example.

car_bitmap - ROM for a car sprite.
sprite_bitmap_top - Example sprite rendering module.
*/

module car_bitmap(yofs, bits);
  
  input [3:0] yofs;
  output [7:0] bits;

  reg [7:0] bitarray[0:15];
  
  assign bits = bitarray[yofs];
  
  initial begin/*{w:8,h:16}*/
    bitarray[0] = 8'b0;
    bitarray[1] = 8'b1100;
    bitarray[2] = 8'b11001100;
    bitarray[3] = 8'b11111100;
    bitarray[4] = 8'b11101100;
    bitarray[5] = 8'b11100000;
    bitarray[6] = 8'b1100000;
    bitarray[7] = 8'b1110000;
    bitarray[8] = 8'b110000;
    bitarray[9] = 8'b110000;
    bitarray[10] = 8'b110000;
    bitarray[11] = 8'b1101110;
    bitarray[12] = 8'b11101110;
    bitarray[13] = 8'b11111110;
    bitarray[14] = 8'b11101110;
    bitarray[15] = 8'b101110;
  end
  
endmodule

`endif
