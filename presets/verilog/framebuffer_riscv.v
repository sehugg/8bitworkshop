
`include "hvsync_generator.v"
`include "femtorv32.v"

module frame_buffer_riscv_top(clk, reset, hsync, vsync, hpaddle, vpaddle, rgb);

  input clk, reset;
  input hpaddle, vpaddle;
  output hsync, vsync;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;
  output reg [3:0] rgb;

  // RAM and ROM
  reg [31:0] ram[0:16383];   // RAM (16384 x 32 bits = 64KB)
  reg [31:0] rom[0:1023];   // ROM (1024 x 32 bits = 4KB)

  // FemtoRV32 CPU interface signals
  wire [31:0] mem_addr;
  wire [31:0] mem_wdata;
  wire [3:0]  mem_wmask;
  reg  [31:0] mem_rdata;
  wire        mem_rstrb;
  reg         mem_rbusy;
  reg         mem_wbusy;

  // Instantiate FemtoRV32 CPU
  FemtoRV32 #(
    .RESET_ADDR(32'h00010000),  // Start execution from ROM area
    .ADDR_WIDTH(24)              // 64KB address space
  ) cpu (
    .clk(clk),
    .reset(reset),               // FemtoRV32 reset (active high based on code)
    .mem_addr(mem_addr),
    .mem_wdata(mem_wdata),
    .mem_wmask(mem_wmask),
    .mem_rdata(mem_rdata),
    .mem_rstrb(mem_rstrb),
    .mem_rbusy(mem_rbusy),
    .mem_wbusy(mem_wbusy)
  );

  // Memory address decoding
  // 0x0000-0xFFFF: RAM (64KB)
  wire ram_sel = (mem_addr[15] == 1'b0);
  // 0x10000-0x10FFF: ROM (4KB)
  wire rom_sel = (mem_addr[16:13] == 4'b1000);
  // 0x18000-0x18FFF: I/O
  wire io_sel = (mem_addr[16:13] == 4'b1100);

  // Memory read logic
  always @(posedge clk) begin
    if (mem_rstrb) begin
      mem_rbusy <= 1;
      if (rom_sel)
        mem_rdata <= rom[mem_addr[11:2]];  // Word-aligned ROM access
      else if (ram_sel)
        mem_rdata <= ram[mem_addr[15:2]];  // Word-aligned RAM access
      else if (io_sel) begin
        case (mem_addr[7:0])
          0: mem_rdata <= {29'h0, vpaddle, hpaddle, display_on};
          1: mem_rdata <= {7'h0, hpos, 7'h0, vpos};
          default:
            mem_rdata <= 32'h00000000; // Unmapped
        endcase
      end else
        mem_rdata <= 32'h00000000; // Unmapped
    end else begin
      mem_rbusy <= 0;
    end
  end

  // Memory write logic (synchronous)
  always @(posedge clk) begin
    if (ram_sel && |mem_wmask) begin
      mem_wbusy <= 1;
      // Byte-wise write masking
      if (mem_wmask[0]) ram[mem_addr[15:2]][7:0]   <= mem_wdata[7:0];
      if (mem_wmask[1]) ram[mem_addr[15:2]][15:8]  <= mem_wdata[15:8];
      if (mem_wmask[2]) ram[mem_addr[15:2]][23:16] <= mem_wdata[23:16];
      if (mem_wmask[3]) ram[mem_addr[15:2]][31:24] <= mem_wdata[31:24];
    end else begin
      mem_wbusy <= 0;
    end
  end

  // Video sync generator
  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(0),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );

  // Video framebuffer rendering
  reg [13:0] vindex;       // Index into framebuffer
  reg [31:0] vshift;       // Shift register with current word to output

  always @(posedge clk) begin
    if (display_on) begin
      // Load next word from RAM every 8 pixels (32 bits = 8 pixels at 4bpp)
      if (hpos[2:0] == 3'b000) begin
        vshift <= ram[vindex];  // Read from framebuffer area (0x2000+)
        vindex <= vindex + 1;
      end else begin
        vshift <= vshift >> 4;  // Shift next 4-bit pixel
      end
      // Decode scanline RAM to RGB output
      rgb <= vshift[3:0];
    end else begin
      rgb <= 0;  // Set color to black
      if (vsync) vindex <= 0;  // Reset vindex every frame
    end
  end

  // Test program - simple pattern generator
`ifdef EXT_INLINE_ASM
  initial begin
    rom = '{
      __asm
.arch riscv
.org 0x10000
.len 0x400

; RISC-V test program - fill framebuffer with pattern
; x1 = loop counter
; x2 = RAM address
; x3 = pattern value

start:
    lui x2, 0x0           ; x2 = 0x0 (framebuffer start)
    addi x1, x0, 0        ; x1 = 0 (counter)
    lui x4, 0x20          ; x4 = 0x20000 (end addr, 0x20 << 12)
    lui x5, 0x18          ; x5 = I/O address

loop:
    add x3, x1, x0       ; x3 = counter value as pattern
    sw x3, 0(x2)         ; Store pattern to framebuffer
    addi x2, x2, 4       ; Increment address by 4 bytes
    addi x1, x1, 1       ; Increment counter
    blt x2, x4, loop     ; Loop if address < end

    ; Infinite loop to restart
    lui x2, 0x2          ; Reset to start
    addi x1, x1, 1       ; Increment counter
    jal x0, loop         ; Jump back to loop

      __endasm
    };
  end
`endif

endmodule
