"use strict";

import { Platform, Base6502Platform, BaseMAMEPlatform, getOpcodeMetadata_6502, getToolForFilename_6502 } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap, dumpRAM, getMousePos } from "../emu";
import { hex, lzgmini, stringToByteArray, lpad, rpad, rgb2bgr } from "../util";
import { MasterAudio, POKEYDeviceChannel, newPOKEYAudio } from "../audio";

declare var jt; // for 6502

var Atari7800_PRESETS = [
  {id:'sprites.dasm', name:'Sprites (ASM)'},
];

const Atari7800_KEYCODE_MAP = makeKeycodeMap([
  [Keys.VK_SPACE, 0, 0],
  [Keys.VK_ENTER, 0, 0],
]);

// http://www.ataripreservation.org/websites/freddy.offenga/megazine/ISSUE5-PALNTSC.html
const CLK = 3579545;
const cpuFrequency = 1789772;
const linesPerFrame = 262;
const colorClocksPerLine = 228*2;
const romLength = 0xc000;

class Atari7800Platform extends Base6502Platform implements Platform {

  mainElement : HTMLElement;
  cpu;
  ram : Uint8Array;
  rom : Uint8Array;
  bios : Uint8Array;
  bus;
  video;
  audio;
  timer : AnimationTimer;
  inputs = new Uint8Array(4);
  scanline : number = 0;

  constructor(mainElement : HTMLElement) {
    super();
    this.mainElement = mainElement;
  }

  getPresets() {
    return Atari7800_PRESETS;
  }

  start() {
    this.cpu = new jt.M6502();
    this.ram = new Uint8Array(0x2800 - 0x1600);
    this.bios = new Uint8Array(0x1000); // TODO
    // TODO: TIA access wastes a cycle
    this.bus = {
      read: newAddressDecoder([
        [0x0040, 0x00ff, 0xffff, (a) => { return this.ram[a]; }],
        [0x0140, 0x01ff, 0xffff, (a) => { return this.ram[a]; }],
        [0x1800, 0x27ff, 0xffff, (a) => { return this.ram[a - 0x1600]; }],
        [0x4000, 0xffff, 0xffff, (a) => { return this.rom ? this.rom[a - 0x4000] : 0; }],
        //[0xf000, 0xffff,  0xfff, (a) => { return this.bios ? this.bios[a] : 0; }],
      ]),
      write: newAddressDecoder([
        [0x0040, 0x00ff, 0xffff, (a,v) => { this.ram[a] = v; }],
        [0x0140, 0x01ff, 0xffff, (a,v) => { this.ram[a] = v; }],
        [0x1800, 0x27ff, 0xffff, (a,v) => { this.ram[a - 0x1600] = v; }],
      ]),
    };
    this.cpu.connectBus(this.bus);
    // create video/audio
    this.video = new RasterVideo(this.mainElement, 320, 192);
    this.audio = newPOKEYAudio(1);
    this.video.create();
    setKeyboardFromMap(this.video, this.inputs, Atari7800_KEYCODE_MAP, (o,key,code,flags) => {
      // TODO
    });
    this.timer = new AnimationTimer(60, this.nextFrame.bind(this));
  }

  advance(novideo : boolean) {
    var idata = this.video.getFrameData();
    var iofs = 0;
    var debugCond = this.getDebugCallback();
    var rgb;
    var freeClocks = 0;
    // load controls
    // TODO
    //gtia.regs[0x10] = inputs[0] ^ 1;
    // visible lines
    for (var sl=0; sl<linesPerFrame; sl++) {
      freeClocks = 256; // TODO
      for (var i=0; i<colorClocksPerLine; i+=4) {
        this.scanline = sl;
        // iterate CPU with free clocks
        while (freeClocks > 0) {
          freeClocks--;
          if (debugCond && debugCond()) {
            debugCond = null;
            i = 999;
            sl = 999;
            break;
          }
          this.cpu.clockPulse();
        }
      }
    }
    // update video frame
    if (!novideo) {
      this.video.updateFrame();
      // set background/border color
      let bkcol = 0; //gtia.regs[COLBK];
      $(this.video.canvas).css('background-color', COLORS_WEB[bkcol]);
    }
  }

  loadROM(title, data) {
    this.rom = padBytes(data, romLength);
    this.reset();
  }

  loadBIOS(title, data) {
    this.bios = padBytes(data, 0x1000);
    this.reset();
  }

  isRunning() {
    return this.timer.isRunning();
  }

  pause() {
    this.timer.stop();
    this.audio.stop();
  }

  resume() {
    this.timer.start();
    this.audio.start();
  }

  reset() {
    this.cpu.reset();
    /*
    // execute until out of BIOS
    for (var i=0; i<20000; i++) {
      this.cpu.clockPulse();
      if (this.getCPUState().PC < 0xf000)
        break;
    }
    */
  }

  readAddress(addr : number) {
    return (addr < 0x1800 ? this.ram[addr] : this.bus.read(addr)) | 0;
  }

  loadState(state) {
    this.unfixPC(state.c);
    this.cpu.loadState(state.c);
    this.fixPC(state.c);
    this.ram.set(state.b);
    this.loadControlsState(state);
  }

  saveState() {
    return {
      c:this.getCPUState(),
      b:this.ram.slice(0),
      in:this.inputs.slice(0)
    };
  }

  loadControlsState(state) {
    this.inputs.set(state.in);
  }

  saveControlsState() {
    return {
      in:this.inputs.slice(0)
    };
  }

  getCPUState() {
    return this.fixPC(this.cpu.saveState());
  }

  getRasterScanline() {
    return this.scanline;
  }

  /*
  getDebugCategories() {
    return super.getDebugCategories().concat(['ANTIC','GTIA']);
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'ANTIC': return ANTIC.stateToLongString(state.antic);
      case 'GTIA': return GTIA.stateToLongString(state.gtia);
      default: return super.getDebugInfo(category, state);
    }
  }
  */
}

///

const ATARI_NTSC_RGB = [
    0x000000,		// 00
    0x404040,		// 02
    0x6c6c6c,		// 04
    0x909090,		// 06
    0xb0b0b0,		// 08
    0xc8c8c8,		// 0A
    0xdcdcdc,		// 0C
    0xf4f4f4,		// 0E
    0x004444,		// 10
    0x106464,		// 12
    0x248484,		// 14
    0x34a0a0,		// 16
    0x40b8b8,		// 18
    0x50d0d0,		// 1A
    0x5ce8e8,		// 1C
    0x68fcfc,		// 1E
    0x002870,		// 20
    0x144484,		// 22
    0x285c98,		// 24
    0x3c78ac,		// 26
    0x4c8cbc,		// 28
    0x5ca0cc,		// 2A
    0x68b4dc,		// 2C
    0x78c8ec,		// 2E
    0x001884,		// 30
    0x183498,		// 32
    0x3050ac,		// 34
    0x4868c0,		// 36
    0x5c80d0,		// 38
    0x7094e0,		// 3A
    0x80a8ec,		// 3C
    0x94bcfc,		// 3E
    0x000088,		// 40
    0x20209c,		// 42
    0x3c3cb0,		// 44
    0x5858c0,		// 46
    0x7070d0,		// 48
    0x8888e0,		// 4A
    0xa0a0ec,		// 4C
    0xb4b4fc,		// 4E
    0x5c0078,		// 50
    0x74208c,		// 52
    0x883ca0,		// 54
    0x9c58b0,		// 56
    0xb070c0,		// 58
    0xc084d0,		// 5A
    0xd09cdc,		// 5C
    0xe0b0ec,		// 5E
    0x780048,		// 60
    0x902060,		// 62
    0xa43c78,		// 64
    0xb8588c,		// 66
    0xcc70a0,		// 68
    0xdc84b4,		// 6A
    0xec9cc4,		// 6C
    0xfcb0d4,		// 6E
    0x840014,		// 70
    0x982030,		// 72
    0xac3c4c,		// 74
    0xc05868,		// 76
    0xd0707c,		// 78
    0xe08894,		// 7A
    0xeca0a8,		// 7C
    0xfcb4bc,		// 7E
    0x880000,		// 80
    0x9c201c,		// 82
    0xb04038,		// 84
    0xc05c50,		// 86
    0xd07468,		// 88
    0xe08c7c,		// 8A
    0xeca490,		// 8C
    0xfcb8a4,		// 8E
    0x7c1800,		// 90
    0x90381c,		// 92
    0xa85438,		// 94
    0xbc7050,		// 96
    0xcc8868,		// 98
    0xdc9c7c,		// 9A
    0xecb490,		// 9C
    0xfcc8a4,		// 9E
    0x5c2c00,		// A0
    0x784c1c,		// A2
    0x906838,		// A4
    0xac8450,		// A6
    0xc09c68,		// A8
    0xd4b47c,		// AA
    0xe8cc90,		// AC
    0xfce0a4,		// AE
    0x2c3c00,		// B0
    0x485c1c,		// B2
    0x647c38,		// B4
    0x809c50,		// B6
    0x94b468,		// B8
    0xacd07c,		// BA
    0xc0e490,		// BC
    0xd4fca4,		// BE
    0x003c00,		// C0
    0x205c20,		// C2
    0x407c40,		// C4
    0x5c9c5c,		// C6
    0x74b474,		// C8
    0x8cd08c,		// CA
    0xa4e4a4,		// CC
    0xb8fcb8,		// CE
    0x003814,		// D0
    0x1c5c34,		// D2
    0x387c50,		// D4
    0x50986c,		// D6
    0x68b484,		// D8
    0x7ccc9c,		// DA
    0x90e4b4,		// DC
    0xa4fcc8,		// DE
    0x00302c,		// E0
    0x1c504c,		// E2
    0x347068,		// E4
    0x4c8c84,		// E6
    0x64a89c,		// E8
    0x78c0b4,		// EA
    0x88d4cc,		// EC
    0x9cece0,		// EE
    0x002844,		// F0
    0x184864,		// F2
    0x306884,		// F4
    0x4484a0,		// F6
    0x589cb8,		// F8
    0x6cb4d0,		// FA
    0x7ccce8,		// FC
    0x8ce0fc		// FE
];

var COLORS_RGBA = new Uint32Array(256);
var COLORS_WEB = [];
for (var i=0; i<256; i++) {
  COLORS_RGBA[i] = ATARI_NTSC_RGB[i>>1] | 0xff000000;
  COLORS_WEB[i] = "#"+hex(rgb2bgr(ATARI_NTSC_RGB[i>>1]),6);
}

///

PLATFORMS['atari7800'] = Atari7800Platform;
