
export interface SavesState<T> {
    saveState() : T;
    loadState(state:T) : void;
}

export interface Bus {
    read(a:number) : number;
    write(a:number, v:number) : void;
    // TODO: readConst?(a:number) : number;
}

export interface ClockBased {
    advanceClock() : void;
}

export interface InstructionBased {
    advanceInsn() : number;
}

export type TrapCondition = () => boolean;

export interface FrameBased {
    advanceFrame(maxClocks:number, trap:TrapCondition) : number;
}

export interface VideoSource {
  getVideoParams() : VideoParams;
  connectVideo(pixels:Uint32Array) : void;
}

export interface RasterFrameBased extends FrameBased, VideoSource {
}

export interface VideoParams {
    width : number;
    height : number;
    overscan? : boolean;
    rotate? : number;
}

// TODO: frame buffer optimization (apple2, etc)

export interface SampledAudioParams {
    sampleRate : number;
    stereo : boolean;
}

export interface SampledAudioSink {
    feedSample(value:number, count:number) : void;
    //sendAudioFrame(samples:Uint16Array) : void;
}

export interface SampledAudioSource {
    getAudioParams() : SampledAudioParams;
    connectAudio(audio : SampledAudioSink) : void;
}

export interface AcceptsROM {
    loadROM(data:Uint8Array, title?:string) : void;
}

export interface Resettable {
    reset() : void;
}

export interface MemoryBusConnected {
    connectMemoryBus(bus:Bus) : void;
}

export interface CPU extends MemoryBusConnected, Resettable {
    getPC() : number;
    getSP() : number;
}

export interface Interruptable<T> {
    interrupt(type:T) : void;
}

// TODO
export interface AcceptsInput {
    setInput(key:number, code:number, flags:number) : void;
    //loadControlState();
    //saveControlState();
}

// TODO?
export function noise(x : number) : number {
  x ^= x << 13;
  x ^= x >> 17;
  x ^= x << 5;
  return x;
}

/// HOOKS

export interface Hook<T> {
  //target : T;
  unhook();
}

export class BusHook implements Hook<Bus> {
  //target : Bus;
  constructor(bus : Bus, profiler : LogBus) {
    //this.target = bus;
    var oldread = bus.read.bind(bus);
    var oldwrite = bus.write.bind(bus);
    bus.read = (a:number):number => {
      profiler.logRead(a);
      var val = oldread(a);
      return val;
    }
    bus.write = (a:number,v:number) => {
      profiler.logWrite(a);
      oldwrite(a,v);
    }
    this.unhook = () => {
      bus.read = oldread;
      bus.write = oldwrite;
    }
  }
  unhook : () => void;
}

export class CPUClockHook implements Hook<CPU&ClockBased> {
  //target : CPU&ClockBased;
  constructor(cpu : CPU&ClockBased, profiler : LogCPU) {
    //this.target = cpu;
    var oldclock = cpu.advanceClock.bind(cpu);
    cpu.advanceClock = () => {
      profiler.logExecute(cpu.getPC());
      return oldclock();
    }
    this.unhook = () => {
      cpu.advanceClock = oldclock;
    }
  }
  unhook : () => void;
}

export class CPUInsnHook implements Hook<CPU&InstructionBased> {
  //target : CPU&InstructionBased;
  constructor(cpu : CPU&InstructionBased, profiler : LogCPU) {
    //this.target = cpu;
    var oldinsn = cpu.advanceInsn.bind(cpu);
    cpu.advanceInsn = () => {
      profiler.logExecute(cpu.getPC());
      return oldinsn();
    }
    this.unhook = () => {
      cpu.advanceInsn = oldinsn;
    }
  }
  unhook : () => void;
}

/// PROFILER

export interface LogCPU {
  logExecute(address:number);
  logInterrupt(type:number);
}

export interface LogBus {
  logRead(address:number);
  logWrite(address:number);
}

export interface LogIO {
  logIORead(address:number);
  logIOWrite(address:number);
}

export interface LogAll extends LogCPU, LogBus, LogIO {
}

/// DEBUGGING

class EmuBreakpoint extends Error {
}

