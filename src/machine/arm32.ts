
import { ARM32CPU, ARMCoreState } from "../common/cpu/ARM";
import { BasicScanlineMachine } from "../common/devices";
import { KeyFlags, newAddressDecoder, padBytes, Keys, makeKeycodeMap, newKeyboardHandler } from "../common/emu";
import { TssChannelAdapter, MasterAudio, AY38910_Audio } from "../common/audio";
import { Debuggable, EmuState } from "../common/baseplatform";
import { hex, lpad, printFlags } from "../common/util";

var GBA_KEYCODE_MAP = makeKeycodeMap([
  [Keys.A,     0, 0x1],
  [Keys.B,     0, 0x2],
  [Keys.SELECT,0, 0x4],
  [Keys.START ,0, 0x8],
  [Keys.RIGHT, 0, 0x10],
  [Keys.LEFT,  0, 0x20],
  [Keys.UP,    0, 0x40],
  [Keys.DOWN,  0, 0x80],
]);

const ROM_START =        0x0;
const ROM_SIZE  =    0x80000;
const RAM_START =  0x2000000;
const RAM_SIZE  =    0x80000;
const IO_START =   0x4000000;
const IO_SIZE  =       0x100;

const CPU_FREQ = 4000000; // 4 MHz

export class ARM32Machine extends BasicScanlineMachine implements Debuggable {

  cpuFrequency = CPU_FREQ; // MHz
  canvasWidth = 160;
  numTotalScanlines = 256;
  numVisibleScanlines = 128;
  cpuCyclesPerLine = Math.floor(CPU_FREQ / (256*60));
  defaultROMSize = 512*1024;
  sampleRate = 1;
  
  cpu: ARM32CPU = new ARM32CPU();
  ram = new Uint8Array(96*1024);
  ram16 = new Uint16Array(this.ram.buffer);
  pixels32 : Uint32Array;
  pixels8 : Uint8Array;
  vidbase : number = 0;
  brightness : number = 255;

  constructor() {
    super();
    this.connectCPUMemoryBus(this);
    this.handler = newKeyboardHandler(this.inputs, GBA_KEYCODE_MAP);
  }

  connectVideo(pixels:Uint32Array) : void {
    super.connectVideo(pixels);
    this.pixels32 = pixels;
    this.pixels8 = new Uint8Array(pixels.buffer);
  }

  // TODO: 32-bit bus?

  read = newAddressDecoder([
    [ROM_START, ROM_START+ROM_SIZE-1, ROM_SIZE-1, (a) => {
      return this.rom ? this.rom[a] : 0;
    }],
    [RAM_START, RAM_START+RAM_SIZE-1, RAM_SIZE-1, (a) => {
      return this.ram[a];
    }],
    [IO_START, IO_START+IO_SIZE-1, IO_SIZE-1, (a, v) => {
      return this.readIO(a);
    }],
  ]);

  write = newAddressDecoder([
    [RAM_START, RAM_START+RAM_SIZE-1, RAM_SIZE-1, (a, v) => {
      this.ram[a] = v;
    }],
    [IO_START, IO_START+IO_SIZE-1, IO_SIZE-1, (a, v) => {
      this.writeIO(a, v);
    }],
  ]);

  readIO(a : number) : number {
    switch (a) {
      case 0x0:
        return this.inputs[0];
      default:
        return 0;
    }
  }

  writeIO(a : number, v : number) : void {
    switch (a) {
      case 0x0:
        //this.brightness = v & 0xff;
        break;
    }
  }

  startScanline() {
  }

  drawScanline() {
  }
  
  postFrame() {
    var p32 = this.pixels32;
    var vbase = (this.vidbase >> 1) & 0xfffff;
    var mask = this.brightness << 24;
    for (var i=0; i<p32.length; i++) {
      var col = this.ram16[i + vbase];
      // rrrrrgggggbbbbb0 ->
      // 000rrrrr000ggggg000bbbbb00011111111
      p32[i] = mask | ((col&31)<<3) | (((col>>5)&31)<<11) | (((col>>10)&31)<<19);
    }
  }

  getDebugCategories() {
    return ['CPU', 'Stack'];
  }

  getDebugInfo?(category: string, state: EmuState) : string {
    switch (category) {
      case 'CPU':
        var s = '';
        var c = state.c as ARMCoreState;
        const EXEC_MODE = {2:'Thumb',4:'ARM'};
        const REGNAMES = {15:'PC',14:'LR',13:'SP',12:'IP',11:'FP',9:'SB'};
        for (var i=0; i<16; i++) {
          s += lpad(REGNAMES[i]||'',3) + lpad('r'+i, 5) + '  ' + hex(c.gprs[i],8) + '\n';
        }
        s += 'Flags ';
        s += c.cpsrN ? " N" : " -";
        s += c.cpsrV ? " V" : " -";
        s += c.cpsrF ? " F" : " -";
        s += c.cpsrZ ? " Z" : " -";
        s += c.cpsrC ? " C" : " -";
        s += c.cpsrI ? " I" : " -";
        s += '\n';
        s += 'MODE ' + EXEC_MODE[c.instructionWidth] + ' ' + MODE_NAMES[c.mode] + '\n';
        s += 'SPSR ' + hex(c.spsr,8) + '\n';
        s += 'cycl ' + c.cycles + '\n';
        return s;
    }
  }
}

const MODE_NAMES = {
	0x10: "USER",
  0x11: "FIQ",
  0x12: "IRQ",
  0x13: "SUPERVISOR",
  0x17: "ABORT",
  0x1b: "UNDEFINED",
  0x1f: "SYSTEM",
};
