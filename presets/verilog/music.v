
`include "hvsync_generator.v"

module sound_psg(clk, reset, out, reg_sel, reg_data, reg_write);
  
  input clk, reset;
  input [3:0] reg_sel;	// select register #
  input [7:0] reg_data;	// data to write to register
  input reg_write;	// write enable
  output [7:0] out;	// output waveform
  
  parameter NVOICES = 4;
  
  reg outputs[0:NVOICES-1];
  reg [11:0] count[0:NVOICES-1];
  reg [7:0] register[0:15];
  reg [5:0] div64;
  
  integer i;
  
  always @(posedge clk) begin
    // divide clock by 64
    if (div64 == 0) begin
      out = 0; // initialize waveform output
      // generate code for each voice (0..NVOICES-1)
      for (i=0; i<NVOICES; i++) begin
        // divide clock/64 by waveform frequency
        if (count[i] == {register[i+4][3:0], register[i]}) begin
          outputs[i] <= outputs[i] ^ 1;
          count[i] <= 0;
        end else begin
          count[i] <= count[i] + 1;
        end
        // need this directive to mix
        // blocking and non-blocking assignments
        /* verilator lint_off BLKSEQ */
        if (register[15][i] && outputs[i]) begin
          // add to output waveform, scaled by intensity
          out = out + register[i+8];
        end
      end
    end
    div64 <= div64 + 1;
    // write to register?
    if (reg_write) begin
      register[reg_sel] <= reg_data;
    end
  end
  
endmodule

module music_player(clk, reset, advance,
                    psg_sel, psg_data, psg_write);

  parameter NVOICES = 4;
  
  input clk, reset;
  input advance;
  output [3:0] psg_sel;
  output [7:0] psg_data;
  output psg_write;
  
  integer i;

//./mknotes.py -m 12 -f 75898
// Namespace(bias=0, freq=75898.0, length=64, maxbits=12.0, upper=49)
// 434.7 3.23120101673 49
  
  reg [11:0] note_table[0:63] = '{
    2960, 2794, 2637, 2489, 2349, 2217, 2093, 1975,
    1864, 1760, 1661, 1568, 1480, 1397, 1318, 1244,
    1175, 1109, 1046, 988, 932, 880, 831, 784,
    740, 698, 659, 622, 587, 554, 523, 494,
    466, 440, 415, 392, 370, 349, 330, 311,
    294, 277, 262, 247, 233, 220, 208, 196,
    185, 175, 165, 156, 147, 139, 131, 123,
    117, 110, 104, 98, 92, 87, 82, 78 
  };
  
  reg [7:0] music_table[0:291] = '{
8'h1e,8'h12,8'h8c,8'h23,8'h17,8'h86,8'h2f,8'h86,8'h36,8'h2a,8'h27,8'h86,8'h2f,8'h86,8'h33,8'h1e,8'h23,8'h86,8'h36,8'h2a,8'h86,8'h24,8'h18,8'h86,8'h2e,8'h86,8'h2a,8'h36,8'h25,8'h86,8'h2e,8'h86,8'h31,8'h28,8'h22,8'h86,8'h36,8'h2a,8'h86,8'h1e,8'h22,8'h28,8'h8c,8'h1e,8'h12,8'h8c,8'h23,8'h17,8'h86,8'h2f,8'h86,8'h36,8'h2a,8'h27,8'h86,8'h2f,8'h86,8'h33,8'h1e,8'h23,8'h86,8'h36,8'h2a,8'h86,8'h24,8'h18,8'h86,8'h2e,8'h86,8'h36,8'h2a,8'h25,8'h86,8'h2e,8'h86,8'h31,8'h28,8'h22,8'h86,8'h36,8'h2a,8'h86,8'h28,8'h22,8'h1e,8'h8c,8'h12,8'h1e,8'h86,8'h36,8'h2a,8'h86,8'h1f,8'h13,8'h86,8'h2f,8'h86,8'h32,8'h86,8'h37,8'h2b,8'h86,8'h1e,8'h12,8'h86,8'h36,8'h2a,8'h86,8'h1e,8'h12,8'h86,8'h2a,8'h36,8'h86,8'h1f,8'h13,8'h86,8'h2f,8'h86,8'h32,8'h86,8'h37,8'h2b,8'h86,8'h1e,8'h12,8'h86,8'h36,8'h2a,8'h92,8'h0b,8'h86,8'h17,8'h86,8'h1a,8'h86,8'h23,8'h86,8'h17,8'h86,8'h23,8'h86,8'h26,8'h86,8'h2f,8'h86,8'h23,8'h86,8'h2f,8'h86,8'h32,8'h86,8'h3b,8'h86,8'h2f,8'h86,8'h3b,8'h86,8'h3e,8'h86,8'h86,8'h3b,8'h29,8'h2c,8'h8c,8'h3b,8'h32,8'h2f,8'h8c,8'h3b,8'h32,8'h2f,8'h8c,8'h3b,8'h29,8'h2c,8'h86,8'h3b,8'h86,8'h33,8'h2f,8'h2a,8'h86,8'h86,8'h33,8'h2f,8'h2a,8'h86,8'h3f,8'h86,8'h2a,8'h2f,8'h33,8'h86,8'h3b,8'h86,8'h33,8'h2f,8'h2a,8'h86,8'h37,8'h3b,8'h86,8'h32,8'h2f,8'h2b,8'h86,8'h3d,8'h86,8'h3e,8'h37,8'h2b,8'h86,8'h3b,8'h86,8'h3d,8'h33,8'h2f,8'h86,8'h3f,8'h36,8'h86,8'h33,8'h2f,8'h2a,8'h86,8'h3b,8'h86,8'h3f,8'h36,8'h33,8'h86,8'h3b,8'h86,8'h3d,8'h36,8'h2a,8'h8c,8'h3b,8'h36,8'h33,8'h92,8'h3b,8'h2f,8'h86,8'h26,8'h23,8'h20,8'h8c,8'h3b,8'h2f,8'h1d,8'h8c,8'h3b,8'h2f,8'h26,8'h8c,8'h3b,8'h2f,8'h26,8'h86,8'h3b,8'h2f,8'h86,8'h1e,8'h23,8'h27,8'h86,8'h36,8'h86,8'h38,8'h2f,8'h27,8'h86,8'h33,8'h86,8'h36,8'h27,8'h23,8'h86,8'h38,8'h2f,8'h86,8'h1e,8'h23,8'h27,8'h86,8'h2f,8'h2b,8'h86,8'h26,8'hff
  };
  
  reg [15:0] music_ptr = 0;
  reg [2:0] freech = 0;
  reg [7:0] cur_duration = 0;
  reg [3:0] ch_durations[0:NVOICES-1];

  reg [7:0] psg_regs[0:15];
  reg [3:0] next_reg;

  wire [7:0] note = music_table[music_ptr[8:0]];
  wire [11:0] period = note_table[note[5:0]];

  always @(posedge advance or posedge reset) begin
    if (reset) begin
      cur_duration <= 0;
      music_ptr <= 0;
      psg_regs[15] <= 0;
    end else if (cur_duration == 0) begin
      // TODO: 0xff
      music_ptr <= music_ptr + 1;
      if (note[7]) begin
        cur_duration <= note & 63;
      end else begin
        psg_regs[freech+0] <= period[7:0];
        psg_regs[freech+4] <= {4'b0, period[11:8]};
        ch_durations[freech+0] = 7;
        psg_regs[15][freech] <= 1;
        freech <= (freech == NVOICES-1) ? 0 : freech+1;
      end
    end else begin
      cur_duration <= cur_duration - 1;
      for (i=0; i<NVOICES; i++) begin
        if (ch_durations[i] == 0) begin
          psg_regs[15][i] <= 0;
        end else begin
          psg_regs[freech+8] <= {4'b0, ch_durations[i]};
          ch_durations[i] <= ch_durations[i] - 1;
        end
      end
    end
  end

  always @(posedge clk or posedge reset) begin
    psg_sel <= next_reg;
    psg_data <= psg_regs[next_reg];
    psg_write <= 1;
    next_reg <= next_reg + 1;
  end

endmodule

module top(clk, reset, hsync, vsync, rgb, spkr);

  input clk, reset;
  output hsync, vsync;
  output [2:0] rgb;
  output [7:0] spkr;
  wire display_on;
  wire [8:0] hpos;
  wire [8:0] vpos;

  hvsync_generator hvsync_gen(
    .clk(clk),
    .reset(reset),
    .hsync(hsync),
    .vsync(vsync),
    .display_on(display_on),
    .hpos(hpos),
    .vpos(vpos)
  );

  wire r = display_on && spkr[2];
  wire g = display_on && spkr[1];
  wire b = display_on && spkr[0];
  assign rgb = {b,g,r};
  
  reg [3:0] sel;
  reg [7:0] data;
  reg write = 0;
  
  sound_psg psg(
    .clk(clk),
    .reset(reset),
    .reg_sel(sel),
    .reg_data(data),
    .reg_write(write),
    .out(spkr));

  music_player player(
    .clk(hsync),
    .reset(reset),
    .advance(vsync),
    .psg_sel(sel),
    .psg_data(data),
    .psg_write(write)
  );
  
endmodule
