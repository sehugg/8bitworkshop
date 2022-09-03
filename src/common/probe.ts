
import { Probeable, ProbeAll } from "./devices";

export enum ProbeFlags {
  CLOCKS	  = 0x00000000,
  EXECUTE	  = 0x01000000,
  INTERRUPT	= 0x08000000,
  ILLEGAL	  = 0x09000000,
  SP_PUSH	  = 0x0a000000,
  SP_POP	  = 0x0b000000,
  HAS_VALUE = 0x10000000,
  MEM_READ	= 0x12000000,
  MEM_WRITE	= 0x13000000,
  IO_READ	  = 0x14000000,
  IO_WRITE	= 0x15000000,
  VRAM_READ	= 0x16000000,
  VRAM_WRITE= 0x17000000,
  DMA_READ  = 0x18000000,
  DMA_WRITE = 0x19000000,
  WAIT      = 0x1f000000,
  SCANLINE	= 0x7e000000,
  FRAME		  = 0x7f000000,
}

class ProbeFrame {
  data : Uint32Array;
  len : number;
}

export class ProbeRecorder implements ProbeAll {

  m : Probeable;      // machine to probe
  buf : Uint32Array;  // buffer
  idx : number = 0;   // index into buffer
  sl : number = 0;    // scanline
  cur_sp = -1;        // last stack pointer
  singleFrame : boolean = true; // clear between frames

  constructor(m:Probeable, buflen?:number) {
    this.m = m;
    this.reset(buflen || 0x100000);
  }
  start() {
    this.m.connectProbe(this);
  }
  stop() {
    this.m.connectProbe(null);
  }
  reset(newbuflen? : number) {
    if (newbuflen) this.buf = new Uint32Array(newbuflen);
    this.sl = 0;
    this.cur_sp = -1;
    this.clear();
  }
  clear() {
    this.idx = 0;
  }
  logData(a:number) {
    this.log(a);
  }
  log(a:number) {
    // TODO: coalesce READ and EXECUTE and PUSH/POP
    if (this.idx >= this.buf.length) return;
    this.buf[this.idx++] = a;
  }
  relog(a:number) {
    this.buf[this.idx-1] = a;
  }
  lastOp() {
    if (this.idx > 0)
      return this.buf[this.idx-1] & 0xff000000;
    else
      return -1;
  }
  lastAddr() {
    if (this.idx > 0)
      return this.buf[this.idx-1] & 0xffffff;
    else
      return -1;
  }
  addLogBuffer(src: Uint32Array) {
    if (this.idx + src.length > this.buf.length) {
      src = src.slice(0, this.buf.length - this.idx);
    }
    this.buf.set(src, this.idx);
    this.idx += src.length;
}
  logClocks(clocks:number) {
    clocks |= 0;
    if (clocks > 0) {
      if (this.lastOp() == ProbeFlags.CLOCKS)
        this.relog((this.lastAddr() + clocks) | ProbeFlags.CLOCKS); // coalesce clocks
      else
        this.log(clocks | ProbeFlags.CLOCKS);
    }
  }
  logNewScanline() {
    this.log(ProbeFlags.SCANLINE);
    this.sl++;
  }
  logNewFrame() {
    this.log(ProbeFlags.FRAME);
    this.sl = 0;
    if (this.singleFrame) this.clear();
  }
  logExecute(address:number, SP:number) {
    // record stack pushes/pops (from last instruction)
    if (this.cur_sp !== SP) {
      if (SP < this.cur_sp) {
        this.log(ProbeFlags.SP_PUSH | SP);
      }
      if (SP > this.cur_sp) {
        this.log(ProbeFlags.SP_POP | SP);
      }
      this.cur_sp = SP;
    }
    this.log(address | ProbeFlags.EXECUTE);
  }
  logInterrupt(type:number) {
    this.log(type | ProbeFlags.INTERRUPT);
  }
  logValue(address:number, value:number, op:number) {
    this.log((address & 0xffff) | ((value & 0xff)<<16) | op);
  }
  logRead(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.MEM_READ);
  }
  logWrite(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.MEM_WRITE);
  }
  logIORead(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.IO_READ);
  }
  logIOWrite(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.IO_WRITE);
  }
  logVRAMRead(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.VRAM_READ);
  }
  logVRAMWrite(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.VRAM_WRITE);
  }
  logIllegal(address:number) {
    this.log(address | ProbeFlags.ILLEGAL);
  }
  logWait(address:number) {
    this.log(address | ProbeFlags.WAIT);
  }
  logDMARead(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.DMA_READ);
  }
  logDMAWrite(address:number, value:number) {
    this.logValue(address, value, ProbeFlags.DMA_WRITE);
  }
  countEvents(op : number) : number {
    var count = 0;
    for (var i=0; i<this.idx; i++) {
      if ((this.buf[i] & 0xff000000) == op)
        count++;
    }
    return count;
  }
  countClocks() : number {
    var count = 0;
    for (var i=0; i<this.idx; i++) {
      if ((this.buf[i] & 0xff000000) == ProbeFlags.CLOCKS)
        count += this.buf[i] & 0xffff;
    }
    return count;
  }

}
