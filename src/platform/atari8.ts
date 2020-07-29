"use strict";

import { Platform, Base6502Platform, BaseMAMEPlatform, getOpcodeMetadata_6502, getToolForFilename_6502 } from "../common/baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap, dumpRAM, getMousePos } from "../common/emu";
import { hex, lzgmini, stringToByteArray, lpad, rpad, rgb2bgr } from "../common/util";
import { MasterAudio, POKEYDeviceChannel, newPOKEYAudio } from "../common/audio";

declare var jt; // for 6502

var Atari8_PRESETS = [
  {id:'hello.dasm', name:'Hello World (ASM)'},
  {id:'hellopm.dasm', name:'Hello Sprites (ASM)'},
  {id:'helloconio.c', name:'Text Mode (C)'},
  {id:'siegegame.c', name:'Siege Game (C)'},
  {id:'hellodlist.c', name:'Display List (C)'},
];

var Atari800_PRESETS = Atari8_PRESETS.concat([
  {id:'sieve.bas', name:'Benchmark (FastBasic)'},
  {id:'pmtest.bas', name:'Sprites Test (FastBasic)'},
  {id:'dli.bas', name:'DLI Test (FastBasic)'},
  {id:'joyas.bas', name:'Match-3 Game (FastBasic)'},
]);

const ATARI8_KEYCODE_MAP = makeKeycodeMap([
  [Keys.VK_SPACE, 0, 0],
  [Keys.VK_ENTER, 0, 0],
]);

// ANTIC

// https://www.atarimax.com/jindroush.atari.org/atanttim.html
// http://www.virtualdub.org/blog/pivot/entry.php?id=243
// http://www.beipmu.com/Antic_Timings.txt
// https://user.xmission.com/~trevin/atari/antic_regs.html
// https://user.xmission.com/~trevin/atari/antic_insns.html
// http://www.atarimuseum.com/videogames/consoles/5200/conv_to_5200.html

const PF_LEFT  = [999,64,48,32];
const PF_RIGHT = [999,192,208,224];

const DMACTL = 0;
const CHACTL = 1;
const DLISTL = 2;
const DLISTH = 3;
const HSCROL = 4;
const VSCROL = 5;
const PMBASE = 7;
const CHBASE = 9;
const WSYNC = 10;
const VCOUNT = 11;
const PENH = 12;
const PENV = 13;
const NMIEN = 14;
const NMIRES = 15;
const NMIST = 15;

const PFNONE = 0;
const PFNARROW = 1;
const PFNORMAL = 2;
const PFWIDE = 3;

const NMIST_CYCLE = 12;
const NMI_CYCLE   = 24;
const WSYNC_CYCLE = 212;

const MODE_LINES = [ 0, 0, 7, 9, 7, 15, 7, 15,  7, 3, 3, 1, 0, 1, 0, 0 ];
const MODE_PERIOD = [ 0, 0, 0, 0, 0, 0, 1, 1,  2, 2, 1, 1, 1, 0, 0, 0 ];
const MODE_YPERIOD = [ 0, 0, 0, 0, 0, 1, 0, 1,  0, 0, 2, 1, 0, 0, 0, 0 ];

class ANTIC {
  regs = new Uint8Array(0x10);				// registers
  gtia : GTIA;												// GTIA link
  read : (address:number) => number;	// bus read function
  nmiPending : boolean = false;
  
  // derived by registers
  pfwidth : number;				// playfield width
  left : number;
  right : number;					// left/right clocks for mode

  // a la minute
  mode : number = 0;			// current mode
  period : number = 0;		// current mode period bitmask
  scanaddr : number = 0;  // Scan Address (via LMS)
  startaddr: number = 0;	// Start of line Address
  pfbyte : number = 0;		// playfield byte fetched
  ch : number = 0;				// char read
  linesleft : number = 0; // # of lines left in mode
  yofs : number = 0;			// yofs fine
  v : number = 0;					// vertical scanline #
  h : number = 0;					// horizontal color clock
  
  constructor(readfn) {
    this.read = readfn; // bus read function
  }
  reset() {
    this.regs[NMIEN] = 0x00;
    this.regs[NMIST] = 0x1f;
    this.setReg(DMACTL, 0x0);
  }
  saveState() {
    return {
      regs: this.regs.slice(0),
      mode: this.mode,
      period: this.period,
      scanaddr: this.scanaddr,
      startaddr: this.startaddr,
      pfbyte: this.pfbyte,
      ch: this.ch,
      linesleft: this.linesleft,
      yofs: this.yofs,
      v: this.v,
      h: this.h,
    };
  }
  loadState(s) {
    for (let i=0; i<16; i++)
      if (i != NMIRES)
        this.setReg(i, s.regs[i]);
    this.mode = s.mode;
    this.period = s.period;
    this.scanaddr = s.scanaddr;
    this.startaddr = s.startaddr;
    this.pfbyte = s.pfbyte;
    this.ch = s.ch;
    this.linesleft = s.linesleft;
    this.yofs = s.yofs;
    this.v = s.v;
    this.h = s.h;
  }
  static stateToLongString(state) : string {
    let s = "";
    s += "H: " + lpad(state.h,3) + " V: " + lpad(state.v,3) + " Linesleft: " + state.linesleft + "\n";
    s += "Mode: " + hex(state.mode,2) + " Period: " + (state.period+1) + "\n";
    s += "Addr: " + hex(state.scanaddr,4) + "\n";
    s += dumpRAM(state.regs, 0, 16).replace('$00', 'Regs');
    return s;
  }
  setReg(a:number, v:number) {
    this.regs[a] = v;
    switch (a) {
      case DMACTL:
        this.pfwidth = this.regs[DMACTL] & 3;
        this.setLeftRight();
        break;
      case NMIRES:
        this.regs[NMIST] = 0x1f;
        break;
    }
  }
  setLeftRight() {
    let offset = 4 << MODE_PERIOD[this.mode & 0xf];
    this.left = PF_LEFT[this.pfwidth];
    this.right = PF_RIGHT[this.pfwidth];
  }
  readReg(a:number) {
    switch (a) {
      case NMIST: return this.regs[NMIST];
      default: return 0;
    }
  }
  startline1() {
    let stolen = 0;
    if (this.linesleft) {
      this.linesleft--;
      if ((this.linesleft & MODE_YPERIOD[this.mode&0xf]) == 0) // use Y period
        this.yofs++;
    }
    if (!this.linesleft) {
      if (this.mode & 0x80) {
        this.triggerInterrupt(0x80); // Display List Interrupt (DLI)
      }
      this.mode = this.nextInsn();
      this.setLeftRight();
      stolen++;
      if ((this.mode & 0xf) == 0) { // N Blank Lines
        this.linesleft = (this.mode >> 4) + 1;
      } else {
        this.linesleft = MODE_LINES[this.mode & 0xf];
        this.period = (1<<MODE_PERIOD[this.mode & 0xf])-1;
        // TODO: this is actually at cclock 9-10
        if ((this.mode & ~0x40) == 0x01) { // JMP insn
          let lo = this.nextInsn();
          let hi = this.nextInsn();
          this.regs[DLISTL] = lo;
          this.regs[DLISTH] = hi;
          // JVB (Jump and wait for Vertical Blank)
          if (this.mode & 0x40) {
            this.mode = 0;
            this.linesleft = 240 - this.v;
          }
          stolen += 2;
        } else if ((this.mode & 0x40) && (this.mode & 0xf)) { // Load Memory Scan bit
          let lo = this.nextInsn();
          let hi = this.nextInsn();
          this.scanaddr = lo + (hi<<8);
          //console.log('scanaddr', hex(this.scanaddr));
          stolen += 2;
        }
        this.startaddr = this.scanaddr;
        this.yofs = 0;
      }
    } else {
      if ((this.mode & 0xf) < 8) // character mode?
        this.scanaddr = this.startaddr; // reset line addr
    }
    return stolen;
  }
  
  startline2() {
    return 0; // TODO
  }
  
  startline3() {
    return 0; // TODO
  }
  
  startline4() {
    let stolen = 0;
    return stolen;
  }
  
  triggerInterrupt(mask : number) {
    if (this.regs[NMIEN] & mask) {
      this.nmiPending = true;
      this.regs[NMIST] |= mask;
    }
  }
  
  nextInsn() : number {
    let pc = this.regs[DLISTL] + (this.regs[DLISTH]<<8);
    let b = this.read(pc);
    //console.log('nextInsn', hex(pc), hex(b), this.v);
    pc = ((pc+1) & 0x3ff) | (pc & ~0x3ff);
    this.regs[DLISTL] = pc & 0xff;
    this.regs[DLISTH] = pc >> 8;
    return b;
  }
  
  nextScreen() : number {
    let b = this.read(this.scanaddr);
    this.scanaddr = ((this.scanaddr+1) & 0xfff) | (this.scanaddr & ~0xfff);
    return b;
  }
  
  clockPulse4() : number {
    let nc = 4; // number of cycles not stolen by DMA
    let h = this.h;
    // in overscan region?
    if (this.v >= 240) {
      // interrupts on last scanline of frame
      if (this.v == 240) {
        if (h == NMIST_CYCLE)
          this.regs[NMIST] = 0x5f;
        else if (h == NMI_CYCLE)
          this.triggerInterrupt(0x40);
      }
    }
    // DMA enabled?
    else if (this.regs[DMACTL] & 0x20) {
      // read line data?
      switch (h) {
        case 0: nc -= this.startline1(); break;
        case 4: nc -= this.startline2(); break;
        case 8: nc -= this.startline3(); break;
        case 12: nc -= this.startline4(); break;
        default:
          let mode = this.mode & 0xf;
          if (h >= 48 && h < 120) nc--; // steal 1 clock for memory refresh
          if (h >= this.left && h < this.right && mode >= 2) { // fetch screen byte?
            if (((h>>2) & this.period) == 0) { // use period interval
              if (mode < 8) {	// character mode
                let ch = this.ch = this.nextScreen();
                let addrofs = this.yofs;
                let chbase = this.regs[CHBASE];
                // modes 6 & 7
                if ((mode & 0xe) == 6) { // or 7
                  ch &= 0x3f;
                  chbase &= 0xfe;
                } else {
                  ch &= 0x7f;
                  chbase &= 0xfc;
                }
                let addr = (ch<<3) + (chbase<<8);
                // modes 2 & 3
                if ((mode & 0xe) == 2) { // or 3
                  let chactl = this.regs[CHACTL];
                  if (mode == 3 && ch >= 0x60) {
                    // TODO
                  }
                  if (chactl & 4)
                    this.pfbyte = this.read(addr + (addrofs ^ 7)); // mirror
                  else
                    this.pfbyte = this.read(addr + addrofs);
                  if (this.ch & 0x80) {
                    if (chactl & 1)
                      this.pfbyte = 0x0; // blank
                    if (chactl & 2)
                      this.pfbyte ^= 0xff; // invert
                  }
                } else {
                  this.pfbyte = this.read(addr + addrofs);
                }
                nc -= 2;
              } else {	// map mode
                this.pfbyte = this.nextScreen();
                nc -= 1;
              }
            }
          }
          break;
      }
    }
    // next scanline?
    this.h += 4;
    if (this.h >= 228) {
      this.h = 0;
      this.v++;
      if (this.v >= 262) {
        this.v = 0;
      }
    }
    return nc;
  }
}

// GTIA
// https://user.xmission.com/~trevin/atari/gtia_regs.html

// write regs
const HPOSP0 = 0x0;
const HPOSM0 = 0x4;
const SIZEP0 = 0x8;
const SIZEM = 0x0c;
const GRAFP0 = 0x0d;
const GRAFM = 0x11;
const COLPM0 = 0x12;
const COLPF0 = 0x16;
const COLPF1 = 0x17;
const COLPF2 = 0x18;
const COLPF3 = 0x19;
const COLBK = 0x1a;
const PRIOR = 0x1b;
const VDELAY = 0x1c;
const GRACTL = 0x1d;
const HITCLR = 0x1e;
const CONSPK = 0x1f;
// read regs
const M0PF = 0x0;
const P0PF = 0x4;
const M0PL = 0x8;
const P0PL = 0xc;
const TRIG0 = 0x10;
const CONSOL = 0x1f;

class GTIA {
  regs = new Uint8Array(0x20);
  count : number = 0;
  antic : ANTIC;
  
  constructor(antic : ANTIC) {
    this.antic = antic;
  }
  saveState() {
    return {
      regs: this.regs.slice(0),
      count: this.count,
    };
  }
  loadState(s) {
    for (let i=0; i<32; i++)
      this.setReg(i, s.regs[i]);
    this.count = s.count;
  }
  setReg(a:number, v:number) {
    this.regs[a] = v;
    switch (a) {
    }
  }  
  clockPulse() : number {
    let pixel = (this.antic.pfbyte & 128) ? 1 : 0;
    let col = 0;
    switch (this.antic.mode & 0xf) {
      // blank line
      case 0:
      case 1:
        col = this.regs[COLBK];
        break;
      // normal text mode
      case 2:
      case 3:
      default:
        if (pixel)
          col = (this.regs[COLPF1] & 0xf) | (this.regs[COLPF2] & 0xf0);
        else
          col = this.regs[COLPF2];
        if ((this.count & this.antic.period) == 0)
          this.antic.pfbyte <<= 1;
        break;
      // 4bpp mode	
      case 4:
      case 5:
        col = (this.antic.pfbyte>>6) & 3;
        if ((this.antic.ch & 0x80) && col==3)
          col = 4; // 5th color
        col = col ? this.regs[COLPF0-1+col] : this.regs[COLBK];
        if ((this.count & 1) == 0)
          this.antic.pfbyte <<= 2;
        break;
      // 4 colors per 64 chars mode
      case 6:
      case 7:
        if (pixel)
          col = this.regs[COLPF0 + (this.antic.ch>>6)];
        else
          col = this.regs[COLBK];
        if ((this.count & this.antic.period) == 0)
          this.antic.pfbyte <<= 1;
        break;
    }
    this.count = (this.count + 1) & 0xff;
    return COLORS_RGBA[col];
  }
  static stateToLongString(state) : string {
    let s = "";
    s += dumpRAM(state.regs, 0, 32);
    return s;
  }
}

const _Atari8Platform = function(mainElement) {
  // http://www.ataripreservation.org/websites/freddy.offenga/megazine/ISSUE5-PALNTSC.html
  const cpuFrequency = 1789773;
  const linesPerFrame = 262;
  const colorClocksPerLine = 228;
  // TODO: for 400/800/5200
  const romLength = 0x8000;

  var cpu;
  var ram : RAM;
  var rom : Uint8Array;
  var bios : Uint8Array;
  var bus;
  var video, audio;
  var timer; // TODO : AnimationTimer;
  var antic : ANTIC;
  var gtia : GTIA;
  var inputs = new Uint8Array(4);
  
 class Atari8Platform extends Base6502Platform implements Platform {

  getPresets() {
    return Atari8_PRESETS;
  }
  start() {
    cpu = new jt.M6502();
    ram = new RAM(0x4000); // TODO
    bios = new lzgmini().decode(stringToByteArray(atob(ALTIRRA_SUPERKERNEL_LZG)));
    bus = {
      // TODO: https://github.com/dmlloyd/atari800/blob/master/DOC/cart.txt
      // TODO: http://atariage.com/forums/topic/169971-5200-memory-map/
      read: newAddressDecoder([
        [0x0000, 0x3fff, 0x3fff, function(a) { return ram.mem[a]; }],
        [0x4000, 0xbfff, 0xffff, function(a) { return rom ? rom[a-0x4000] : 0; }],
        [0xd400, 0xd4ff,    0xf, function(a) { return antic.readReg(a); }],
        [0xf800, 0xffff,  0x7ff, function(a) { return bios[a]; }],
      ]),
      write: newAddressDecoder([
        [0x0000, 0x3fff, 0xffff, function(a,v) { ram.mem[a] = v; }],
        [0xc000, 0xcfff,   0x1f, function(a,v) { gtia.regs[a] = v; }],
        [0xd400, 0xd4ff,    0xf, function(a,v) { antic.setReg(a,v); }],
        [0xe800, 0xefff,    0xf, function(a,v) { audio.pokey1.setRegister(a, v); }],
      ]),
    };
    cpu.connectBus(bus);
    // create support chips
    antic = new ANTIC(bus.read);
    gtia = new GTIA(antic);
    // create video/audio
    video = new RasterVideo(mainElement, 352, 192);
    audio = newPOKEYAudio(1);
    video.create();
    setKeyboardFromMap(video, inputs, ATARI8_KEYCODE_MAP, (o,key,code,flags) => {
      // TODO
    });
    timer = new AnimationTimer(60, this.nextFrame.bind(this));
    // setup mouse events
    var rasterPosBreakFn = (e) => {
      if (e.ctrlKey) {
        var clickpos = getMousePos(e.target, e);
        this.runEval( (c) => {
          var pos = {x:antic.h, y:this.getRasterScanline()};
          return (pos.x == (clickpos.x&~3)) && (pos.y == (clickpos.y|0));
        });
      }
    };
    var jacanvas = $("#emulator").find("canvas");
    jacanvas.mousedown(rasterPosBreakFn);
  }
  
  advance(novideo : boolean) : number {
    var idata = video.getFrameData();
    var iofs = 0;
    var debugCond = this.getDebugCallback();
    var rgb;
    var freeClocks = 0;
    var totalClocks = 0;
    // load controls
    // TODO
    gtia.regs[0x10] = inputs[0] ^ 1;
    // visible lines
    for (var sl=0; sl<linesPerFrame; sl++) {
      for (var i=0; i<colorClocksPerLine; i+=4) {
        // 2 color clocks per CPU cycle = 4 color clocks
        freeClocks += antic.clockPulse4();
        // interrupt?
        if (antic.nmiPending) {
          freeClocks -= cpu.setNMIAndWait(); // steal clocks b/c of interrupt (could be negative)
          antic.nmiPending = false;
        }
        // iterate CPU with free clocks
        while (freeClocks > 0) {
          freeClocks--;
          if (debugCond && debugCond()) {
            debugCond = null;
            i = 999;
            sl = 999;
            break;
          }
          cpu.clockPulse();
          totalClocks++;
        }
        // 4 ANTIC pulses = 8 pixels
        if (antic.v >= 24 && antic.h >= 44 && antic.h < 44+176) { // TODO: const
          for (var j=0; j<8; j++) {
            rgb = gtia.clockPulse();
            idata[iofs++] = rgb;
          }
        }
      }
    }
    // update video frame
    if (!novideo) {
      video.updateFrame();
      // set background/border color
      let bkcol = gtia.regs[COLBK];
      $(video.canvas).css('background-color', COLORS_WEB[bkcol]);
    }
    return totalClocks;
  }

  loadROM(title, data) {
    rom = padBytes(data, romLength);
    this.reset();
  }
  
  loadBIOS(title, data) {
    bios = padBytes(data, 0x800);
    this.reset();
  }

  isRunning() {
    return timer.isRunning();
  }
  pause() {
    timer.stop();
    audio.stop();
  }
  resume() {
    timer.start();
    audio.start();
  }
  reset() {
    cpu.reset();
    // execute until out of BIOS
    for (var i=0; i<20000; i++) {
      cpu.clockPulse();
      if (this.getCPUState().PC < 0xf000)
        break;
    }
  }
  readAddress(addr : number) {
    return ((addr & 0xf000) != 0xd000) ? bus.read(addr) : null; // ignore I/O space
  }

  loadState(state) {
    this.unfixPC(state.c);
    cpu.loadState(state.c);
    this.fixPC(state.c);
    ram.mem.set(state.b);
    antic.loadState(state.antic);
    gtia.loadState(state.gtia);
    this.loadControlsState(state);
  }
  saveState() {
    return {
      c:this.getCPUState(),
      b:ram.mem.slice(0),
      antic:antic.saveState(),
      gtia:gtia.saveState(),
      in:inputs.slice(0)
    };
  }
  loadControlsState(state) {
    inputs.set(state.in);
  }
  saveControlsState() {
    return {
      in:inputs.slice(0)
    };
  }
  getCPUState() {
    return this.fixPC(cpu.saveState());
  }
  getRasterScanline() {
    return antic.v;
  }
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
 }

  return new Atari8Platform(); // return inner class from constructor
};

// Atari 800
const _Atari800Platform = function(mainElement) {
  this.__proto__ = new (_Atari8Platform as any)(mainElement);
}

// Atari 5200
const _Atari5200Platform = function(mainElement) {
  this.__proto__ = new (_Atari8Platform as any)(mainElement);
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

/// MAME support

abstract class Atari8MAMEPlatform extends BaseMAMEPlatform {
  getPresets() { return Atari8_PRESETS; }
  getToolForFilename = function(fn:string) {
    if (fn.endsWith(".bas") || fn.endsWith(".fb") || fn.endsWith(".fbi")) return "fastbasic";
    else return getToolForFilename_6502(fn);
  }
  getOpcodeMetadata = getOpcodeMetadata_6502;
  getDefaultExtension() { return ".asm"; };
  showHelp(tool:string, ident:string) {
    if (tool == 'fastbasic')
      window.open("https://github.com/dmsc/fastbasic/blob/master/manual.md", "_help");
    else
      window.open("https://atariwiki.org/wiki/Wiki.jsp?page=Assembler", "_help"); // TODO
  }
}

class Atari800MAMEPlatform extends Atari8MAMEPlatform implements Platform {
  getPresets() { return Atari800_PRESETS; }
  loadROM(title, data) {
    if (!this.started) {
      this.startModule(this.mainElement, {
        jsfile:'mame8bitws.js',
        biosfile:'a800xl.zip',
        cfgfile:'a800xl.cfg',
        driver:'a800xl',
        width:336*2,
        height:225*2,
        romfn:'/emulator/cart.rom',
        romdata:new Uint8Array(data),
        romsize:0x2000,
        preInit:function(_self) {
        },
      });
    } else {
      this.loadROMFile(data);
      this.loadRegion(":cartleft:cart:rom", data);
    }
  }
  start() {
  }
  getMemoryMap = function() { return { main:[
    {name:'RAM',start:0x0,size:0x10000,type:'ram'},
    {name:'Left Cartridge ROM',start:0xa000,size:0x2000,type:'rom'},
    {name:'GTIA',start:0xd000,size:0x20,type:'io'},
    {name:'POKEY',start:0xd200,size:0x10,type:'io'},
    {name:'PIA',start:0xd300,size:0x04,type:'io'},
    {name:'ANTIC',start:0xd400,size:0x10,type:'io'},
    {name:'Cartridge Control Line',start:0xd600,size:0x100,type:'io'},
    {name:'ROM',start:0xd800,size:0x800,type:'rom'},
    {name:'ATARI Character Set',start:0xe000,size:0x400,type:'rom'},
    {name:'ROM',start:0xe400,size:0x1c00,type:'rom'},
  ] } };
}

class Atari5200MAMEPlatform extends Atari8MAMEPlatform implements Platform {
  loadROM(title, data) {
    if (!this.started) {
      this.startModule(this.mainElement, {
        jsfile:'mame8bitws.js',
        biosfile:'a5200/5200.rom',
        cfgfile:'a5200.cfg',
        driver:'a5200',
        width:336*2,
        height:225*2,
        romfn:'/emulator/cart.rom',
        romdata:new Uint8Array(data),
        romsize:0x8000,
        preInit:function(_self) {
        },
      });
    } else {
      this.loadROMFile(data);
      this.loadRegion(":cartleft:cart:rom", data);
    }
  }
  start() {
  }
  getMemoryMap = function() { return { main:[
    {name:'RAM',start:0x0,size:0x4000,type:'ram'},
    {name:'Cartridge ROM',start:0x4000,size:0x8000,type:'rom'},
    {name:'GTIA',start:0xc000,size:0x20,type:'io'},
    {name:'ANTIC',start:0xd400,size:0x10,type:'io'},
    {name:'POKEY',start:0xe800,size:0x10,type:'io'},
    {name:'ATARI Character Set',start:0xf800,size:0x400,type:'rom'},
    {name:'ROM',start:0xfc00,size:0x400,type:'rom'},
  ] } };
}

///

// Altirra Superkernel ROM (http://www.virtualdub.org/altirra.html) compiled with MADS
const ALTIRRA_SUPERKERNEL_LZG = `
TFpHAAAIAAAABJGU01hQARcZHSUAACUFGCUBABgAAGZmZh2IZv9mJUEAGD5gPAZ8HVBsGDBmRgAcNhw4
b2Y7HagdoA4cGBgcDgAAcDgYGDhwHSA8/zwdehgYfhkFGh1EMCWhfhkGYx0IAAAGDBgwYEAAADxmbnZm
PB0MHTgYHRs8Zh0RJeF+DBgMHVAMHDxsfgwdCGB8Bh1IPGB8ZiXifh15MB1oPB2IPGY+Bgw4GQRVGQNx
JeMwHV4YDAYZBHclQWAdBhgwYBkEYBkC6Dxmbm5gPh0nHT9+ZgAAfGZ8ZmZ8HVBgYBkCUHhsZmZseBkD
eGBgHXwl4h04PmBgbmYdMB1uGSIrfhkiOR0YBiUBHXAdLR0zAAAdJR2wY3d/a2NjHRB2fn5uHRA8HS4d
YBkCZhkCSB1IbDYdyB1wPGA8BgYdGBkDUBkkkGZmfiXkPB0IY2Nrf3cZAkhmPB0zJeMdoH4ZAtcdIB4d
bx4AAEAZAuoGAAB4HUh4AAAIHDYdLiUF/wAANn9/PhwIGSLHHx8lgQMlBR0D+PgZRA/4+Bkk5CXjAwcO
HDhw4MDA4HA4HA4HAwEDBw8fP3//HRgADyUBgMDg8Pj8/v8dRB1M8CUBJeL/HZolBh3GHZQcHHd3CBwd
RxkDeBkGFR0D//8diDx+fn48GQUu///AJQUdhxkjEx0gGQVEJQIZA8AdCHhgeGB+GQL4GDwZIjoZA0l+
GSIwGDB+MBlDFwx+DCXjPH4dkAA8Bj4ZIshgGUJYfB1IYGBgPBkiyD5mHVAAPGZ+HUgOGD4ZBJ8dTwZ8
HehmAAAYADgYGB1oGSP6PB0QbBkj+B0OHZAAZn9/axkich1nHRAZI+kdUBkm+RkDSAYdSBlDWAAZY3EA
ABliPxgOHXglARkCgBkl+ABja38+Nh1IPBgZY2kdVwwZQqEZZDgZAtAYPBljzyUCAH54fG5mBgAIGDh4
OBgIABAYHB4cGBAAbAACSKkgLA7o0A1FAI0O6KUlgmwQAjAPqYAZCQkMAnAPqUAZCQkIAmodLfAZCi0S
AmokAPASGQ5EFAKpARkODBYCKhkOCxgZEAsaAopIur0BASkQ0ANsDgJoqmhA////aKgdQUiKSJhI5gLQ
COYBpQQwAuYEpQPQ5aUFjQLUpQaNA9SlB40A1KAAJAQQAqQBogiYVQidEsDKEPeiB70A6JURyhD4jQvo
bAQC////GQJBrQnoSikPqr0T/WwKAv8LAAoOCQgHDQYFBAwDAgEsD9SND9QQA2wGAmwCAnjYov+arf2/
yf/QA2z+v6IAqQCVAJ0AwJ0A1J0A6OjQ8qn4jQnUogu9lf6dAAIZAmtPvc39nQAQHUMTvei/nVAdQ6kQ
hQypD4UNqQCFDiVhDyVhEKkEjRvAogq9wh0nIB1cIoUHqcCNDtQdFQWpIIUGqQKND+ipwIUZIhapeMUC
0Pxs/r9wcHBCABCCB0HC/SFsdGlycmEAFRIQEAAyLy0AK2VybmVsGWpyJQMub3cAcGxheWluZxoZDxUZ
a58lHiUcJQkD/Lj8svyh/gL9svxI5gzQBBkiJhkj9SUfJR8lHiUBI/0x/QD8`;

///

PLATFORMS['atari8-800'] = _Atari800Platform;
PLATFORMS['atari8-5200'] = _Atari5200Platform;
PLATFORMS['atari8-800xl.mame'] = Atari800MAMEPlatform;
PLATFORMS['atari8-5200.mame'] = Atari5200MAMEPlatform;
