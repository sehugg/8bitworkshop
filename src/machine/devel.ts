
import { MOS6502 } from "../common/cpu/MOS6502";
import { BasicHeadlessMachine } from "../common/devices";
import { padBytes, newAddressDecoder } from "../common/emu"; // TODO

export class Devel6502 extends BasicHeadlessMachine {
  cpuFrequency = 1000000;
  defaultROMSize = 0x8000;
  
  cpu = new MOS6502();
  ram = new Uint8Array(0x4000);
  rom : Uint8Array;

  digits = [];

  constructor() {
    super();
    this.connectCPUMemoryBus(this);
  }

  read = newAddressDecoder([
    [0x0000, 0x3fff, 0x3fff, (a) => { return this.ram[a]; }],
    [0x8000, 0xffff, 0x7fff, (a) => { return this.rom && this.rom[a]; }],
  ]);
  
  write = newAddressDecoder([
    [0x0000, 0x3fff, 0x3fff, (a,v) => { this.ram[a] = v; }],
  ]);
  
  readConst(a:number) : number {
    return this.read(a);
  }

  advanceFrame(trap) : number {
    var clock = 0;
    while (clock < this.cpuFrequency/60) {
      if (trap && trap()) break;
      clock += this.advanceCPU();
    }
    return clock;
  }
}

