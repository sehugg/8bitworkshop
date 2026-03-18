// based on https://github.com/mamedev/mame/blob/master/src/devices/cpu/f8/f8.cpp
// license:BSD-3-Clause
// copyright-holders:Juergen Buchmueller
// and https://raw.githubusercontent.com/mamedev/mame/master/src/mame/fairchild/channelf.cpp
// license:GPL-2.0+
// copyright-holders:Juergen Buchmueller, Frank Palazzolo, Sean Riddle

import { F8CPU, F8State } from "../common/cpu/F8";
import { BasicMachine, Bus, SampledAudioSink } from "../common/devices";
import { KeyFlags, Keys, newAddressDecoder, padBytes } from "../common/emu";
import { hex } from "../common/util";

// Channel F color palette (RGBA)
const CHANNELF_COLORS = [
  0xFF484848, // 0: dark gray/background (approximation for "field" color)
  0xFF5050FF, // 1: blue
  0xFF50FF50, // 2: green  -> actually the red
  0xFF808080, // 3: gray
  0xFFFFFFFF, // 4: white (BG palette)
  0xFF50FF50, // 5: green
  0xFFFF5050, // 6: red
  0xFFC8C8C8, // 7: light gray
];

// Full 16-entry color map (4 palette banks x 4 colors)
const CHANNELF_COLORMAP = [
  // Palette 0 (default)
  0xFF484848, // 0: background
  0xFF50FF50, // 1: green
  0xFF5050FF, // 2: blue
  0xFF808080, // 3: gray
  // Palette 1
  0xFFFF5050, // 0: red (background)
  0xFF50FF50, // 1: green
  0xFF5050FF, // 2: blue
  0xFF808080, // 3: gray
  // Palette 2
  0xFF484848, // 0: background
  0xFFFF5050, // 1: red
  0xFF5050FF, // 2: blue
  0xFF808080, // 3: gray
  // Palette 3
  0xFF484848, // 0: background
  0xFF50FF50, // 1: green
  0xFFFF5050, // 2: red
  0xFF808080, // 3: gray
];

// Input port bit definitions
const INPUT_RIGHT   = 0x01;
const INPUT_LEFT    = 0x02;
const INPUT_BACK    = 0x04;
const INPUT_FORWARD = 0x08;
const INPUT_CCW     = 0x10;  // counter-clockwise
const INPUT_CW      = 0x20;  // clockwise
const INPUT_PULL    = 0x40;
const INPUT_PUSH    = 0x80;

export class ChannelF extends BasicMachine {

  cpuFrequency = 1789773;  // NTSC: 3.579545 MHz / 2
  defaultROMSize = 0x10000;

  // Video params
  canvasWidth = 128;
  numVisibleScanlines = 64;
  numTotalScanlines = 64;
  cpuCyclesPerLine = this.cpuFrequency / 60 / 64; // ~466 cycles per line

  sampleRate = this.cpuFrequency / 2; // audio sample rate

  cpu = new F8CPU();
  ram = new Uint8Array(0x10000); // address space (ROM + VRAM)
  vram = new Uint8Array(0x2000); // 8KB video RAM (128x64, 2 bits per pixel)

  bios: Uint8Array;

  // I/O port latches
  port0: number = 0;  // console switches
  port1: number = 0;  // right controller
  port4: number = 0;  // left controller
  port5: number = 0;  // row/column/sound

  // Video registers
  row_reg: number = 0;
  col_reg: number = 0;
  color: number = 0;

  // Audio state
  soundMode: number = 0;
  soundCounter: number = 0;
  soundEnvelope: number = 0;
  soundOnTime: number = 0;

  constructor() {
    super();
    this.bios = new Uint8Array(0x800); // 2KB BIOS
    this.connectCPUMemoryBus(this);
    this.cpu.connectIOBus(this.newIOBus());
  }

  newIOBus(): Bus {
    return this.probeIOBus({
      read: (port: number): number => {
        return this.readPort(port);
      },
      write: (port: number, val: number): void => {
        this.writePort(port, val);
      }
    });
  }

  readPort(port: number): number {
    switch (port & 0xFF) {
      case 0:
        // Console switches: TIME(0), MODE(1), HOLD(2), START(3)
        return (~this.inputs[0]) & 0xFF;
      case 1:
        // Right controller
        return (~this.inputs[1]) & 0xFF;
      case 4:
        // Left controller
        return (~this.inputs[2]) & 0xFF;
      default:
        return 0xFF;
    }
  }

  writePort(port: number, val: number): void {
    switch (port & 0xFF) {
      case 0:
        this.port0 = val;
        break;
      case 1:
        this.port1 = val;
        // The right controller port is also used for video column
        this.col_reg = val;
        break;
      case 4:
        this.port4 = val;
        break;
      case 5:
        this.port5 = val;
        // Upper 2 bits control sound
        this.soundMode = (val >> 6) & 3;
        if (this.soundMode > 0) {
          this.soundEnvelope = 0x3FF; // reset envelope on new sound
          this.soundOnTime = 60; // minimum on time (~2ms)
        }
        // Lower 6 bits control video row
        this.row_reg = val & 0x3F;
        // Write pixel to VRAM when both row and column are set
        this.writePixel();
        break;
    }
  }

  writePixel(): void {
    const row = this.row_reg;
    const col = this.col_reg & 0x7F;
    if (row < 64 && col < 128) {
      // Color comes from port 1 upper bits
      const color = (this.port1 >> 6) & 0x03;
      const addr = row * 128 + col;
      this.vram[addr] = color;
    }
  }

  read = newAddressDecoder([
    [0x0000, 0x07FF, 0x07FF, (a) => { return this.bios[a]; }],
    [0x0800, 0xFFFF, 0xFFFF, (a) => { return this.rom ? (this.rom[a - 0x0800] || 0) : 0; }],
  ], { gmask: 0xFFFF });

  write = newAddressDecoder([
    // Channel F has no writable main memory in the base config
    // Some cartridges have RAM at 0x2800-0x2FFF
    [0x2800, 0x2FFF, 0x07FF, (a, v) => { if (this.rom) this.rom[a - 0x0800] = v; }],
  ], { gmask: 0xFFFF });

  readConst(a: number): number {
    if (a < 0x0800) return this.bios[a];
    return this.rom ? (this.rom[a - 0x0800] || 0) : 0;
  }

  loadROM(data: Uint8Array): void {
    if (!this.rom) this.rom = new Uint8Array(this.defaultROMSize);
    this.rom.set(data);
    this.reset();
  }

  loadBIOS(data: Uint8Array): void {
    this.bios = padBytes(data, 0x800);
    this.reset();
  }

  reset(): void {
    super.reset();
    this.vram.fill(0);
    this.port0 = 0;
    this.port1 = 0;
    this.port4 = 0;
    this.port5 = 0;
    this.row_reg = 0;
    this.col_reg = 0;
    this.soundMode = 0;
    this.soundCounter = 0;
    this.soundEnvelope = 0;
  }

  advanceFrame(trap): number {
    var clock = 0;
    var targetClocks = this.cpuFrequency / 60;
    this.probe.logNewFrame();
    while (clock < targetClocks) {
      if (trap && trap()) break;
      clock += this.advanceCPU();
    }
    this.renderFrame();
    this.generateAudio(targetClocks);
    return clock;
  }

  renderFrame(): void {
    if (!this.pixels) return;
    // Determine palette offset from VRAM locations 125 and 126 of row 0
    // (simplified - uses palette 0 by default)
    for (let y = 0; y < 64; y++) {
      // Palette selection per row from vram[y*128 + 125] and [y*128 + 126]
      let palOffset = 0;
      const p125 = this.vram[y * 128 + 125];
      const p126 = this.vram[y * 128 + 126];
      palOffset = ((p125 & 2) | ((p126 & 2) >> 1)) * 4;

      for (let x = 0; x < 128; x++) {
        const color = this.vram[y * 128 + x] & 0x03;
        const rgba = CHANNELF_COLORMAP[palOffset + color];
        // Double vertical: each Channel F row maps to 4 display rows (NTSC)
        this.pixels[y * 128 + x] = rgba;
      }
    }
  }

  generateAudio(cycles: number): void {
    if (!this.audio) return;
    // Simple tone generation based on sound mode
    const samplesPerFrame = Math.floor(this.sampleRate / 60);
    for (let i = 0; i < samplesPerFrame; i++) {
      let sample = 0;
      if (this.soundMode > 0 && this.soundEnvelope > 0) {
        // Generate square wave at appropriate frequency
        let freq: number;
        switch (this.soundMode) {
          case 1: freq = 1000; break;   // ~1000 Hz
          case 2: freq = 500; break;    // ~500 Hz
          case 3: freq = 120; break;    // ~120 Hz
          default: freq = 0;
        }
        if (freq > 0) {
          const period = Math.floor(this.sampleRate / freq);
          this.soundCounter = (this.soundCounter + 1) % period;
          sample = this.soundCounter < period / 2 ? 0.3 : -0.3;
          sample *= this.soundEnvelope / 0x3FF;
        }
        // Decay envelope
        if (this.soundOnTime > 0) {
          this.soundOnTime--;
        } else {
          this.soundEnvelope -= 2;
          if (this.soundEnvelope < 0) this.soundEnvelope = 0;
        }
      }
      this.audio.feedSample(sample, 1);
    }
  }

  setKeyInput(key: number, code: number, flags: number): void {
    // inputs[0] = console switches
    // inputs[1] = right controller
    // inputs[2] = left controller
    const pressed = !!(flags & KeyFlags.KeyDown);
    const released = !!(flags & KeyFlags.KeyUp);

    // Console buttons (mapped to number keys)
    if (key === Keys.VK_1.c) { // TIME
      if (pressed) this.inputs[0] |= 0x01; else if (released) this.inputs[0] &= ~0x01;
    }
    if (key === Keys.VK_2.c) { // MODE
      if (pressed) this.inputs[0] |= 0x02; else if (released) this.inputs[0] &= ~0x02;
    }
    if (key === Keys.VK_3.c) { // HOLD
      if (pressed) this.inputs[0] |= 0x04; else if (released) this.inputs[0] &= ~0x04;
    }
    if (key === Keys.VK_4.c) { // START
      if (pressed) this.inputs[0] |= 0x08; else if (released) this.inputs[0] &= ~0x08;
    }

    // Right controller (WASD + QE for twist + RF for push/pull)
    if (key === Keys.VK_UP.c || key === Keys.VK_W.c) {
      if (pressed) this.inputs[1] |= INPUT_FORWARD; else if (released) this.inputs[1] &= ~INPUT_FORWARD;
    }
    if (key === Keys.VK_DOWN.c || key === Keys.VK_S.c) {
      if (pressed) this.inputs[1] |= INPUT_BACK; else if (released) this.inputs[1] &= ~INPUT_BACK;
    }
    if (key === Keys.VK_LEFT.c || key === Keys.VK_A.c) {
      if (pressed) this.inputs[1] |= INPUT_LEFT; else if (released) this.inputs[1] &= ~INPUT_LEFT;
    }
    if (key === Keys.VK_RIGHT.c || key === Keys.VK_D.c) {
      if (pressed) this.inputs[1] |= INPUT_RIGHT; else if (released) this.inputs[1] &= ~INPUT_RIGHT;
    }
    if (key === Keys.VK_Q.c) { // CCW twist
      if (pressed) this.inputs[1] |= INPUT_CCW; else if (released) this.inputs[1] &= ~INPUT_CCW;
    }
    if (key === Keys.VK_E.c) { // CW twist
      if (pressed) this.inputs[1] |= INPUT_CW; else if (released) this.inputs[1] &= ~INPUT_CW;
    }
    if (key === Keys.VK_R.c) { // Push
      if (pressed) this.inputs[1] |= INPUT_PUSH; else if (released) this.inputs[1] &= ~INPUT_PUSH;
    }
    if (key === Keys.VK_F.c) { // Pull
      if (pressed) this.inputs[1] |= INPUT_PULL; else if (released) this.inputs[1] &= ~INPUT_PULL;
    }
  }

  saveState() {
    return {
      c: this.cpu.saveState(),
      ram: this.ram.slice(0),
      inputs: this.inputs.slice(0),
      vram: this.vram.slice(0),
      port0: this.port0,
      port1: this.port1,
      port4: this.port4,
      port5: this.port5,
      row_reg: this.row_reg,
      col_reg: this.col_reg,
      soundMode: this.soundMode,
      soundCounter: this.soundCounter,
      soundEnvelope: this.soundEnvelope,
    };
  }

  loadState(state) {
    this.cpu.loadState(state.c);
    this.ram.set(state.ram);
    this.inputs.set(state.inputs);
    this.vram.set(state.vram);
    this.port0 = state.port0;
    this.port1 = state.port1;
    this.port4 = state.port4;
    this.port5 = state.port5;
    this.row_reg = state.row_reg;
    this.col_reg = state.col_reg;
    this.soundMode = state.soundMode;
    this.soundCounter = state.soundCounter;
    this.soundEnvelope = state.soundEnvelope;
  }
}
