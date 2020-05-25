
import { MOS6502, MOS6502State } from "../common/cpu/MOS6502";
import { BasicMachine, RasterFrameBased, Bus, ProbeAll } from "../common/devices";
import { KeyFlags, newAddressDecoder, padBytes, Keys, makeKeycodeMap, newKeyboardHandler, EmuHalt, dumpRAM } from "../common/emu";
import { lzgmini, stringToByteArray, hex, rgb2bgr } from "../common/util";

// https://www.c64-wiki.com/wiki/C64
// http://www.zimmers.net/cbmpics/cbm/c64/vic-ii.txt
// http://www.zimmers.net/cbmpics/cbm/c64/c64prg.txt
// http://sta.c64.org/cbm64mem.html
// http://hitmen.c02.at/temp/palstuff/

// native JS emulator (NOT USED)

const KEYBOARD_ROW_0 = 0;
const SWCHA = 8;
const SWCHB = 9;
const INPT0 = 10;

const C64_KEYCODE_MAP = makeKeycodeMap([
  [Keys.A,        INPT0+0, 0x80],
  [Keys.B,        INPT0+1, 0x80],
  [Keys.SELECT,   SWCHB, -0x02],
  [Keys.START,    SWCHB, -0x01],
  [Keys.UP,       SWCHA, -0x10],
  [Keys.DOWN,     SWCHA, -0x20],
  [Keys.LEFT,     SWCHA, -0x40],
  [Keys.RIGHT,    SWCHA, -0x80],
  
  [Keys.P2_A,     INPT0+2, 0x80],
  [Keys.P2_B,     INPT0+3, 0x80],
  //[Keys.P2_SELECT, 1, 2],
  //[Keys.P2_START,  1, 3],
  [Keys.P2_UP,     SWCHA, -0x01],
  [Keys.P2_DOWN,   SWCHA, -0x02],
  [Keys.P2_LEFT,   SWCHA, -0x04],
  [Keys.P2_RIGHT,  SWCHA, -0x08],
]);

const C64_KEYMATRIX_NOSHIFT = [
  Keys.VK_DELETE, Keys.VK_ENTER, Keys.VK_RIGHT, Keys.VK_F7,	Keys.VK_F1, Keys.VK_F3, Keys.VK_F5, Keys.VK_DOWN,
  Keys.VK_3, Keys.VK_W, Keys.VK_A, Keys.VK_4,			Keys.VK_Z, Keys.VK_S, Keys.VK_E, Keys.VK_SHIFT,
  Keys.VK_5, Keys.VK_R, Keys.VK_D, Keys.VK_6,			Keys.VK_C, Keys.VK_F, Keys.VK_T, Keys.VK_X,
  Keys.VK_7, Keys.VK_Y, Keys.VK_G, Keys.VK_8,			Keys.VK_B, Keys.VK_H, Keys.VK_U, Keys.VK_V,
  Keys.VK_9, Keys.VK_I, Keys.VK_J, Keys.VK_0,			Keys.VK_M, Keys.VK_K, Keys.VK_O, Keys.VK_N,
  null/*Keys.VK_PLUS*/, Keys.VK_P, Keys.VK_L, Keys.VK_MINUS,	Keys.VK_PERIOD, null/*Keys.VK_COLON*/, null/*Keys.VK_AT*/, Keys.VK_COMMA,
  null/*Keys.VK_POUND*/, null/*TIMES*/, Keys.VK_SEMICOLON, Keys.VK_HOME, Keys.VK_SHIFT/*right*/, Keys.VK_EQUALS, Keys.VK_TILDE, Keys.VK_SLASH,
  Keys.VK_1, Keys.VK_LEFT, Keys.VK_CONTROL, Keys.VK_2,		Keys.VK_SPACE, Keys.VK_ALT, Keys.VK_Q, null/*STOP*/,
];

// CIA
// TODO: https://www.c64-wiki.com/wiki/CIA

class CIA {
  regs = new Uint8Array(0x10);

  reset() {
    this.regs.fill(0);
  }
  read(a : number) : number {
    return this.regs[a] | 0;
  }
  write(a : number, v : number) {
    this.regs[a] = v;
  }
}

// VIC-II chip

class VIC_II {
  platform : C64;
  scanline : number = 0;
  regs   = new Uint8Array(0x40); // 64 bytes
  cram   = new Uint8Array(0x400); // color RAM
  pixels = new Uint8Array(numVisiblePixels); // output pixel buffer
  cycle  : number = 0;
  vc     : number = 0; 
  vcbase : number = 0;
  rc     : number = 0;
  vmli   : number = 0; // TODO: we don't use

  constructor(platform) {
    this.platform = platform;
  }
  reset() {
    this.regs.fill(0);
    this.cram.fill(0);
    this.vc = 0;
    this.vcbase = 0;
    this.rc = 0;
    this.vmli = 0;
  }
  read(a : number) : number {
    switch (a) {
      case 0x12: return this.scanline;
    }
    return this.regs[a] | 0;
  }
  write(a : number, v : number) {
    this.regs[a] = v;
  }
  setScanline(sl : number) {
    this.scanline = sl;
    // interrupt?
    if (sl == (this.regs[0x12] | ((this.regs[0x11]&0x80)<<1))) {
      this.regs[0x19] |= 0x81;
    }
    // reset pixel clock
    this.cycle = 0;
    // reset VCBASE
    if (sl < firstScanline) this.vcbase = 0;
    // clear pixel buffer w/ background
    this.pixels.fill(this.regs[0x21]);
  }
  saveState() {
    return {
      regs: this.regs.slice(0),
      cram: this.cram.slice(0)
    };
  }
  loadState(s) {
    for (let i=0; i<32; i++)
      this.write(i, s.regs[i]);
    this.cram.set(s.cram);
  }
  c_access() : number {
    let vm = this.regs[0x18];
    let vadr = (this.vc & 0x3ff) | ((vm & 0xf0) << 6);
    //this.platform.profiler && this.platform.profiler.logRead(vadr);
    return this.platform.readVRAMAddress(vadr) | (this.cram[vadr & 0x3ff] << 8);
  }
  g_access(data : number) : number {
    let cb = this.regs[0x18];
    let vadr = (this.rc & 7) | ((data & 0xff) << 3) | ((cb & 0xe) << 10);
    this.vc = (this.vc + 1) & 0x3ff;
    //this.vcbase = (this.vcbase + 1) & 0x3ff;
    //this.platform.profiler && this.platform.profiler.logRead(vadr);
    return this.platform.readVRAMAddress(vadr);
  }
  getx() : number {
    // TODO: left border 0x1f, 0x18
    return (this.cycle - 16)*8 + numBorderPixels;
  }
  clockPulse() {
    switch (this.cycle) {
      case 14:
        this.vc = this.vcbase;
        //console.log("VC ->",hex(this.vc));
        this.vmli = 0;
        break;
      case 58:
        if (this.rc == 7) {
          this.vcbase = this.vc;
          //console.log("VCBASE",hex(this.vc));
          // TODO
        }
        this.rc = (this.rc + 1) & 7;
        break;
    }
    let x = this.getx();
    if (this.cycle >= 16 && this.cycle < 56) {
      var cdata = this.c_access();
      let gdata = this.g_access(cdata);
      let fgcol = cdata >> 8;
      let bgcol = this.regs[0x21];
      for (let i=0; i<8; i++) {
        this.pixels[x+i] = (gdata & 0x80) ? fgcol : bgcol;
        gdata <<= 1;
      }
    }
    this.cycle++;
  }
  doDMA() {
    // TODO
    //let bus = this.platform.bus;
    //let profiler = this.platform.profiler;
    if (true) { //this.isDMAEnabled()) {
    }
    return 0; //TODO
  }
  doInterrupt() : boolean {
    return false; // TODO
  }
  static stateToLongString(state) : string {
    let s = "";
    s += dumpRAM(state.regs, 0, 64);
    //s += "\nScanline: " + state.scanline;
    //s += "\n   DLL: $" + hex((state.regs[0x0c] << 8) + state.regs[0x10],4) + " @ $" + hex(state.dll,4);
    return s;
  }
}

const cpuFrequency = 10227273; // NTSC
const linesPerFrame = 263; //  (6567R8)
const firstScanline = 0x30;
const lastScanline = 0xf7;
const numVisibleLines = 235; // (6567R8)
const numScreenPixels = 320;
const numBorderPixels = 16;
const numVisiblePixels = numScreenPixels+numBorderPixels*2; // (6567R8)
const cpuClocksPerLine = 65; // 65*8 (6567R8)
const cpuClocksPreDMA = 7; // TODO
const audioOversample = 4;
const audioSampleRate = linesPerFrame*60*audioOversample;

export class C64 extends BasicMachine implements RasterFrameBased {

  cpuFrequency = cpuFrequency;
  canvasWidth = numVisiblePixels;
  overscan = true;
  numTotalScanlines = linesPerFrame;
  numVisibleScanlines = numVisibleLines;
  defaultROMSize = 0x6000;
  cpuCyclesPerLine = 65; // 65*8 (6567R8)
  cpuCyclesPreDMA = 7; // TODO
  sampleRate = audioSampleRate;

  cpu : MOS6502;
  ram  : Uint8Array;
  rom  : Uint8Array; // cartridge ROM
  bios : Uint8Array;
  vic  : VIC_II = new VIC_II(this);
  cia1 : CIA = new CIA();
  cia2 : CIA = new CIA();
  probeDMABus;
  lastFrameCycles : number = 0;
  
  enableKERNAL : boolean = true;
  enableIO     : boolean = true;
  enableBASIC  : boolean = true;
  enableCART   : boolean = true;

  constructor() {
    super();
    this.cpu = new MOS6502();
    this.ram = new Uint8Array(0x10000); // 64 KB, of course
    this.bios = new lzgmini().decode(stringToByteArray(atob(C64_BIOS_LZG))); // BASIC-CHAR-KERNAL ROMs
    this.connectCPUMemoryBus(this);
    this.probeDMABus = this.probeIOBus(this);
    this.handler = newKeyboardHandler(this.inputs, C64_KEYCODE_MAP, this.getKeyboardFunction(), true);
  }

  read = newAddressDecoder([
      [0x8000, 0x9fff, 0x1fff, (a) => { return this.enableCART   ? (this.rom&&this.rom[a]) : this.ram[a|0x8000]; }], // CART ROM
      [0xa000, 0xbfff, 0x1fff, (a) => { return this.enableBASIC  ? this.bios[a] : this.ram[a|0xa000]; }], // BASIC ROM
      [0xd000, 0xdfff,  0xfff, (a) => { return !this.enableIO    ? this.bios[a + 0x2000] : this.readIO(a) }], // CHAR ROM
      [0xe000, 0xffff, 0x1fff, (a) => { return this.enableKERNAL ? this.bios[a + 0x3000] : this.ram[a|0xe000]; }], // KERNAL ROM
      [0x0000, 0xffff, 0xffff, (a) => { return this.ram[a]; }],
    ]);
  
  write = newAddressDecoder([
      [0x0000, 0x0001, 0xffff, (a,v) => { this.write6510(a,v); }],
      [0xd000, 0xdfff,  0xfff, (a,v) => { this.writeIO(a,v); }],
      [0x0000, 0xffff, 0xffff, (a,v) => { this.ram[a] = v; }],
    ]);
  
  getKeyboardMap() { return null; /* TODO: C64_KEYCODE_MAP;*/ }

  // http://map.grauw.nl/articles/keymatrix.php
  // https://codebase64.org/doku.php?id=base:reading_the_keyboard
  // http://www.c64os.com/post?p=45
  // https://www.c64-wiki.com/wiki/Keyboard
  
  getKeyboardFunction() {
    return (o,key,code,flags) => {
      //console.log(o,key,code,flags);
      var keymap = C64_KEYMATRIX_NOSHIFT;
      for (var i=0; i<keymap.length; i++) {
        if (keymap[i] && keymap[i].c == key) {
          let row = i >> 3;
          let col = i & 7;
          // is column selected?
          if (flags & KeyFlags.KeyDown) {
            this.inputs[KEYBOARD_ROW_0 + row] |= (1<<col);
          } else if (flags & KeyFlags.KeyUp) {
            this.inputs[KEYBOARD_ROW_0 + row] &= ~(1<<col);
          }
          //console.log(key, row, col, hex(this.inputs[KEYBOARD_ROW_0 + row]));
          break;
        }
      }
    }
  }
  
  // TODO: https://www.c64-wiki.com/wiki/Zeropage
  write6510(a:number, v:number) {
    this.ram[a] = v;
    switch (a) {
      case 0:
        this.enableBASIC  = (v & 0x1) != 0; // LORAM
        this.enableKERNAL = (v & 0x2) != 0; // HIRAM
        this.enableIO     = (v & 0x4) != 0; // CHAREN
        break;
    }
  }

  writeIO(a:number, v:number) {
    //this.profiler && this.profiler.logWrite(a+0xd000);
    var page = (a>>8);
    switch (page) {
      case 0x0: case 0x1: case 0x2: case 0x3:
        this.vic.write(a & 0x3f, v);
        break;
      case 0x8: case 0x9: case 0xa: case 0xb:
        this.vic.cram[a & 0x3ff] = v;
        break;
      case 0xc:
        this.cia1.write(a & 0xf, v);
        break;
      case 0xd:
        this.cia2.write(a & 0xf, v);
        break;
      default:
        return; //TODO
    }
  }

  readIO(a:number) : number {
    //this.profiler && this.profiler.logRead(a+0xd000);
    var page = (a>>8);
    switch (page) {
      case 0x0: case 0x1: case 0x2: case 0x3: // VIC-II
        return this.vic.read(a & 0x3f);
      case 0x8: case 0x9: case 0xa: case 0xb:
        return this.vic.cram[a & 0x3ff];
      case 0xc:
        switch (a & 0xf) {
          // scan keyboard matrix for CIA 1
          // CIA 1 regs: [00, 00, ff, 00] or [ff, 00, ff, 00]
          // http://www.c64os.com/post?p=45
          case 0x1:
            let cols = 0;
            for (let i=0; i<8; i++)
              if ((this.cia1.regs[0] & (1<<i)) == 0)
                cols |= this.inputs[KEYBOARD_ROW_0 + i];
            //if (cols) console.log(this.cia1.regs[0], cols);
            return cols ^ 0xff;
        }
        return this.cia1.read(a & 0xf);
      case 0xd:
        return this.cia2.read(a & 0xf);
      default:
        return 0; //TODO
    }
  }

  readVRAMAddress(a:number) {
    let bank = ~this.cia2.regs[0] & 3; // CIA 2 port A
    a &= 0x3fff; // VIC II sees 14 bits
    if ((a >= 0x1000 && a < 0x2000) && (bank == 0 || bank == 2)) return this.bios[0x1000 + a]; // CHAR ROM
    else return this.ram[a];
  }
  
  advanceFrame(trap) : number {
    var idata = this.pixels;
    var iofs = 0;
    var vicClocks = cpuClocksPreDMA;
    var fc = 0;
    this.probe.logNewFrame();
    // visible lines
    for (var sl=0; sl<linesPerFrame; sl++) {
      this.vic.setScanline(sl);
      // interrupt?
      // TODO: https://www.c64-wiki.com/wiki/Raster_interrupt
      if (this.vic.regs[0x19] & 0x1) {
        this.vic.regs[0x19] &= 0x7e;
        //TODO: this.cpu.IRQ();
        //this.profiler && this.profiler.logInterrupt(0x1);
      }
      // is this scanline visible?
      let visible = sl >= firstScanline && sl <= lastScanline;
      // iterate CPU with free clocks
      while (vicClocks > 0) {
        // next CPU clock
        vicClocks--;
        if (trap && trap()) {
          trap = null;
          sl = 999;
          break;
        }
        if (visible) this.vic.clockPulse(); // VIC first
        this.advanceCPU();
        fc++;
      }
      vicClocks += cpuClocksPerLine;
      if (visible) {
        // do DMA for scanline?
        vicClocks -= this.vic.doDMA();
      }
      // copy line to frame buffer
      if (idata && sl > firstScanline-24 && iofs < idata.length) {
        for (var i=0; i<numVisiblePixels; i++) {
          idata[iofs++] = COLORS_RGBA[this.vic.pixels[i]];
        }
      }
      this.probe.logNewScanline();
    }
    return this.lastFrameCycles = fc;
  }

  getRasterX() { return this.lastFrameCycles % this.cpuCyclesPerLine; }
  getRasterY() { return Math.floor(this.lastFrameCycles / this.cpuCyclesPerLine); }  

  loadROM(data) {
    // BASIC stub?
    if (data[0] == 0x01 && data[1] == 0x08) {
      this.ram.set(data.slice(2), 0x801);
      this.enableCART = false;
      // hack BASIC interpreter loop (TODO?)
      var prgstart = 0x80a; //TODO (this.debugSymbols && this.debugSymbols.symbolmap['__MAIN_START__']) || 0x80a;
      this.bios[0x3f9b] = 0x4c;
      this.bios[0x3f9c] = prgstart & 0xff;
      this.bios[0x3f9d] = prgstart >> 8;
    } else {
      // assume cartridge ROM
      this.rom = padBytes(data, this.defaultROMSize);
    }
    this.reset();
  }

  // BASIC (0x2000 bytes)
  // CHAR (0x1000 bytes)
  // KERNAL (0x2000 bytes)
  loadBIOS(data) {
    this.bios = padBytes(data, 0x5000);
    this.reset();
  }

  reset() {
    super.reset();
    this.vic.reset();
    this.cia1.reset();
    this.cia2.reset();
    this.write6510(0, 0xff);
    this.inputs.fill(0x0);
  }

  // TODO: don't log if profiler active
  readConst(addr : number) {
    return this.read(addr) | 0;
  }

  loadState(state) {
    this.cpu.loadState(state.c);
    this.ram.set(state.ram);
    this.vic.loadState(state.vic);
    this.loadControlsState(state);
  }
  saveState() {
    return {
      c:this.getCPUState(),
      ram:this.ram.slice(0),
      vic:this.vic.saveState(),
      inputs:this.inputs.slice(0)
    };
  }

  loadControlsState(state) {
    this.inputs.set(state.inputs);
  }

  saveControlsState() {
    return {
      inputs:this.inputs.slice(0)
    };
  }

  getCPUState() {
    return this.cpu.saveState();
  }

  getRasterScanline() {
    return this.vic.scanline;
  }

  getDebugCategories() {
    return ['CPU','Stack','VIC-II'];
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'VIC-II': return VIC_II.stateToLongString(state.vic);
    }
  }

}


const VIC_NTSC_RGB = [
  0x000000,
  0xFFFFFF,
  0x880000,
  0xAAFFEE,
  0xCC44CC,
  0x00CC55,
  0x00CC55,
  0xEEEE77,
  0xDD8855,
  0x664400,
  0xFF7777,
  0x333333,
  0x777777,
  0xAAFF66,
  0x0088FF,
  0xBBBBBB,
];

var COLORS_RGBA = new Uint32Array(256);
var COLORS_WEB = [];
for (var i=0; i<256; i++) {
  COLORS_RGBA[i] = rgb2bgr(VIC_NTSC_RGB[i & 15]) | 0xff000000;
  COLORS_WEB[i] = "#"+hex(VIC_NTSC_RGB[i & 15],6);
}

// bank-switching table
// TODO: https://www.c64-wiki.com/wiki/Bank_Switching

enum BankSwitchFlags {
  LORAM=1, HIRAM=2, CHAREN=4, _GAME=8, _EXROM=16
};

enum Bank {
  NONE, RAM, IO, CART_ROM_LO, CART_ROM_HI, CHAR_ROM, KERN_ROM, BASIC_ROM
};

function getBankMapping(flags:number, region:number) : Bank {
  return BANK_TABLE[flags & 0x1f][region];
};

const BANK_TABLE : Bank[][] = [
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.CART_ROM_HI, Bank.RAM, Bank.CHAR_ROM, Bank.KERN_ROM ],
  [ Bank.RAM, Bank.RAM, Bank.CART_ROM_LO, Bank.CART_ROM_HI, Bank.RAM, Bank.CHAR_ROM, Bank.KERN_ROM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.IO, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.CART_ROM_HI, Bank.RAM, Bank.IO, Bank.KERN_ROM ],
  [ Bank.RAM, Bank.RAM, Bank.CART_ROM_LO, Bank.CART_ROM_HI, Bank.RAM, Bank.IO, Bank.KERN_ROM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.CHAR_ROM, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.CHAR_ROM, Bank.KERN_ROM ],
  [ Bank.RAM, Bank.RAM, Bank.CART_ROM_LO, Bank.BASIC_ROM, Bank.RAM, Bank.CHAR_ROM, Bank.KERN_ROM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.IO, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.IO, Bank.KERN_ROM ],
  [ Bank.RAM, Bank.RAM, Bank.CART_ROM_LO, Bank.BASIC_ROM, Bank.RAM, Bank.IO, Bank.KERN_ROM ],
  [ Bank.RAM, Bank.NONE, Bank.CART_ROM_LO, Bank.NONE, Bank.NONE, Bank.IO, Bank.CART_ROM_HI ],
  [ Bank.RAM, Bank.NONE, Bank.CART_ROM_LO, Bank.NONE, Bank.NONE, Bank.IO, Bank.CART_ROM_HI ],
  [ Bank.RAM, Bank.NONE, Bank.CART_ROM_LO, Bank.NONE, Bank.NONE, Bank.IO, Bank.CART_ROM_HI ],
  [ Bank.RAM, Bank.NONE, Bank.CART_ROM_LO, Bank.NONE, Bank.NONE, Bank.IO, Bank.CART_ROM_HI ],
  [ Bank.RAM, Bank.NONE, Bank.CART_ROM_LO, Bank.NONE, Bank.NONE, Bank.IO, Bank.CART_ROM_HI ],
  [ Bank.RAM, Bank.NONE, Bank.CART_ROM_LO, Bank.NONE, Bank.NONE, Bank.IO, Bank.CART_ROM_HI ],
  [ Bank.RAM, Bank.NONE, Bank.CART_ROM_LO, Bank.NONE, Bank.NONE, Bank.IO, Bank.CART_ROM_HI ],
  [ Bank.RAM, Bank.NONE, Bank.CART_ROM_LO, Bank.NONE, Bank.NONE, Bank.IO, Bank.CART_ROM_HI ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.CHAR_ROM, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.CHAR_ROM, Bank.KERN_ROM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.BASIC_ROM, Bank.RAM, Bank.CHAR_ROM, Bank.KERN_ROM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.IO, Bank.RAM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.RAM, Bank.IO, Bank.KERN_ROM ],
  [ Bank.RAM, Bank.RAM, Bank.RAM, Bank.BASIC_ROM, Bank.RAM, Bank.IO, Bank.KERN_ROM ],
];

// https://github.com/MEGA65/open-roms
var C64_BIOS_LZG = `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`;

//// WASM Machine

import { Machine, BaseWASMMachine } from "../common/baseplatform";
import { TrapCondition } from "../common/devices";

export class C64_WASMMachine extends BaseWASMMachine implements Machine {

  prgstart : number;
  initstring : string;
  initindex : number;
  joymask0 = 0;

  reset() {
    super.reset();
    // load rom
    if (this.romptr && this.romlen) {
      this.exports.machine_load_rom(this.sys, this.romptr, this.romlen);
      this.prgstart = this.romarr[0] + (this.romarr[1]<<8); // TODO: get starting address
      if (this.prgstart == 0x801) this.prgstart = 0x80d;
    }
    // set init string
    if (this.prgstart) {
      this.initstring = "\r\r\r\r\r\r\r\r\r\r\rSYS " + this.prgstart + "\r";
      this.initindex = 0;
    }
    // clear keyboard
    for (var ch=0; ch<128; ch++) {
      this.setKeyInput(ch, 0, KeyFlags.KeyUp);
    }
  }
  advanceFrame(trap: TrapCondition) : number {
    this.typeInitString(); // type init string into console (TODO: doesnt work during debug)
    return super.advanceFrameClock(trap, 19656); // TODO: 985248 / 50 = 19705? music skips
  }
  typeInitString() {
    if (this.initstring) {
      var ch = this.initstring.charCodeAt(this.initindex >> 1);
      this.setKeyInput(ch, 0, (this.initindex&1) ? KeyFlags.KeyUp : KeyFlags.KeyDown);
      if (++this.initindex >= this.initstring.length*2) this.initstring = null;
    }
  }
  getCPUState() {
    this.exports.machine_save_cpu_state(this.sys, this.cpustateptr);
    var s = this.cpustatearr;
    var pc = s[2] + (s[3]<<8);
    return {
      PC:pc,
      SP:s[9],
      A:s[6],
      X:s[7],
      Y:s[8],
      C:s[10] & 1,
      Z:s[10] & 2,
      I:s[10] & 4,
      D:s[10] & 8,
      V:s[10] & 64,
      N:s[10] & 128,
      o:this.readConst(pc),
    }
  }
  saveState() {
    this.exports.machine_save_state(this.sys, this.stateptr);
    /*
    for (var i=0; i<this.statearr.length; i++)
      if (this.statearr[i] == 0xa0 && this.statearr[i+1] == 0x4d && this.statearr[i+2] == 0xe2) console.log(hex(i));
    */
    return {
      c:this.getCPUState(),
      state:this.statearr.slice(0),
      ram:this.statearr.slice(18640, 18640+0x200), // ZP and stack
    };
  }
  loadState(state) : void {
    this.statearr.set(state.state);
    this.exports.machine_load_state(this.sys, this.stateptr);
  }
  getVideoParams() {
   return {width:392, height:272, overscan:true, videoFrequency:50};
  }
  setKeyInput(key: number, code: number, flags: number): void {
    // TODO: handle shifted keys
    if (key == 16 || key == 17 || key == 18 || key == 224) return; // meta keys
    //console.log(key, code, flags);
    //if (flags & KeyFlags.Shift) { key += 64; }
    // convert to c64
    var mask = 0;
    if (key == 37) { key = 0x8; mask = 0x4; } // LEFT
    if (key == 38) { key = 0xb; mask = 0x1; } // UP
    if (key == 39) { key = 0x9; mask = 0x8; } // RIGHT
    if (key == 40) { key = 0xa; mask = 0x2; } // DOWN
    if (flags & KeyFlags.KeyDown) {
      this.exports.machine_key_down(this.sys, key);
      this.joymask0 |= mask;
    } else if (flags & KeyFlags.KeyUp) {
      this.exports.machine_key_up(this.sys, key);
      this.joymask0 &= ~mask;
    }
    this.exports.c64_joystick(this.sys, this.joymask0, 0); // TODO: c64
  }
}
