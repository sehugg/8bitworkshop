`include "hvsync_generator.v"

module tank_bitmap(addr, bits);
  
  input [7:0] addr;
  output [7:0] bits;
  
  reg [15:0] bitarray[256];
  
  assign bits = (addr[0]) ? bitarray[addr>>1][15:8] : bitarray[addr>>1][7:0];
  
  initial begin/*{w:16,h:16,bpw:16,count:5}*/
    bitarray[0'h00] = 16'b11110000000;
    bitarray[0'h01] = 16'b11110000000;
    bitarray[0'h02] = 16'b1100000000;
    bitarray[0'h03] = 16'b1100000000;
    bitarray[0'h04] = 16'b111101101111000;
    bitarray[0'h05] = 16'b111101101111000;
    bitarray[0'h06] = 16'b111111111111000;
    bitarray[0'h07] = 16'b111111111111000;
    bitarray[0'h08] = 16'b111111111111000;
    bitarray[0'h09] = 16'b111111111111000;
    bitarray[0'h0a] = 16'b111111111111000;
    bitarray[0'h0b] = 16'b111100001111000;
    bitarray[0'h0c] = 16'b111100001111000;
    bitarray[0'h0d] = 16'b0;
    bitarray[0'h0e] = 16'b0;
    bitarray[0'h0f] = 16'b0;
    
    bitarray[0'h10] = 16'b111000000000;
    bitarray[0'h11] = 16'b1111000000000;
    bitarray[0'h12] = 16'b1111000000000;
    bitarray[0'h13] = 16'b11000000000;
    bitarray[0'h14] = 16'b11101110000;
    bitarray[0'h15] = 16'b1101110000;
    bitarray[0'h16] = 16'b111101111110000;
    bitarray[0'h17] = 16'b111101111111000;
    bitarray[0'h18] = 16'b111111111111000;
    bitarray[0'h19] = 16'b11111111111000;
    bitarray[0'h1a] = 16'b11111111111100;
    bitarray[0'h1b] = 16'b11111111111100;
    bitarray[0'h1c] = 16'b11111001111100;
    bitarray[0'h1d] = 16'b1111001110000;
    bitarray[0'h1e] = 16'b1111000000000;
    bitarray[0'h1f] = 16'b1100000000000;
    
    bitarray[0'h20] = 16'b0;
    bitarray[0'h21] = 16'b0;
    bitarray[0'h22] = 16'b11000011000000;
    bitarray[0'h23] = 16'b111000111100000;
    bitarray[0'h24] = 16'b111101111110000;
    bitarray[0'h25] = 16'b1110111111000;
    bitarray[0'h26] = 16'b111111111100;
    bitarray[0'h27] = 16'b11111111110;
    bitarray[0'h28] = 16'b11011111111110;
    bitarray[0'h29] = 16'b111111111111100;
    bitarray[0'h2a] = 16'b111111111001000;
    bitarray[0'h2b] = 16'b11111110000000;
    bitarray[0'h2c] = 16'b1111100000000;
    bitarray[0'h2d] = 16'b111110000000;
    bitarray[0'h2e] = 16'b11110000000;
    bitarray[0'h2f] = 16'b1100000000;

    bitarray[0'h30] = 16'b0;
    bitarray[0'h31] = 16'b0;
    bitarray[0'h32] = 16'b110000000;
    bitarray[0'h33] = 16'b100001111000000;
    bitarray[0'h34] = 16'b1110001111110000;
    bitarray[0'h35] = 16'b1111010111111100;
    bitarray[0'h36] = 16'b1111111111111111;
    bitarray[0'h37] = 16'b1111111111111;
    bitarray[0'h38] = 16'b11111111110;
    bitarray[0'h39] = 16'b101111111110;
    bitarray[0'h3a] = 16'b1111111101100;
    bitarray[0'h3b] = 16'b11111111000000;
    bitarray[0'h3c] = 16'b1111111100000;
    bitarray[0'h3d] = 16'b11111110000;
    bitarray[0'h3e] = 16'b111100000;
    bitarray[0'h3f] = 16'b1100000;

    bitarray[0'h40] = 16'b0;
    bitarray[0'h41] = 16'b0;
    bitarray[0'h42] = 16'b0;
    bitarray[0'h43] = 16'b111111111000;
    bitarray[0'h44] = 16'b111111111000;
    bitarray[0'h45] = 16'b111111111000;
    bitarray[0'h46] = 16'b111111111000;
    bitarray[0'h47] = 16'b1100001111100000;
    bitarray[0'h48] = 16'b1111111111100000;
    bitarray[0'h49] = 16'b1111111111100000;
    bitarray[0'h4a] = 16'b1100001111100000;
    bitarray[0'h4b] = 16'b111111111000;
    bitarray[0'h4c] = 16'b111111111000;
    bitarray[0'h4d] = 16'b111111111000;
    bitarray[0'h4e] = 16'b111111111000;
    bitarray[0'h4f] = 16'b0;
  end
endmodule

module sprite_renderer(clk, vstart, load, hstart, rom_addr, rom_bits, 
                       hmirror, vmirror,
                       gfx, busy);
  
  input clk, vstart, load, hstart;
  input hmirror, vmirror;
  output [4:0] rom_addr;
  input [7:0] rom_bits;
  output gfx;
  output busy = state != WAIT_FOR_VSTART;

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

module rotation_selector(rotation, bitmap_num, hmirror, vmirror);
  input [3:0] rotation;
  output [2:0] bitmap_num;
  output hmirror, vmirror;
  
  always @(*)
    case (rotation[3:2])
      0: begin
        bitmap_num = {1'b0, rotation[1:0]};
        hmirror = 0;
        vmirror = 0;
      end
      1: begin
        bitmap_num = -rotation[2:0];
        hmirror = 0;
        vmirror = 1;
      end
      2: begin
        bitmap_num = {1'b0, rotation[1:0]};
        hmirror = 1;
        vmirror = 1;
      end
      3: begin
        bitmap_num = -rotation[2:0];
        hmirror = 1;
        vmirror = 0;
      end
    endcase

endmodule

function signed [7:0] sin_16x4;
  input [3:0] in;
  integer y;
  case (in[1:0])
    0: y = 0;
    1: y = 3;
    2: y = 5;
    3: y = 6;
  endcase
  case (in[3:2])
    0: sin_16x4 = 8'(y);
    1: sin_16x4 = 8'(7-y);
    2: sin_16x4 = 8'(-y);
    3: sin_16x4 = 8'(y-7);
  endcase
endfunction

module tank_controller(clk, reset, hpos, vpos, hsync, vsync, 
                       sprite_addr, sprite_bits, gfx,
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
  input switch_left, switch_right, switch_up;
  
  wire hmirror, vmirror;
  wire busy;

  reg [11:0] player_x_fixed;
  wire [7:0] player_x = player_x_fixed[11:4];
  wire [3:0] player_x_frac = player_x_fixed[3:0];
  
  reg [11:0] player_y_fixed;
  wire [7:0] player_y = player_y_fixed[11:4];
  wire [3:0] player_y_frac = player_y_fixed[3:0];
  
  reg [3:0] player_rot;
  reg [3:0] player_speed = 0;
  reg [3:0] frame = 0;
  
  wire vstart = {1'b0,player_y} == vpos;
  wire hstart = {1'b0,player_x} == hpos;

  sprite_renderer renderer(
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
    if (reset) begin
      player_rot <= 0;
    end else begin
      frame <= frame + 1;
      // rotation
      if (frame[0]) begin
        if (switch_left)
          player_rot <= player_rot - 1;
        else if (switch_right)
          player_rot <= player_rot + 1;
        if (switch_up) begin
          if (player_speed != 15)
            player_speed <= player_speed + 1;
        end else
          player_speed <= 0;
      end
    end
  
  always @(posedge hsync or posedge reset)
    if (reset) begin
      player_x_fixed <= 128<<4;
      player_y_fixed <= 120<<4;
    end else begin
      // movement
      if (vpos < 9'(player_speed)) begin
        if (vpos[0])
          player_x_fixed <= player_x_fixed + 12'(sin_16x4(player_rot));
        else
          player_y_fixed <= player_y_fixed - 12'(sin_16x4(player_rot+4));
      end
    end

endmodule

//TODO: debouncing

module test_top(clk, reset, hsync, vsync, rgb, switches_p1);

  input clk;
  input reset;
  output hsync;
  output vsync;
  output [2:0] rgb;
  input [7:0] switches_p1;
  
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;

  reg [7:0] paddle_x;
  reg [7:0] paddle_y;
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  wire [7:0] tank_sprite_addr;
  wire [7:0] tank_sprite_bits;
  
  tank_bitmap tank_bmp(
    .addr(tank_sprite_addr), 
    .bits(tank_sprite_bits));
  
  tank_controller tank1(
    .clk(clk),
    .reset(reset),
    .hpos(hpos),
    .vpos(vpos),
    .hsync(hsync),
    .vsync(vsync),
    .sprite_addr(tank_sprite_addr), 
    .sprite_bits(tank_sprite_bits),
    .gfx(tank1_gfx),
    .switch_left(switches_p1[0]),
    .switch_right(switches_p1[1]),
    .switch_up(switches_p1[2])
  );
  
  wire tank1_gfx;
  wire unused;
  
  wire r = display_on && tank1_gfx;
  wire g = display_on && tank1_gfx;
  wire b = display_on && tank1_gfx;
  assign rgb = {b,g,r};

endmodule
