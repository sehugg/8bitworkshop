`include "hvsync_generator.v"
`include "font_cp437_8x8.v"
`include "ram.v"
`include "tile_renderer.v"
`include "sprite_scanline_renderer.v"
`include "lfsr.v"
`include "sound_generator.v"
`include "cpu16.v"

module cpu_platform(clk, reset, hsync, vsync, rgb);

  input clk, reset;
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
  
  font_cp437_8x8 tile_rom(
    .addr(tile_rom_addr),
    .data(tile_rom_data)
  );

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
  
  assign cpu_bus = cpu_ram_addr[15]
    ? rom[cpu_ram_addr[9:0]]
    : ram_read;
  
  CPU16 cpu(
    .clk(clk),
    .reset(reset),
    .hold(tile_reading | sprite_reading),
    .busy(cpu_busy),
    .address(cpu_ram_addr),
    .data_in(cpu_bus),
    .data_out(ram_write),
    .write(ram_writeenable));

  reg [15:0] rom[0:1023];
  
`ifdef EXT_INLINE_ASM
  initial begin
    rom = '{
      __asm
.arch femto16
.org 0x8000
.len 1024
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
      mov	cx,@$390
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
      __endasm
    };
  end
`endif

endmodule
