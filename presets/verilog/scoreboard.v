
`ifndef SCOREBOARD_H
`define SCOREBOARD_H

`include "hvsync_generator.v"
`include "digits10.v"

/*
player_stats - Holds two-digit score and one-digit lives counter.
scoreboard_generator - Outputs video signal with score/lives digits.
*/

module player_stats(reset, score0, score1, lives, incscore, declives);
  
  input reset;
  output reg [3:0] score0;
  output reg [3:0] score1;
  input incscore;
  output reg [3:0] lives;
  input declives;

  always @(posedge incscore or posedge reset)
    begin
      if (reset) begin
        score0 <= 0;
        score1 <= 0;
      end else if (score0 == 9) begin
        score0 <= 0;
        score1 <= score1 + 1;
      end else begin
        score0 <= score0 + 1;
      end
    end

  always @(posedge declives or posedge reset)
    begin
      if (reset)
        lives <= 3;
      else if (lives != 0)
        lives <= lives - 1;
    end

endmodule

module scoreboard_generator(score0, score1, lives, vpos, hpos, board_gfx);

  input [3:0] score0;
  input [3:0] score1;
  input [3:0] lives;
  input [8:0] vpos;
  input [8:0] hpos;
  output board_gfx;

  reg [3:0] score_digit;
  reg [4:0] score_bits;
  
  always @(*)
    begin
      case (hpos[7:5])
        1: score_digit = score1;
        2: score_digit = score0;
        6: score_digit = lives;
        default: score_digit = 15; // no digit
      endcase
    end
  
  digits10_array digits(
    .digit(score_digit),
    .yofs(vpos[4:2]),
    .bits(score_bits)
  );

  assign board_gfx = score_bits[hpos[4:2] ^ 3'b111];
  
endmodule

module scoreboard_top(clk, reset, hsync, vsync, rgb);

  input clk, reset;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  wire board_gfx;

  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  scoreboard_generator scoreboard_gen(
    .score0(0),
    .score1(1),
    .lives(3),
    .vpos(vpos),
    .hpos(hpos),
    .board_gfx(board_gfx)
  );

  wire r = display_on && board_gfx;
  wire g = display_on && board_gfx;
  wire b = display_on && board_gfx;
  assign rgb = {b,g,r};

endmodule

`endif
