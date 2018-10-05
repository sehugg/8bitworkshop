
`ifndef SPRITE_RENDERER_H
`define SPRITE_RENDERER_H

`include "hvsync_generator.v"
`include "sprite_bitmap.v"

/*
Displays a 16x16 sprite (8 bits mirrored left/right).
*/

module sprite_renderer(clk, reset,
                       vstart, load, hstart, rom_addr, rom_bits, 
                       gfx, in_progress);
  
  input clk;
  input reset;
  input vstart;		// start drawing (top border)
  input load;		// ok to load sprite data?
  input hstart;		// start drawing scanline (left border)
  output reg [3:0] rom_addr;	// select ROM address
  input [7:0] rom_bits;		// input bits from ROM
  output reg gfx;		// output pixel
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

  always @(posedge clk or posedge reset)
    if (reset) begin
      state <= WAIT_FOR_VSTART;
    end else begin
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

