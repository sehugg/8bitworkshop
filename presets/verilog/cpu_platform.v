
`include "hvsync_generator.v"
`include "font_cp437_8x8.v"
`include "ram.v"
`include "tile_renderer.v"
`include "sprite_scanline_renderer.v"
`include "lfsr.v"
`include "sound_generator.v"
`include "cpu16.v"

/*
A full video game console, with the following components:

  64 kilobytes (32,678 16-bit words) of RAM
  16-bit CPU running at 4.857 MHz
  32x30 tile graphics with 256 x 8 tile ROM
  32 16x16 sprites per frame with sprite ROM
  16 colors (two per tile, one per sprite)
  Two game controllers (four direction switches, two buttons)
  One paddle/analog stick controller
*/

module cpu_platform(clk, reset, hsync, vsync, 
                    hpaddle, vpaddle, 
                    switches_p1, switches_p2,
                    rgb);

  input clk, reset;
  input hpaddle, vpaddle;
  input [7:0] switches_p1;
  input [7:0] switches_p2;
  output hsync, vsync;
  output [3:0] rgb;

  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  
  // video RAM bus
  wire [15:0] ram_read;
  reg [15:0] ram_write;
  reg ram_writeenable;

  // multiplex sprite and tile RAM
  reg [15:0] tile_ram_addr;
  reg [5:0] sprite_ram_addr;
  wire tile_reading;
  wire sprite_reading;
  wire [14:0] mux_ram_addr; // 15-bit RAM access
  
  // multiplexor for sprite/tile/CPU RAM
  always @(*)
    if (cpu_busy) begin
      if (sprite_reading)
        mux_ram_addr = {9'b111111100, sprite_ram_addr};
      else
        mux_ram_addr = tile_ram_addr[14:0];
    end else
      mux_ram_addr = cpu_ram_addr[14:0];
  
  // tile and sprite ROM
  wire [10:0] tile_rom_addr;
  wire [7:0] tile_rom_data;
  wire [15:0] sprite_rom_addr;
  wire [15:0] sprite_rom_data;
  
  // gfx outputs
  wire [3:0] tile_rgb;
  wire [3:0] sprite_rgb;
  
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
 
  // RAM (32k x 16 bits)
  RAM_sync #(15,16) ram(
    .clk(clk),
    .dout(ram_read),
    .din(ram_write),
    .addr(mux_ram_addr),
    .we(ram_writeenable)
  );
  
  // tile graphics
  tile_renderer tile_gen(
    .clk(clk),
    .reset(reset),
    .hpos(hpos),
    .vpos(vpos),
    .ram_addr(tile_ram_addr),
    .ram_read(ram_read),
    .ram_busy(tile_reading),
    .rom_addr(tile_rom_addr),
    .rom_data(tile_rom_data),
    .rgb(tile_rgb)
  );

  // sprite scanline renderer
  sprite_scanline_renderer ssr(
    .clk(clk),
    .reset(reset),
    .hpos(hpos),
    .vpos(vpos),
    .ram_addr(sprite_ram_addr),
    .ram_data(ram_read),
    .ram_busy(sprite_reading),
    .rom_addr(sprite_rom_addr),
    .rom_data(sprite_rom_data),
    .rgb(sprite_rgb)
  );
  
  // tile ROM
  font_cp437_8x8 tile_rom(
    .addr(tile_rom_addr),
    .data(tile_rom_data)
  );

  // sprite ROM
  example_bitmap_rom bitmap_rom(
    .addr(sprite_rom_addr),
    .data(sprite_rom_data)
  );

  // sprites overlay tiles
  assign rgb = display_on
    ? (sprite_rgb>0 ? sprite_rgb : tile_rgb)
    : 0;

  // CPU
  reg cpu_hold = 0;
  wire cpu_busy;
  wire [15:0] cpu_ram_addr;
  wire busy;
  wire [15:0] cpu_bus;
  wire [15:0] flags = {11'b0, vsync, hsync, vpaddle, hpaddle, display_on};
  wire [15:0] switches = {switches_p2, switches_p1};
  
  // select ROM, RAM, switches ($FFFE) or flags ($FFFF)
  always @(*)
    casez (cpu_ram_addr)
      16'hfffe: cpu_bus = switches;
      16'hffff: cpu_bus = flags;
      16'b0???????????????: cpu_bus = ram_read;
      16'b1???????????????: cpu_bus = program_rom[cpu_ram_addr[14:0]];
    endcase

  // 16-bit CPU
  CPU16 cpu(
    .clk(clk),
    .reset(reset),
    .hold(tile_reading | sprite_reading), // hold input
    .busy(cpu_busy),			  // busy output
    .address(cpu_ram_addr),
    .data_in(cpu_bus),
    .data_out(ram_write),
    .write(ram_writeenable));

  // program ROM ($8000-$FFFE)
  reg [15:0] program_rom[0:32767];
  
  // example ROM program code
`ifdef EXT_INLINE_ASM
  initial begin
    program_rom = '{
      __asm
.arch femto16
.org 0x8000
.len 32768
      mov       sp,@$6fff
      mov	dx,@InitPageTable
      jsr	dx
      mov	ax,@$4ffe
      mov	dx,@ClearTiles
      jsr	dx
      mov	dx,@ClearSprites
      jsr	dx
      reset
InitPageTable:
      mov       ax,@$6000	; screen buffer
      mov       bx,@$7e00	; page table start
      mov	cx,#32		; 32 rows
InitPTLoop:
      mov	[bx],ax
      add	ax,#32
      inc	bx
      dec	cx
      bnz	InitPTLoop
      rts
ClearTiles:
      mov	bx,@$6000
      mov	cx,@$3c0
ClearLoop:
        mov	[bx],ax
        inc	bx
        dec	cx
        bnz	ClearLoop
      rts
ClearSprites:
        mov	bx,@$7f00
        mov	ax,#0
        mov	cx,#$40
ClearSLoop:
        mov	ax,[bx]
        add	ax,@$101
        mov	[bx],ax
        inc	bx
	dec	cx
        bnz	ClearSLoop
        rts
      __endasm
    };
  end
`endif

endmodule
