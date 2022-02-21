
import { MOS6502 } from "../common/cpu/MOS6502";
import { BasicHeadlessMachine, HasSerialIO, SerialIOInterface } from "../common/devices";
import { padBytes, newAddressDecoder } from "../common/emu"; // TODO

const INPUT_HALTED = 31;

export class Devel6502 extends BasicHeadlessMachine implements HasSerialIO {

  cpuFrequency = 1000000;
  defaultROMSize = 0x8000;
  
  cpu = new MOS6502();
  ram = new Uint8Array(0x4000);
  rom : Uint8Array;
  serial : SerialIOInterface;

  constructor() {
    super();
    this.connectCPUMemoryBus(this);
  }
  
  connectSerialIO(serial: SerialIOInterface) {
    this.serial = serial;
  }

  read = newAddressDecoder([
    [0x0000, 0x3fff, 0x3fff, (a) => { return this.ram[a]; }],
    [0x4000, 0x4000, 0xffff, (a) => { return this.serial.byteAvailable() ? 0x80 : 0 }],
    [0x4001, 0x4001, 0xffff, (a) => { return this.serial.recvByte() }],
    [0x4002, 0x4002, 0xffff, (a) => { return this.serial.clearToSend() ? 0x80 : 0 }],
    [0x8000, 0xffff, 0x7fff, (a) => { return this.rom && this.rom[a]; }],
  ]);
  
  write = newAddressDecoder([
    [0x0000, 0x3fff, 0x3fff, (a,v) => { this.ram[a] = v; }],
    [0x4003, 0x4003, 0xffff, (a,v) => { return this.serial.sendByte(v) }],
    [0x400f, 0x400f, 0xffff, (a,v) => { this.inputs[INPUT_HALTED] = 1; }],
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

  advanceCPU() {
    if (this.isHalted()) return 1;
    var n = super.advanceCPU();
    if (this.serial) this.serial.advance(n);
    return n;
  }

  reset() {
    this.inputs[INPUT_HALTED] = 0;
    super.reset();
    if (this.serial) this.serial.reset();
  }

  isHalted() { return this.inputs[INPUT_HALTED] != 0; }
}

