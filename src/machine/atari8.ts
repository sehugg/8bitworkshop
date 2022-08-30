import { newPOKEYAudio, TssChannelAdapter } from "../common/audio";
import { EmuState, Machine } from "../common/baseplatform";
import { MOS6502 } from "../common/cpu/MOS6502";
import { AcceptsKeyInput, AcceptsPaddleInput, AcceptsROM, BasicScanlineMachine, FrameBased, Probeable, RasterFrameBased, TrapCondition, VideoSource } from "../common/devices";
import { dumpRAM, KeyFlags, Keys, makeKeycodeMap, newAddressDecoder, newKeyboardHandler } from "../common/emu";
import { hex, lpad, lzgmini, rgb2bgr, stringToByteArray } from "../common/util";
import { BaseWASIMachine } from "../common/wasmplatform";

const ATARI8_KEYMATRIX_INTL_NOSHIFT = [
  Keys.VK_L, Keys.VK_J, Keys.VK_SEMICOLON, Keys.VK_F1, Keys.VK_F2, Keys.VK_K, Keys.VK_SLASH, Keys.VK_TILDE,
  Keys.VK_O, null, Keys.VK_P, Keys.VK_U, Keys.VK_ENTER, Keys.VK_I, Keys.VK_MINUS, Keys.VK_EQUALS,
  Keys.VK_V, Keys.VK_F8, Keys.VK_C, Keys.VK_F3, Keys.VK_F4, Keys.VK_B, Keys.VK_X, Keys.VK_Z,
  Keys.VK_4, null, Keys.VK_3, Keys.VK_6, Keys.VK_ESCAPE, Keys.VK_5, Keys.VK_2, Keys.VK_1,
  Keys.VK_COMMA, Keys.VK_SPACE, Keys.VK_PERIOD, Keys.VK_N, null, Keys.VK_M, Keys.VK_SLASH, null/*invert*/,
  Keys.VK_R, null, Keys.VK_E, Keys.VK_Y, Keys.VK_TAB, Keys.VK_T, Keys.VK_W, Keys.VK_Q,
  Keys.VK_9, null, Keys.VK_0, Keys.VK_7, Keys.VK_BACK_SPACE, Keys.VK_8, Keys.VK_LEFT, Keys.VK_RIGHT,
  Keys.VK_F, Keys.VK_H, Keys.VK_D, null, Keys.VK_CAPS_LOCK, Keys.VK_G, Keys.VK_S, Keys.VK_A,
];

//TODO
var ATARI8_KEYCODE_MAP = makeKeycodeMap([
  [Keys.UP, 0, 0x1],
  [Keys.DOWN, 0, 0x2],
  [Keys.LEFT, 0, 0x4],
  [Keys.RIGHT, 0, 0x8],
  [Keys.VK_SPACE, 2, 0x1],
  /*
    [Keys.P2_UP, 0, 0x10],
    [Keys.P2_DOWN, 0, 0x20],
    [Keys.P2_LEFT, 0, 0x40],
    [Keys.P2_RIGHT, 0, 0x80],
    [Keys.P2_A, 3, 0x1],
  */
    [Keys.START, 3, 0x1],
    [Keys.SELECT, 3, 0x2],
    [Keys.VK_OPEN_BRACKET, 3, 0x4],
  ]);

// ANTIC

// https://www.atarimax.com/jindroush.atari.org/atanttim.html
// http://www.virtualdub.org/blog/pivot/entry.php?id=243
// http://www.beipmu.com/Antic_Timings.txt
// https://user.xmission.com/~trevin/atari/antic_regs.html
// https://user.xmission.com/~trevin/atari/antic_insns.html
// http://www.atarimuseum.com/videogames/consoles/5200/conv_to_5200.html
// https://www.virtualdub.org/downloads/Altirra%20Hardware%20Reference%20Manual.pdf

const PF_LEFT = [999, 26, 18, 10];
const PF_RIGHT = [999, 26 + 64, 18 + 80, 10 + 96];

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
const NMI_CYCLE = 24;
const WSYNC_CYCLE = 212;

const MODE_LINES = [0, 0, 8, 10, 8, 16, 8, 16, 8, 4, 4, 2, 1, 2, 1, 1];
// how many bits before DMA clock repeats?
const MODE_PERIOD = [0, 0, 2, 2, 2, 2, 4, 4, 8, 4, 4, 4, 4, 2, 2, 2];
const MODE_YPERIOD = [0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 0, 0, 0, 0];
//const MODE_BPP = [0, 0, 1, 1, 2, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 1];
// how many color clocks / pixel * 2
const MODE_SHIFT = [0, 0, 1, 1, 2, 2, 2, 2, 8, 4, 4, 2, 2, 2, 2, 1];

class ANTIC {
  regs = new Uint8Array(0x10);				// registers
  read: (address: number) => number;	// bus read function
  nmiPending: boolean = false;

  // derived by registers
  pfwidth: number;				// playfield width
  left: number;
  right: number;					// left/right clocks for mode

  // a la minute
  dliop: number = 0;    // dli operation
  mode: number = 0;			// current mode
  jmp = false; // TODO
  lms = false; // TODO
  dlarg_lo: number = 0;
  dlarg_hi: number = 0;
  period: number = 0;		// current mode period bitmask
  scanaddr: number = 0;  // Scan Address (via LMS)
  startaddr: number = 0;	// Start of line Address
  pfbyte: number = 0;		// playfield byte fetched
  ch: number = 0;				// char read
  linesleft: number = 0; // # of lines left in mode
  yofs: number = 0;			// yofs fine
  v: number = 0;					// vertical scanline #
  h: number = 0;					// horizontal color clock

  linebuf = new Uint8Array(48);
  dmaclock: number = 0;
  dmaidx: number = 0;
  output: number = 0;
  dramrefresh = false;

  constructor(readfn) {
    this.read = readfn; // bus read function
  }
  reset() {
    this.regs.fill(0);
    this.regs[NMIEN] = 0x00;
    this.regs[NMIST] = 0x7f;
    this.regs[PENH] = 0x00;
    this.regs[PENV] = 0xff;
    this.setReg(DMACTL, 0x0);
    this.h = this.v = 0;
    this.startaddr = this.scanaddr = 0;
    this.dmaclock = 0;
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
      linebuf: this.linebuf.slice(0),
      dmaidx: this.dmaidx,
      dmaclock: this.dmaclock,
      output: this.output,
      dramrefresh: this.dramrefresh,
    };
  }
  loadState(s) {
    this.regs.set(s.regs);
    this.setReg(DMACTL, s.regs[DMACTL]);
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
    this.linebuf.set(s.linebuf);
    this.dmaidx = s.dmaidx;
    this.dmaclock = s.dmaclock;
    this.output = s.output;
    this.dramrefresh = s.dramrefresh;
  }
  static stateToLongString(state): string {
    let s = "";
    s += "H: " + lpad(state.h, 3) + " V: " + lpad(state.v, 3) + " Linesleft: " + state.linesleft + "\n";
    s += "Mode: " + hex(state.mode, 2) + " Period: " + (state.period + 1) + "\n";
    s += "Addr: " + hex(state.scanaddr, 4) + "\n";
    s += dumpRAM(state.regs, 0, 16).replace('$00', 'Regs');
    return s;
  }
  setReg(a: number, v: number) {
    this.regs[a] = v;
    switch (a) {
      case WSYNC:
        this.regs[WSYNC] = 0xff;
        break;
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
    //let offset = 4 << MODE_PERIOD[this.mode & 0xf];
    this.left = PF_LEFT[this.pfwidth];
    this.right = PF_RIGHT[this.pfwidth];
  }
  readReg(a: number) {
    switch (a) {
      case NMIST:
        return this.regs[a];
      case VCOUNT:
        return this.v >> 1;
      default:  
        return 0xff;
    }
  }
  processDLIEntry() {
    if (this.mode == 0) { // N Blank Lines
      this.linesleft = (this.dliop >> 4) + 1;
    } else {
      this.linesleft = MODE_LINES[this.mode];
      this.period = MODE_PERIOD[this.mode];
      if (this.jmp) {
        this.regs[DLISTL] = this.dlarg_lo;
        this.regs[DLISTH] = this.dlarg_hi;
        this.mode = 0;
        // JVB (Jump and wait for Vertical Blank)
        if (this.dliop & 0x40) {
          this.linesleft = (248 - this.v) & 0xff; // TODO?
        }
      } else if (this.lms) {
        this.scanaddr = this.dlarg_lo + (this.dlarg_hi << 8);
        //console.log('scanaddr', hex(this.scanaddr));
      }
      this.startaddr = this.scanaddr;
    }
  }

  processLine() {
    if (this.linesleft > 0) {
      this.linesleft--;
      this.yofs++;
      if (this.mode >= 8 && this.linesleft) {
        this.scanaddr = this.startaddr; // reset line addr
      }
    }
  }

  triggerNMI(mask: number) {
    if (this.regs[NMIEN] & mask) {
      this.nmiPending = true;
    }
    this.regs[NMIST] = mask | 0x1f;
  }

  nextInsn(): number {
    let pc = this.regs[DLISTL] + (this.regs[DLISTH] << 8);
    let b = this.read(pc);
    //console.log('nextInsn', hex(pc), hex(b), this.v);
    pc = ((pc + 1) & 0x3ff) | (pc & ~0x3ff);
    this.regs[DLISTL] = pc & 0xff;
    this.regs[DLISTH] = pc >> 8;
    return b;
  }

  nextScreen(): number {
    let b = this.read(this.scanaddr);
    this.scanaddr = ((this.scanaddr + 1) & 0xfff) | (this.scanaddr & ~0xfff);
    return b;
  }

  dlDMAEnabled() { return this.regs[DMACTL] & 0b100000; }
  pmDMAEnabled() { return this.regs[DMACTL] & 0b001100; }

  isVisibleScanline() {
    return this.v >= 8 && this.v < 248;
  }
  isPlayfieldDMAEnabled() {
    return this.dlDMAEnabled() && !this.linesleft;
  }
  isPlayerDMAEnabled() {
    return this.regs[DMACTL] & 0b1000;
  }
  isMissileDMAEnabled() {
    return this.regs[DMACTL] & 0x1100;
  }

  clockPulse(): boolean {
    let dma = this.regs[WSYNC] != 0;
    if (!this.isVisibleScanline()) {
      this.doVBlank();
    } else {
      switch (this.h) {
        case 0:
          if (this.isMissileDMAEnabled()) {
            this.doPlayerMissileDMA(3);
            dma = true;
          }
          break;
        case 1:
          if (this.isPlayfieldDMAEnabled()) {
            let op = this.nextInsn(); // get mode
            // TODO: too many booleans
            this.jmp = (op & ~0x40) == 0x01; // JMP insn?
            this.lms = (op & 0x40) != 0 && (op & 0xf) != 0; // LMS insn?
            this.mode = op & 0xf;
            this.dliop = op;
            this.yofs = 0;
            dma = true;
          }
          break;
        case 2: case 3: case 4: case 5:
          if (this.isPlayerDMAEnabled()) {
            this.doPlayerMissileDMA(6 - this.h);
            dma = true;
          }
          break;
        case 6:
        case 7:
          if (this.yofs == 0 && this.isPlayfieldDMAEnabled() && (this.jmp || this.lms)) { // read extra bytes?
            if (this.h == 6) this.dlarg_lo = this.nextInsn();
            if (this.h == 7) this.dlarg_hi = this.nextInsn();
            dma = true;
          }
          break;
        case 9:
          if (this.yofs == 0) {
            this.processDLIEntry();
          }
          break;
        case 8:
          if (this.dliop & 0x80) { // TODO: what if DLI disabled?
            if (this.linesleft == 1) {
              this.triggerNMI(0x80); // DLI interrupt
            }
          }
          break;
        case 111:
          this.processLine();
          ++this.v;
          break;
      }
      this.output = 0; // background color (TODO: only for blank lines)
      if (this.mode >= 2) {
        let candma = this.h < 106;
        this.dmaclock <<= 1;
        if (this.dmaclock & (1 << this.period)) {
          this.dmaclock |= 1;
        }
        if (this.h == this.left) { this.dmaclock |= 1; this.dmaidx = 0; }
        if (this.h == this.right) { this.dmaclock &= ~1; this.dmaidx++; }
        if (this.dmaclock & 1) {
          if (this.mode < 8 && this.yofs == 0) { // only read chars on 1st line
            this.linebuf[this.dmaidx] = this.nextScreen(); // read char name
            dma = candma;
          }
          this.dmaidx++;
        } else if (this.dmaclock & 8) {
          this.ch = this.linebuf[this.dmaidx - 4 / this.period]; // latch char
          this.readBitmapData(); // read bitmap
          dma = candma;
        }
        this.output = this.h >= this.left + 3 && this.h <= this.right + 2 ? 4 : 0;
      }
    }
    if (this.h < 19 || this.h > 102) this.output = 2;
    this.incHorizCounter();
    if (!dma && this.dramrefresh) {
      this.dramrefresh = false;
      dma = true;
    }
    return dma;
  }
  incHorizCounter() {
    ++this.h;
    switch (this.h) {
      case 25: case 25 + 4 * 1: case 25 + 4 * 2: case 25 + 4 * 3: case 25 + 4 * 4:
      case 25 + 4 * 5: case 25 + 4 * 6: case 25 + 4 * 7: case 25 + 4 * 8:
        this.dramrefresh = true;
        break;
      case 105:
        this.regs[WSYNC] = 0; // TODO: dram refresh delay to 106?
        break;
      case 114:
        this.h = 0;
        break;
    }
  }
  doVBlank() {
    this.linesleft = this.mode = 0;
    if (this.h == 111) { this.v++; }
    if (this.v == 248 && this.h == 0) { this.triggerNMI(0x40); } // VBI
    if (this.v == 262 && this.h == 112) { this.v = 0; }
    this.output = 2; // blank
  }

  doPlayerMissileDMA(section: number) {
    let oneline = this.regs[DMACTL] & 0x10;
    let pmaddr = this.regs[PMBASE] << 8;
    if (oneline) {
      pmaddr &= 0b1111100000000000;
      pmaddr |= section << 8;
      pmaddr += this.v & 0xff;
    } else {
      pmaddr &= 0b111111000000000;
      pmaddr |= section << 7;
      pmaddr += this.v >> 1;
    }
    this.read(pmaddr);
  }

  readBitmapData() {
    const mode = this.mode;
    if (mode < 8) {	// character mode
      let ch = this.ch;
      let y = this.yofs >> MODE_YPERIOD[this.mode];
      let addrofs = y & 7;
      let chbase = this.regs[CHBASE];
      // modes 6 & 7
      if ((mode & 0xe) == 6) { // or 7
        ch &= 0x3f;
        chbase &= 0xfe;
      } else {
        ch &= 0x7f;
        chbase &= 0xfc;
      }
      let addr = (ch << 3) + (chbase << 8);
      // modes 2 & 3
      if ((mode & 0xe) == 2) { // or 3
        let chactl = this.regs[CHACTL];
        let mode3lc = mode == 3 && (ch & 0x60) == 0x60;
        if (chactl & 4)
          this.pfbyte = this.read(addr + (addrofs ^ 7)); // mirror
        else
          this.pfbyte = this.read(addr + addrofs);
        if (mode3lc && y < 2) { this.pfbyte = 0; }
        if (!mode3lc && y > 7) { this.pfbyte = 0; }
        if (this.ch & 0x80) {
          if (chactl & 1)
            this.pfbyte = 0x0; // blank
          if (chactl & 2)
            this.pfbyte ^= 0xff; // invert
        }
      } else {
        this.pfbyte = this.read(addr + addrofs);
      }
    } else {	// map mode
      this.pfbyte = this.nextScreen();
    }
  }

  shiftout() {
    if (this.output == 4) { // visible pixel?
      switch (this.mode) {
        case 2: case 3:
        case 15:
          {
            let v = (this.pfbyte >> 7) & 1;
            this.pfbyte <<= 1;
            return v ? 8 : 6;
          }
        case 6: case 7:
          {
            let v = (this.pfbyte >> 7) & 1;
            this.pfbyte <<= 1;
            return v ? (this.ch >> 6) + 4 : 0;
          }
        case 9: case 11: case 12:
          {
            let v = (this.pfbyte >> 7) & 1;
            this.pfbyte <<= 1;
            return v ? 4 : 0;
          }
        case 4: case 5:
        case 8: case 10:
        case 13: case 14:
          {
            let v = (this.pfbyte >> 6) & 3;
            this.pfbyte <<= 2;
            return [0, 4, 5, 6][v]; // TODO: 5th color
          }
      }
    }
    return this.output;
  }

}

// GTIA
// https://user.xmission.com/~trevin/atari/gtia_regs.html
// https://user.xmission.com/~trevin/atari/gtia_pinout.html


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
  shiftregs = new Uint32Array(8);

  count = 0;
  an = 0;
  rgb = 0;
  pmcol = 0;
  console_inputs = 0;

  reset() {
    this.regs.fill(0);
    this.count = 0;
  }
  saveState() {
    return {
      regs: this.regs.slice(0),
      shiftregs: this.shiftregs.slice(0),
      count: this.count,
      console_inputs: this.console_inputs,
    };
  }
  loadState(s) {
    this.regs.set(s.regs);
    this.shiftregs.set(s.shiftregs);
    this.count = s.count;
    this.console_inputs = s.console_inputs;
  }
  setReg(a: number, v: number) {
    switch (a) {
      case CONSOL:
        v = (v & 15) ^ 15; // 0 = input, 1 = pull down
        break;
      case HITCLR:
        this.regs[P0PF] = this.regs[P0PL] = this.regs[M0PF] = this.regs[M0PL] = 0;
        break;
    }
    this.regs[a] = v;
  }
  readReg(a: number) {
    if (a == CONSOL) {
      return this.console_inputs & this.regs[CONSOL];
    }
    return this.regs[a];
  }
  updateGfx(h: number, data: number) {
    switch (h) {
      case 0:
        this.count = 0;
        if (this.regs[GRACTL] & 1) { this.regs[GRAFM] = data; }
        break;
      case 2: case 3: case 4: case 5:
        if (this.regs[GRACTL] & 2) { this.regs[GRAFP0 - 2 + h] = data; }
        break;
    }
  }
  getPlayfieldColor(): number {
    let pfcol = 0;
    switch (this.an) {
      case 0:
        pfcol = this.regs[COLBK]; // 0 = background
        break;
      case 2: case 3:
        pfcol = 0; // 2/3 = blank
        break;
      case 4: case 5: case 6: case 7:
        pfcol = this.regs[COLPF0 + this.an - 4];
        break;
      case 8:
        pfcol = (this.regs[COLPF2] & 0xf0) | (this.regs[COLPF1] & 0x0f);
        break;
    }
    return pfcol;
  }
  clockPulse1(): void {
    let topcol = -1;
    let lasti = -1;
    let pfset = this.an > 4; // TODO?
    let p0pf = this.regs[P0PF];
    let p0pl = this.regs[P0PL];
    for (let i = 0; i < 8; i++) {
      let pmcol = this.getPlayerMissileColor(i);
      if (pmcol >= 0) {
        if (pfset) {
          p0pl |= 1 << i;
        }
        if (lasti > 0) {
          p0pl |= 1 << i;
          p0pl |= 1 << lasti;
        }
        topcol = pmcol;
        lasti = i;
      }
    }
    this.regs[P0PF] = p0pf;
    this.regs[P0PL] = p0pl;
    this.pmcol = topcol; // TODO: priority
    this.count++;
    this.clockPulse2();
  }
  clockPulse2(): void {
    let col = this.getPlayfieldColor();
    if (this.pmcol >= 0) col = this.pmcol;
    this.rgb = COLORS_RGBA[col];
  }
  getPlayerMissileColor(i: number) {
    let bit = this.shiftregs[i] & 0x80000000;
    this.shiftregs[i] <<= 1;
    if (this.regs[HPOSP0 + i] - 7 == this.count) {
      this.triggerObject(i);
    }
    return bit ? this.regs[COLPM0 + (i & 3)] : -1;
  }
  triggerObject(i: number) {
    let size, data;
    if (i < 4) {
      size = this.regs[SIZEP0 + i] & 3;
      data = this.regs[GRAFP0 + i];
    } else {
      size = (this.regs[SIZEM] >> (i - 4) * 2) & 3;
      data = this.regs[GRAFM] & (1 << i); // TODO
    }
    if (size & 1) data = expandBits(data); else data <<= 8;
    if (size == 3) data = expandBits(data); else data <<= 16;
    this.shiftregs[i] = data;
  }

  static stateToLongString(state): string {
    let s = "";
    s += dumpRAM(state.regs, 0, 32);
    return s;
  }
}

function expandBits(x: number): number {
  x = (x | (x << 8)) & 0x00FF00FF;
  x = (x | (x << 4)) & 0x0F0F0F0F;
  x = (x | (x << 2)) & 0x33333333;
  x = (x | (x << 1)) & 0x55555555;
  return x | (x << 1);
}


export class Atari800 extends BasicScanlineMachine {

  // http://www.ataripreservation.org/websites/freddy.offenga/megazine/ISSUE5-PALNTSC.html
  cpuFrequency = 1789773;
  numTotalScanlines = 262;
  cpuCyclesPerLine = 114;
  canvasWidth = 352; // TODO?
  aspectRatio = 240 / 172;
  firstVisibleClock = 34 * 2; // TODO?
  numVisibleScanlines = 250;
  // TODO: for 400/800/5200
  defaultROMSize = 0x8000;
  overscan = true;
  audioOversample = 4;
  sampleRate = this.numTotalScanlines * 60 * this.audioOversample;

  cpu: MOS6502;
  ram: Uint8Array;
  rom: Uint8Array;
  bios: Uint8Array;
  bus;
  pokey;
  audioadapter;
  antic: ANTIC;
  gtia: GTIA;
  inputs = new Uint8Array(4);
  linergb = new Uint32Array(this.canvasWidth);
  lastdmabyte = 0;
  keycode = 0;
  irqstatus = 0;
  // TODO: save/load vars

  constructor() {
    super();
    this.cpu = new MOS6502();
    this.ram = new Uint8Array(0x10000);
    this.bios = new Uint8Array(0x2800);
    this.bus = this.newBus();
    this.connectCPUMemoryBus(this.bus);
    // create support chips
    this.antic = new ANTIC(this.readDMA.bind(this));
    this.gtia = new GTIA();
    this.pokey = newPOKEYAudio(1);
    this.audioadapter = new TssChannelAdapter(this.pokey.pokey1, this.audioOversample, this.sampleRate);
    this.handler = newKeyboardHandler(
      this.inputs, ATARI8_KEYCODE_MAP, this.getKeyboardFunction(), true);
  }

  newBus() {
    return {
      // TODO: https://github.com/dmlloyd/atari800/blob/master/DOC/cart.txt
      read: newAddressDecoder([
        [0x0000, 0x9fff, 0xffff, (a) => { return this.ram[a]; }],
        [0xa000, 0xbfff, 0xffff, (a) => { return this.rom ? this.rom[a - 0xa000] : this.ram[a]; }],
        [0xd000, 0xd0ff, 0x1f, (a) => { return this.gtia.readReg(a); }],
        [0xd200, 0xd2ff, 0xf, (a) => { return this.readPokey(a); }],
        [0xd300, 0xd3ff, 0xf, (a) => { return this.readPIA(a); }],
        [0xd400, 0xd4ff, 0xf, (a) => { return this.antic.readReg(a); }],
        [0xd800, 0xffff, 0xffff, (a) => { return this.bios[a - 0xd800]; }],
      ]),
      write: newAddressDecoder([
        [0x0000, 0xbfff, 0xffff, (a, v) => { this.ram[a] = v; }],
        [0xd000, 0xd0ff, 0x1f, (a, v) => { this.gtia.setReg(a, v); }],
        [0xd200, 0xd2ff, 0xf, (a, v) => { this.writePokey(a, v); }],
        [0xd400, 0xd4ff, 0xf, (a, v) => { this.antic.setReg(a, v); }],
      ]),
    };
  }

  loadBIOS(bios: Uint8Array) {
    this.bios.set(bios);
  }

  reset() {
    super.reset();
    this.antic.reset();
    this.gtia.reset();
    this.keycode = 0;
    this.irqstatus = 0;
  }

  read(a) {
    // TODO: lastdmabyte?
    return this.bus.read(a);
  }
  // used by ANTIC
  readDMA(a) {
    let v = this.bus.read(a);
    this.probe.logVRAMRead(a, v);
    this.lastdmabyte = v;
    return v;
  }
  readConst(a) {
    return a < 0xd000 || a >= 0xe000 ? this.bus.read(a) : 0xff;
  }
  write(a, v) {
    this.bus.write(a, v);
  }
  readPokey(a: number) {
    //console.log(hex(a), hex(this.saveState().c.PC));
    switch (a) {
      case 9: // KBCODE
        return this.keycode & 0xff;
      case 14: // IRQST
        return this.irqstatus ^ 0xff;
      case 15: // SKSTAT
        return ((~this.keycode >> 6) & 0x4) | ((~this.keycode >> 3) & 0x8) | 0x12;
      default:
        return 0xff;
    }
  }
  readPIA(a: number) {
    if (a == 0 || a == 1) { return ~this.inputs[a]; }
  }
  writePokey(a, v) {
    switch (a) {
      case 13: this.sendIRQ(0x18); break; // serial output ready IRQ (TODO)
      case 14: this.irqstatus = 0; break;
    }
    this.pokey.pokey1.setRegister(a, v);
  }

  startScanline() {
    this.gtia.regs[TRIG0] = ~this.inputs[2];
    this.gtia.console_inputs = this.inputs[3] ^ 7;
    this.audio && this.audioadapter.generate(this.audio);
  }

  drawScanline() {
    // TODO
    if (this.antic.v < this.numVisibleScanlines) {
      this.pixels.set(this.linergb, this.antic.v * this.canvasWidth);
    }
  }

  advanceCPU(): number {
    // update ANTIC
    if (this.antic.clockPulse()) {
      this.probe.logClocks(1);
      // DMA cycle
    } else {
      // update CPU, NMI?
      if (this.antic.nmiPending) {
        this.cpu.NMI();
        this.probe.logInterrupt(1);
        this.antic.nmiPending = false;
      }
      super.advanceCPU();
    }
    // update GTIA
    let gtiatick1 = () => {
      this.gtia.clockPulse1();
      this.linergb[xofs++] = this.gtia.rgb;
    }
    let gtiatick2 = () => {
      this.gtia.clockPulse2();
      this.linergb[xofs++] = this.gtia.rgb;
    }
    this.gtia.updateGfx(this.antic.h - 1, this.lastdmabyte);
    let xofs = this.antic.h * 4 - this.firstVisibleClock;
    let bp = MODE_SHIFT[this.antic.mode];
    if (bp < 8 || (xofs & 4) == 0) { this.gtia.an = this.antic.shiftout(); }
    gtiatick1();
    if (bp == 1) { this.gtia.an = this.antic.shiftout(); }
    gtiatick2();
    if (bp <= 2) { this.gtia.an = this.antic.shiftout(); }
    gtiatick1();
    if (bp == 1) { this.gtia.an = this.antic.shiftout(); }
    gtiatick2();
    return 1;
  }

  loadState(state: any) {
    this.cpu.loadState(state.c);
    this.ram.set(state.ram);
    this.antic.loadState(state.antic);
    this.gtia.loadState(state.gtia);
    this.loadControlsState(state);
    this.lastdmabyte = state.lastdmabyte;
    this.keycode = state.keycode;
    this.irqstatus = state.irqstatus;
  }
  saveState() {
    return {
      c: this.cpu.saveState(),
      ram: this.ram.slice(0),
      antic: this.antic.saveState(),
      gtia: this.gtia.saveState(),
      inputs: this.inputs.slice(0),
      lastdmabyte: this.lastdmabyte,
      keycode: this.keycode, // TODO: inputs?
      irqstatus: this.irqstatus,
    };
  }
  loadControlsState(state) {
    this.inputs.set(state.inputs);
  }
  saveControlsState() {
    return {
      inputs: this.inputs.slice(0)
    };
  }
  getRasterScanline() {
    return this.antic.v;
  }
  getDebugCategories() {
    return ['CPU', 'Stack', 'ANTIC', 'GTIA', 'POKEY'];
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'ANTIC': return ANTIC.stateToLongString(state.antic);
      case 'GTIA': return GTIA.stateToLongString(state.gtia);
      case 'POKEY': {
        let s = '';
        for (let i = 0; i < 16; i++) { s += hex(this.readPokey(i)) + ' '; }
        s += "\nIRQ Status: " + hex(this.irqstatus) + "\n";
        return s;
      }
    }
  }
  getKeyboardFunction() {
    return (o, key, code, flags) => {
      if (flags & (KeyFlags.KeyDown | KeyFlags.KeyUp)) {
        var keymap = ATARI8_KEYMATRIX_INTL_NOSHIFT;
        if (key == Keys.VK_F9.c) {
          this.sendIRQ(0x80); // break IRQ
          return true;
        }
        for (var i = 0; i < keymap.length; i++) {
          if (keymap[i] && keymap[i].c == key) {
            this.keycode = i;
            if (flags & KeyFlags.Shift) { this.keycode |= 0x40; }
            if (flags & KeyFlags.Ctrl) { this.keycode |= 0x80; }
            if (flags & KeyFlags.KeyDown) {
              this.keycode |= 0x100;
              this.sendIRQ(0x40); // key pressed IRQ
              console.log(o, key, code, flags, hex(this.keycode));
              return true;
            }
          }
        }
      };
    }
  }
  sendIRQ(mask: number) {
    // irq enabled?
    if (this.pokey.pokey1.getRegister(0xe) & mask) {
      this.irqstatus = mask;
      this.cpu.IRQ();
      this.probe.logInterrupt(2);
      // TODO? if (this.antic.h == 4) { console.log("NMI blocked!"); }
    }
  }
  loadROM(rom: Uint8Array) {
    // TODO: support other than 8 KB carts
    super.loadROM(rom);
  }
}

export class Atari5200 extends Atari800 {
  newBus() {
    return {
      read: newAddressDecoder([
        [0x0000, 0x3fff, 0xffff, (a) => { return this.ram[a]; }],
        [0x4000, 0xbfff, 0xffff, (a) => { return this.rom ? this.rom[a - 0x4000] : 0; }],
        [0xc000, 0xcfff, 0x1f, (a) => { return this.gtia.readReg(a); }],
        [0xd400, 0xd4ff, 0xf, (a) => { return this.antic.readReg(a); }],
        [0xe800, 0xefff, 0xf, (a) => { return this.readPokey(a); }],
        [0xf800, 0xffff, 0x7ff, (a) => { return this.bios[a]; }],
      ]),
      write: newAddressDecoder([
        [0x0000, 0x3fff, 0xffff, (a, v) => { this.ram[a] = v; }],
        [0xc000, 0xcfff, 0x1f, (a, v) => { this.gtia.setReg(a, v); }],
        [0xd400, 0xd4ff, 0xf, (a, v) => { this.antic.setReg(a, v); }],
        [0xe800, 0xefff, 0xf, (a, v) => { this.writePokey(a, v); }],
      ]),
    };
  }
  loadROM(rom: Uint8Array) {
    // support 4/8/16/32 KB carts
    let rom2 = new Uint8Array(0x8000);
    for (let i = 0; i < rom2.length; i += rom.length) {
      rom2.set(rom, i);
    }
    super.loadROM(rom2);
  }
}

///

export class Atari8_WASMMachine extends BaseWASIMachine
  implements Machine, Probeable, VideoSource, AcceptsROM, FrameBased, AcceptsKeyInput, AcceptsPaddleInput {

  numTotalScanlines = 312;
  cpuCyclesPerLine = 63;

  prgstart: number;
  joymask0 = 0;
  joymask1 = 0;

  loadROM(rom: Uint8Array) {
    super.loadROM(rom);
    this.reloadROM();
  }
  reloadROM() {
    if (this.sys) {
      var result = this.exports.machine_load_rom(this.sys, this.romptr, this.romlen);
      console.log('machine_load_rom', result);
      //console.log(this.wasmFs.fs.existsSync('atari8.img'), result);
    }
  }
  loadBIOS(srcArray: Uint8Array) {
    super.loadBIOS(srcArray);
  }
  reset() {
    super.reset();
    this.reloadROM();
  }
  advanceFrame(trap: TrapCondition): number {
    // TODO
    this.exports.machine_start_frame(this.sys);
    if (trap) {
      this.advanceFrameClock(trap, 999999); // TODO?
    } else {
      this.exports.machine_advance_frame(this.sys);
    }
    this.syncVideo();
    this.syncAudio();
    return 1;
  }
  getCPUState() {
    this.exports.machine_save_cpu_state(this.sys, this.stateptr);
    var s = this.statearr;
    var pc = s[6] + (s[7] << 8);
    return {
      PC: pc,
      SP: s[2],
      A: s[0],
      X: s[3],
      Y: s[4],
      C: s[1] & 1,
      Z: s[1] & 2,
      I: s[1] & 4,
      D: s[1] & 8,
      V: s[1] & 64,
      N: s[1] & 128,
      o: this.readConst(pc),
    }
  }
  saveState() {
    var cpu = this.getCPUState();
    this.exports.machine_save_state(this.sys, this.stateptr);
    return {
      c: cpu,
      state: this.statearr.slice(0),
      //ram:this.statearr.slice(18640, 18640+0x200), // ZP and stack
    };
  }
  loadState(state): void {
    this.statearr.set(state.state);
    this.exports.machine_load_state(this.sys, this.stateptr);
  }
  getVideoParams() {
    return { width: 384, height: 240, overscan: true, videoFrequency: 60 };
  }
  pollControls() {
  }
  setKeyInput(key: number, code: number, flags: number): void {
    // modifier flags
    if (flags & KeyFlags.Shift) key |= 0x100;
    if (flags & KeyFlags.Ctrl) key |= 0x200;
    // keyboard -> joystick
    var mask = 0;
    if (key == 37) { key = 0x8; mask = 0x4; } // LEFT
    if (key == 38) { key = 0xb; mask = 0x1; } // UP
    if (key == 39) { key = 0x9; mask = 0x8; } // RIGHT
    if (key == 40) { key = 0xa; mask = 0x2; } // DOWN
    if (key == 32) { mask = 0x100; } // FIRE
    // set machine inputs
    if (flags & KeyFlags.KeyDown) {
      this.exports.machine_key_down(this.sys, key);
      this.joymask0 |= mask;
    } else if (flags & KeyFlags.KeyUp) {
      this.exports.machine_key_up(this.sys, key);
      this.joymask0 &= ~mask;
    }
    this.setJoyInput(0, this.joymask0);
    this.setJoyInput(1, this.joymask1);
  }
  setJoyInput(joy: number, mask: number) {
    this.exports.machine_joy_set(this.sys, joy, mask);
  }
  setPaddleInput(controller: number, value: number): void {
    this.exports.machine_paddle_set(this.sys, controller, value);
  }

}

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
for (var i = 0; i < 256; i++) {
  COLORS_RGBA[i] = ATARI_NTSC_RGB[i >> 1] | 0xff000000;
  COLORS_WEB[i] = "#" + hex(rgb2bgr(ATARI_NTSC_RGB[i >> 1]), 6);
}

