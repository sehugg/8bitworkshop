`include "hvsync_generator.v"
`include "digits10.v"
`include "scoreboard.v"

module ball_paddle_top(clk, reset, hpaddle, hsync, vsync, rgb);

  input clk;
  input reset;
  input hpaddle;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  reg [8:0] paddle_pos;
  
  reg [8:0] ball_x;
  reg [8:0] ball_y;
  reg ball_dir_x;
  reg ball_speed_x;
  reg ball_dir_y;
  
  reg brick_array [BRICKS_H * BRICKS_V];

  wire [3:0] score0;
  wire [3:0] score1;
  wire [3:0] lives;
  reg incscore;
  reg declives = 0; // TODO
  
  localparam BRICKS_H = 16;
  localparam BRICKS_V = 8;

  localparam BALL_DIR_LEFT = 0;
  localparam BALL_DIR_RIGHT = 1;

  localparam BALL_DIR_DOWN = 1;
  localparam BALL_DIR_UP = 0;
  
  localparam PADDLE_WIDTH = 31;
  localparam BALL_SIZE = 6;
  
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

  player_stats stats(.reset(reset), 
                     .score0(score0), .score1(score1), .incscore(incscore),
                     .lives(lives), .declives(declives));

  wire score_gfx;
  
  scoreboard_generator score_gen(
    .score0(score0), .score1(score1), .lives(lives),
    .vpos(vpos), .hpos(hpos), 
    .board_gfx(score_gfx));

  wire [5:0] hcell = hpos[8:3];
  wire [5:0] vcell = vpos[8:3];
  wire lr_border = hcell==0 || hcell==31;

  // TODO: unsigned compare doesn't work in JS
  wire [8:0] paddle_rel_x = ((hpos-paddle_pos) & 9'h1ff);
  wire paddle_gfx = (vcell == 28) && (paddle_rel_x < PADDLE_WIDTH);

  wire [8:0] ball_rel_x = (hpos-ball_x);
  wire [8:0] ball_rel_y = (vpos-ball_y);
  
  wire ball_gfx = ball_rel_x < BALL_SIZE
  	       && ball_rel_y < BALL_SIZE;

  reg main_gfx;
  reg brick_present;
  reg [6:0] brick_index;
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
        //main_gfx <= 0; // 2 pixel horiz spacing between bricks
      end
      // every 17th pixel
      else if (hpos[3:0] == 9) begin
        // load brick bit from array
        brick_present <= brick_array[brick_index];
      end else begin
        //main_gfx <= brick_present && vpos[2:0] != 0; // 1 pixel vert. spacing
      end
    end else begin
      brick_present <= 0;
    end
  
  // only works when paddle at bottom of screen!
  // (we don't want to mess w/ paddle position during visible portion)
  always @(posedge hsync)
    if (!hpaddle)
      paddle_pos <= vpos;

  wire ball_pixel_collide = main_gfx & ball_gfx;
  
  /* verilator lint_off MULTIDRIVEN */
  reg ball_collide_paddle = 0;
  reg [3:0] ball_collide_bits = 0;
  /* verilator lint_on MULTIDRIVEN */

  // compute ball collisions with paddle and playfield
  always @(posedge clk)
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

  // compute ball collisions with brick and increment score
  always @(posedge clk)
    if (ball_pixel_collide && brick_present) begin
      brick_array[brick_index] <= 0;
      incscore <= 1; // increment score
    end else begin
      incscore <= 0; // reset incscore
    end

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
      ball_collide_bits <= 0; // clear all collide bits for frame
      ball_collide_paddle <= 0;
    end
  
  // ball motion: update ball position
  always @(negedge vsync or posedge reset)
    begin
      if (reset) begin
        ball_x <= 128;
        ball_y <= 180;
      end else begin
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
        0: main_gfx = score_gfx; // scoreboard
        1: main_gfx = score_gfx;
        2: main_gfx = score_gfx;
        3: main_gfx = 0;
        4: main_gfx = 1; // top border
        8: main_gfx = brick_gfx; // 1st brick row
        9: main_gfx = brick_gfx; // ...
        10: main_gfx = brick_gfx;
        11: main_gfx = brick_gfx;
        12: main_gfx = brick_gfx;
        13: main_gfx = brick_gfx;
        14: main_gfx = brick_gfx;
        15: main_gfx = brick_gfx; // 8th brick row
        28: main_gfx = paddle_gfx | lr_border; // paddle
        29: main_gfx = hpos[0] ^ vpos[0]; // bottom border
        default: main_gfx = lr_border; // left/right borders
      endcase
    end

  wire grid_gfx = (((hpos&7)==0) || ((vpos&7)==0));
  
  wire r = display_on && (ball_gfx | paddle_gfx);
  wire g = display_on && (main_gfx | ball_gfx);
  wire b = display_on && (grid_gfx | ball_gfx | brick_present);
  assign rgb = {b,g,r};

endmodule
