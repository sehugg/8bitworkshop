import { newPOKEYAudio, TssChannelAdapter } from "../common/audio";
import { Machine } from "../common/baseplatform";
import { MOS6502 } from "../common/cpu/MOS6502";
import { AcceptsKeyInput, AcceptsPaddleInput, AcceptsROM, BasicScanlineMachine, FrameBased, Probeable, TrapCondition, VideoSource } from "../common/devices";
import { KeyFlags, Keys, makeKeycodeMap, newAddressDecoder, newKeyboardHandler } from "../common/emu";
import { hex } from "../common/util";
import { BaseWASIMachine } from "../common/wasmplatform";
import { ANTIC, MODE_SHIFT } from "./chips/antic";
import { CONSOL, GTIA, TRIG0 } from "./chips/gtia";
import { POKEY } from "./chips/pokey";

const ATARI8_KEYMATRIX_INTL_NOSHIFT = [
  Keys.VK_L, Keys.VK_J, Keys.VK_SEMICOLON, Keys.VK_F4, Keys.VK_F5, Keys.VK_K, Keys.VK_BACK_SLASH, Keys.VK_TILDE,
  Keys.VK_O, null, Keys.VK_P, Keys.VK_U, Keys.VK_ENTER, Keys.VK_I, Keys.VK_MINUS2, Keys.VK_EQUALS2,
  Keys.VK_V, Keys.VK_F7, Keys.VK_C, Keys.VK_F6, Keys.VK_F4, Keys.VK_B, Keys.VK_X, Keys.VK_Z,
  Keys.VK_4, null, Keys.VK_3, Keys.VK_6, Keys.VK_ESCAPE, Keys.VK_5, Keys.VK_2, Keys.VK_1,
  Keys.VK_COMMA, Keys.VK_SPACE, Keys.VK_PERIOD, Keys.VK_N, null, Keys.VK_M, Keys.VK_SLASH, null/*invert*/,
  Keys.VK_R, null, Keys.VK_E, Keys.VK_Y, Keys.VK_TAB, Keys.VK_T, Keys.VK_W, Keys.VK_Q,
  Keys.VK_9, null, Keys.VK_0, Keys.VK_7, Keys.VK_BACK_SPACE, Keys.VK_8, null, null,
  Keys.VK_F, Keys.VK_H, Keys.VK_D, null, Keys.VK_CAPS_LOCK, Keys.VK_G, Keys.VK_S, Keys.VK_A,
];

//TODO
var ATARI8_KEYCODE_MAP = makeKeycodeMap([
  [Keys.UP, 0, 0x1],
  [Keys.DOWN, 0, 0x2],
  [Keys.LEFT, 0, 0x4],
  [Keys.RIGHT, 0, 0x8],
  [{ c: 16, n: "Shift", plyr: 0, button: 0 }, 2, 0x1],
  /*
    [Keys.P2_UP, 0, 0x10],
    [Keys.P2_DOWN, 0, 0x20],
    [Keys.P2_LEFT, 0, 0x40],
    [Keys.P2_RIGHT, 0, 0x80],
    [Keys.P2_A, 3, 0x1],
  */
  [Keys.VK_F1, 3, 0x1],  // START
  [Keys.VK_F2, 3, 0x2], // SELECT
  [Keys.VK_F3, 3, 0x4], // OPTION
]);


export class Atari800 extends BasicScanlineMachine {

  // http://www.ataripreservation.org/websites/freddy.offenga/megazine/ISSUE5-PALNTSC.html
  cpuFrequency = 1789773;
  numTotalScanlines = 262;
  cpuCyclesPerLine = 114;
  canvasWidth = 336;
  numVisibleScanlines = 224;
  aspectRatio = this.canvasWidth / this.numVisibleScanlines * 0.857;
  firstVisibleScanline = 16;
  firstVisibleClock = (44 - 6) * 2; // ... to 215 * 2
  defaultROMSize = 0x8000;
  overscan = true;
  audioOversample = 2;
  sampleRate = this.numTotalScanlines * 60 * this.audioOversample;
  run_address = -1;

  cpu: MOS6502;
  ram: Uint8Array;
  bios: Uint8Array;
  bus;
  audio_pokey;
  audioadapter;
  antic: ANTIC;
  gtia: GTIA;
  irq_pokey: POKEY;
  inputs = new Uint8Array(4);
  linergb = new Uint32Array(this.canvasWidth);
  lastdmabyte = 0;
  keycode = 0;
  cart_80 = false;
  cart_a0 = false;
  xexdata = null;
  keyboard_active = true;
  d500 = new Uint8Array(0x100);
  // TODO: save/load vars

  constructor() {
    super();
    this.cpu = new MOS6502();
    this.ram = new Uint8Array(0x10000);
    this.bios = new Uint8Array(0x2800);
    this.bus = this.newBus();
    this.connectCPUMemoryBus(this.bus);
    // create support chips
    this.antic = new ANTIC(this.readDMA.bind(this), this.antic_nmi.bind(this));
    this.gtia = new GTIA();
    this.irq_pokey = new POKEY(this.pokey_irq.bind(this), () => this.antic.h);
    this.audio_pokey = newPOKEYAudio(1);
    this.audioadapter = new TssChannelAdapter(this.audio_pokey.pokey1, this.audioOversample, this.sampleRate);
    this.handler = newKeyboardHandler(
      this.inputs, ATARI8_KEYCODE_MAP, this.getKeyboardFunction(), true);
  }

  newBus() {
    return {
      read: newAddressDecoder([
        [0x0000, 0x7fff, 0xffff, (a) => { return this.ram[a]; }],
        [0x8000, 0x9fff, 0xffff, (a) => { return this.cart_80 ? this.rom[a - 0x8000] : this.ram[a]; }],
        [0xa000, 0xbfff, 0xffff, (a) => { return this.cart_a0 ? this.rom[a - 0x8000] : this.ram[a]; }],
        [0xd000, 0xd0ff, 0x1f, (a) => { return this.gtia.readReg(a); }],
        [0xd200, 0xd2ff, 0xf, (a) => { return this.readPokey(a); }],
        [0xd300, 0xd3ff, 0xf, (a) => { return this.readPIA(a); }],
        [0xd400, 0xd4ff, 0xf, (a) => { return this.antic.readReg(a); }],
        [0xd500, 0xd5ff, 0xff, (a) => { return this.d500[a]; }],
        [0xd800, 0xffff, 0xffff, (a) => { return this.bios[a - 0xd800]; }],
      ]),
      write: newAddressDecoder([
        [0x0000, 0xbffa, 0xffff, (a, v) => { this.ram[a] = v; }],
        [0xbffb, 0xbfff, 0xffff, (a, v) => { this.ram[a] = v; this.initCartA(); }],
        [0xd000, 0xd0ff, 0x1f, (a, v) => { this.gtia.setReg(a, v); }],
        [0xd200, 0xd2ff, 0xf, (a, v) => { this.writePokey(a, v); }],
        [0xd400, 0xd4ff, 0xf, (a, v) => { this.antic.setReg(a, v); }],
        [0xd500, 0xd5ff, 0xff, (a, v) => { this.writeMapper(a, v); }],
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
    //if (this.xexdata) this.cart_a0 = true; // TODO
  }

  read(a) {
    // TODO: lastdmabyte?
    return this.bus.read(a);
  }
  // used by ANTIC
  readDMA(a) {
    let v = this.bus.read(a);
    this.probe.logDMARead(a, v);
    this.lastdmabyte = v;
    return v;
  }
  readConst(a) {
    return a < 0xd000 || a >= 0xd500 ? this.bus.read(a) : 0xff;
  }
  write(a, v) {
    this.bus.write(a, v);
  }
  readPokey(a: number) {
    switch (a & 0xf) {
      case 9: // KBCODE
        return this.keycode & 0xff;
      case 15: // SKSTAT
        return ((~this.keycode >> 6) & 0x4) | ((~this.keycode >> 3) & 0x8) | 0x12;
      default:
        return this.irq_pokey.read(a);
    }
  }
  readPIA(a: number) {
    if (a == 0 || a == 1) { return ~this.inputs[a]; }
  }
  writePokey(a, v) {
    this.audio_pokey.pokey1.setRegister(a, v);
    this.irq_pokey.write(a, v);
  }

  startScanline() {
    // TODO: if (this.antic.h != 0) throw new Error(this.antic.h+"");
    //if (this.cpu.isHalted()) throw new EmuHalt("CPU HALTED");
    // set GTIA switch inputs
    this.gtia.sync();
    // TODO: trigger latching mode
    for (let i = 0; i < 4; i++)
      this.gtia.readregs[TRIG0 + i] = (~this.inputs[2] >> i) & 1;
    // console switches
    this.gtia.readregs[CONSOL] = ~this.inputs[3] & 0x7;
    // advance POKEY audio
    this.audio && this.audioadapter.generate(this.audio);
    // advance POKEY IRQ timers
    this.irq_pokey.advanceScanline();
  }

  drawScanline() {
    // TODO
    let y = this.antic.v - this.firstVisibleScanline;
    if (y >= 0 && y < this.numVisibleScanlines) {
      this.pixels.set(this.linergb, y * this.canvasWidth);
    }
  }

  advanceCPU(): number {
    // update ANTIC
    if (this.antic.clockPulse()) {
      // ANTIC DMA cycle, update GTIA
      if (this.antic.h < 8)
        this.gtia.updateGfx(this.antic.h - 1, this.antic.v, this.lastdmabyte); // HALT pin
      if (this.antic.isWSYNC())
        this.probe.logWait(0);
      this.probe.logClocks(1);
    } else {
      super.advanceCPU();
    }
    // update GTIA
    // get X coordinate within scanline
    let xofs = this.antic.h * 4 - this.firstVisibleClock;
    // GTIA tick functions
    let gtiatick1 = () => {
      this.gtia.clockPulse1();
      this.linergb[xofs++] = this.gtia.rgb;
    }
    let gtiatick2 = () => {
      this.gtia.clockPulse2();
      this.linergb[xofs++] = this.gtia.rgb;
    }
    // tick 4 GTIA clocks for each CPU/ANTIC cycle
    this.gtia.clockPulse4();
    // correct for HSCROL -- bias antic +2, bias gtia -1
    if ((this.antic.dliop & 0x10) && (this.antic.regs[4] & 1)) {
      xofs += 2;
      this.gtia.setBias(-1);
    } else {
      this.gtia.setBias(0);
    }
    let bp = MODE_SHIFT[this.antic.mode];
    let odd = this.antic.h & 1;
    if (bp < 8 || odd) { this.gtia.an = this.antic.shiftout(); }
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
    this.loadControlsState(state);
    this.cpu.loadState(state.c);
    this.ram.set(state.ram);
    this.antic.loadState(state.antic);
    this.gtia.loadState(state.gtia);
    this.irq_pokey.loadState(state.pokey);
    this.lastdmabyte = state.lastdmabyte;
    this.cart_80 = state.cart_80;
    this.cart_a0 = state.cart_a0;
  }
  saveState() {
    return {
      c: this.cpu.saveState(),
      ram: this.ram.slice(0),
      antic: this.antic.saveState(),
      gtia: this.gtia.saveState(),
      pokey: this.irq_pokey.saveState(),
      inputs: this.inputs.slice(0),
      lastdmabyte: this.lastdmabyte,
      keycode: this.keycode,
      cart_80: this.cart_80,
      cart_a0: this.cart_a0,
    };
  }
  loadControlsState(state) {
    this.inputs.set(state.inputs);
    this.keycode = state.keycode;
  }
  saveControlsState() {
    return {
      inputs: this.inputs.slice(0),
      keycode: this.keycode,
    };
  }
  getRasterScanline() {
    return this.antic.v;
  }
  getRasterLineClock() {
    return this.antic.h;
  }
  getDebugCategories() {
    return ['CPU', 'Stack', 'ANTIC', 'GTIA', 'POKEY'];
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'ANTIC': return ANTIC.stateToLongString(state.antic);
      case 'GTIA': return GTIA.stateToLongString(state.gtia);
      case 'POKEY': return POKEY.stateToLongString(state.pokey);
    }
  }
  getKeyboardFunction() {
    return (o, key, code, flags) => {
      if (!this.keyboard_active) return false;
      if (flags & (KeyFlags.KeyDown | KeyFlags.KeyUp)) {
        //console.log(o, key, code, flags, hex(this.keycode));
        var keymap = ATARI8_KEYMATRIX_INTL_NOSHIFT;
        if (key == Keys.VK_F9.c) {
          this.irq_pokey.generateIRQ(0x80); // break IRQ
          return true;
        }
        for (var i = 0; i < keymap.length; i++) {
          if (keymap[i] && keymap[i].c == key) {
            this.keycode = i;
            if (flags & KeyFlags.Shift) { this.keycode |= 0x40; }
            if (flags & KeyFlags.Ctrl) { this.keycode |= 0x80; }
            if (flags & KeyFlags.KeyDown) {
              this.keycode |= 0x100;
              this.irq_pokey.generateIRQ(0x40); // key pressed IRQ
              return true;
            }
          }
        }
      };
    }
  }
  pokey_irq() {
    this.cpu.IRQ();
    this.probe.logInterrupt(2);
  }
  antic_nmi() {
    this.cpu.NMI();
    this.probe.logInterrupt(1);
  }

  loadROM(rom: Uint8Array, title: string) {
    if ((rom[0] == 0xff && rom[1] == 0xff) && !title?.endsWith('.rom')) {
      // XEX file, chill out and wait for BIOS hook
      this.xexdata = rom;
    } else {
      this.loadCartridge(rom);
    }
  }

  loadCartridge(rom: Uint8Array) {
    // TODO: https://github.com/dmlloyd/atari800/blob/master/DOC/cart.txt
    // strip off header
    if (rom[0] == 0x43 && rom[1] == 0x41 && rom[2] == 0x52 && rom[3] == 0x54) {
      rom = rom.slice(16);
    }
    if (rom.length != 0x1000 && rom.length != 0x2000 && rom.length != 0x4000 && rom.length != 0x8000)
      throw new Error("Sorry, this platform can only load 4/8/16/32 KB cartridges at the moment.");
    // TODO: support other than 8 KB carts
    // support 4/8/16/32 KB carts
    let rom2 = new Uint8Array(0x8000);
    for (let i = 0; i <= rom2.length - rom.length; i += rom.length) {
      rom2.set(rom, i);
    }
    this.run_address = rom2[0x7ffe] + rom2[0x7fff]*256;
    this.cart_a0 = true; // TODO
    this.cart_80 = rom.length == 0x4000;
    super.loadROM(rom2);
  }

  writeMapper(addr: number, value: number) {
    // TODO
    if (addr == 0xff) {
      if (value == 0x80) this.cart_80 = false;
      if (value == 0xa0) this.cart_a0 = false;
    }
  }

  loadXEX(rom: Uint8Array) {
    let ofs = 2;
    let stub = this.d500;
    let stubofs = 0; // stub routine 
    var runaddr = -1;
    // load segments into RAM
    while (ofs < rom.length) {
      let start = rom[ofs + 0] + rom[ofs + 1] * 256;
      let end = rom[ofs + 2] + rom[ofs + 3] * 256;
      console.log('XEX', hex(ofs), hex(start), hex(end));
      ofs += 4;
      for (let i = start; i <= end; i++) {
        this.ram[i] = rom[ofs++];
      }
      if (start == 0x2e0 && end == 0x2e1) {
        runaddr = this.ram[0x2e0] + this.ram[0x2e1] * 256;
        console.log('XEX run', hex(runaddr));
      }
      if (start == 0x2e2 && end == 0x2e3) {
        var initaddr = this.ram[0x2e2] + this.ram[0x2e3] * 256;
        console.log('XEX init', hex(initaddr));
        stub[stubofs++] = 0x20;
        stub[stubofs++] = initaddr & 0xff;
        stub[stubofs++] = initaddr >> 8;
      }
      if (ofs > rom.length) throw new Error("Bad .XEX file format");
    }
    if (runaddr >= 0) {
      // build stub routine at 0xd500
      stub[stubofs++] = 0xa9; // lda #$a0
      stub[stubofs++] = 0xa0;
      stub[stubofs++] = 0x8d; // sta $d5ff (disable cart)
      stub[stubofs++] = 0xff;
      stub[stubofs++] = 0xd5;
      stub[stubofs++] = 0x4c; // jmp runaddr
      stub[stubofs++] = runaddr & 0xff;
      stub[stubofs++] = runaddr >> 8;
      // set DOSVEC to 0xd500
      this.ram[0xa] = 0x00;
      this.ram[0xb] = 0xd5;
      this.run_address = 0xd500;
    }
  }

  initCartA() {
    if (this.cpu.getPC() == 0xf17f && this.xexdata) {
      this.loadXEX(this.xexdata);
    }
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
}

