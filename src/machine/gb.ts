
import { SM83, SM83State } from "../common/cpu/SM83";
import { BasicScanlineMachine, Bus } from "../common/devices";
import { newAddressDecoder, padBytes, Keys, makeKeycodeMap, newKeyboardHandler, EmuHalt } from "../common/emu";
import { hex } from "../common/util";

// Game Boy DMG palette: 4 shades of green (darkest to lightest)
const DMG_PALETTE: number[] = [
  0xFFd0d884, // Lightest (Warm Mint)
  0xFF87a84c, // Light Mid
  0xFF526b34, // Dark Mid
  0xFF2d3122, // Darkest (Deep Olive)
];

var GB_KEYCODE_MAP = makeKeycodeMap([
  // D-pad
  [Keys.RIGHT,   0, 0x01],
  [Keys.LEFT,    0, 0x02],
  [Keys.UP,      0, 0x04],
  [Keys.DOWN,    0, 0x08],
  // Buttons
  [Keys.A,       0, 0x10],
  [Keys.B,       0, 0x20],
  [Keys.GP_A,    0, 0x10],
  [Keys.GP_B,    0, 0x20],
  [Keys.SELECT,  0, 0x40],
  [Keys.START,   0, 0x80],
  [Keys.VK_ENTER, 0, 0x80], // Start
  [Keys.VK_SHIFT, 0, 0x40], // Select
]);

// Duty cycle waveforms for square wave channels (8 steps each)
const DUTY_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 1], // 12.5%
  [1, 0, 0, 0, 0, 0, 0, 1], // 25%
  [1, 0, 0, 0, 0, 1, 1, 1], // 50%
  [0, 1, 1, 1, 1, 1, 1, 0], // 75%
];

// Read masks for NR registers (bits that always read as 1)
const NR_READ_MASKS = new Uint8Array(0x30);
// Set up read masks per Pan Docs
(() => {
  NR_READ_MASKS[0x10 - 0x10] = 0x80; // NR10
  NR_READ_MASKS[0x11 - 0x10] = 0x3F; // NR11: duty readable, length not
  NR_READ_MASKS[0x12 - 0x10] = 0x00; // NR12
  NR_READ_MASKS[0x13 - 0x10] = 0xFF; // NR13: write-only
  NR_READ_MASKS[0x14 - 0x10] = 0xBF; // NR14: bit 6 readable
  NR_READ_MASKS[0x15 - 0x10] = 0xFF; // NR15: unused
  NR_READ_MASKS[0x16 - 0x10] = 0x3F; // NR21
  NR_READ_MASKS[0x17 - 0x10] = 0x00; // NR22
  NR_READ_MASKS[0x18 - 0x10] = 0xFF; // NR23: write-only
  NR_READ_MASKS[0x19 - 0x10] = 0xBF; // NR24
  NR_READ_MASKS[0x1A - 0x10] = 0x7F; // NR30
  NR_READ_MASKS[0x1B - 0x10] = 0xFF; // NR31: write-only
  NR_READ_MASKS[0x1C - 0x10] = 0x9F; // NR32
  NR_READ_MASKS[0x1D - 0x10] = 0xFF; // NR33: write-only
  NR_READ_MASKS[0x1E - 0x10] = 0xBF; // NR34
  NR_READ_MASKS[0x1F - 0x10] = 0xFF; // unused
  NR_READ_MASKS[0x20 - 0x10] = 0xFF; // NR41: write-only
  NR_READ_MASKS[0x21 - 0x10] = 0x00; // NR42
  NR_READ_MASKS[0x22 - 0x10] = 0x00; // NR43
  NR_READ_MASKS[0x23 - 0x10] = 0xBF; // NR44
  NR_READ_MASKS[0x24 - 0x10] = 0x00; // NR50
  NR_READ_MASKS[0x25 - 0x10] = 0x00; // NR51
  NR_READ_MASKS[0x26 - 0x10] = 0x70; // NR52: bits 4-6 unused
})();

class GameBoyAPU {
  // Master control
  enabled: boolean = false;
  nr50: number = 0; // master volume / VIN
  nr51: number = 0; // panning

  // Channel 1: Square with sweep
  ch1_enabled: boolean = false;
  ch1_dacEnabled: boolean = false;
  ch1_duty: number = 0;
  ch1_dutyPos: number = 0;
  ch1_lengthCounter: number = 0;
  ch1_lengthEnabled: boolean = false;
  ch1_volume: number = 0;
  ch1_envInitVol: number = 0;
  ch1_envDir: number = 0;   // 0=down, 1=up
  ch1_envPeriod: number = 0;
  ch1_envTimer: number = 0;
  ch1_freq: number = 0;
  ch1_freqTimer: number = 0;
  ch1_sweepPeriod: number = 0;
  ch1_sweepDir: number = 0;  // 0=add, 1=subtract
  ch1_sweepShift: number = 0;
  ch1_sweepTimer: number = 0;
  ch1_sweepEnabled: boolean = false;
  ch1_sweepShadow: number = 0;

  // Channel 2: Square (no sweep)
  ch2_enabled: boolean = false;
  ch2_dacEnabled: boolean = false;
  ch2_duty: number = 0;
  ch2_dutyPos: number = 0;
  ch2_lengthCounter: number = 0;
  ch2_lengthEnabled: boolean = false;
  ch2_volume: number = 0;
  ch2_envInitVol: number = 0;
  ch2_envDir: number = 0;
  ch2_envPeriod: number = 0;
  ch2_envTimer: number = 0;
  ch2_freq: number = 0;
  ch2_freqTimer: number = 0;

  // Channel 3: Wave
  ch3_enabled: boolean = false;
  ch3_dacEnabled: boolean = false;
  ch3_lengthCounter: number = 0;
  ch3_lengthEnabled: boolean = false;
  ch3_volume: number = 0; // 0=mute, 1=100%, 2=50%, 3=25%
  ch3_freq: number = 0;
  ch3_freqTimer: number = 0;
  ch3_samplePos: number = 0;
  ch3_sampleBuffer: number = 0;
  waveRAM = new Uint8Array(16);

  // Channel 4: Noise
  ch4_enabled: boolean = false;
  ch4_dacEnabled: boolean = false;
  ch4_lengthCounter: number = 0;
  ch4_lengthEnabled: boolean = false;
  ch4_volume: number = 0;
  ch4_envInitVol: number = 0;
  ch4_envDir: number = 0;
  ch4_envPeriod: number = 0;
  ch4_envTimer: number = 0;
  ch4_clockShift: number = 0;
  ch4_widthMode: number = 0; // 0=15-bit, 1=7-bit
  ch4_divisor: number = 0;
  ch4_freqTimer: number = 0;
  ch4_lfsr: number = 0x7FFF;

  // Frame sequencer
  frameSeqTimer: number = 0;
  frameSeqStep: number = 0;

  // Raw register values for read-back
  regs = new Uint8Array(0x30);

  reset(): void {
    this.enabled = false;
    this.nr50 = 0;
    this.nr51 = 0;
    this.ch1_enabled = false; this.ch1_dacEnabled = false;
    this.ch1_duty = 0; this.ch1_dutyPos = 0;
    this.ch1_lengthCounter = 0; this.ch1_lengthEnabled = false;
    this.ch1_volume = 0; this.ch1_envInitVol = 0;
    this.ch1_envDir = 0; this.ch1_envPeriod = 0; this.ch1_envTimer = 0;
    this.ch1_freq = 0; this.ch1_freqTimer = 0;
    this.ch1_sweepPeriod = 0; this.ch1_sweepDir = 0; this.ch1_sweepShift = 0;
    this.ch1_sweepTimer = 0; this.ch1_sweepEnabled = false; this.ch1_sweepShadow = 0;
    this.ch2_enabled = false; this.ch2_dacEnabled = false;
    this.ch2_duty = 0; this.ch2_dutyPos = 0;
    this.ch2_lengthCounter = 0; this.ch2_lengthEnabled = false;
    this.ch2_volume = 0; this.ch2_envInitVol = 0;
    this.ch2_envDir = 0; this.ch2_envPeriod = 0; this.ch2_envTimer = 0;
    this.ch2_freq = 0; this.ch2_freqTimer = 0;
    this.ch3_enabled = false; this.ch3_dacEnabled = false;
    this.ch3_lengthCounter = 0; this.ch3_lengthEnabled = false;
    this.ch3_volume = 0; this.ch3_freq = 0; this.ch3_freqTimer = 0;
    this.ch3_samplePos = 0; this.ch3_sampleBuffer = 0;
    this.waveRAM.fill(0);
    this.ch4_enabled = false; this.ch4_dacEnabled = false;
    this.ch4_lengthCounter = 0; this.ch4_lengthEnabled = false;
    this.ch4_volume = 0; this.ch4_envInitVol = 0;
    this.ch4_envDir = 0; this.ch4_envPeriod = 0; this.ch4_envTimer = 0;
    this.ch4_clockShift = 0; this.ch4_widthMode = 0; this.ch4_divisor = 0;
    this.ch4_freqTimer = 0; this.ch4_lfsr = 0x7FFF;
    this.frameSeqTimer = 0; this.frameSeqStep = 0;
    this.regs.fill(0);
  }

  readRegister(addr: number): number {
    // addr is 0x10-0x3F range
    if (addr >= 0x30 && addr <= 0x3F) {
      // Wave RAM - if ch3 is reading, return the current sample byte
      if (this.ch3_enabled) {
        return this.waveRAM[this.ch3_samplePos >> 1];
      }
      return this.waveRAM[addr - 0x30];
    }
    if (addr === 0x26) {
      // NR52: bit 7 = master enable, bits 0-3 = channel status
      var val = (this.enabled ? 0x80 : 0) |
        (this.ch1_enabled ? 0x01 : 0) |
        (this.ch2_enabled ? 0x02 : 0) |
        (this.ch3_enabled ? 0x04 : 0) |
        (this.ch4_enabled ? 0x08 : 0);
      return val | 0x70; // bits 4-6 always 1
    }
    if (!this.enabled) return 0xFF;
    var regIndex = addr - 0x10;
    return this.regs[regIndex] | NR_READ_MASKS[regIndex];
  }

  writeRegister(addr: number, val: number): void {
    // Wave RAM is always writable
    if (addr >= 0x30 && addr <= 0x3F) {
      this.waveRAM[addr - 0x30] = val;
      return;
    }
    // NR52 special handling
    if (addr === 0x26) {
      var wasEnabled = this.enabled;
      this.enabled = !!(val & 0x80);
      if (wasEnabled && !this.enabled) {
        // Turning off: clear all registers
        for (var i = 0x10; i <= 0x25; i++) {
          this.writeRegister(i, 0);
        }
        this.ch1_enabled = false;
        this.ch2_enabled = false;
        this.ch3_enabled = false;
        this.ch4_enabled = false;
      }
      if (!wasEnabled && this.enabled) {
        this.frameSeqTimer = 0;
        this.frameSeqStep = 0;
      }
      return;
    }
    if (!this.enabled) return; // writes ignored when APU off (except NR52 and wave RAM)

    var regIndex = addr - 0x10;
    this.regs[regIndex] = val;

    switch (addr) {
      // Channel 1: NR10-NR14
      case 0x10: // NR10: Sweep
        this.ch1_sweepPeriod = (val >> 4) & 0x07;
        this.ch1_sweepDir = (val >> 3) & 0x01;
        this.ch1_sweepShift = val & 0x07;
        break;
      case 0x11: // NR11: Duty & length
        this.ch1_duty = (val >> 6) & 0x03;
        this.ch1_lengthCounter = 64 - (val & 0x3F);
        break;
      case 0x12: // NR12: Volume envelope
        this.ch1_envInitVol = (val >> 4) & 0x0F;
        this.ch1_envDir = (val >> 3) & 0x01;
        this.ch1_envPeriod = val & 0x07;
        this.ch1_dacEnabled = (val & 0xF8) !== 0;
        if (!this.ch1_dacEnabled) this.ch1_enabled = false;
        break;
      case 0x13: // NR13: Frequency low
        this.ch1_freq = (this.ch1_freq & 0x700) | val;
        break;
      case 0x14: // NR14: Trigger & frequency high
        this.ch1_freq = (this.ch1_freq & 0xFF) | ((val & 0x07) << 8);
        this.ch1_lengthEnabled = !!(val & 0x40);
        if (val & 0x80) this.triggerChannel1();
        break;

      // Channel 2: NR21-NR24
      case 0x16: // NR21: Duty & length
        this.ch2_duty = (val >> 6) & 0x03;
        this.ch2_lengthCounter = 64 - (val & 0x3F);
        break;
      case 0x17: // NR22: Volume envelope
        this.ch2_envInitVol = (val >> 4) & 0x0F;
        this.ch2_envDir = (val >> 3) & 0x01;
        this.ch2_envPeriod = val & 0x07;
        this.ch2_dacEnabled = (val & 0xF8) !== 0;
        if (!this.ch2_dacEnabled) this.ch2_enabled = false;
        break;
      case 0x18: // NR23: Frequency low
        this.ch2_freq = (this.ch2_freq & 0x700) | val;
        break;
      case 0x19: // NR24: Trigger & frequency high
        this.ch2_freq = (this.ch2_freq & 0xFF) | ((val & 0x07) << 8);
        this.ch2_lengthEnabled = !!(val & 0x40);
        if (val & 0x80) this.triggerChannel2();
        break;

      // Channel 3: NR30-NR34
      case 0x1A: // NR30: DAC enable
        this.ch3_dacEnabled = !!(val & 0x80);
        if (!this.ch3_dacEnabled) this.ch3_enabled = false;
        break;
      case 0x1B: // NR31: Length
        this.ch3_lengthCounter = 256 - val;
        break;
      case 0x1C: // NR32: Volume
        this.ch3_volume = (val >> 5) & 0x03;
        break;
      case 0x1D: // NR33: Frequency low
        this.ch3_freq = (this.ch3_freq & 0x700) | val;
        break;
      case 0x1E: // NR34: Trigger & frequency high
        this.ch3_freq = (this.ch3_freq & 0xFF) | ((val & 0x07) << 8);
        this.ch3_lengthEnabled = !!(val & 0x40);
        if (val & 0x80) this.triggerChannel3();
        break;

      // Channel 4: NR41-NR44
      case 0x20: // NR41: Length
        this.ch4_lengthCounter = 64 - (val & 0x3F);
        break;
      case 0x21: // NR42: Volume envelope
        this.ch4_envInitVol = (val >> 4) & 0x0F;
        this.ch4_envDir = (val >> 3) & 0x01;
        this.ch4_envPeriod = val & 0x07;
        this.ch4_dacEnabled = (val & 0xF8) !== 0;
        if (!this.ch4_dacEnabled) this.ch4_enabled = false;
        break;
      case 0x22: // NR43: Polynomial counter
        this.ch4_clockShift = (val >> 4) & 0x0F;
        this.ch4_widthMode = (val >> 3) & 0x01;
        this.ch4_divisor = val & 0x07;
        break;
      case 0x23: // NR44: Trigger
        this.ch4_lengthEnabled = !!(val & 0x40);
        if (val & 0x80) this.triggerChannel4();
        break;

      // Master controls
      case 0x24: // NR50
        this.nr50 = val;
        break;
      case 0x25: // NR51
        this.nr51 = val;
        break;
    }
  }

  private triggerChannel1(): void {
    if (this.ch1_dacEnabled) this.ch1_enabled = true;
    if (this.ch1_lengthCounter === 0) this.ch1_lengthCounter = 64;
    this.ch1_freqTimer = (2048 - this.ch1_freq) * 4;
    this.ch1_volume = this.ch1_envInitVol;
    this.ch1_envTimer = this.ch1_envPeriod || 8;
    // Sweep
    this.ch1_sweepShadow = this.ch1_freq;
    this.ch1_sweepTimer = this.ch1_sweepPeriod || 8;
    this.ch1_sweepEnabled = this.ch1_sweepPeriod > 0 || this.ch1_sweepShift > 0;
    if (this.ch1_sweepShift > 0) {
      this.calcSweepFreq(); // overflow check
    }
  }

  private triggerChannel2(): void {
    if (this.ch2_dacEnabled) this.ch2_enabled = true;
    if (this.ch2_lengthCounter === 0) this.ch2_lengthCounter = 64;
    this.ch2_freqTimer = (2048 - this.ch2_freq) * 4;
    this.ch2_volume = this.ch2_envInitVol;
    this.ch2_envTimer = this.ch2_envPeriod || 8;
  }

  private triggerChannel3(): void {
    if (this.ch3_dacEnabled) this.ch3_enabled = true;
    if (this.ch3_lengthCounter === 0) this.ch3_lengthCounter = 256;
    this.ch3_freqTimer = (2048 - this.ch3_freq) * 2;
    this.ch3_samplePos = 0;
  }

  private triggerChannel4(): void {
    if (this.ch4_dacEnabled) this.ch4_enabled = true;
    if (this.ch4_lengthCounter === 0) this.ch4_lengthCounter = 64;
    var divisor = this.ch4_divisor === 0 ? 8 : this.ch4_divisor * 16;
    this.ch4_freqTimer = divisor << this.ch4_clockShift;
    this.ch4_volume = this.ch4_envInitVol;
    this.ch4_envTimer = this.ch4_envPeriod || 8;
    this.ch4_lfsr = 0x7FFF;
  }

  private calcSweepFreq(): number {
    var newFreq = this.ch1_sweepShadow >> this.ch1_sweepShift;
    if (this.ch1_sweepDir) {
      newFreq = this.ch1_sweepShadow - newFreq;
    } else {
      newFreq = this.ch1_sweepShadow + newFreq;
    }
    if (newFreq > 2047) {
      this.ch1_enabled = false;
    }
    return newFreq;
  }

  // Clock the APU by tCycles T-cycles
  clock(tCycles: number): void {
    if (!this.enabled) return;

    for (var t = 0; t < tCycles; t++) {
      // Frame sequencer: clocked at 512 Hz = every 8192 T-cycles
      this.frameSeqTimer++;
      if (this.frameSeqTimer >= 8192) {
        this.frameSeqTimer = 0;
        this.clockFrameSequencer();
      }

      // Channel 1 frequency timer
      if (this.ch1_enabled) {
        this.ch1_freqTimer--;
        if (this.ch1_freqTimer <= 0) {
          this.ch1_freqTimer = (2048 - this.ch1_freq) * 4;
          this.ch1_dutyPos = (this.ch1_dutyPos + 1) & 7;
        }
      }

      // Channel 2 frequency timer
      if (this.ch2_enabled) {
        this.ch2_freqTimer--;
        if (this.ch2_freqTimer <= 0) {
          this.ch2_freqTimer = (2048 - this.ch2_freq) * 4;
          this.ch2_dutyPos = (this.ch2_dutyPos + 1) & 7;
        }
      }

      // Channel 3 frequency timer (clocks at 2x rate)
      if (this.ch3_enabled) {
        this.ch3_freqTimer--;
        if (this.ch3_freqTimer <= 0) {
          this.ch3_freqTimer = (2048 - this.ch3_freq) * 2;
          this.ch3_samplePos = (this.ch3_samplePos + 1) & 31;
          // Read wave sample
          var sampleByte = this.waveRAM[this.ch3_samplePos >> 1];
          this.ch3_sampleBuffer = (this.ch3_samplePos & 1) ? (sampleByte & 0x0F) : (sampleByte >> 4);
        }
      }

      // Channel 4 frequency timer
      if (this.ch4_enabled) {
        this.ch4_freqTimer--;
        if (this.ch4_freqTimer <= 0) {
          var divisor = this.ch4_divisor === 0 ? 8 : this.ch4_divisor * 16;
          this.ch4_freqTimer = divisor << this.ch4_clockShift;
          // Clock LFSR
          var xor = (this.ch4_lfsr & 1) ^ ((this.ch4_lfsr >> 1) & 1);
          this.ch4_lfsr = (this.ch4_lfsr >> 1) | (xor << 14);
          if (this.ch4_widthMode) {
            this.ch4_lfsr = (this.ch4_lfsr & ~(1 << 6)) | (xor << 6);
          }
        }
      }
    }
  }

  private clockFrameSequencer(): void {
    // Step 0,2,4,6 = length counter (256 Hz)
    if ((this.frameSeqStep & 1) === 0) {
      this.clockLengthCounters();
    }
    // Step 2,6 = sweep (128 Hz)
    if (this.frameSeqStep === 2 || this.frameSeqStep === 6) {
      this.clockSweep();
    }
    // Step 7 = volume envelope (64 Hz)
    if (this.frameSeqStep === 7) {
      this.clockEnvelopes();
    }
    this.frameSeqStep = (this.frameSeqStep + 1) & 7;
  }

  private clockLengthCounters(): void {
    if (this.ch1_lengthEnabled && this.ch1_lengthCounter > 0) {
      this.ch1_lengthCounter--;
      if (this.ch1_lengthCounter === 0) this.ch1_enabled = false;
    }
    if (this.ch2_lengthEnabled && this.ch2_lengthCounter > 0) {
      this.ch2_lengthCounter--;
      if (this.ch2_lengthCounter === 0) this.ch2_enabled = false;
    }
    if (this.ch3_lengthEnabled && this.ch3_lengthCounter > 0) {
      this.ch3_lengthCounter--;
      if (this.ch3_lengthCounter === 0) this.ch3_enabled = false;
    }
    if (this.ch4_lengthEnabled && this.ch4_lengthCounter > 0) {
      this.ch4_lengthCounter--;
      if (this.ch4_lengthCounter === 0) this.ch4_enabled = false;
    }
  }

  private clockSweep(): void {
    if (!this.ch1_sweepEnabled) return;
    this.ch1_sweepTimer--;
    if (this.ch1_sweepTimer <= 0) {
      this.ch1_sweepTimer = this.ch1_sweepPeriod || 8;
      if (this.ch1_sweepPeriod > 0) {
        var newFreq = this.calcSweepFreq();
        if (newFreq <= 2047 && this.ch1_sweepShift > 0) {
          this.ch1_sweepShadow = newFreq;
          this.ch1_freq = newFreq;
          this.calcSweepFreq(); // overflow check with new freq
        }
      }
    }
  }

  private clockEnvelopes(): void {
    // Channel 1
    if (this.ch1_envPeriod > 0) {
      this.ch1_envTimer--;
      if (this.ch1_envTimer <= 0) {
        this.ch1_envTimer = this.ch1_envPeriod || 8;
        if (this.ch1_envDir && this.ch1_volume < 15) {
          this.ch1_volume++;
        } else if (!this.ch1_envDir && this.ch1_volume > 0) {
          this.ch1_volume--;
        }
      }
    }
    // Channel 2
    if (this.ch2_envPeriod > 0) {
      this.ch2_envTimer--;
      if (this.ch2_envTimer <= 0) {
        this.ch2_envTimer = this.ch2_envPeriod || 8;
        if (this.ch2_envDir && this.ch2_volume < 15) {
          this.ch2_volume++;
        } else if (!this.ch2_envDir && this.ch2_volume > 0) {
          this.ch2_volume--;
        }
      }
    }
    // Channel 4
    if (this.ch4_envPeriod > 0) {
      this.ch4_envTimer--;
      if (this.ch4_envTimer <= 0) {
        this.ch4_envTimer = this.ch4_envPeriod || 8;
        if (this.ch4_envDir && this.ch4_volume < 15) {
          this.ch4_volume++;
        } else if (!this.ch4_envDir && this.ch4_volume > 0) {
          this.ch4_volume--;
        }
      }
    }
  }

  // Get current mixed sample as float in [-1, 1]
  getSample(): number {
    if (!this.enabled) return 0;

    // Get per-channel digital outputs (0-15 range)
    var ch1out = 0, ch2out = 0, ch3out = 0, ch4out = 0;

    if (this.ch1_enabled && this.ch1_dacEnabled) {
      ch1out = DUTY_TABLE[this.ch1_duty][this.ch1_dutyPos] ? this.ch1_volume : 0;
    }
    if (this.ch2_enabled && this.ch2_dacEnabled) {
      ch2out = DUTY_TABLE[this.ch2_duty][this.ch2_dutyPos] ? this.ch2_volume : 0;
    }
    if (this.ch3_enabled && this.ch3_dacEnabled) {
      var waveSample = this.ch3_sampleBuffer;
      switch (this.ch3_volume) {
        case 0: waveSample = 0; break;       // mute
        case 1: break;                        // 100%
        case 2: waveSample >>= 1; break;     // 50%
        case 3: waveSample >>= 2; break;     // 25%
      }
      ch3out = waveSample;
    }
    if (this.ch4_enabled && this.ch4_dacEnabled) {
      ch4out = (this.ch4_lfsr & 1) ? 0 : this.ch4_volume; // bit 0 inverted
    }

    // DAC conversion: digital 0-15 maps to analog -1..+1
    // DAC output = (digital / 7.5) - 1
    var dac1 = ch1out / 7.5 - 1;
    var dac2 = ch2out / 7.5 - 1;
    var dac3 = ch3out / 7.5 - 1;
    var dac4 = ch4out / 7.5 - 1;

    // Mix left and right with NR51 panning
    var left = 0, right = 0;
    if (this.nr51 & 0x10) left += dac1;
    if (this.nr51 & 0x20) left += dac2;
    if (this.nr51 & 0x40) left += dac3;
    if (this.nr51 & 0x80) left += dac4;
    if (this.nr51 & 0x01) right += dac1;
    if (this.nr51 & 0x02) right += dac2;
    if (this.nr51 & 0x04) right += dac3;
    if (this.nr51 & 0x08) right += dac4;

    // Master volume (NR50): 0-7 range for each side
    var leftVol = ((this.nr50 >> 4) & 0x07) + 1;
    var rightVol = (this.nr50 & 0x07) + 1;
    left *= leftVol / 8;
    right *= rightVol / 8;

    // Mix to mono, scale down (4 channels max, each -1..+1)
    return (left + right) / 8;
  }

  saveState(): any {
    return {
      enabled: this.enabled, nr50: this.nr50, nr51: this.nr51,
      ch1_enabled: this.ch1_enabled, ch1_dacEnabled: this.ch1_dacEnabled,
      ch1_duty: this.ch1_duty, ch1_dutyPos: this.ch1_dutyPos,
      ch1_lengthCounter: this.ch1_lengthCounter, ch1_lengthEnabled: this.ch1_lengthEnabled,
      ch1_volume: this.ch1_volume, ch1_envInitVol: this.ch1_envInitVol,
      ch1_envDir: this.ch1_envDir, ch1_envPeriod: this.ch1_envPeriod, ch1_envTimer: this.ch1_envTimer,
      ch1_freq: this.ch1_freq, ch1_freqTimer: this.ch1_freqTimer,
      ch1_sweepPeriod: this.ch1_sweepPeriod, ch1_sweepDir: this.ch1_sweepDir,
      ch1_sweepShift: this.ch1_sweepShift, ch1_sweepTimer: this.ch1_sweepTimer,
      ch1_sweepEnabled: this.ch1_sweepEnabled, ch1_sweepShadow: this.ch1_sweepShadow,
      ch2_enabled: this.ch2_enabled, ch2_dacEnabled: this.ch2_dacEnabled,
      ch2_duty: this.ch2_duty, ch2_dutyPos: this.ch2_dutyPos,
      ch2_lengthCounter: this.ch2_lengthCounter, ch2_lengthEnabled: this.ch2_lengthEnabled,
      ch2_volume: this.ch2_volume, ch2_envInitVol: this.ch2_envInitVol,
      ch2_envDir: this.ch2_envDir, ch2_envPeriod: this.ch2_envPeriod, ch2_envTimer: this.ch2_envTimer,
      ch2_freq: this.ch2_freq, ch2_freqTimer: this.ch2_freqTimer,
      ch3_enabled: this.ch3_enabled, ch3_dacEnabled: this.ch3_dacEnabled,
      ch3_lengthCounter: this.ch3_lengthCounter, ch3_lengthEnabled: this.ch3_lengthEnabled,
      ch3_volume: this.ch3_volume, ch3_freq: this.ch3_freq, ch3_freqTimer: this.ch3_freqTimer,
      ch3_samplePos: this.ch3_samplePos, ch3_sampleBuffer: this.ch3_sampleBuffer,
      waveRAM: this.waveRAM.slice(0),
      ch4_enabled: this.ch4_enabled, ch4_dacEnabled: this.ch4_dacEnabled,
      ch4_lengthCounter: this.ch4_lengthCounter, ch4_lengthEnabled: this.ch4_lengthEnabled,
      ch4_volume: this.ch4_volume, ch4_envInitVol: this.ch4_envInitVol,
      ch4_envDir: this.ch4_envDir, ch4_envPeriod: this.ch4_envPeriod, ch4_envTimer: this.ch4_envTimer,
      ch4_clockShift: this.ch4_clockShift, ch4_widthMode: this.ch4_widthMode,
      ch4_divisor: this.ch4_divisor, ch4_freqTimer: this.ch4_freqTimer, ch4_lfsr: this.ch4_lfsr,
      frameSeqTimer: this.frameSeqTimer, frameSeqStep: this.frameSeqStep,
      regs: this.regs.slice(0),
    };
  }

  loadState(state: any): void {
    this.enabled = state.enabled; this.nr50 = state.nr50; this.nr51 = state.nr51;
    this.ch1_enabled = state.ch1_enabled; this.ch1_dacEnabled = state.ch1_dacEnabled;
    this.ch1_duty = state.ch1_duty; this.ch1_dutyPos = state.ch1_dutyPos;
    this.ch1_lengthCounter = state.ch1_lengthCounter; this.ch1_lengthEnabled = state.ch1_lengthEnabled;
    this.ch1_volume = state.ch1_volume; this.ch1_envInitVol = state.ch1_envInitVol;
    this.ch1_envDir = state.ch1_envDir; this.ch1_envPeriod = state.ch1_envPeriod;
    this.ch1_envTimer = state.ch1_envTimer;
    this.ch1_freq = state.ch1_freq; this.ch1_freqTimer = state.ch1_freqTimer;
    this.ch1_sweepPeriod = state.ch1_sweepPeriod; this.ch1_sweepDir = state.ch1_sweepDir;
    this.ch1_sweepShift = state.ch1_sweepShift; this.ch1_sweepTimer = state.ch1_sweepTimer;
    this.ch1_sweepEnabled = state.ch1_sweepEnabled; this.ch1_sweepShadow = state.ch1_sweepShadow;
    this.ch2_enabled = state.ch2_enabled; this.ch2_dacEnabled = state.ch2_dacEnabled;
    this.ch2_duty = state.ch2_duty; this.ch2_dutyPos = state.ch2_dutyPos;
    this.ch2_lengthCounter = state.ch2_lengthCounter; this.ch2_lengthEnabled = state.ch2_lengthEnabled;
    this.ch2_volume = state.ch2_volume; this.ch2_envInitVol = state.ch2_envInitVol;
    this.ch2_envDir = state.ch2_envDir; this.ch2_envPeriod = state.ch2_envPeriod;
    this.ch2_envTimer = state.ch2_envTimer;
    this.ch2_freq = state.ch2_freq; this.ch2_freqTimer = state.ch2_freqTimer;
    this.ch3_enabled = state.ch3_enabled; this.ch3_dacEnabled = state.ch3_dacEnabled;
    this.ch3_lengthCounter = state.ch3_lengthCounter; this.ch3_lengthEnabled = state.ch3_lengthEnabled;
    this.ch3_volume = state.ch3_volume; this.ch3_freq = state.ch3_freq;
    this.ch3_freqTimer = state.ch3_freqTimer;
    this.ch3_samplePos = state.ch3_samplePos; this.ch3_sampleBuffer = state.ch3_sampleBuffer;
    if (state.waveRAM) this.waveRAM.set(state.waveRAM);
    this.ch4_enabled = state.ch4_enabled; this.ch4_dacEnabled = state.ch4_dacEnabled;
    this.ch4_lengthCounter = state.ch4_lengthCounter; this.ch4_lengthEnabled = state.ch4_lengthEnabled;
    this.ch4_volume = state.ch4_volume; this.ch4_envInitVol = state.ch4_envInitVol;
    this.ch4_envDir = state.ch4_envDir; this.ch4_envPeriod = state.ch4_envPeriod;
    this.ch4_envTimer = state.ch4_envTimer;
    this.ch4_clockShift = state.ch4_clockShift; this.ch4_widthMode = state.ch4_widthMode;
    this.ch4_divisor = state.ch4_divisor; this.ch4_freqTimer = state.ch4_freqTimer;
    this.ch4_lfsr = state.ch4_lfsr;
    this.frameSeqTimer = state.frameSeqTimer; this.frameSeqStep = state.frameSeqStep;
    if (state.regs) this.regs.set(state.regs);
  }
}

export class GameBoyMachine extends BasicScanlineMachine {

  cpuFrequency = 4194304;       // 4.19 MHz
  canvasWidth = 160;
  numVisibleScanlines = 144;
  numTotalScanlines = 154;      // 144 visible + 10 vblank
  cpuCyclesPerLine = 456;       // T-cycles per scanline
  sampleRate = 154 * 60 * 4; // ~36960 Hz: 4 audio samples per scanline
  overscan = false;
  defaultROMSize = 0x8000;      // 32KB minimum

  cpu: SM83 = new SM83();
  ram = new Uint8Array(0x2000);       // Work RAM (C000-DFFF)
  vram = new Uint8Array(0x2000);      // Video RAM (8000-9FFF)
  oam = new Uint8Array(0xA0);         // OAM (FE00-FE9F)
  hram = new Uint8Array(0x80);        // High RAM (FF80-FFFE)
  extram = new Uint8Array(0x2000);    // External/cartridge RAM (A000-BFFF)

  // IO registers
  joyp: number = 0xCF;         // FF00 - Joypad
  sb: number = 0;              // FF01 - Serial transfer data
  sc: number = 0;              // FF02 - Serial transfer control
  divCounter: number = 0;      // Internal 16-bit DIV counter
  tima: number = 0;            // FF05 - Timer counter
  tma: number = 0;             // FF06 - Timer modulo
  tac: number = 0;             // FF07 - Timer control
  iflag: number = 0;           // FF0F - Interrupt flag
  ie: number = 0;              // FFFF - Interrupt enable

  // PPU registers
  lcdc: number = 0x91;         // FF40 - LCD control
  stat: number = 0;            // FF41 - LCD status
  scy: number = 0;             // FF42 - Scroll Y
  scx: number = 0;             // FF43 - Scroll X
  ly: number = 0;              // FF44 - LCD Y coordinate
  lyc: number = 0;             // FF45 - LY compare
  dma: number = 0;             // FF46 - DMA transfer
  bgp: number = 0xFC;          // FF47 - BG palette
  obp0: number = 0xFF;         // FF48 - Object palette 0
  obp1: number = 0xFF;         // FF49 - Object palette 1
  wy: number = 0;              // FF4A - Window Y
  wx: number = 0;              // FF4B - Window X

  // Audio
  apu = new GameBoyAPU();
  apuCycleAccum: number = 0;        // accumulate T-cycles for downsampling

  // PPU state
  ppuMode: number = 0;        // 0=HBlank, 1=VBlank, 2=OAM, 3=Transfer
  ppuDot: number = 0;          // Dot counter within scanline
  windowLine: number = 0;     // Internal window line counter

  // MBC1 state
  mbcType: number = 0;        // 0=ROM only, 1=MBC1
  romBank: number = 1;
  ramBank: number = 0;
  ramEnabled: boolean = false;
  mbcMode: number = 0;        // 0=ROM banking, 1=RAM banking
  romBankMask: number = 0x1F;

  getKeyboardMap() { return GB_KEYCODE_MAP; }

  constructor() {
    super();
    this.handler = newKeyboardHandler(this.inputs, this.getKeyboardMap());
    this.connectCPUMemoryBus(this);
  }

  read = newAddressDecoder([
    [0x0000, 0x3FFF, 0x3FFF, (a) => { return this.rom ? this.rom[a] : 0xFF; }],
    [0x4000, 0x7FFF, 0x3FFF, (a) => { return this.readBankedROM(a); }],
    [0x8000, 0x9FFF, 0x1FFF, (a) => { return this.vram[a]; }],
    [0xA000, 0xBFFF, 0x1FFF, (a) => { return this.readExtRAM(a); }],
    [0xC000, 0xDFFF, 0x1FFF, (a) => { return this.ram[a]; }],
    [0xE000, 0xFDFF, 0x1FFF, (a) => { return this.ram[a]; }], // Echo RAM
    [0xFE00, 0xFE9F, 0xFF,   (a) => { return this.oam[a]; }],
    [0xFEA0, 0xFEFF, 0xFF,   (a) => { return 0xFF; }], // Unusable
    [0xFF00, 0xFF7F, 0x7F,   (a) => { return this.readIO(a); }],
    [0xFF80, 0xFFFE, 0x7F,   (a) => { return this.hram[a]; }],
    [0xFFFF, 0xFFFF, 0,      (a) => { return this.ie; }],
  ]);

  write = newAddressDecoder([
    [0x0000, 0x1FFF, 0x1FFF, (a, v) => { this.writeMBC(a, v); }],
    [0x2000, 0x3FFF, 0x1FFF, (a, v) => { this.writeMBC(0x2000 + a, v); }],
    [0x4000, 0x5FFF, 0x1FFF, (a, v) => { this.writeMBC(0x4000 + a, v); }],
    [0x6000, 0x7FFF, 0x1FFF, (a, v) => { this.writeMBC(0x6000 + a, v); }],
    [0x8000, 0x9FFF, 0x1FFF, (a, v) => { this.vram[a] = v; }],
    [0xA000, 0xBFFF, 0x1FFF, (a, v) => { this.writeExtRAM(a, v); }],
    [0xC000, 0xDFFF, 0x1FFF, (a, v) => { this.ram[a] = v; }],
    [0xE000, 0xFDFF, 0x1FFF, (a, v) => { this.ram[a] = v; }], // Echo RAM
    [0xFE00, 0xFE9F, 0xFF,   (a, v) => { this.oam[a] = v; }],
    [0xFEA0, 0xFEFF, 0xFF,   (a, v) => { /* unusable */ }],
    [0xFF00, 0xFF7F, 0x7F,   (a, v) => { this.writeIO(a, v); }],
    [0xFF80, 0xFFFE, 0x7F,   (a, v) => { this.hram[a] = v; }],
    [0xFFFF, 0xFFFF, 0,      (a, v) => { this.ie = v; }],
  ]);

  // MBC1 ROM banking
  readBankedROM(a: number): number {
    if (!this.rom) return 0xFF;
    var bank = this.romBank;
    if (this.mbcType === 0) bank = 1; // ROM only
    var addr = a + (bank * 0x4000);
    return addr < this.rom.length ? this.rom[addr] : 0xFF;
  }

  writeMBC(fullAddr: number, v: number): void {
    if (this.mbcType === 0) return; // ROM-only, ignore writes
    if (fullAddr < 0x2000) {
      // RAM enable
      this.ramEnabled = (v & 0x0F) === 0x0A;
    } else if (fullAddr < 0x4000) {
      // ROM bank number (lower 5 bits)
      var bank = v & 0x1F;
      if (bank === 0) bank = 1;
      this.romBank = (this.romBank & 0x60) | bank;
      this.romBank &= this.romBankMask;
    } else if (fullAddr < 0x6000) {
      // RAM bank / upper ROM bank bits
      if (this.mbcMode === 0) {
        this.romBank = (this.romBank & 0x1F) | ((v & 0x03) << 5);
        this.romBank &= this.romBankMask;
      } else {
        this.ramBank = v & 0x03;
      }
    } else {
      // Banking mode select
      this.mbcMode = v & 0x01;
    }
  }

  readExtRAM(a: number): number {
    if (!this.ramEnabled && this.mbcType > 0) return 0xFF;
    var offset = a + (this.ramBank * 0x2000);
    return offset < this.extram.length ? this.extram[offset] : 0xFF;
  }

  writeExtRAM(a: number, v: number): void {
    if (!this.ramEnabled && this.mbcType > 0) return;
    var offset = a + (this.ramBank * 0x2000);
    if (offset < this.extram.length) this.extram[offset] = v;
  }

  // IO register read
  readIO(a: number): number {
    switch (a) {
      case 0x00: return this.readJoypad();
      case 0x01: return this.sb;
      case 0x02: return this.sc;
      case 0x04: return (this.divCounter >> 8) & 0xFF; // DIV
      case 0x05: return this.tima;
      case 0x06: return this.tma;
      case 0x07: return this.tac | 0xF8;
      case 0x0F: return this.iflag | 0xE0;
      // Audio registers + Wave RAM
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14:
      case 0x15: case 0x16: case 0x17: case 0x18: case 0x19:
      case 0x1A: case 0x1B: case 0x1C: case 0x1D: case 0x1E:
      case 0x1F: case 0x20: case 0x21: case 0x22: case 0x23:
      case 0x24: case 0x25: case 0x26:
      case 0x30: case 0x31: case 0x32: case 0x33:
      case 0x34: case 0x35: case 0x36: case 0x37:
      case 0x38: case 0x39: case 0x3A: case 0x3B:
      case 0x3C: case 0x3D: case 0x3E: case 0x3F:
        return this.apu.readRegister(a);
      // PPU registers
      case 0x40: return this.lcdc;
      case 0x41: return this.stat | 0x80;
      case 0x42: return this.scy;
      case 0x43: return this.scx;
      case 0x44: return this.ly;
      case 0x45: return this.lyc;
      case 0x46: return this.dma;
      case 0x47: return this.bgp;
      case 0x48: return this.obp0;
      case 0x49: return this.obp1;
      case 0x4A: return this.wy;
      case 0x4B: return this.wx;
      default: return 0xFF;
    }
  }

  // IO register write
  writeIO(a: number, v: number): void {
    switch (a) {
      case 0x00: this.joyp = v; break;
      case 0x01: this.sb = v; break;
      case 0x02: this.sc = v; break;
      case 0x04: this.divCounter = 0; break; // Writing any value resets DIV
      case 0x05: this.tima = v; break;
      case 0x06: this.tma = v; break;
      case 0x07: this.tac = v & 0x07; break;
      case 0x0F: this.iflag = v & 0x1F; break;
      // Audio registers + Wave RAM
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14:
      case 0x15: case 0x16: case 0x17: case 0x18: case 0x19:
      case 0x1A: case 0x1B: case 0x1C: case 0x1D: case 0x1E:
      case 0x1F: case 0x20: case 0x21: case 0x22: case 0x23:
      case 0x24: case 0x25: case 0x26:
      case 0x30: case 0x31: case 0x32: case 0x33:
      case 0x34: case 0x35: case 0x36: case 0x37:
      case 0x38: case 0x39: case 0x3A: case 0x3B:
      case 0x3C: case 0x3D: case 0x3E: case 0x3F:
        this.apu.writeRegister(a, v);
        break;
      // PPU registers
      case 0x40:
        this.lcdc = v;
        if (!(v & 0x80)) {
          // LCD disabled — reset PPU state
          this.ly = 0;
          this.ppuMode = 0;
          this.ppuDot = 0;
          this.stat = (this.stat & 0xFC); // mode 0
        }
        break;
      case 0x41: this.stat = (this.stat & 0x07) | (v & 0x78); break; // lower 3 bits read-only
      case 0x42: this.scy = v; break;
      case 0x43: this.scx = v; break;
      case 0x44: break; // LY is read-only
      case 0x45: this.lyc = v; break;
      case 0x46: this.dmaTransfer(v); break;
      case 0x47: this.bgp = v; break;
      case 0x48: this.obp0 = v; break;
      case 0x49: this.obp1 = v; break;
      case 0x4A: this.wy = v; break;
      case 0x4B: this.wx = v; break;
    }
  }

  // Joypad reading (FF00)
  readJoypad(): number {
    var result = this.joyp | 0x0F;
    // Bits 4-5 select which button group to read
    if (!(this.joyp & 0x10)) {
      // Direction keys selected (active low)
      result &= ~(this.inputs[0] & 0x0F);
    }
    if (!(this.joyp & 0x20)) {
      // Button keys selected (active low)
      result &= ~((this.inputs[0] >> 4) & 0x0F);
    }
    return result | 0xC0;
  }

  // OAM DMA transfer (instant copy)
  dmaTransfer(v: number): void {
    this.dma = v;
    var srcBase = v << 8;
    for (var i = 0; i < 0xA0; i++) {
      this.oam[i] = this.read(srcBase + i);
    }
  }

  // Timer update — called per CPU cycle (M-cycle)
  updateTimer(cycles: number): void {
    // DIV increments at 16384 Hz = every 256 T-cycles = 64 M-cycles
    // But we count in M-cycles (4 T-cycles each)
    this.divCounter = (this.divCounter + (cycles * 4)) & 0xFFFF;

    if (!(this.tac & 0x04)) return; // Timer disabled

    // Timer clock select
    var timerPeriod: number;
    switch (this.tac & 0x03) {
      case 0: timerPeriod = 1024; break; // 4096 Hz
      case 1: timerPeriod = 16; break;   // 262144 Hz
      case 2: timerPeriod = 64; break;   // 65536 Hz
      case 3: timerPeriod = 256; break;  // 16384 Hz
      default: timerPeriod = 1024;
    }

    // Simplified timer — increment TIMA per period
    // In a more accurate emulator, we'd track the sub-cycle counter
    // For now, we check if DIV crossed the relevant bit boundary
    for (var i = 0; i < cycles; i++) {
      this.tima++;
      if (this.tima > 0xFF) {
        this.tima = this.tma;
        this.iflag |= 0x04; // Timer interrupt
      }
    }
  }

  // Sync interrupt flags from machine state to CPU
  syncInterrupts(): void {
    var pending = this.iflag & this.ie & 0x1F;
    this.cpu.interruptFlags = pending;
  }

  // After CPU handles an interrupt, clear corresponding bit in IF
  syncInterruptsBack(): void {
    // The CPU clears bits in interruptFlags when servicing
    // We need to reflect that back to IF
    var handled = (this.iflag & this.ie & 0x1F) & ~this.cpu.interruptFlags;
    this.iflag &= ~handled;
  }

  // Override advanceCPU to include timer, PPU mode tracking, and interrupt sync
  advanceCPU() {
    this.syncInterrupts();
    var oldFlags = this.cpu.interruptFlags;
    var c = this.cpu as any;
    var n = 1;
    if (this.cpu.isStable()) { this.probe.logExecute(this.cpu.getPC(), this.cpu.getSP()); }
    if (c.advanceInsn) { n = c.advanceInsn(1); }
    var tCycles = n * 4;
    this.probe.logClocks(tCycles);
    // Sync back any interrupt handling
    if (this.cpu.interruptFlags !== oldFlags) {
      this.syncInterruptsBack();
    }
    // Update timer
    this.updateTimerMCycles(n);
    // Update PPU mode based on dot position within scanline
    this.updatePPUMode(tCycles);
    // Clock APU and generate audio samples
    this.apu.clock(tCycles);
    if (this.audio) {
      // Downsample: emit a sample every ~114 T-cycles (456 / 4 samples per line)
      this.apuCycleAccum += tCycles;
      var samplePeriod = 114; // 456 T-cycles per line / 4 samples per line
      while (this.apuCycleAccum >= samplePeriod) {
        this.apuCycleAccum -= samplePeriod;
        this.audio.feedSample(this.apu.getSample(), 1);
      }
    }
    return tCycles; // return T-cycles to match cpuCyclesPerLine
  }

  // Update PPU mode based on dot position within the current scanline
  updatePPUMode(tCycles: number): void {
    if (this.scanline >= 144) return; // VBlank mode doesn't change
    this.ppuDot += tCycles;
    var oldMode = this.ppuMode;
    if (this.ppuDot < 80) {
      this.ppuMode = 2; // OAM scan
    } else if (this.ppuDot < 252) {
      this.ppuMode = 3; // Drawing/transfer
    } else {
      this.ppuMode = 0; // HBlank
    }
    if (this.ppuMode !== oldMode) {
      this.stat = (this.stat & 0xFC) | (this.ppuMode & 0x03);
      // Fire STAT interrupts on mode transitions
      if (this.ppuMode === 0 && (this.stat & 0x08)) {
        this.iflag |= 0x02; // HBlank STAT interrupt
      } else if (this.ppuMode === 2 && (this.stat & 0x20)) {
        this.iflag |= 0x02; // OAM STAT interrupt
      }
    }
  }

  // Timer tracking with proper sub-cycle accuracy
  private timerSubCycles: number = 0;

  updateTimerMCycles(mCycles: number): void {
    var tCycles = mCycles * 4;
    this.divCounter = (this.divCounter + tCycles) & 0xFFFF;

    if (!(this.tac & 0x04)) return;

    var timerPeriod: number;
    switch (this.tac & 0x03) {
      case 0: timerPeriod = 1024; break;
      case 1: timerPeriod = 16; break;
      case 2: timerPeriod = 64; break;
      case 3: timerPeriod = 256; break;
      default: timerPeriod = 1024;
    }

    this.timerSubCycles += tCycles;
    while (this.timerSubCycles >= timerPeriod) {
      this.timerSubCycles -= timerPeriod;
      this.tima = (this.tima + 1) & 0xFF;
      if (this.tima === 0) {
        this.tima = this.tma;
        this.iflag |= 0x04;
      }
    }
  }

  startScanline(): void {
    this.ly = this.scanline;
    this.ppuDot = 0;
    // Update PPU mode based on scanline position
    if (this.scanline < 144) {
      // Visible scanline: starts in Mode 2 (OAM scan)
      this.ppuMode = 2;
    } else {
      // VBlank
      this.ppuMode = 1;
      if (this.scanline === 144) {
        this.iflag |= 0x01; // VBlank interrupt
        // STAT VBlank interrupt
        if (this.stat & 0x10) {
          this.iflag |= 0x02;
        }
      }
    }

    // LYC compare
    if (this.ly === this.lyc) {
      this.stat |= 0x04; // coincidence flag
      if (this.stat & 0x40) {
        this.iflag |= 0x02; // STAT interrupt
      }
    } else {
      this.stat &= ~0x04;
    }

    // Update STAT mode bits
    this.stat = (this.stat & 0xFC) | (this.ppuMode & 0x03);
  }

  drawScanline(): void {
    if (!(this.lcdc & 0x80)) return; // LCD disabled
    if (this.scanline >= 144) return; // VBlank, nothing to draw

    var lineOffset = this.scanline * 160;

    // Draw background
    if (this.lcdc & 0x01) {
      this.drawBGLine(lineOffset);
    } else {
      // BG disabled — fill with color 0
      for (var x = 0; x < 160; x++) {
        this.pixels[lineOffset + x] = DMG_PALETTE[0];
      }
    }

    // Draw window
    if ((this.lcdc & 0x20) && this.scanline >= this.wy) {
      this.drawWindowLine(lineOffset);
    }

    // Draw sprites
    if (this.lcdc & 0x02) {
      this.drawSpriteLine(lineOffset);
    }

  }

  // Get color from palette register
  getPaletteColor(palette: number, colorIndex: number): number {
    var shade = (palette >> (colorIndex * 2)) & 0x03;
    return DMG_PALETTE[shade];
  }

  // Draw one line of background
  drawBGLine(lineOffset: number): void {
    var tileMap = (this.lcdc & 0x08) ? 0x1C00 : 0x1800; // BG tile map select
    var tileData = (this.lcdc & 0x10) ? 0x0000 : 0x0800; // BG & Window tile data select
    var signed = !(this.lcdc & 0x10); // Use signed tile indices when bit 4 is 0

    var y = (this.scanline + this.scy) & 0xFF;
    var tileRow = (y >> 3) & 31;
    var tileYOffset = y & 7;

    for (var x = 0; x < 160; x++) {
      var scrolledX = (x + this.scx) & 0xFF;
      var tileCol = (scrolledX >> 3) & 31;
      var tileXBit = 7 - (scrolledX & 7);

      // Get tile index from map
      var tileIndex = this.vram[tileMap + tileRow * 32 + tileCol];
      var tileAddr: number;
      if (signed) {
        // Signed: tile 0 is at 0x9000 (VRAM offset 0x1000)
        tileAddr = 0x1000 + (((tileIndex << 24) >> 24) * 16); // sign extend
      } else {
        tileAddr = tileIndex * 16;
      }

      // Get pixel from tile data (2bpp)
      var lo = this.vram[tileAddr + tileYOffset * 2];
      var hi = this.vram[tileAddr + tileYOffset * 2 + 1];
      var colorIndex = ((hi >> tileXBit) & 1) << 1 | ((lo >> tileXBit) & 1);

      this.pixels[lineOffset + x] = this.getPaletteColor(this.bgp, colorIndex);
    }
  }

  // Draw one line of window
  drawWindowLine(lineOffset: number): void {
    var wxAdjusted = this.wx - 7;
    if (wxAdjusted >= 160) return;

    var tileMap = (this.lcdc & 0x40) ? 0x1C00 : 0x1800; // Window tile map select
    var tileData = (this.lcdc & 0x10) ? 0x0000 : 0x0800;
    var signed = !(this.lcdc & 0x10);

    var winY = this.windowLine;
    var tileRow = (winY >> 3) & 31;
    var tileYOffset = winY & 7;

    var drawn = false;
    for (var x = Math.max(0, wxAdjusted); x < 160; x++) {
      var winX = x - wxAdjusted;
      var tileCol = (winX >> 3) & 31;
      var tileXBit = 7 - (winX & 7);

      var tileIndex = this.vram[tileMap + tileRow * 32 + tileCol];
      var tileAddr: number;
      if (signed) {
        tileAddr = 0x1000 + (((tileIndex << 24) >> 24) * 16);
      } else {
        tileAddr = tileIndex * 16;
      }

      var lo = this.vram[tileAddr + tileYOffset * 2];
      var hi = this.vram[tileAddr + tileYOffset * 2 + 1];
      var colorIndex = ((hi >> tileXBit) & 1) << 1 | ((lo >> tileXBit) & 1);

      this.pixels[lineOffset + x] = this.getPaletteColor(this.bgp, colorIndex);
      drawn = true;
    }
    if (drawn) this.windowLine++;
  }

  // Draw sprites for current line
  drawSpriteLine(lineOffset: number): void {
    var spriteHeight = (this.lcdc & 0x04) ? 16 : 8;
    var spritesOnLine = 0;

    // Collect sprites on this scanline (max 10)
    var sprites: { x: number, index: number }[] = [];
    for (var i = 0; i < 40 && spritesOnLine < 10; i++) {
      var y = this.oam[i * 4] - 16;
      var x = this.oam[i * 4 + 1] - 8;
      if (this.scanline >= y && this.scanline < y + spriteHeight) {
        sprites.push({ x: x, index: i });
        spritesOnLine++;
      }
    }

    // Sort by X coordinate (lower X = higher priority, ties broken by OAM index)
    sprites.sort((a, b) => a.x !== b.x ? a.x - b.x : a.index - b.index);

    // Draw sprites in reverse order (lowest priority first, so higher priority overwrites)
    for (var si = sprites.length - 1; si >= 0; si--) {
      var spriteIndex = sprites[si].index;
      var yPos = this.oam[spriteIndex * 4] - 16;
      var xPos = this.oam[spriteIndex * 4 + 1] - 8;
      var tileIndex = this.oam[spriteIndex * 4 + 2];
      var flags = this.oam[spriteIndex * 4 + 3];

      var palette = (flags & 0x10) ? this.obp1 : this.obp0;
      var xFlip = !!(flags & 0x20);
      var yFlip = !!(flags & 0x40);
      var bgPriority = !!(flags & 0x80);

      if (spriteHeight === 16) tileIndex &= 0xFE; // Ignore bit 0 for 8x16 sprites

      var tileY = this.scanline - yPos;
      if (yFlip) tileY = spriteHeight - 1 - tileY;

      var tileAddr = tileIndex * 16 + tileY * 2;
      var lo = this.vram[tileAddr];
      var hi = this.vram[tileAddr + 1];

      for (var px = 0; px < 8; px++) {
        var screenX = xPos + px;
        if (screenX < 0 || screenX >= 160) continue;

        var bit = xFlip ? px : (7 - px);
        var colorIndex = ((hi >> bit) & 1) << 1 | ((lo >> bit) & 1);
        if (colorIndex === 0) continue; // Transparent

        // BG priority: sprite hidden behind BG colors 1-3
        if (bgPriority) {
          var bgColor = this.pixels[lineOffset + screenX];
          if (bgColor !== DMG_PALETTE[(this.bgp & 0x03)]) continue; // BG color 0 check
        }

        this.pixels[lineOffset + screenX] = this.getPaletteColor(palette, colorIndex);
      }
    }
  }

  loadROM(data: Uint8Array, title?: string): void {
    // Detect MBC type from cartridge header
    if (data.length > 0x147) {
      var cartType = data[0x147];
      switch (cartType) {
        case 0x00: this.mbcType = 0; break; // ROM only
        case 0x01: case 0x02: case 0x03: this.mbcType = 1; break; // MBC1
        default: console.log(`Invalid cartridge type @ 0x147: ${data[0x147]}`); break;
      }
    } else throw new EmuHalt("ROM not long enough for header");

    // Determine ROM size and bank mask
    this.rom = new Uint8Array(Math.max(data.length, 0x8000));
    this.rom.set(data);
    var numBanks = Math.max(2, this.rom.length >> 14);
    this.romBankMask = numBanks - 1;

    // Determine RAM size from header
    switch (data[0x149]) {
      case 0x00: break; // No RAM
      case 0x01: this.extram = new Uint8Array(0x800); break;   // 2KB
      case 0x02: this.extram = new Uint8Array(0x2000); break;  // 8KB
      case 0x03: this.extram = new Uint8Array(0x8000); break;  // 32KB
      case 0x04: this.extram = new Uint8Array(0x20000); break; // 128KB
      case 0x05: this.extram = new Uint8Array(0x10000); break; // 64KB
      default: console.log(`Invalid RAM size code @ 0x149: ${data[0x149]}`); break;
    }

    this.reset();
  }

  reset(): void {
    super.reset();
    this.ram.fill(0);
    this.vram.fill(0);
    this.oam.fill(0);
    this.hram.fill(0);
    this.iflag = 0;
    this.ie = 0;
    this.lcdc = 0x91;
    this.stat = 0;
    this.scy = 0;
    this.scx = 0;
    this.ly = 0;
    this.lyc = 0;
    this.bgp = 0xFC;
    this.obp0 = 0xFF;
    this.obp1 = 0xFF;
    this.wy = 0;
    this.wx = 0;
    this.joyp = 0xCF;
    this.divCounter = 0;
    this.tima = 0;
    this.tma = 0;
    this.tac = 0;
    this.ppuMode = 0;
    this.ppuDot = 0;
    this.windowLine = 0;
    this.romBank = 1;
    this.ramBank = 0;
    this.ramEnabled = false;
    this.mbcMode = 0;
    this.timerSubCycles = 0;
    this.apuCycleAccum = 0;
    this.apu.reset();
  }

  preFrame(): void {
    this.windowLine = 0;
  }

  readVRAMAddress(a: number): number {
    return this.vram[a & 0x1FFF];
  }

  // Save/load state
  saveState() {
    var state = super.saveState();
    state['vram'] = this.vram.slice(0);
    state['oam'] = this.oam.slice(0);
    state['hram'] = this.hram.slice(0);
    state['extram'] = this.extram.slice(0);
    state['io'] = {
      joyp: this.joyp, sb: this.sb, sc: this.sc,
      divCounter: this.divCounter, tima: this.tima, tma: this.tma, tac: this.tac,
      iflag: this.iflag, ie: this.ie,
      lcdc: this.lcdc, stat: this.stat, scy: this.scy, scx: this.scx,
      ly: this.ly, lyc: this.lyc, dma: this.dma,
      bgp: this.bgp, obp0: this.obp0, obp1: this.obp1,
      wy: this.wy, wx: this.wx,
      ppuMode: this.ppuMode, ppuDot: this.ppuDot, windowLine: this.windowLine,
      romBank: this.romBank, ramBank: this.ramBank,
      ramEnabled: this.ramEnabled, mbcMode: this.mbcMode,
      timerSubCycles: this.timerSubCycles,
    };
    state['apu'] = this.apu.saveState();
    state['apuCycleAccum'] = this.apuCycleAccum;
    return state;
  }

  loadState(state) {
    super.loadState(state);
    this.vram.set(state.vram);
    this.oam.set(state.oam);
    this.hram.set(state.hram);
    if (state.extram) this.extram.set(state.extram);
    var io = state.io;
    this.joyp = io.joyp; this.sb = io.sb; this.sc = io.sc;
    this.divCounter = io.divCounter; this.tima = io.tima; this.tma = io.tma; this.tac = io.tac;
    this.iflag = io.iflag; this.ie = io.ie;
    this.lcdc = io.lcdc; this.stat = io.stat; this.scy = io.scy; this.scx = io.scx;
    this.ly = io.ly; this.lyc = io.lyc; this.dma = io.dma;
    this.bgp = io.bgp; this.obp0 = io.obp0; this.obp1 = io.obp1;
    this.wy = io.wy; this.wx = io.wx;
    this.ppuMode = io.ppuMode; this.ppuDot = io.ppuDot; this.windowLine = io.windowLine;
    this.romBank = io.romBank; this.ramBank = io.ramBank;
    this.ramEnabled = io.ramEnabled; this.mbcMode = io.mbcMode;
    this.timerSubCycles = io.timerSubCycles;
    if (state.apu) this.apu.loadState(state.apu);
    this.apuCycleAccum = state.apuCycleAccum || 0;
  }

  getDebugCategories() {
    return ['CPU', 'Stack', 'PPU'];
  }

  getDebugInfo(category, state) {
    switch (category) {
      case 'PPU':
        return "LCDC " + hex(this.lcdc, 2) + "  STAT " + hex(this.stat, 2) + "\n"
          + "LY   " + hex(this.ly, 2) + "  LYC  " + hex(this.lyc, 2) + "\n"
          + "SCX  " + hex(this.scx, 2) + "  SCY  " + hex(this.scy, 2) + "\n"
          + "WX   " + hex(this.wx, 2) + "  WY   " + hex(this.wy, 2) + "\n"
          + "BGP  " + hex(this.bgp, 2) + "  OBP0 " + hex(this.obp0, 2) + "\n"
          + "OBP1 " + hex(this.obp1, 2) + "  DMA  " + hex(this.dma, 2) + "\n"
          + "IF   " + hex(this.iflag, 2) + "  IE   " + hex(this.ie, 2) + "\n"
          + "DIV  " + hex((this.divCounter >> 8) & 0xFF, 2) + "  TIMA " + hex(this.tima, 2) + "\n"
          + "TMA  " + hex(this.tma, 2) + "  TAC  " + hex(this.tac, 2) + "\n"
          + "Bank " + this.romBank + "\n";
    }
  }
}
