
`include "hvsync_generator.v"
`include "sprite_bitmap.v"
`include "sprite_renderer.v"
`include "cpu8.v"

// uncomment to see scope view
//`define DEBUG

module frame_buffer_top(clk, reset, hsync, vsync, hpaddle, vpaddle,
                           address_bus, to_cpu, from_cpu, write_enable
`ifdef DEBUG
                        , output [7:0] A
                        , output [7:0] B
                        , output [7:0] IP
                        , output carry
                        , output zero
`else
                        ,rgb
`endif
);

  input clk, reset;
  input hpaddle, vpaddle;
  output hsync, vsync;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
`ifdef DEBUG
  assign IP = cpu.IP;
  assign A = cpu.A;
  assign B = cpu.B;
  assign carry = cpu.carry;
  assign zero = cpu.zero;
`else
  output [3:0] rgb;
`endif
  
  parameter IN_HPOS  = 8'b01000000;
  parameter IN_VPOS  = 8'b01000001;
  parameter IN_FLAGS = 8'b01000010;
  parameter IN_VPU   = 8'b01000011;

  reg [7:0] ram[0:63];
  reg [7:0] rom[0:127];

  output wire [7:0] address_bus;
  output reg  [7:0] to_cpu;
  output wire [7:0] from_cpu;
  output wire write_enable;
  
  CPU cpu(.clk(clk),
          .reset(reset),
          .address(address_bus),
          .data_in(to_cpu),
          .data_out(from_cpu),
          .write(write_enable));

  always @(posedge clk)
    if (write_enable) begin
      casez (address_bus)
        // VPU lo byte
        8'b0001000: begin
          vpu_write[15:8] <= from_cpu;
        end
        // VPU hi byte
        8'b0001001: begin
          vpu_write[7:0] <= from_cpu;
        end
        // VPU write
        8'b0001010: begin
          vpu_ram[vpu_write] <= from_cpu[7:4];
          vpu_ram[vpu_write+1] <= from_cpu[3:0];
          vpu_write <= vpu_write + 2;
        end
        // VPU move
        8'b0001011: begin
          // sign extend
          vpu_write <= {
            vpu_write[15:8] + { {4{from_cpu[7]}}, from_cpu[7:4] }, 
            vpu_write[7:0] + { {4{from_cpu[3]}}, from_cpu[3:0] }
          };
        end
        default: ram[address_bus[5:0]] <= from_cpu;
      endcase
    end
  
  always @(*)
    casez (address_bus)
      // RAM
      8'b00??????: to_cpu = ram[address_bus[5:0]];
      // special read registers
      IN_HPOS:  to_cpu = hpos[7:0];
      IN_VPOS:  to_cpu = vpos[7:0];
      IN_FLAGS: to_cpu = {3'b0, 
                          vsync, hsync, vpaddle, hpaddle, display_on};
      IN_VPU:	to_cpu = {vpu_ram[vpu_write], vpu_ram[vpu_write+1]};
      // ROM
      8'b1???????: to_cpu = rom[address_bus[7:0] + 128];
      default: ;
    endcase
  
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(0),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );
  
  reg [3:0]  vpu_ram[0:65535];
  reg [15:0] vpu_read;
  reg [15:0] vpu_write;
  reg [3:0]  rgb;
  
  always @(posedge clk) begin
    if (!hpos[8] && !vpos[8]) begin
      rgb <= vpu_ram[vpu_read];
      vpu_read <= vpu_read + 1;
    end else begin
      rgb <= 0;
      if (vpos[8])
        vpu_read <= 0;
    end
  end
\end{lstlisting}

We also have a simple test program that writes repeated patterns to the VPU:

\begin{lstlisting}[language=femto8]
`ifdef EXT_INLINE_ASM
  initial begin
    rom = '{
        __asm
.arch femto8
.org 128
.len 128

.define VPU_LO 8
.define VPU_HI 9
.define VPU_WRITE 10
.define VPU_MOVE 11

.define IN_HPOS  $40
.define IN_VPOS  $41
.define IN_FLAGS $42

.define F_DISPLAY 1
.define F_HPADDLE 2
.define F_VPADDLE 4
.define F_HSYNC 8
.define F_VSYNC 16
      
Start:
	zero	A
        sta	VPU_LO
        sta	VPU_HI
        sta	0
DisplayLoop:
      	zero	B
        mov	A,[b]
        sta	VPU_WRITE
        sta	VPU_MOVE
        sta	VPU_WRITE
        sta	VPU_MOVE
        sta	VPU_WRITE
        sta	VPU_MOVE
        lda	#F_VSYNC
      	ldb	#IN_FLAGS
        and	none,[B]
        bz	DisplayLoop
WaitVsync:
        and	none,[B]
        bnz	WaitVsync
      	zero	B
        mov	A,[b]
        inc	A
        sta	0
	jmp	DisplayLoop
      __endasm
    };
  end
`endif
