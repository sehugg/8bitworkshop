"use strict";

import { Platform, BaseMAMEPlatform, BaseZ80Platform, getToolForFilename_z80 } from "../baseplatform";
import { PLATFORMS, RAM, newAddressDecoder, padBytes, noise, setKeyboardFromMap, AnimationTimer, RasterVideo, Keys, makeKeycodeMap } from "../emu";
import { hex, lzgmini, stringToByteArray } from "../util";
import { MasterAudio, SN76489_Audio } from "../audio";
import { TMS9918A, SMSVDP } from "../video/tms9918a";
import { ColecoVision_PRESETS } from "./coleco";

// http://www.smspower.org/Development/Index
// http://www.smspower.org/uploads/Development/sg1000.txt
// http://www.smspower.org/uploads/Development/richard.txt
// http://www.smspower.org/uploads/Development/msvdp-20021112.txt

// TODO: merge w/ coleco
export var SG1000_PRESETS = [
  {id:'text.c', name:'Text Mode'},
  {id:'hello.c', name:'Scrolling Text'},
  {id:'text32.c', name:'32-Column Color Text'},
  {id:'stars.c', name:'Scrolling Starfield'},
  {id:'cursorsmooth.c', name:'Moving Cursor'},
  {id:'simplemusic.c', name:'Simple Music'},
  {id:'musicplayer.c', name:'Multivoice Music'},
  {id:'mode2bitmap.c', name:'Mode 2 Bitmap'},
  {id:'mode2compressed.c', name:'Mode 2 Bitmap (LZG)'},
  {id:'lines.c', name:'Mode 2 Lines'},
  {id:'multicolor.c', name:'Multicolor Mode'},
  {id:'siegegame.c', name:'Siege Game'},
  {id:'shoot.c', name:'Solarian Game'},
  {id:'climber.c', name:'Platform Game'},
];


var SG1000_KEYCODE_MAP = makeKeycodeMap([
  [Keys.VK_UP,    0, 0x1],
  [Keys.VK_DOWN,  0, 0x2],
  [Keys.VK_LEFT,  0, 0x4],
  [Keys.VK_RIGHT, 0, 0x8],
  [Keys.VK_SPACE, 0, 0x10],
  [Keys.VK_CONTROL, 0, 0x20],

  [Keys.VK_R, 0, 0x40],
  [Keys.VK_F, 0, 0x80],
  [Keys.VK_D, 1, 0x1],
  [Keys.VK_G, 1, 0x2],
  [Keys.VK_A, 1, 0x4],
  [Keys.VK_S, 1, 0x8],
  [Keys.VK_1, 1, 0x10],
]);

class SG1000Platform extends BaseZ80Platform {

  cpuFrequency = 3579545; // MHz
  canvasWidth = 304;
  numTotalScanlines = 262;
  numVisibleScanlines = 240;
  cpuCyclesPerLine;

  cpu;
  ram : RAM;
  membus;
  iobus;
  rom = new Uint8Array(0);
  video;
  vdp;
  timer;
  audio;
  psg;
  inputs = new Uint8Array(4);
  mainElement : HTMLElement;

  currentScanline : number;
  startLineTstates : number;
  
  constructor(mainElement : HTMLElement) {
    super();
    this.mainElement = mainElement;
  }

  getPresets() { return SG1000_PRESETS; }
    
  newRAM() {
    return new RAM(0x400);
  }
    
  newMembus() {
    var ramSize = this.ram.mem.length;
    return {
       read: newAddressDecoder([
         [0xc000, 0xffff, ramSize-1, (a) => { return this.ram.mem[a]; }],
         [0x0000, 0xbfff, 0xffff,    (a) => { return this.rom[a]; }],
       ]),
       write: newAddressDecoder([
         [0xc000, 0xffff, ramSize-1, (a,v) => { this.ram.mem[a] = v; }],
       ]),
       isContended: () => { return false; },
    };
  }
  
  getVCounter() : number { return 0; }
  getHCounter() : number { return 0; }
  setMemoryControl(v:number) { }
  setIOPortControl(v:number) { }
  
  newIOBus() {
    return {
      read: (addr:number) => {
        addr &= 0xff;
        //console.log('IO read', hex(addr,4));
        switch (addr & 0xc1) {
          case 0x40: return this.getVCounter();
          case 0x41: return this.getHCounter();
          case 0x80: return this.vdp.readData();
          case 0x81: return this.vdp.readStatus();
          case 0xc0: return this.inputs[0] ^ 0xff;
          case 0xc1: return this.inputs[1] ^ 0xff;
        }
        return 0;
      },
      write: (addr:number, val:number) => {
        addr &= 0xff;
        val &= 0xff;
        //console.log('IO write', hex(addr,4), hex(val,2));
        switch (addr & 0xc1) {
          case 0x00: return this.setMemoryControl(val);
          case 0x01: return this.setIOPortControl(val);
          case 0x40:
          case 0x41: return this.psg.setData(val);
          case 0x80: return this.vdp.writeData(val);
          case 0x81: return this.vdp.writeAddress(val);
        }
      }
    };
  }
  
  newVDP(frameData, cru, flicker) {
    return new TMS9918A(frameData, cru, flicker);
  }
  
  start() {
    this.cpuCyclesPerLine = Math.round(this.cpuFrequency / 60 / this.numTotalScanlines);
    this.ram = this.newRAM();
    this.membus = this.newMembus();
    this.iobus = this.newIOBus();
    this.cpu = this.newCPU(this.membus, this.iobus);
    this.video = new RasterVideo(this.mainElement, this.canvasWidth, this.numVisibleScanlines, {overscan:true});
    this.video.create();
    this.audio = new MasterAudio();
    this.psg = new SN76489_Audio(this.audio);
    var cru = {
      setVDPInterrupt: (b) => {
        if (b) {
          this.cpu.nonMaskableInterrupt();
        } else {
          // TODO: reset interrupt?
        }
      }
    };
    this.vdp = this.newVDP(this.video.getFrameData(), cru, true); // true = 4 sprites/line
    setKeyboardFromMap(this.video, this.inputs, SG1000_KEYCODE_MAP); // TODO
    this.timer = new AnimationTimer(60, this.nextFrame.bind(this));
  }
  
  readAddress(addr) {
    return this.membus.read(addr);
  }

  advance(novideo : boolean) {
    var extraCycles = 0;
    for (var sl=0; sl<this.numTotalScanlines; sl++) {
      this.currentScanline = sl;
      this.startLineTstates = this.cpu.getTstates() + extraCycles;
      extraCycles = this.runCPU(this.cpu, this.cpuCyclesPerLine - extraCycles); // TODO: HALT opcode?
      //debug//this.video.getFrameData()[sl] = -1>>>extraCycles;
      this.vdp.drawScanline(sl);
    }
    this.video.updateFrame();
  }

  loadROM(title, data) {
    this.rom = padBytes(data, 0xc000);
    this.reset();
  }

  loadState(state) {
    this.cpu.loadState(state.c);
    this.ram.mem.set(state.b);
    this.vdp.restoreState(state.vdp);
    this.inputs.set(state.in);
  }
  saveState() {
    return {
      c:this.getCPUState(),
      b:this.ram.mem.slice(0),
      vdp:this.vdp.getState(),
      in:this.inputs.slice(0),
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
    return this.cpu.saveState();
  }

  isRunning() {
    return this.timer && this.timer.isRunning();
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
    this.cpu.setTstates(0);
    this.vdp.reset();
    this.psg.reset();
  }

  getDebugCategories() {
    return super.getDebugCategories().concat(['VDP']);
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'VDP': return this.vdpStateToLongString(state.vdp);
      default: return super.getDebugInfo(category, state);
    }
  }
  vdpStateToLongString(ppu) {
    return this.vdp.getRegsString();
  }
}

///

class SMSPlatform extends SG1000Platform {

  cartram : RAM = new RAM(0);
  pagingRegisters = new Uint8Array(4);
  romPageMask : number;
  // TODO: add to state
  latchedHCounter = 0;
  ioControlFlags = 0;
  // TODO: hide bottom scanlines
  
  reset() {
    super.reset();
    this.pagingRegisters.set([0,0,1,2]);
  }

  newVDP(frameData, cru, flicker) {
    return new SMSVDP(frameData, cru, flicker);
  }
  
  getVCounter() {
    var y = this.currentScanline;
    return (y <= 0xda) ? (y) : (y - 6);
  }
  getHCounter() {
    return this.latchedHCounter;
  }
  computeHCounter() {
    var t0 = this.startLineTstates;
    var t1 = this.cpu.getTstates();
    return (t1-t0) & 0xff; // TODO
  }
  setIOPortControl(v:number) {
    if ((v ^ this.ioControlFlags) & 0xa0) { // either joystick TH pin
      this.latchedHCounter = this.computeHCounter();
      //console.log("H:"+hex(this.latchedHCounter)+" V:"+hex(this.getVCounter()));
    }
    this.ioControlFlags = v;
  }
  
  newRAM() { return new RAM(0x2000); }
  
  getPagedROM(a:number, reg:number) {
    //if (!(a&0xff)) console.log(hex(a), reg, this.pagingRegisters[reg], this.romPageMask);
    return this.rom[a + ((this.pagingRegisters[reg] & this.romPageMask) << 14)]; // * $4000
  }

  newMembus() {
    return {
       read: newAddressDecoder([
         [0xc000, 0xffff, 0x1fff, (a) => { return this.ram.mem[a]; }],
         [0x0000, 0x03ff,  0x3ff, (a) => { return this.rom[a]; }],
         [0x0400, 0x3fff, 0x3fff, (a) => { return this.getPagedROM(a,1); }],
         [0x4000, 0x7fff, 0x3fff, (a) => { return this.getPagedROM(a,2); }],
         [0x8000, 0xbfff, 0x3fff, (a) => {
           var reg0 = this.pagingRegisters[0]; // RAM select?
           if (reg0 & 0x8) {
             return this.cartram.mem[(reg0 & 0x4) ? a+0x4000 : a];
           } else {
             return this.getPagedROM(a,3);
           }
         }],
       ]),
       write: newAddressDecoder([
         [0xc000, 0xfffb, 0x1fff, (a,v) => {
           this.ram.mem[a] = v;
         }],
         [0xfffc, 0xffff,    0x3, (a,v) => {
           this.pagingRegisters[a] = v;
           this.ram.mem[a+0x1ffc] = v;
         }],
         [0x8000, 0xbfff, 0x3fff, (a,v) => {
           var reg0 = this.pagingRegisters[0]; // RAM select?
           if (reg0 & 0x8) {
             if (this.cartram.mem.length == 0)
               this.cartram = new RAM(0x8000); // create cartridge RAM lazily
             this.cartram.mem[(reg0 & 0x4) ? a+0x4000 : a] = v;
           }
         }],
       ]),
       isContended: () => { return false; },
    };
  }

  loadROM(title, data) {
    if (data.length <= 0xc000) {
      this.rom = padBytes(data, 0xc000);
      this.romPageMask = 3; // only pages 0, 1, 2
    } else {
      switch (data.length) {
        case 0x10000:
        case 0x20000:
        case 0x40000:
        case 0x80000:
          this.rom = data;
          this.romPageMask = (data.length >> 14) - 1; // div $4000
          break;
        default:
          throw "Unknown rom size: $" + hex(data.length);
      }
    }
    //console.log("romPageMask: " + hex(this.romPageMask));
    this.reset();
  }

  loadState(state) {
    super.loadState(state);
    this.pagingRegisters.set(state.pr);
    this.cartram.mem.set(state.cr);
  }
  saveState() {
    var state = super.saveState();
    state['pr'] = this.pagingRegisters.slice(0);
    state['cr'] = this.cartram.mem.slice(0);
    return state;
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'CPU':
        return super.getDebugInfo(category, state) +
          "\nBank Regs: " + this.pagingRegisters + "\n";
      default: return super.getDebugInfo(category, state);
    }
  }
}

///

PLATFORMS['sms-sg1000-libcv'] = SG1000Platform;
PLATFORMS['sms-sms-libcv'] = SMSPlatform;
