
`ifndef SPRITE_RENDERER_H
`define SPRITE_RENDERER_H

`include "hvsync_generator.v"
`include "sprite_bitmap.v"

/*
Displays a 16x16 sprite (8 bits mirrored left/right).
*/

module sprite_renderer(clk, vstart, load, hstart, rom_addr, rom_bits, 
                       gfx, in_progress);
  
  input clk;
  input vstart;		// start drawing (top border)
  input load;		// ok to load sprite data?
  input hstart;		// start drawing scanline (left border)
  output [3:0] rom_addr;	// select ROM address
  input [7:0] rom_bits;		// input bits from ROM
  output gfx;		// output pixel
  output in_progress;	// 0 if waiting for vstart
  
  reg [2:0] state;	// current state #
  reg [3:0] ycount;	// number of scanlines drawn so far
  reg [3:0] xcount;	// number of horiz. pixels in this line
  
  reg [7:0] outbits;	// register to store bits from ROM
  
  // states for state machine
  localparam WAIT_FOR_VSTART = 0;
  localparam WAIT_FOR_LOAD   = 1;
  localparam LOAD1_SETUP     = 2;
  localparam LOAD1_FETCH     = 3;
  localparam WAIT_FOR_HSTART = 4;
  localparam DRAW            = 5;

  // assign in_progress output bit
  assign in_progress = state != WAIT_FOR_VSTART;

  always @(posedge clk)
    begin
      case (state)
        WAIT_FOR_VSTART: begin
          ycount <= 0; // initialize vertical count
          gfx <= 0; // default pixel value (off)
          // wait for vstart, then next state
          if (vstart)
            state <= WAIT_FOR_LOAD;
        end
        WAIT_FOR_LOAD: begin
          xcount <= 0; // initialize horiz. count
	  gfx <= 0;
          // wait for load, then next state
          if (load)
            state <= LOAD1_SETUP;
        end
        LOAD1_SETUP: begin
          rom_addr <= ycount; // load ROM address
          state <= LOAD1_FETCH;
        end
        LOAD1_FETCH: begin
	  outbits <= rom_bits; // latch bits from ROM
          state <= WAIT_FOR_HSTART;
        end
        WAIT_FOR_HSTART: begin
          // wait for hstart, then start drawing
          if (hstart)
            state <= DRAW;
        end
        DRAW: begin
          // get pixel, mirroring graphics left/right
          gfx <= outbits[xcount<8 ? xcount[2:0] : ~xcount[2:0]];
          xcount <= xcount + 1;
          // finished drawing horizontal slice?
          if (xcount == 15) begin // pre-increment value
            ycount <= ycount + 1;
            // finished drawing sprite?
            if (ycount == 15) // pre-increment value
              state <= WAIT_FOR_VSTART; // done drawing sprite
            else
	      state <= WAIT_FOR_LOAD; // done drawing this scanline
          end
        end
        // unknown state -- reset
        default: begin
          state <= WAIT_FOR_VSTART; 
        end
      endcase
    end
  
endmodule

/// TEST MODULE

module sprite_render_test_top(clk, hsync, vsync, rgb, hpaddle, vpaddle);

  input clk;
  input hpaddle, vpaddle;
  output hsync, vsync;
  output [2:0] rgb;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;

  // player position
  reg [7:0] player_x;
  reg [7:0] player_y;
  
  // paddle position
  reg [7:0] paddle_x;
  reg [7:0] paddle_y;
  
  // video sync generator
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(0),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  // car bitmap ROM and associated wires
  wire [3:0] car_sprite_addr;
  wire [7:0] car_sprite_bits;
  
  car_bitmap car(
    .yofs(car_sprite_addr), 
    .bits(car_sprite_bits));
   
  // convert player X/Y to 9 bits and compare to CRT hpos/vpos
  wire vstart = {1'b0,player_y} == vpos;
  wire hstart = {1'b0,player_x} == hpos;
  
  wire car_gfx;		// car sprite video signal
  wire in_progress;	// 1 = rendering taking place on scanline

  // sprite renderer module
  sprite_renderer renderer(
    .clk(clk),
    .vstart(vstart),
    .load(hsync),
    .hstart(hstart),
    .rom_addr(car_sprite_addr),
    .rom_bits(car_sprite_bits),
    .gfx(car_gfx),
    .in_progress(in_progress));

  // measure paddle position
  always @(posedge hpaddle)
    paddle_x <= vpos[7:0];

  always @(posedge vpaddle)
    paddle_y <= vpos[7:0];

  always @(posedge vsync)
    begin
      player_x <= paddle_x;
      player_y <= paddle_y;
    end

  // video RGB output
  wire r = display_on && car_gfx;
  wire g = display_on && car_gfx;
  wire b = display_on && in_progress;
  assign rgb = {b,g,r};

endmodule

`endif
