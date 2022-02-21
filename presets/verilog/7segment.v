
`include "hvsync_generator.v"

/*
seven_segment_decoder - Decodes a digit into 7 segments.

segments_to_bitmap - Encodes a 7-segment bitmask into
  a 5x5 bitmap.

Segment bit indices:

       6666
      1    5 
      1    5
       0000
      2    4
      2    4
       3333
*/

module seven_segment_decoder(digit, segments);

  input [3:0] digit;
  output reg [6:0] segments;

  always @(*)
    case(digit)
      0: segments = 7'b1111110;
      1: segments = 7'b0110000;
      2: segments = 7'b1101101;
      3: segments = 7'b1111001;
      4: segments = 7'b0110011;
      5: segments = 7'b1011011;
      6: segments = 7'b1011111;
      7: segments = 7'b1110000;
      8: segments = 7'b1111111;
      9: segments = 7'b1111011;
      default: segments = 7'b0000000;
    endcase
  
endmodule

module segments_to_bitmap(segments, line, bits);
  
  input [6:0] segments;
  input [2:0] line;
  output reg [4:0] bits;
  
  always @(*)
    case (line)
      0:bits = (segments[6]?5'b11111:0) 
             ^ (segments[5]?5'b00001:0) 
             ^ (segments[1]?5'b10000:0);
      1:bits = (segments[1]?5'b10000:0) 
             ^ (segments[5]?5'b00001:0);
      2:bits = (segments[0]?5'b11111:0) 
             ^ (|segments[5:4]?5'b00001:0) 
             ^ (|segments[2:1]?5'b10000:0);
      3:bits = (segments[2]?5'b10000:0) 
             ^ (segments[4]?5'b00001:0);
      4:bits = (segments[3]?5'b11111:0) 
             ^ (segments[4]?5'b00001:0) 
             ^ (segments[2]?5'b10000:0);
      default:bits = 0;
    endcase
  
endmodule

module test_7segment_top(clk, reset, hsync, vsync, rgb);
  
  input clk, reset;
  output hsync, vsync;
  output [2:0] rgb;

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
  
  wire [3:0] digit = hpos[7:4];
  wire [2:0] xofs = hpos[3:1];
  wire [2:0] yofs = vpos[3:1];
  wire [4:0] bits;
  wire [6:0] segments;
  
  seven_segment_decoder decoder(
    .digit(digit),
    .segments(segments)
  );
  
  segments_to_bitmap numbers(
    .segments(segments),
    .line(yofs),
    .bits(bits)
  );

  wire r = display_on && 0;
  wire g = display_on && bits[~xofs];
  wire b = display_on && 0;
  assign rgb = {b,g,r};

endmodule
