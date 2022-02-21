
`include "hvsync_generator.v"
`include "cpu16.v"

module frame_buffer_top(clk, reset, hsync, vsync, hpaddle, vpaddle,
                        address_bus, to_cpu, from_cpu, write_enable,
                        rgb
);

  input clk, reset;
  input hpaddle, vpaddle;
  output hsync, vsync;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  output reg [3:0] rgb;
  
  reg [15:0] ram[0:32767];	// RAM (32768 x 16 bits)
  reg [15:0] rom[0:1023];	// ROM (1024 x 16 bits)

  // 16-bit CPU
  output wire [15:0] address_bus;
  output reg  [15:0] to_cpu;
  output wire [15:0] from_cpu;
  output wire write_enable;
  
  CPU16 cpu(.clk(clk),
          .reset(reset),
          .hold(hold),
          .busy(busy),
          .address(address_bus),
          .data_in(to_cpu),
          .data_out(from_cpu),
          .write(write_enable));

  // CPU -> RAM write bus (synchronous)
  always @(posedge clk)
    if (write_enable) begin
      ram[address_bus[14:0]] <= from_cpu;
    end
  
  // RAM -> CPU read bus (asynchronous)
  always @(*)
    if (address_bus[15])
      to_cpu = rom[address_bus[9:0]];
    else
      to_cpu = ram[address_bus[14:0]];
  
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

  // CPU busy flags (not used here)
  reg hold = 0;
  wire busy;
  
  reg [12:0] vindex; // index into line array
  reg [15:0] vshift; // shift register with current word to output
  reg [3:0] palette[0:3] = '{0,1,4,7}; // simple palette array
  
  always @(posedge clk) begin
    if (display_on) begin
      // load next word from RAM every 8 pixels
      if (0 == hpos[2:0]) begin
        vshift <= ram[{2'b10,vindex}];
        vindex <= vindex + 1;
      end else
        vshift <= vshift << 2; // shift next pixel in 16-bit word
      // decode scanline RAM to RGB output
      rgb <= palette[vshift[15:14]];
    end else begin
      rgb <= 0; // set color to black
      if (vsync) vindex <= 0; // reset vindex every frame
    end;
  end

  // test program
  
`ifdef EXT_INLINE_ASM
  initial begin
    rom = '{
        __asm
.arch femto16
.org 32768
.len 1024

Start:
      mov ax,cx		; ax = cx
      mov bx,#0		; bx = #0
Loop:
      mov [bx],ax	; ram[bx] = ax
      inc ax		; ax = ax + 1
      inc bx		; bx = bx + 1
      bnz Loop		; loop until bx is 0
      inc cx
      reset		; reset CPU
      __endasm
    };
  end
`endif
  
endmodule
