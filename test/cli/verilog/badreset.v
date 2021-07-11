

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

/*
ROM module with 5x5 bitmaps for the digits 0-9.

digits10_case - Uses the case statement.
digits10_array - Uses an array and initial block.

These two modules are functionally equivalent.
*/

// module for 10-digit bitmap ROM
module digits10_case(digit, yofs, bits);
  
  input [3:0] digit;		// digit 0-9
  input [2:0] yofs;		// vertical offset (0-4)
  output reg [4:0] bits;	// output (5 bits)

  // combine {digit,yofs} into single ROM address
  wire [6:0] caseexpr = {digit,yofs};
  
  always @(*)
    case (caseexpr)/*{w:5,h:5,count:10}*/
      7'o00: bits = 5'b11111;
      7'o01: bits = 5'b10001;
      7'o02: bits = 5'b10001;
      7'o03: bits = 5'b10001;
      7'o04: bits = 5'b11111;

      7'o10: bits = 5'b01100;
      7'o11: bits = 5'b00100;
      7'o12: bits = 5'b00100;
      7'o13: bits = 5'b00100;
      7'o14: bits = 5'b11111;

      7'o20: bits = 5'b11111;
      7'o21: bits = 5'b00001;
      7'o22: bits = 5'b11111;
      7'o23: bits = 5'b10000;
      7'o24: bits = 5'b11111;

      7'o30: bits = 5'b11111;
      7'o31: bits = 5'b00001;
      7'o32: bits = 5'b11111;
      7'o33: bits = 5'b00001;
      7'o34: bits = 5'b11111;

      7'o40: bits = 5'b10001;
      7'o41: bits = 5'b10001;
      7'o42: bits = 5'b11111;
      7'o43: bits = 5'b00001;
      7'o44: bits = 5'b00001;

      7'o50: bits = 5'b11111;
      7'o51: bits = 5'b10000;
      7'o52: bits = 5'b11111;
      7'o53: bits = 5'b00001;
      7'o54: bits = 5'b11111;

      7'o60: bits = 5'b11111;
      7'o61: bits = 5'b10000;
      7'o62: bits = 5'b11111;
      7'o63: bits = 5'b10001;
      7'o64: bits = 5'b11111;

      7'o70: bits = 5'b11111;
      7'o71: bits = 5'b00001;
      7'o72: bits = 5'b00001;
      7'o73: bits = 5'b00001;
      7'o74: bits = 5'b00001;

      7'o100: bits = 5'b11111;
      7'o101: bits = 5'b10001;
      7'o102: bits = 5'b11111;
      7'o103: bits = 5'b10001;
      7'o104: bits = 5'b11111;

      7'o110: bits = 5'b11111;
      7'o111: bits = 5'b10001;
      7'o112: bits = 5'b11111;
      7'o113: bits = 5'b00001;
      7'o114: bits = 5'b11111;

      default: bits = 0;
    endcase
endmodule

module digits10_array(digit, yofs, bits);
  
  input [3:0] digit;		// digit 0-9
  input [2:0] yofs;		// vertical offset (0-4)
  output [4:0] bits;		// output (5 bits)

  reg [4:0] bitarray[0:15][0:4]; // ROM array (16 x 5 x 5 bits)

  assign bits = bitarray[digit][yofs];	// assign module output
  
  integer i,j;
  
  initial begin/*{w:5,h:5,count:10}*/
    bitarray[0][0] = 5'b11111;
    bitarray[0][1] = 5'b10001;
    bitarray[0][2] = 5'b10001;
    bitarray[0][3] = 5'b10001;
    bitarray[0][4] = 5'b11111;

    bitarray[1][0] = 5'b01100;
    bitarray[1][1] = 5'b00100;
    bitarray[1][2] = 5'b00100;
    bitarray[1][3] = 5'b00100;
    bitarray[1][4] = 5'b11111;

    bitarray[2][0] = 5'b11111;
    bitarray[2][1] = 5'b00001;
    bitarray[2][2] = 5'b11111;
    bitarray[2][3] = 5'b10000;
    bitarray[2][4] = 5'b11111;

    bitarray[3][0] = 5'b11111;
    bitarray[3][1] = 5'b00001;
    bitarray[3][2] = 5'b11111;
    bitarray[3][3] = 5'b00001;
    bitarray[3][4] = 5'b11111;

    bitarray[4][0] = 5'b10001;
    bitarray[4][1] = 5'b10001;
    bitarray[4][2] = 5'b11111;
    bitarray[4][3] = 5'b00001;
    bitarray[4][4] = 5'b00001;

    bitarray[5][0] = 5'b11111;
    bitarray[5][1] = 5'b10000;
    bitarray[5][2] = 5'b11111;
    bitarray[5][3] = 5'b00001;
    bitarray[5][4] = 5'b11111;

    bitarray[6][0] = 5'b11111;
    bitarray[6][1] = 5'b10000;
    bitarray[6][2] = 5'b11111;
    bitarray[6][3] = 5'b10001;
    bitarray[6][4] = 5'b11111;

    bitarray[7][0] = 5'b11111;
    bitarray[7][1] = 5'b00001;
    bitarray[7][2] = 5'b00001;
    bitarray[7][3] = 5'b00001;
    bitarray[7][4] = 5'b00001;

    bitarray[8][0] = 5'b11111;
    bitarray[8][1] = 5'b10001;
    bitarray[8][2] = 5'b11111;
    bitarray[8][3] = 5'b10001;
    bitarray[8][4] = 5'b11111;

    bitarray[9][0] = 5'b11111;
    bitarray[9][1] = 5'b10001;
    bitarray[9][2] = 5'b11111;
    bitarray[9][3] = 5'b00001;
    bitarray[9][4] = 5'b11111;

    // clear unused array entries
    for (i = 10; i <= 15; i++)
      for (j = 0; j <= 4; j++) 
        bitarray[i][j] = 0; 
  end
endmodule


/*
Video sync generator, used to drive a simulated CRT.
To use:
- Wire the hsync and vsync signals to top level outputs
- Add a 3-bit (or more) "rgb" output to the top level
*/

module hvsync_generator(clk, reset, hsync, vsync, display_on, hpos, vpos);

  input clk;
  input reset;
  output reg hsync, vsync;
  output display_on;
  output reg [8:0] hpos;
  output reg [8:0] vpos;

  // declarations for TV-simulator sync parameters
  // horizontal constants
  parameter H_DISPLAY       = 256; // horizontal display width
  parameter H_BACK          =  23; // horizontal left border (back porch)
  parameter H_FRONT         =   7; // horizontal right border (front porch)
  parameter H_SYNC          =  23; // horizontal sync width
  // vertical constants
  parameter V_DISPLAY       = 240; // vertical display height
  parameter V_TOP           =   5; // vertical top border
  parameter V_BOTTOM        =  14; // vertical bottom border
  parameter V_SYNC          =   3; // vertical sync # lines
  // derived constants
  parameter H_SYNC_START    = H_DISPLAY + H_FRONT;
  parameter H_SYNC_END      = H_DISPLAY + H_FRONT + H_SYNC - 1;
  parameter H_MAX           = H_DISPLAY + H_BACK + H_FRONT + H_SYNC - 1;
  parameter V_SYNC_START    = V_DISPLAY + V_BOTTOM;
  parameter V_SYNC_END      = V_DISPLAY + V_BOTTOM + V_SYNC - 1;
  parameter V_MAX           = V_DISPLAY + V_TOP + V_BOTTOM + V_SYNC - 1;

  wire hmaxxed = (hpos == H_MAX) || reset;	// set when hpos is maximum
  wire vmaxxed = (vpos == V_MAX) || reset;	// set when vpos is maximum
  
  // horizontal position counter
  always @(posedge clk)
  begin
    hsync <= (hpos>=H_SYNC_START && hpos<=H_SYNC_END);
    if(hmaxxed)
      hpos <= 0;
    else
      hpos <= hpos + 1;
  end

  // vertical position counter
  always @(posedge clk)
  begin
    vsync <= (vpos>=V_SYNC_START && vpos<=V_SYNC_END);
    if(hmaxxed)
      if (vmaxxed)
        vpos <= 0;
      else
        vpos <= vpos + 1;
  end
  
  // display_on is set when beam is in "safe" visible frame
  assign display_on = (hpos<H_DISPLAY) && (vpos<V_DISPLAY);

endmodule


/*
A brick-smashing ball-and-paddle game.
*/

module ball_paddle_top(clk, reset, hpaddle, hsync, vsync);

  input clk;
  input reset;
  input hpaddle;
  output hsync, vsync;
  reg [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  reg [8:0] paddle_pos;	// paddle X position
  
  reg [8:0] ball_x;	// ball X position
  reg [8:0] ball_y;	// ball Y position
  reg ball_dir_x;	// ball X direction (0=left, 1=right)
  reg ball_speed_x;	// ball speed (0=1 pixel/frame, 1=2 pixels/frame)
  reg ball_dir_y;	// ball Y direction (0=up, 1=down)
  
  reg brick_array [0:BRICKS_H*BRICKS_V-1]; // 16*8 = 128 bits

  wire [3:0] score0;	// score right digit
  wire [3:0] score1;	// score left digit
  wire [3:0] lives;	// # lives remaining
  reg incscore;		// incscore signal 
  reg declives = 0; // TODO
  
  localparam BRICKS_H = 16;	// # of bricks across
  localparam BRICKS_V = 8;	// # of bricks down

  localparam BALL_DIR_LEFT = 0;
  localparam BALL_DIR_RIGHT = 1;
  localparam BALL_DIR_DOWN = 1;
  localparam BALL_DIR_UP = 0;
  
  localparam PADDLE_WIDTH = 31;	// horizontal paddle size
  localparam BALL_SIZE = 6;	// square ball size

  // video sync generator  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  // scoreboard
  wire score_gfx; // output from score generator
  player_stats stats(
    .reset(reset),
    .score0(score0),
    .score1(score1),
    .incscore(incscore),
    .lives(lives),
    .declives(declives)
  );

  scoreboard_generator score_gen(
    .score0(score0),
    .score1(score1),
    .lives(lives),
    .vpos(vpos),
    .hpos(hpos), 
    .board_gfx(score_gfx)
  );

  wire [5:0] hcell = hpos[8:3];		// horizontal brick index
  wire [5:0] vcell = vpos[8:3];		// vertical brick index
  wire lr_border = hcell==0 || hcell==31; // along horizontal border?

  // TODO: unsigned compare doesn't work in JS
  wire [8:0] paddle_rel_x = ((hpos-paddle_pos) & 9'h1ff);

  // player paddle graphics signal
  wire paddle_gfx = (vcell == 28) && (paddle_rel_x < PADDLE_WIDTH);

  // difference between ball position and video beam
  wire [8:0] ball_rel_x = (hpos - ball_x);
  wire [8:0] ball_rel_y = (vpos - ball_y);

  // ball graphics signal
  wire ball_gfx = ball_rel_x < BALL_SIZE
  	       && ball_rel_y < BALL_SIZE;

  reg main_gfx;		// main graphics signal (bricks and borders)
  reg brick_present;	// 1 when we are drawing a brick
  reg [6:0] brick_index;// index into array of current brick
  // brick graphics signal
  wire brick_gfx = lr_border || (brick_present && vpos[2:0] != 0 && hpos[3:1] != 4);
  
  // scan bricks: compute brick_index and brick_present flag
  always @(posedge clk)
    // see if we are scanning brick area
    if (vpos[8:6] == 1 && !lr_border)
    begin
      // every 16th pixel, starting at 8
      if (hpos[3:0] == 8) begin
        // compute brick index
        brick_index <= {vpos[5:3], hpos[7:4]};
      end
      // every 17th pixel
      else if (hpos[3:0] == 9) begin
        // load brick bit from array
        brick_present <= !brick_array[brick_index];
      end
    end else begin
      brick_present <= 0;
    end
  
  // only works when paddle at bottom of screen!
  // (we don't want to mess w/ paddle position during visible portion)
  always @(posedge hsync)
    if (!hpaddle)
      paddle_pos <= vpos;

  // 1 when ball signal intersects main (brick + border) signal
  wire ball_pixel_collide = main_gfx & ball_gfx;
  
  reg ball_collide_paddle = 0;
  reg [3:0] ball_collide_bits = 0;

  // compute ball collisions with paddle and playfield
  always @(posedge clk)
    // clear all collide bits for frame
    if (vsync) begin
      ball_collide_bits <= 0; 
      ball_collide_paddle <= 0;
    end else begin
      if (ball_pixel_collide) begin
        // did we collide w/ paddle?
        if (paddle_gfx) begin
          ball_collide_paddle <= 1;
        end
        // ball has 4 collision quadrants
        if (!ball_rel_x[2] & !ball_rel_y[2]) ball_collide_bits[0] <= 1;
        if (ball_rel_x[2] & !ball_rel_y[2]) ball_collide_bits[1] <= 1;
        if (!ball_rel_x[2] & ball_rel_y[2]) ball_collide_bits[2] <= 1;
        if (ball_rel_x[2] & ball_rel_y[2]) ball_collide_bits[3] <= 1;
      end
    end

  // compute ball collisions with brick and increment score
  always @(posedge clk)
    if (ball_pixel_collide && brick_present) begin
      brick_array[brick_index] <= 1;
      incscore <= 1; // increment score
    end else begin
      incscore <= 0; // reset incscore
    end

  // computes position of ball in relation to center of paddle
  wire signed [8:0] ball_paddle_dx = ball_x - paddle_pos + 8;

  // ball bounce: determine new velocity/direction
  always @(posedge vsync or posedge reset)
    begin
      if (reset) begin
        ball_dir_y <= BALL_DIR_DOWN;
      end else
      // ball collided with paddle?
      if (ball_collide_paddle) begin 
        // bounces upward off of paddle
        ball_dir_y <= BALL_DIR_UP;
        // which side of paddle, left/right?
        ball_dir_x <= (ball_paddle_dx < 20) ? BALL_DIR_LEFT : BALL_DIR_RIGHT;
        // hitting with edge of paddle makes it fast
        ball_speed_x <= ball_collide_bits[3:0] != 4'b1100;
      end else begin
        // collided with playfield
        // TODO: can still slip through corners
        // compute left/right bounce
        casez (ball_collide_bits[3:0])
          4'b01?1: ball_dir_x <= BALL_DIR_RIGHT; // left edge/corner
          4'b1101: ball_dir_x <= BALL_DIR_RIGHT; // left corner
          4'b101?: ball_dir_x <= BALL_DIR_LEFT; // right edge/corner
          4'b1110: ball_dir_x <= BALL_DIR_LEFT; // right corner
          default: ;
        endcase
        // compute top/bottom bounce
        casez (ball_collide_bits[3:0])
          4'b1011: ball_dir_y <= BALL_DIR_DOWN;
          4'b0111: ball_dir_y <= BALL_DIR_DOWN;
          4'b001?: ball_dir_y <= BALL_DIR_DOWN;
          4'b0001: ball_dir_y <= BALL_DIR_DOWN;
          4'b0100: ball_dir_y <= BALL_DIR_UP;
          4'b1?00: ball_dir_y <= BALL_DIR_UP;
          4'b1101: ball_dir_y <= BALL_DIR_UP;
          4'b1110: ball_dir_y <= BALL_DIR_UP;
          default: ;
        endcase
      end
    end
  
  // ball motion: update ball position
  always @(negedge vsync or posedge reset)
    begin
      if (reset) begin
        // reset ball position to top center
        ball_x <= 128;
        ball_y <= 180;
      end else begin
        // move ball horizontal and vertical position
        if (ball_dir_x == BALL_DIR_RIGHT)
          ball_x <= ball_x + (ball_speed_x?1:0) + 1;
        else
          ball_x <= ball_x - (ball_speed_x?1:0) - 1;
        ball_y <= ball_y + (ball_dir_y==BALL_DIR_DOWN?1:-1);
      end
    end
  
  // compute main_gfx
  always @(*)
    begin
      case (vpos[8:3])
        0,1,2: main_gfx = score_gfx; // scoreboard
        3: main_gfx = 0;
        4: main_gfx = 1; // top border
        8,9,10,11,12,13,14,15: main_gfx = brick_gfx; // brick rows 1-8
        28: main_gfx = paddle_gfx | lr_border; // paddle
        29: main_gfx = hpos[0] ^ vpos[0]; // bottom border
        default: main_gfx = lr_border; // left/right borders
      endcase
    end

  // combine signals to RGB output
  wire grid_gfx = (((hpos&7)==0) || ((vpos&7)==0));
  wire r = display_on && (ball_gfx | paddle_gfx);
  wire g = display_on && (main_gfx | ball_gfx);
  wire b = display_on && (grid_gfx | ball_gfx | brick_present);
  assign rgb = {b,g,r};
  
  always @(negedge reset) begin
    if (score0 != 0 || score1 != 0 || lives != 3) $stop;
  end

endmodule
