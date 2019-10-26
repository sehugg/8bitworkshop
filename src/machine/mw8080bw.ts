
import { Z80, Z80State } from "../common/cpu/ZilogZ80";
import { BasicScanlineMachine } from "../common/devices";
import { KeyFlags, newAddressDecoder, padBytes, Keys, makeKeycodeMap, newKeyboardHandler } from "../common/emu";
import { TssChannelAdapter, MasterAudio, AY38910_Audio } from "../common/audio";

// http://www.computerarcheology.com/Arcade/

const MW8080BW_PRESETS = [
  { id: 'gfxtest.c', name: 'Graphics Test' },
  { id: 'shifter.c', name: 'Sprite w/ Bit Shifter' },
  { id: 'game2.c', name: 'Cosmic Impalas' },
];

const SPACEINV_KEYCODE_MAP = makeKeycodeMap([
  [Keys.A,        1, 0x10], // P1
  [Keys.LEFT,     1, 0x20],
  [Keys.RIGHT,    1, 0x40],
  [Keys.P2_A,     2, 0x10], // P2
  [Keys.P2_LEFT,  2, 0x20],
  [Keys.P2_RIGHT, 2, 0x40],
  [Keys.SELECT,   1, 0x1],
  [Keys.START,    1, 0x4],
  [Keys.P2_START, 1, 0x2],
]);

const INITIAL_WATCHDOG = 256;
const PIXEL_ON = 0xffeeeeee;
const PIXEL_OFF = 0xff000000;

export class Midway8080 extends BasicScanlineMachine {

  cpuFrequency = 1996800; // MHz
  canvasWidth = 256;
  numTotalScanlines = 262;
  numVisibleScanlines = 224;
  cpuCyclesPerLine = Math.floor(1996800 / (262*60));
  defaultROMSize = 0x2000;
  rotate = -90;
  sampleRate = 1;

  bitshift_offset = 0;
  bitshift_register = 0;
  watchdog_counter;
  
  cpu: Z80 = new Z80();
  ram = new Uint8Array(0x2000);

  constructor() {
    super();
    this.connectCPUMemoryBus(this);
    this.connectCPUIOBus(this.newIOBus());
    this.handler = newKeyboardHandler(this.inputs, SPACEINV_KEYCODE_MAP);
  }
  
  read = newAddressDecoder([
        [0x0000, 0x1fff, 0x1fff, (a) => { return this.rom ? this.rom[a] : 0; }],
        [0x2000, 0x3fff, 0x1fff, (a) => { return this.ram[a]; }],
  ]);
  write = newAddressDecoder([
        [0x2000, 0x23ff, 0x3ff, (a, v) => { this.ram[a] = v; }],
        [0x2400, 0x3fff, 0x1fff, (a, v) => {
          this.ram[a] = v;
          var ofs = (a - 0x400) << 3;
          for (var i = 0; i < 8; i++) {
            this.pixels[ofs + i] = (v & (1 << i)) ? PIXEL_ON : PIXEL_OFF;
          }
          //if (displayPCs) displayPCs[a] = cpu.getPC(); // save program counter
        }],
  ]);

  newIOBus() {
    return {
      read: (addr) => {
        addr &= 0x3;
        //console.log('IO read', hex(addr,4));
        switch (addr) {
          case 0:
          case 1:
          case 2:
            return this.inputs[addr];
          case 3:
            return (this.bitshift_register >> (8 - this.bitshift_offset)) & 0xff;
        }
        return 0;
      },
      write: (addr, val) => {
        addr &= 0x7;
        val &= 0xff;
        //console.log('IO write', hex(addr,4), hex(val,2));
        switch (addr) {
          case 2:
            this.bitshift_offset = val & 0x7;
            break;
          case 3:
          case 5:
            // TODO: sound
            break;
          case 4:
            this.bitshift_register = (this.bitshift_register >> 8) | (val << 8);
            break;
          case 6:
            this.watchdog_counter = INITIAL_WATCHDOG;
            break;
        }
      }
    };
  }

  startScanline() {
  }

  drawScanline() {
    // at end of scanline
    if (this.scanline == 95)
      this.interrupt(0xcf); // RST $8
    else if (this.scanline == 223)
      this.interrupt(0xd7); // RST $10
  }
  
  interrupt(data:number) {
    this.probe.logInterrupt(data);
    this.cpu.interrupt(data);
  }

  advanceFrame(trap) : number {
    if (this.watchdog_counter-- <= 0) {
      console.log("WATCHDOG FIRED"); // TODO: alert on video
      this.reset();
    }
    return super.advanceFrame(trap);
  }

  loadState(state) {
    super.loadState(state);
    this.bitshift_register = state.bsr;
    this.bitshift_offset = state.bso;
    this.watchdog_counter = state.wdc;
  }
  saveState() {
    var state: any = super.saveState();
    state.bsr = this.bitshift_register;
    state.bso = this.bitshift_offset;
    state.wdc = this.watchdog_counter;
    return state;
  }
  reset() {
    super.reset();
    this.watchdog_counter = INITIAL_WATCHDOG;
  }
}
