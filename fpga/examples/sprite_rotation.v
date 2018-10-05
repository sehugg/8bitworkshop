
`ifndef SPRITE_ROTATION_H
`define SPRITE_ROTATION_H

`include "hvsync_generator.v"

/*
tank_bitmap - ROM for tank bitmaps (5 different rotations)
sprite_renderer2 - Displays a 16x16 sprite.
tank_controller - Handles display and movement for one tank.
*/

module tank_bitmap(addr, bits);
  
  input [7:0] addr;
  output [7:0] bits;
  
  reg [15:0] bitarray[0:255];
  
  assign bits = (addr[0]) ? bitarray[addr>>1][15:8] : bitarray[addr>>1][7:0];
  
  initial begin/*{w:16,h:16,bpw:16,count:5}*/
    bitarray['h00] = 16'b11110000000;
    bitarray['h01] = 16'b11110000000;
    bitarray['h02] = 16'b1100000000;
    bitarray['h03] = 16'b1100000000;
    bitarray['h04] = 16'b111101101111000;
    bitarray['h05] = 16'b111101101111000;
    bitarray['h06] = 16'b111111111111000;
    bitarray['h07] = 16'b111111111111000;
    bitarray['h08] = 16'b111111111111000;
    bitarray['h09] = 16'b111111111111000;
    bitarray['h0a] = 16'b111111111111000;
    bitarray['h0b] = 16'b111100001111000;
    bitarray['h0c] = 16'b111100001111000;
    bitarray['h0d] = 16'b0;
    bitarray['h0e] = 16'b0;
    bitarray['h0f] = 16'b0;
    
    bitarray['h10] = 16'b111000000000;
    bitarray['h11] = 16'b1111000000000;
    bitarray['h12] = 16'b1111000000000;
    bitarray['h13] = 16'b11000000000;
    bitarray['h14] = 16'b11101110000;
    bitarray['h15] = 16'b1101110000;
    bitarray['h16] = 16'b111101111110000;
    bitarray['h17] = 16'b111101111111000;
    bitarray['h18] = 16'b111111111111000;
    bitarray['h19] = 16'b11111111111000;
    bitarray['h1a] = 16'b11111111111100;
    bitarray['h1b] = 16'b11111111111100;
    bitarray['h1c] = 16'b11111001111100;
    bitarray['h1d] = 16'b1111001110000;
    bitarray['h1e] = 16'b1111000000000;
    bitarray['h1f] = 16'b1100000000000;
    
    bitarray['h20] = 16'b0;
    bitarray['h21] = 16'b0;
    bitarray['h22] = 16'b11000011000000;
    bitarray['h23] = 16'b111000111100000;
    bitarray['h24] = 16'b111101111110000;
    bitarray['h25] = 16'b1110111111000;
    bitarray['h26] = 16'b111111111100;
    bitarray['h27] = 16'b11111111110;
    bitarray['h28] = 16'b11011111111110;
    bitarray['h29] = 16'b111111111111100;
    bitarray['h2a] = 16'b111111111001000;
    bitarray['h2b] = 16'b11111110000000;
    bitarray['h2c] = 16'b1111100000000;
    bitarray['h2d] = 16'b111110000000;
    bitarray['h2e] = 16'b11110000000;
    bitarray['h2f] = 16'b1100000000;

    bitarray['h30] = 16'b0;
    bitarray['h31] = 16'b0;
    bitarray['h32] = 16'b110000000;
    bitarray['h33] = 16'b100001111000000;
    bitarray['h34] = 16'b1110001111110000;
    bitarray['h35] = 16'b1111010111111100;
    bitarray['h36] = 16'b1111111111111111;
    bitarray['h37] = 16'b1111111111111;
    bitarray['h38] = 16'b11111111110;
    bitarray['h39] = 16'b101111111110;
    bitarray['h3a] = 16'b1111111101100;
    bitarray['h3b] = 16'b11111111000000;
    bitarray['h3c] = 16'b1111111100000;
    bitarray['h3d] = 16'b11111110000;
    bitarray['h3e] = 16'b111100000;
    bitarray['h3f] = 16'b1100000;

    bitarray['h40] = 16'b0;
    bitarray['h41] = 16'b0;
    bitarray['h42] = 16'b0;
    bitarray['h43] = 16'b111111111000;
    bitarray['h44] = 16'b111111111000;
    bitarray['h45] = 16'b111111111000;
    bitarray['h46] = 16'b111111111000;
    bitarray['h47] = 16'b1100001111100000;
    bitarray['h48] = 16'b1111111111100000;
    bitarray['h49] = 16'b1111111111100000;
    bitarray['h4a] = 16'b1100001111100000;
    bitarray['h4b] = 16'b111111111000;
    bitarray['h4c] = 16'b111111111000;
    bitarray['h4d] = 16'b111111111000;
    bitarray['h4e] = 16'b111111111000;
    bitarray['h4f] = 16'b0;
  end
endmodule

// 16x16 sprite renderer that supports rotation
module sprite_renderer2(clk, vstart, load, hstart, rom_addr, rom_bits, 
                       hmirror, vmirror,
                       gfx, busy);
  
  input clk, vstart, load, hstart;
  input hmirror, vmirror;
  output [4:0] rom_addr;
  input [7:0] rom_bits;
  output gfx;
  output busy;
  
  assign busy = state != WAIT_FOR_VSTART;

  reg [2:0] state;
  reg [3:0] ycount;
  reg [3:0] xcount;
  
  reg [15:0] outbits;
  
  localparam WAIT_FOR_VSTART = 0;
  localparam WAIT_FOR_LOAD   = 1;
  localparam LOAD1_SETUP     = 2;
  localparam LOAD1_FETCH     = 3;
  localparam LOAD2_SETUP     = 4;
  localparam LOAD2_FETCH     = 5;
  localparam WAIT_FOR_HSTART = 6;
  localparam DRAW            = 7;
  
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
          rom_addr <= {vmirror?~ycount:ycount, 1'b0};
          state <= LOAD1_FETCH;
        end
        LOAD1_FETCH: begin
	  outbits[7:0] <= rom_bits;
          state <= LOAD2_SETUP;
        end
        LOAD2_SETUP: begin
          rom_addr <= {vmirror?~ycount:ycount, 1'b1};
          state <= LOAD2_FETCH;
        end
        LOAD2_FETCH: begin
          outbits[15:8] <= rom_bits;
          state <= WAIT_FOR_HSTART;
        end
        WAIT_FOR_HSTART: begin
          if (hstart) state <= DRAW;
        end
        DRAW: begin
          // mirror graphics left/right
          gfx <= outbits[hmirror ? ~xcount[3:0] : xcount[3:0]];
          xcount <= xcount + 1;
          if (xcount == 15) begin // pre-increment value
            ycount <= ycount + 1;
            if (ycount == 15) // pre-increment value
              state <= WAIT_FOR_VSTART; // done drawing sprite
            else
	      state <= WAIT_FOR_LOAD; // done drawing this scanline
          end
        end
      endcase
    end
  
endmodule

// converts 0..15 rotation value to bitmap index / mirror bits
module rotation_selector(rotation, bitmap_num, hmirror, vmirror);
  
  input [3:0] rotation;	   // angle (0..15)
  output [2:0] bitmap_num; // bitmap index (0..4)
  output hmirror, vmirror; // horiz & vert mirror bits
  
  always @(*)
    case (rotation[3:2])	// 4 quadrants
      0: begin			// 0..3 -> 0..3
        bitmap_num = {1'b0, rotation[1:0]};
        hmirror = 0;
        vmirror = 0;
      end
      1: begin			// 4..7 -> 4..1
        bitmap_num = -rotation[2:0];
        hmirror = 0;
        vmirror = 1;
      end
      2: begin			// 8-11 -> 0..3
        bitmap_num = {1'b0, rotation[1:0]};
        hmirror = 1;
        vmirror = 1;
      end
      3: begin			// 12-15 -> 4..1
        bitmap_num = -rotation[2:0];
        hmirror = 1;
        vmirror = 0;
      end
    endcase

endmodule

// tank controller module -- handles rendering and movement
module tank_controller(clk, reset, hpos, vpos, hsync, vsync, 
                       sprite_addr, sprite_bits, gfx,
                       playfield,
                      switch_left, switch_right, switch_up);
  
  input clk;
  input reset;
  input hsync;
  input vsync;
  input [8:0] hpos;
  input [8:0] vpos;
  output [7:0] sprite_addr;
  input [7:0] sprite_bits;
  output gfx;
  input playfield;
  input switch_left, switch_right, switch_up;
  
  parameter initial_x = 128;
  parameter initial_y = 120;
  parameter initial_rot = 0;
  
  wire hmirror, vmirror;
  wire busy;
  wire collision_gfx = gfx && playfield;

  reg [11:0] player_x_fixed;
  wire [7:0] player_x = player_x_fixed[11:4];
  wire [3:0] player_x_frac = player_x_fixed[3:0];
  
  reg [11:0] player_y_fixed;
  wire [7:0] player_y = player_y_fixed[11:4];
  wire [3:0] player_y_frac = player_y_fixed[3:0];
  
  reg [3:0] player_rot;
  reg [3:0] player_speed;
  reg [3:0] frame = 0;
  
  wire vstart = {1'b0,player_y} == vpos;
  wire hstart = {1'b0,player_x} == hpos;

  sprite_renderer2 renderer(
    .clk(clk),
    .vstart(vstart),
    .load(hsync),
    .hstart(hstart),
    .hmirror(hmirror),
    .vmirror(vmirror),
    .rom_addr(sprite_addr[4:0]),
    .rom_bits(sprite_bits),
    .gfx(gfx),
    .busy(busy));
  
  rotation_selector rotsel(
    .rotation(player_rot),
    .bitmap_num(sprite_addr[7:5]),
    .hmirror(hmirror),
    .vmirror(vmirror));

  always @(posedge vsync or posedge reset)
  begin
    if (reset) begin
      player_rot <= initial_rot;
      player_speed <= 0;
    end else begin
      frame <= frame + 1; // increment frame counter
      if (frame[0]) begin // only update every other frame
        if (switch_left)
          player_rot <= player_rot - 1; // turn left
        else if (switch_right)
          player_rot <= player_rot + 1; // turn right
        if (switch_up) begin
          if (player_speed != 15) // max accel
            player_speed <= player_speed + 1;
        end else
          player_speed <= 0; // stop
      end
    end
  end
  
  // set if collision; cleared at vsync
  reg collision_detected; 
  
  always @(posedge clk)
    if (vstart)
      collision_detected <= 0;
    else if (collision_gfx)
      collision_detected <= 1;
  
  // sine lookup (4 bits input, 4 signed bits output)  
  function signed [3:0] sin_16x4;
    input [3:0] in;	// input angle 0..15
    integer y;
    case (in[1:0])	// 4 values per quadrant
      0: y = 0;
      1: y = 3;
      2: y = 5;
      3: y = 6;
    endcase
    case (in[3:2])	// 4 quadrants
      0: sin_16x4 = 4'(y);
      1: sin_16x4 = 4'(7-y);
      2: sin_16x4 = 4'(-y);
      3: sin_16x4 = 4'(y-7);
    endcase
  endfunction
  
  always @(posedge hsync or posedge reset)
    if (reset) begin
      // set initial position
      player_x_fixed <= initial_x << 4;
      player_y_fixed <= initial_y << 4;
    end else begin
      // collision detected? move backwards
      if (collision_detected && vpos[3:1] == 0) begin
        if (vpos[0])
          player_x_fixed <= player_x_fixed + 12'(sin_16x4(player_rot+8));
        else
          player_y_fixed <= player_y_fixed - 12'(sin_16x4(player_rot+12));
      end else
      // forward movement
      if (vpos < 9'(player_speed)) begin
        if (vpos[0])
          player_x_fixed <= player_x_fixed + 12'(sin_16x4(player_rot));
        else
          player_y_fixed <= player_y_fixed - 12'(sin_16x4(player_rot+4));
      end
    end

endmodule

