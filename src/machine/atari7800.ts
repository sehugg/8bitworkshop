
import { MOS6502, MOS6502State } from "../common/cpu/MOS6502";
import { BasicMachine, RasterFrameBased, Bus, ProbeAll } from "../common/devices";
import { KeyFlags, newAddressDecoder, padBytes, Keys, makeKeycodeMap, newKeyboardHandler, EmuHalt, dumpRAM, gtia_ntsc_to_rgb } from "../common/emu";
import { TssChannelAdapter, MasterAudio, POKEYDeviceChannel } from "../common/audio";
import { hex, rgb2bgr } from "../common/util";

// https://atarihq.com/danb/a7800.shtml
// https://atarihq.com/danb/files/maria_r1.txt
// https://atarihq.com/danb/files/7800vid.txt
// https://sites.google.com/site/atari7800wiki/

interface Atari7800StateBase {
  ram : Uint8Array;
  regs6532 : Uint8Array;
}

interface Atari7800ControlsState {
  inputs : Uint8Array;
}

interface Atari7800State extends Atari7800StateBase, Atari7800ControlsState {
  c : MOS6502State;
  tia : {
    regs : Uint8Array,
  };
  maria : {
    regs : Uint8Array,
    offset,dll,dlstart : number;
    dli,h16,h8 : boolean;
  };
  pia : {
    timer: number;
    interval: number;
  }
}

const SWCHA = 0;
const SWCHB = 2;
const INPT0 = 8;

const Atari7800_KEYCODE_MAP = makeKeycodeMap([
  [Keys.A,        INPT0+0, 0x80],
  [Keys.B,        INPT0+1, 0x80],
  [Keys.GP_A,     INPT0+0, 0x80],
  [Keys.GP_B,     INPT0+1, 0x80],
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

// http://www.ataripreservation.org/websites/freddy.offenga/megazine/ISSUE5-PALNTSC.html
// http://7800.8bitdev.org/index.php/7800_Software_Guide#APPENDIX_4:_FRAME_TIMING
// https://forums.atariage.com/topic/224025-7800-hardware-facts/
const CLK = 3579545;
const linesPerFrame = 263;
const numVisibleLines = 258-16;
const colorClocksPerLine = 451; // 451? 452? 456?
const colorClocksPreDMA = 28;
const colorClocksShutdownOther = 16;
const colorClocksShutdownLast = 24;
const audioOversample = 2;
const audioSampleRate = linesPerFrame*60*audioOversample;

// TIA chip

class TIA {
  regs = new Uint8Array(0x20);
  
  reset() {
    this.regs.fill(0);
  }
  read(a : number) : number {
    return this.regs[a] | 0;
  }
  write(a : number, v : number) {
    this.regs[a] = v;
  }
  saveState() {
    return {
      regs: this.regs.slice(0)
    };
  }
  loadState(s) {
    for (let i=0; i<32; i++)
      this.write(i, s.regs[i]);
  }
  static stateToLongString(state) : string {
    let s = "";
    s += dumpRAM(state.regs, 0, 32);
    return s;
  }
}

// MARIA chip

class MARIA {
  bus : Bus;
  cycles : number = 0;
  regs = new Uint8Array(0x20);
  offset : number = -1;
  dll : number = 0;
  dlstart : number = 0;
  dli : boolean = false;
  h16 : boolean = false;
  h8 : boolean = false;
  writemode : number = 0;
  indirect : boolean = false;
  pixels = new Uint8Array(320);
  WSYNC : number = 0;

  reset() {
    this.regs.fill(0);
    // TODO?
  }
  read(a : number) : number {
    return this.regs[a] | 0;
  }
  write(a : number, v : number) {
    this.regs[a] = v;
    if (a == 0x04) this.WSYNC++;
    //console.log(hex(a), '=', hex(v));
  }
  saveState() {
    return {
      regs: this.regs.slice(0),
      offset: this.offset,
      dll: this.dll,
      dlstart: this.dlstart,
      dli: this.dli,
      h16: this.h16,
      h8: this.h8,
      indirect: this.indirect,
      writemode: this.writemode,
    };
  }
  loadState(s) {
    for (let i=0; i<32; i++)
      this.write(i, s.regs[i]|0);
    this.offset = s.offset|0;
    this.dll = s.dll|0;
    this.dlstart = s.dlstart|0;
    this.dli = !!s.dli;
    this.h16 = !!s.h16;
    this.h8 = !!s.h8;
    this.indirect = !!s.indirect;
    this.writemode = s.writemode|0;
  }
  isDMAEnabled() {
    return (this.regs[0x1c] & 0x60) == 0x40;
  }
  getDLLStart() {
    return (this.regs[0x0c] << 8) + this.regs[0x10];
  }
  getCharBaseAddress() {
    return (this.regs[0x14] << 8) + this.offset;
  }
  setVBLANK(b : boolean) {
    if (b) {
      this.regs[0x08] |= 0x80;
      this.offset = -1;
      this.dll = this.getDLLStart();
      this.dli = this.bus && (this.bus.read(this.dll) & 0x80) != 0; // if DLI on first zone
    } else {
      this.regs[0x08] &= ~0x80;
    }
  }
  readDLLEntry(bus) {
    // display lists must be in RAM (TODO: probe?)
    if (this.dll >= 0x4000) { return; }
    let x = bus.read(this.dll);
    this.offset = (x & 0xf);
    this.h16 = (x & 0x40) != 0;
    this.h8  = (x & 0x20) != 0;
    this.dlstart = (bus.read(this.dll+1)<<8) + bus.read(this.dll+2);
    //console.log(hex(this.dll,4), this.offset, hex(this.dlstart,4));
    this.dll = (this.dll + 3) & 0xffff; // TODO: can also only cross 1 page?
    this.dli = (bus.read(this.dll) & 0x80) != 0; // DLI flag is from next DLL entry
  }
  isHoley(a : number) : boolean {
    if (this.indirect) return false;
    if (a & 0x8000) {
      if (this.h16 && (a & 0x1000)) return true;
      if (this.h8  && (a & 0x800))  return true;
    }
    return false;
  }
  readDMA(a : number) : number {
    if (this.isHoley(a)) {
      return 0;
    } else {
      this.cycles += 3;
      return this.bus.read(a);
    }
  }
  doDMA(bus : Bus) {
    this.bus = bus;
    this.cycles = 0;
    const pix = this.pixels;
    pix.fill(this.regs[0x0]); // background color
    if (this.isDMAEnabled()) {
      // last line in zone gets additional 8 cycles
      this.cycles += this.offset == 0 ? colorClocksShutdownLast : colorClocksShutdownOther;
      // time for a new DLL entry?
      if (this.offset < 0) {
        this.readDLLEntry(bus);
      }
      // read the DL (only can span two pages)
      let dlhi = this.dlstart & 0xff00;
      let dlofs = this.dlstart & 0xff;
      do {
        // read DL entry
        let b0 = bus.read(dlhi + ((dlofs+0) & 0x1ff));
        let b1 = bus.read(dlhi + ((dlofs+1) & 0x1ff));
        if (b1 == 0) break; // end of DL
        // display lists must be in RAM (TODO: probe?)
        if (dlhi >= 0x4000) { break; }
        let b2 = bus.read(dlhi + ((dlofs+2) & 0x1ff));
        let b3 = bus.read(dlhi + ((dlofs+3) & 0x1ff));
        let indirect = false;
        // extended header?
        if ((b1 & 31) == 0) {
          var pal = b3 >> 5;
          var width = 32 - (b3 & 31);
          var xpos = bus.read(dlhi + ((dlofs+4) & 0x1ff));
          indirect = (b1 & 0x20) != 0;
          dlofs += 5;
          this.cycles += 10;
          this.writemode = b1 & 0x80;
        } else {
          // direct mode
          var xpos = b3;
          var pal = b1 >> 5;
          var width = 32 - (b1 & 31);
          dlofs += 4;
          this.cycles += 8;
        }
        this.indirect = indirect;
        const gfxadr = b0 + (((b2 + (indirect?0:this.offset)) & 0xff) << 8);
        xpos *= 2;
        const ctrlreg = this.regs[0x1c];
        // gfx mode (readmode + writemode * 4)
        const grmode = (ctrlreg & 0x3) + (this.writemode ? 4 : 0);
        // kangaroo mode
        const kangaroo = (ctrlreg & 0x4) != 0;
        // double bytes?
        const dbl = indirect && (ctrlreg & 0x10) != 0;
        if (dbl) { width *= 2; }
        //if (this.offset == 0) console.log(hex(dla,4), hex(gfxadr,4), xpos, width, pal, readmode);
        for (var i=0; i<width; i++) {
          let data = this.readDMA( dbl ? (gfxadr+(i>>1)) : (gfxadr+i) );
          if (indirect) {
            let indadr = ((this.regs[0x14] + this.offset) << 8) + data;
            if (dbl && (i&1)) {
              indadr++;
              this.cycles -= 3; // indirect read has 6/9 cycles
            }
            data = this.readDMA(indadr);
          }
          // TODO: more modes (https://github.com/gstanton/ProSystem1_3/blob/master/Core/Maria.cpp)
          switch (grmode) {
            case 0:	// 160A
              for (let j=0; j<4; j++) {
                let col = (data >> 6) & 3;
                if (col || kangaroo) {
                  pix[xpos] = pix[xpos+1] = this.regs[(pal<<2) + col];
                }
                data <<= 2;
                xpos = (xpos + 2) & 0x1ff;
              }
              break;
            case 3:	// 320A
              for (let j=0; j<8; j++) {
                let col = (data & 0x80) >> 6;
                if (col || kangaroo) {
                  pix[xpos] = this.regs[(pal<<2) + col];
                }
                data <<= 1;
                xpos = (xpos + 1) & 0x1ff;
              }
              break;
            case 4: // 160B
              for (let j=0; j<2; j++) {
                let col = ((data >> 6) & 0b0011) + (data & 0b1100);
                if ((col & 3) || kangaroo) {
                  pix[xpos] = pix[xpos+1] = pix[xpos+2] = pix[xpos+3] = this.regs[((pal&4)<<2) + col];
                }
                data <<= 2;
                xpos = (xpos + 2) & 0x1ff;
              }
              break;
            case 6: // 320B
              for (let j=0; j<4; j++) {
                let col = ((data & 0x80) >> 6) | ((data & 0x08) >> 3);
                if (col || kangaroo) {
                  pix[xpos] = this.regs[(pal<<2) + col];
                }
                data <<= 1;
                xpos = (xpos + 1) & 0x1ff;
              }
              break;
            case 2: // 320D
              for (let j=0; j<8; j++) {
                let col = ((data & 0x80) >> 6);
                col += (j & 1) ? (pal & 1) : ((pal >> 1) & 1);
                if (col || kangaroo) {
                  pix[xpos] = this.regs[(pal<<2) + col];
                }
                data <<= 1;
                xpos = (xpos + 1) & 0x1ff;
              }
              break;
            case 7: // 320C
              let data0 = data;
              for (let j=0; j<4; j++) {
                if (j == 2) data0 <<= 2;
                let col = (data & 0x80) >> 6;
                let ppal = (pal & 4) | ((data0 >> 2) & 3);
                if (col || kangaroo) {
                  pix[xpos] = this.regs[(ppal<<2) + col];
                }
                data <<= 1;
                xpos = (xpos + 1) & 0x1ff;
              }
              break;
          }
        }
      } while (this.cycles < colorClocksPerLine); // TODO?
      // decrement offset
      this.offset -= 1;
    }
    return this.cycles;
  }
  doInterrupt() : boolean {
    if (this.dli && this.offset < 0) {
      this.dli = false;
      return true;
    } else
      return false;
    //return this.dli;// && this.offset == 1;
  }
  static stateToLongString(state) : string {
    let s = "";
    s += dumpRAM(state.regs, 0, 32);
    s += "\n   DLL: $" + hex((state.regs[0x0c] << 8) + state.regs[0x10],4) + " @ $" + hex(state.dll,4);
    s += "\n    DL: $" + hex(state.dlstart,4);
    s += "\nOffset:  " + state.offset;
    s += "\n   DLI?  " + state.dli;
    return s;
  }
}

// Atari 7800

export class Atari7800 extends BasicMachine implements RasterFrameBased {

  cpuFrequency = 1789772;
  canvasWidth = 320;
  numTotalScanlines = linesPerFrame;
  numVisibleScanlines = numVisibleLines;
  defaultROMSize = 0xc000;
  cpuCyclesPerLine = 113.5;
  sampleRate = audioSampleRate;

  cpu : MOS6502;
  ram : Uint8Array = new Uint8Array(0x1000);
  regs6532 = new Uint8Array(4);
  piatimer : number = 0;
  timerinterval : number = 1;
  tia : TIA = new TIA();
  maria : MARIA = new MARIA();
  pokey1; //TODO: type
  audioadapter;
  
  lastFrameCycles = 0;
  xtracyc = 0;
  
  read  : (a:number) => number;
  write : (a:number, v:number) => void;
  
  dmaBus : Bus; // to pass to MARIA

  constructor() {
    super();
    this.cpu = new MOS6502();
    this.read = newAddressDecoder([
        [0x0008, 0x000d,   0x0f, (a) => { this.xtracyc++; return this.readInput(a); }],
        [0x0000, 0x001f,   0x1f, (a) => { this.xtracyc++; return this.tia.read(a); }],
        [0x0020, 0x003f,   0x1f, (a) => { return this.maria.read(a); }],
        [0x0040, 0x00ff,   0xff, (a) => { return this.ram[a + 0x800]; }],
        [0x0100, 0x013f,   0xff, (a) => { return this.read(a); }], // shadow
        [0x0140, 0x01ff,  0x1ff, (a) => { return this.ram[a + 0x800]; }],
        [0x0280, 0x02ff,   0x7f, (a) => { this.xtracyc++; return this.readPIA(a); }],
        [0x1800, 0x27ff, 0xffff, (a) => { return this.ram[a - 0x1800]; }],
        [0x2800, 0x3fff,  0x7ff, (a) => { return this.read(a | 0x2000); }], // shadow
        [0x4000, 0xffff, 0xffff, (a) => { return this.rom ? this.rom[a - 0x4000] : 0; }],
        [0x0000, 0xffff, 0xffff, (a) => { return this.probe && this.probe.logIllegal(a); }],
      ]);
    this.write = newAddressDecoder([
        [0x0015, 0x001A,   0x1f, (a,v) => { this.xtracyc++; this.pokey1.setTIARegister(a, v); }],
        [0x0000, 0x001f,   0x1f, (a,v) => { this.xtracyc++; this.tia.write(a,v); }],
        [0x0020, 0x003f,   0x1f, (a,v) => { this.maria.write(a,v); }],
        [0x0040, 0x00ff,   0xff, (a,v) => { this.ram[a + 0x800] = v; }],
        [0x0100, 0x013f,   0xff, (a,v) => { this.write(a,v); }], // shadow
        [0x0140, 0x01ff,  0x1ff, (a,v) => { this.ram[a + 0x800] = v; }],
        [0x0280, 0x02ff,   0x7f, (a,v) => { this.xtracyc++; this.writePIA(a,v) }],
        [0x1800, 0x27ff, 0xffff, (a,v) => { this.ram[a - 0x1800] = v; }],
        [0x2800, 0x3fff,  0x7ff, (a,v) => { this.write(a | 0x2000, v); }], // shadow
        [0xbfff, 0xbfff, 0xffff, (a,v) => { }], // TODO: bank switching?
        [0x0000, 0xffff, 0xffff, (a,v) => { this.probe && this.probe.logIllegal(a); }],
      ]);
    this.connectCPUMemoryBus(this);
    this.dmaBus = this.probeDMABus(this);
    this.handler = newKeyboardHandler(this.inputs, Atari7800_KEYCODE_MAP);
    this.pokey1 = new POKEYDeviceChannel();
    this.audioadapter = new TssChannelAdapter(this.pokey1, audioOversample, audioSampleRate);
  }
  
  readConst(a) {
    // make sure we don't log during this
    let oldprobe = this.probe;
    this.probe = null;
    let v = this.read(a);
    this.probe = oldprobe;
    return v;
  }

  readInput(a:number) : number {
    switch (a) {
      case 0xc: return ~this.inputs[0x8] & 0x80; //INPT4
      case 0xd: return ~this.inputs[0x9] & 0x80; //INPT5
      default: return this.inputs[a]|0;
    }
  }

  readPIA(a:number) : number {
    switch (a) {
      case 0x0:
      case 0x2:
        return this.inputs[a]; // SWCHA, SWCHB
      case 0x1:
      case 0x3:
        return this.regs6532[a]; // CTLSWA, CTLSWB
      case 0x4:
        return this.getPIATimerValue(); // INTIM
      default:
        return 0;
    }
  }

  writePIA(a:number, v:number) : void {
    switch (a) {
      case 0x0:
      case 0x1:
      case 0x2:
      case 0x3:
        this.regs6532[a] = v;
        return;
      case 0x14: this.setPIATimer(v, 0); return; // TIM1T
      case 0x15: this.setPIATimer(v, 3); return; // TIM8T
      case 0x16: this.setPIATimer(v, 6); return; // TIM64T
      case 0x17: this.setPIATimer(v, 10); return; // T1024T
      case 0x18: this.setPIATimer(v, 6); return; // TIM64TI (TODO)
    }
  }

  setPIATimer(v:number, shift:number) : void {
    this.piatimer = (v + 1) << shift;
    this.timerinterval = shift;
  }

  getPIATimerValue() : number {
    let t = this.piatimer;
    if (t > 0) {
      return t >> this.timerinterval;
    } else {
      return t & 0xff;
    }
  }

  advanceCPU() : number {
    var clk = super.advanceCPU();
    this.tickPIATimer(clk); // TODO?
    if (this.xtracyc) {
      clk += this.xtracyc;
      this.tickClocks(this.xtracyc);
      this.xtracyc = 0;
    }
    return clk;
  }

  tickClocks(clocks:number) {
    this.probe.logClocks(clocks);
    this.tickPIATimer(clocks);
  }
  tickPIATimer(clocks:number) {
    this.piatimer = Math.max(-256, this.piatimer - clocks);
  }

  advanceFrame(trap) : number {
    var idata = this.pixels;
    var iofs = 0;
    var rgb;
    var mc = 0;
    var fc = 0;
    var steps = 0;
    this.lastFrameCycles = -1;
    this.probe.logNewFrame();
    //console.log(hex(this.cpu.getPC()), hex(this.maria.dll));
    // visible lines
    for (var sl=0; sl<linesPerFrame; sl++) {
      this.scanline = sl;
      var visible = sl < numVisibleLines;
      this.maria.setVBLANK(!visible);
      this.maria.WSYNC = 0;
      // pre-DMA clocks
      while (mc < colorClocksPreDMA) {
        if (this.maria.WSYNC) break;
        if (trap && trap()) {
          trap = null;
          sl = 999;
          this.lastFrameCycles = mc;
          break; // TODO?
        }
        mc += this.advanceCPU() << 2;
        steps++;
      }
      // is this scanline visible?
      if (visible) {
        // do DMA for scanline?
        let dmaClocks = this.maria.doDMA(this.dmaBus);
        this.tickClocks(dmaClocks >> 2); // TODO: logDMA
        mc += dmaClocks;
        // copy line to frame buffer
        if (idata) {
          const ctrlreg = this.maria.regs[0x1c];
          const colorkill = (ctrlreg & 0x80) != 0;
          const mask = colorkill ? 0x0f : 0xff;
          for (var i=0; i<320; i++) {
            idata[iofs++] = COLORS_RGBA[this.maria.pixels[i] & mask];
          }
        }
      }
      // do interrupt? (if visible or before 1st scanline)
      if ((visible || sl == linesPerFrame-1) && this.maria.doInterrupt()) {
        this.probe.logInterrupt(0);
        this.cpu.NMI();
      }
      // post-DMA clocks
      while (mc < colorClocksPerLine) {
        if (this.maria.WSYNC) {
          this.probe.logWait(0);
          this.tickClocks((colorClocksPerLine - mc) >> 2);
          mc = colorClocksPerLine;
          break;
        }
        if (trap && trap()) {
          trap = null;
          sl = 999;
          this.lastFrameCycles = mc;
          break;
        }
        mc += this.advanceCPU() << 2;
        steps++;
      }
      // audio
      this.audio && this.audioadapter.generate(this.audio);
      // update clocks, scanline
      mc -= colorClocksPerLine;
      fc += mc;
      this.probe.logNewScanline();
    }
    /*
      // TODO let bkcol = this.maria.regs[0x0];
      // TODO $(this.video.canvas).css('background-color', COLORS_WEB[bkcol]);
    */
    return steps;
  }

  // TODO: doesn't work when breakpoint
  getRasterX() { return (this.lastFrameCycles + colorClocksPerLine) % colorClocksPerLine; }

  getRasterY() { return this.scanline; }

  getRasterCanvasPosition() {
    return { x: this.getRasterX(), y: this.getRasterY() };
  }

  loadROM(data) {
    if (data.length == 0xc080) data = data.slice(0x80); // strip header
    this.rom = padBytes(data, this.defaultROMSize, true);
  }

  reset() {
    super.reset();
    this.tia.reset();
    this.maria.reset();
    this.inputs.fill(0x0);
    this.inputs[SWCHA] = 0xff;
    this.inputs[SWCHB] = 1+2+8;
    this.setPIATimer(0, 0); // TODO?
    //this.cpu.advanceClock(); // needed for test to pass?
  }

  readAddress(addr : number) {
    return this.read(addr) | 0;
  }

  loadState(state : Atari7800State) {
    this.cpu.loadState(state.c);
    this.ram.set(state.ram);
    this.tia.loadState(state.tia);
    this.maria.loadState(state.maria);
    this.regs6532.set(state.regs6532);
    this.piatimer = state.pia.timer;
    this.timerinterval = state.pia.interval;
    this.loadControlsState(state);
  }
  saveState() : Atari7800State {
    return {
      c:this.cpu.saveState(),
      ram:this.ram.slice(0),
      tia:this.tia.saveState(),
      maria:this.maria.saveState(),
      regs6532:this.regs6532.slice(0),
      inputs:this.inputs.slice(0),
      pia:{timer:this.piatimer, interval: this.timerinterval}
    };
  }
  loadControlsState(state:Atari7800ControlsState) : void {
    this.inputs.set(state.inputs);
  }
  saveControlsState() : Atari7800ControlsState {
    return {
      inputs:this.inputs.slice(0)
    };
  }

  getDebugCategories() {
    return ['CPU','Stack','TIA','MARIA'];
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'TIA': return TIA.stateToLongString(state.tia);
      case 'MARIA': return MARIA.stateToLongString(state.maria) + "\nScanline: " + this.scanline;
      //default: return super.getDebugInfo(category, state);
    }
  }
  getDebugDisplayLists() {
    // return display list in human-readable JSON object
    let display_lists = {};
    let dll_ofs = this.maria.getDLLStart();
    // read the address of each DLL entry
    let y = 0;
    while (y < 240) {
      let x = this.readConst(dll_ofs);
      let offset = (x & 0xf);
      let h16 = (x & 0x40) != 0;
      let h8  = (x & 0x20) != 0;
      let dlstart = (this.readConst(dll_ofs+1)<<8) + this.readConst(dll_ofs+2);
      dll_ofs = (dll_ofs + 3) & 0xffff; // TODO: can also only cross 1 page?
      let dli = (this.readConst(dll_ofs) & 0x80) != 0; // DLI flag is from next DLL entry
      let title = "DL $" + hex(dlstart,4) + " " + y + "-" + (y+offset);
      if (h16) title += " H16";
      if (h8) title += " H8";
      if (dli) title += " DLI";
      display_lists[title] = { "$$": this._readDebugDisplayList(dlstart) };
      y += offset + 1;
    }
    return display_lists;
  }
  _readDebugDisplayList(dlstart: number) {
    return () => this.readDebugDisplayList(dlstart);
  }
  readDebugDisplayList(dlstart: number) {
    let display_list = [];
    let dlhi = dlstart & 0xff00;
    let dlofs = dlstart & 0xff;
    do {
      const ctrlreg = this.maria.regs[0x1c];
      // read DL entry
      let b0 = this.readConst(dlhi + ((dlofs+0) & 0x1ff));
      let b1 = this.readConst(dlhi + ((dlofs+1) & 0x1ff));
      if (b1 == 0) break; // end of DL
      // display lists must be in RAM (TODO: probe?)
      let b2 = this.readConst(dlhi + ((dlofs+2) & 0x1ff));
      let b3 = this.readConst(dlhi + ((dlofs+3) & 0x1ff));
      // extended header?
      let indirect = false;
      let description = "";
      let writemode;
      const grmode = (ctrlreg & 0x3) + ((b1 & 0x80) ? 4 : 0);
      if ((b1 & 31) == 0) {
        var pal = b3 >> 5;
        var width = 32 - (b3 & 31);
        var xpos = this.readConst(dlhi + ((dlofs+4) & 0x1ff));
        indirect = (b1 & 0x20) != 0;
        writemode = b1 & 0x80;
        dlofs += 5;
      } else {
        // direct mode
        var xpos = b3;
        var pal = b1 >> 5;
        var width = 32 - (b1 & 31);
        dlofs += 4;
      }
      description += "X=" + xpos + " W=" + width + " P=" + pal;
      if (writemode) description += " WM=1";
      if (indirect) description += " CHR=$" + hex((this.maria.regs[0x14] + this.maria.offset) & 0xff) + "xx";
      let gfxadr = b0 + (((b2 + (indirect?0:this.maria.offset)) & 0xff) << 8);
      description = " $" + hex(gfxadr,4) + " " + description;
      description = ["160A","?","320D","320A","160B","?","320B","320C"][grmode] + ' ' + description;
      display_list.push(description);
    } while (dlofs < 0x200);
    return display_list;
  }
}

///

var COLORS_RGBA = new Uint32Array(256);
for (var i=0; i<256; i++) {
  COLORS_RGBA[i] = gtia_ntsc_to_rgb(i);
}

