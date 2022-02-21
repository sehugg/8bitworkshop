
`include "hvsync_generator.v"
`include "cpu8.v"
`include "cpu16.v"

// uncomment to see scope view
//`define DEBUG

module shared_framebuffer_top(clk, reset, hsync, vsync, hpaddle, vpaddle,
                           address_bus, to_cpu, from_cpu, write_enable
`ifdef DEBUG
                        , output [15:0] IP
                        , output carry
                        , output zero
`else
                        , rgb
`endif
);

  input clk, reset;
  input hpaddle, vpaddle;
  output hsync, vsync;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
`ifdef DEBUG
  assign IP = cpu.regs[cpu.IP];
  assign carry = cpu.carry;
  assign zero = cpu.zero;
`else
  output [3:0] rgb;
`endif
  
  parameter IN_HPOS  = 8'b01000000;
  parameter IN_VPOS  = 8'b01000001;
  parameter IN_FLAGS = 8'b01000010;

  reg [15:0] ram[0:32767];
  reg [15:0] rom[0:1023];

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

  always @(posedge clk)
    if (write_enable) begin
      ram[address_bus[14:0]] <= from_cpu;
    end
  
  always @(*)
    if (address_bus[15])
      to_cpu = rom[address_bus[9:0]];
    else if (&address_bus[14:8]) begin
      casez (address_bus[7:0])
        // special read registers
        IN_HPOS:  to_cpu = {8'b0, hpos[7:0]};
        IN_VPOS:  to_cpu = {8'b0, vpos[7:0]};
        IN_FLAGS: to_cpu = {11'b0, 
                            vsync, hsync, vpaddle, hpaddle, display_on};
        default:  to_cpu = 0;
      endcase
    end else
      to_cpu = ram[address_bus[14:0]];
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(0),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );

  // video DMA access
  reg hold;
  wire busy;
  reg [15:0] vline[0:31]; // 32x16 bits = 256 4-color pixels
  reg [4:0] vindex;
  reg [15:0] vshift;
  //wire [15:0] scanread = scanline[hpos[7:3]];
  //wire [2:0] scanpixel = hpos[2:0];
  
  always @(posedge clk) begin
    // has CPU released the bus?
    if (busy) begin
      // write from main RAM -> scanline RAM
      vline[vindex] <= ram[{2'b10,vpos[7:0],vindex}];
      // end of scanline read?
      if (&vindex)
        hold <= 0; // release CPU
      vindex <= vindex + 1; // next address
    end else if (hpos >= 256 && hpos < 256+4 && vpos < 240) begin
      hold <= 1; // start DMA mode, hold CPU
    end else if (!hpos[8]) begin
      // load next word from vline buffer
      if (!&hpos[2:0]) begin
        vshift <= vline[vindex];
        vindex <= vindex + 1;
      end else
        vshift <= {2'b0, vshift[15:2]};
      // decode scanline RAM to RGB output
      rgb <= vshift[3:0];
    end else
      rgb <= 0;
  end

  /*
  reg [14:0] vpu_read;
  reg [15:0] vpu_buffer;
  reg [3:0]  rgb;
  
  always @(posedge clk) begin
    if (!hpos[8] && !vpos[8]) begin
      if (hpos[1:0] == 0) begin
        vpu_buffer <= ram[vpu_read];
        vpu_read <= vpu_read + 1;
      end
      //rgb <= ram[{vpos[6:0],hpos[7:0]}][3:0];
      case (hpos[1:0])
        0: rgb <= vpu_buffer[3:0];
        1: rgb <= vpu_buffer[7:4];
        2: rgb <= vpu_buffer[11:8];
        3: rgb <= vpu_buffer[15:12];
      endcase
    end else begin
      rgb <= 0;
      if (vpos[8])
        vpu_read <= 0;
    end
  end
  */

`ifdef EXT_INLINE_ASM
  initial begin
    rom = '{
        __asm
.arch femto16
.org 32768
.len 1024

.define IN_HPOS  $7f00
.define IN_VPOS  $7f01
.define IN_FLAGS $7f02

.define F_DISPLAY 1
.define F_HPADDLE 2
.define F_VPADDLE 4
.define F_HSYNC 8
.define F_VSYNC 16

Start:
      mov ax,#0
      mov bx,ax
Loop:
      mov [bx],ax
      inc bx
      inc ax
      bnz Loop
      reset
      __endasm
    };
  end
`endif
  
endmodule
