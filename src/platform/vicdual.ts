"use strict";

import { Platform, BasicZ80ScanlinePlatform } from "../baseplatform";
import { PLATFORMS, newAddressDecoder, padBytes, Keys, makeKeycodeMap } from "../emu";
import { MasterAudio, AY38910_Audio } from "../audio";

const VICDUAL_PRESETS = [
  { id: 'minimal.c', name: 'Minimal Example' },
  { id: 'hello.c', name: 'Hello World' },
  { id: 'gfxtest.c', name: 'Graphics Test' },
  { id: 'soundtest.c', name: 'Sound Test' },
  { id: 'snake1.c', name: 'Siege Game (Prototype)' },
  { id: 'snake2.c', name: 'Siege Game (Full)' },
  { id: 'music.c', name: 'Music Player' },
];

class VicDualDisplay {
  palbank: number = 0;

  palette = [
    0xff000000, // black
    0xff0000ff, // red
    0xff00ff00, // green
    0xff00ffff, // yellow
    0xffff0000, // blue
    0xffff00ff, // magenta
    0xffffff00, // cyan
    0xffffffff  // white
  ];

  // default PROM
  colorprom = [
    0xe0, 0x60, 0x20, 0x60, 0xc0, 0x60, 0x40, 0xc0,
    0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0, 0x0e,
    0xe0, 0xe0, 0xe0, 0xe0, 0x60, 0x60, 0x60, 0x60,
    0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0, 0xe0,
  ];

  // videoram 0xc000-0xc3ff
  // RAM      0xc400-0xc7ff
  // charram  0xc800-0xcfff
  drawScanline(ram, pixels: Uint32Array, sl: number) {
    if (sl >= 224) return;
    var pixofs = sl * 256;
    var outi = pixofs; // starting output pixel in frame buffer
    var vramofs = (sl >> 3) << 5; // offset in VRAM
    var yy = sl & 7; // y offset within tile
    for (var xx = 0; xx < 32; xx++) {
      var code = ram[vramofs + xx];
      var data = ram[0x800 + (code << 3) + yy];
      var col = (code >> 5) + (this.palbank << 3);
      var color1 = this.palette[(this.colorprom[col] >> 1) & 7];
      var color2 = this.palette[(this.colorprom[col] >> 5) & 7];
      for (var i = 0; i < 8; i++) {
        var bm = 128 >> i;
        pixels[outi] = (data & bm) ? color2 : color1;
        /* TODO
        if (framestats) {
          framestats.layers.tiles[outi] = (data&bm) ? colorprom[col+8] : colorprom[col];
        }
        */
        outi++;
      }
    }
  }
}

const CARNIVAL_KEYCODE_MAP = makeKeycodeMap([
  [Keys.A,        2, -0x20],
  [Keys.B,        2, -0x40],
  [Keys.LEFT,     1, -0x10],
  [Keys.RIGHT,    1, -0x20],
  [Keys.UP,       1, -0x40],
  [Keys.DOWN,     1, -0x80],
  [Keys.START,    2, -0x10],
  [Keys.P2_START, 3, -0x20],
  [Keys.SELECT,   3, 0x8],
]);

const XTAL = 15468000.0;
const scanlinesPerFrame = 0x106;
const vblankStart = 0xe0;
const vsyncStart = 0xec;
const vsyncEnd = 0xf0;
const cpuFrequency = XTAL / 8;
const hsyncFrequency = XTAL / 3 / scanlinesPerFrame;
const vsyncFrequency = hsyncFrequency / 0x148;
const cpuCyclesPerLine = cpuFrequency / hsyncFrequency;
const timerFrequency = 500; // input 2 bit 0x8
const cyclesPerTimerTick = cpuFrequency / (2 * timerFrequency);

class VicDualPlatform extends BasicZ80ScanlinePlatform implements Platform {

  display: VicDualDisplay;
  psg;
  reset_disable = false;
  reset_disable_timer;

  cpuFrequency = XTAL / 8; // MHz
  canvasWidth = 256;
  numTotalScanlines = 262;
  numVisibleScanlines = 224;
  defaultROMSize = 0x4040;

  getPresets() { return VICDUAL_PRESETS; }

  getKeyboardMap() { return CARNIVAL_KEYCODE_MAP; }

  getKeyboardFunction() {
    return (o) => {
      // reset when coin inserted
      if (o.index == 3 && o.mask == 0x8 && !this.reset_disable) {
        this.cpu.reset();
        console.log("coin inserted");
        console.log(this.inputs)
      }
      // don't allow repeated resets in short period of time
      this.reset_disable = true;
      clearTimeout(this.reset_disable_timer);
      this.reset_disable_timer = setTimeout(() => { this.reset_disable = false; }, 1100);
    }
  };

  getVideoOptions() { return { rotate: -90 }; }

  newRAM() {
    return new Uint8Array(0x1000);
  }

  newMembus() {
    return {
      read: newAddressDecoder([
        [0x0000, 0x7fff, 0x3fff, (a) => { return this.rom ? this.rom[a] : null; }],
        [0x8000, 0xffff, 0x0fff, (a) => { return this.ram[a]; }],
      ]),
      write: newAddressDecoder([
        [0x8000, 0xffff, 0x0fff, (a, v) => { this.ram[a] = v; }],
      ]),
    };
  }

  newIOBus() {
    return {
      read: (addr) => {
        return this.inputs[addr & 3];
      },
      write: (addr, val) => {
        if (addr & 0x1) { this.psg.selectRegister(val & 0xf); }; // audio 1
        if (addr & 0x2) { this.psg.setData(val); }; // audio 2
        if (addr & 0x8) { }; // TODO: assert coin status
        if (addr & 0x40) { this.display.palbank = val & 3; }; // palette
      }
    };
  }

  start() {
    super.start();
    this.inputs.set([0xff, 0xff, 0xff, 0xff ^ 0x8]); // most things active low
    this.display = new VicDualDisplay();
    this.audio = new MasterAudio();
    this.psg = new AY38910_Audio(this.audio);
  }

  reset() {
    super.reset();
    this.psg.reset();
  }

  startScanline(sl: number) {
    this.inputs[2] &= ~0x8;
    this.inputs[2] |= ((this.cpu.getTstates() / cyclesPerTimerTick) & 1) << 3;
    if (sl == vblankStart) this.inputs[1] |= 0x8;
    if (sl == vsyncEnd) this.inputs[1] &= ~0x8;
  }

  drawScanline(sl: number) {
    this.display.drawScanline(this.ram, this.video.getFrameData(), sl);
  }

  loadROM(title, data) {
    super.loadROM(title, data);
    if (data.length >= 0x4020 && (data[0x4000] || data[0x401f])) {
      this.display.colorprom = data.slice(0x4000, 0x4020);
    }
  }

  loadState(state) {
    super.loadState(state);
    this.display.palbank = state.pb;
  }
  saveState() {
    var state = super.saveState();
    state['pb'] = this.display.palbank;
    return state;
  }
}

PLATFORMS['vicdual'] = VicDualPlatform;
