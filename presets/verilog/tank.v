`include "hvsync_generator.v"

module minefield(hpos, vpos, mine_gfx);

  input [8:0] hpos;
  input [8:0] vpos;
  output mine_gfx;
  
  // mine X coordinates in ROM
  reg [3:0] mine_xpos [0:15];
  
  // 1 bit for each mine
  reg [15:0] mine_exploded;

  // screen-wide pattern for mines
  wire mine_pattern = ~(hpos[0] ^ hpos[1]) ^ (vpos[0] ^ vpos[1]) 
                     && hpos[2] && vpos[2];
  
  // limit mine pattern to a rectangular window
  wire mine_field = (hpos >= 64 && hpos < 160)
  && (vpos >= 48 && vpos < 176)
  && mine_pattern;
  
  // index for each of the 16 mines in window
  wire [3:0] mine_vindex = vpos[6:3]^8;
  
  // select only 1 mine per horizontal slice
  wire mine_all = (hpos[6:3]==(mine_xpos[mine_vindex]^8))
  && mine_field;

  // only show mines that haven't exploded
  wire mine_gfx = mine_all && !mine_exploded[mine_vindex];

  initial begin
    mine_exploded = 0;
    mine_xpos[0] = 2;
    mine_xpos[1] = 10;
    mine_xpos[2] = 6;
    mine_xpos[3] = 0;
    mine_xpos[4] = 9;
    mine_xpos[5] = 3;
    mine_xpos[6] = 7;
    mine_xpos[7] = 11;
    mine_xpos[8] = 4;
    mine_xpos[9] = 1;
    mine_xpos[10] = 10;
    mine_xpos[11] = 5;
    mine_xpos[12] = 11;
    mine_xpos[13] = 3;
    mine_xpos[14] = 8;
    mine_xpos[15] = 0;
  end

endmodule

module playfield(hpos, vpos, playfield_gfx);
  
  input [8:0] hpos;
  input [8:0] vpos;
  output playfield_gfx;
  
  reg [31:0] maze [0:27];
  
  wire [4:0] x = hpos[7:3];
  wire [4:0] y = vpos[7:3] - 2;
  
  assign playfield_gfx = maze[y][x];
  
  initial begin/*{w:32,h:28,bpw:32}*/
    maze[0]  = 32'b11111111111111111111111111111111;
    maze[1]  = 32'b10000000000100000000001000000001;
    maze[2]  = 32'b10000000000100000000001000000001;
    maze[3]  = 32'b10000000000100000000000000000001;
    maze[4]  = 32'b10011110000000000000000000000001;
    maze[5]  = 32'b10000000000000000000000011111001;
    maze[6]  = 32'b10000000001000000000000000100001;
    maze[7]  = 32'b11100010000000000000000000100001;
    maze[8]  = 32'b10000010000000000000000000000001;
    maze[9]  = 32'b10000011100000000000000000000001;
    maze[10] = 32'b10000000000000000000000000000001;
    maze[11] = 32'b10000000000000000000000000000001;
    maze[12] = 32'b11111000001000000000000000000001;
    maze[13] = 32'b10001000001000000000000111100001;
    maze[14] = 32'b10001110001000000000000000000001;
    maze[15] = 32'b10000000001000000000000000000001;
    maze[16] = 32'b10000000001000000000000000000001;
    maze[17] = 32'b10001111000000000000000000000001;
    maze[18] = 32'b10000000000000000000000100011001;
    maze[19] = 32'b10000000000000000000000100010001;
    maze[20] = 32'b10000001001000000000000100010001;
    maze[21] = 32'b10000001001110000000000100000001;
    maze[22] = 32'b10000001000000000010001100000001;
    maze[23] = 32'b10001000000000000000000000000001;
    maze[24] = 32'b10001000000111100000000000010001;
    maze[25] = 32'b10001000000000100000000000010001;
    maze[26] = 32'b10001000000000000010000000010001;
    maze[27] = 32'b11111111111111111111111111111111;
  end
  
endmodule

module mine_test_top(clk, hsync, vsync, rgb);

  input clk;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  wire mine_gfx;
  wire playfield_gfx;

  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(0),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  minefield mine_gen(
    .hpos(hpos),
    .vpos(vpos),
    .mine_gfx(mine_gfx)
  );

  playfield playfield_gen(
    .hpos(hpos),
    .vpos(vpos),
    .playfield_gfx(playfield_gfx)
  );

  wire r = display_on && mine_gfx;
  wire g = display_on && playfield_gfx;
  wire b = display_on && 0;
  assign rgb = {b,g,r};
  
endmodule
