
`include "hvsync_generator.v"
`include "lfsr.v"

/*
Sound generator module.
This module has a square-wave oscillator (VCO) which can
be modulated by a low-frequency oscillator (LFO) and also
mixed with a LFSR noise source.
*/

module sound_generator(clk, reset, spkr,
               lfo_freq,noise_freq, vco_freq,
               vco_select, noise_select, lfo_shift, mixer);

  input clk, reset;
  output reg spkr = 0;		// module output
  
  input [9:0] lfo_freq;		// LFO frequency (10 bits)
  input [11:0] noise_freq;	// noise frequency (12 bits)
  input [11:0] vco_freq;	// VCO frequency (12 bits)
  input vco_select;		// 1 = LFO modulates VCO
  input noise_select;		// 1 = LFO modulates Noise
  input [2:0] lfo_shift;	// LFO modulation depth
  input [2:0] mixer;		// mix enable {LFO, Noise, VCO}

  reg [3:0] div16;		// divide-by-16 counter
  reg [17:0] lfo_count;		// LFO counter (18 bits)
  reg lfo_state;		// LFO output
  reg [12:0] noise_count;	// Noise counter (13 bits)
  reg noise_state;		// Noise output
  reg [12:0] vco_count;		// VCO counter (12 bits)
  reg vco_state;		// VCO output

  reg [15:0] lfsr;		// LFSR output
  
  LFSR #(16'b1000000001011,0) lfsr_gen(
    .clk(clk),
    .reset(reset),
    .enable(div16 == 0 && noise_count == 0),
    .lfsr(lfsr)
  );

  // create triangle waveform from LFO
  wire [11:0] lfo_triangle = lfo_count[17] ? ~lfo_count[17:6] : lfo_count[17:6];
  wire [11:0] vco_delta = lfo_triangle >> lfo_shift;
  
  always @(posedge clk) begin
    // divide clock by 64
    div16 <= div16 + 1;
    if (div16 == 0) begin
      // VCO oscillator
      if (reset || vco_count == 0) begin
        vco_state <= ~vco_state;
        if (vco_select)
          vco_count <= vco_freq + vco_delta;
        else
          vco_count <= vco_freq + 0;
      end else
        vco_count <= vco_count - 1;
      // LFO oscillator
      if (reset || lfo_count == 0) begin
        lfo_state <= ~lfo_state;
        lfo_count <= {lfo_freq, 8'b0};
      end else
        lfo_count <= lfo_count - 1;
      // Noise oscillator
      if (reset || noise_count == 0) begin
        if (lfsr[0])
          noise_state <= ~noise_state;
        if (noise_select)
          noise_count <= noise_freq + vco_delta;
        else
          noise_count <= noise_freq + 0;
      end else
        noise_count <= noise_count - 1;
      // Mixer
      spkr <= (lfo_state | ~mixer[2]) 
      & (noise_state | ~mixer[1])
      & (vco_state | ~mixer[0]);
    end
  end

endmodule

module test_snchip_top(clk, reset, hsync, vsync, rgb, spkr);

  input clk, reset;
  output hsync;
  output vsync;
  output spkr;
  output [2:0] rgb;
  
  // don't output a valid sync signal
  assign hsync = 0;
  assign vsync = 0;
  assign rgb = {spkr,1'b0,1'b0};
  
  sound_generator sndgen(
    .clk(clk),
    .reset(reset),
    .spkr(spkr),
    .lfo_freq(1000),
    .noise_freq(90),
    .vco_freq(250),
    .vco_select(1),
    .noise_select(1),
    .lfo_shift(1),
    .mixer(3)
  );

endmodule
