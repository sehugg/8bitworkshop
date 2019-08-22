
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

export interface FrameBased {
    advanceFrame() : number;
}

export interface VideoFrameBased extends FrameBased {
  getVideoParams() : VideoParams;
  connectVideo(pixels:Uint32Array) : void;
}

export interface RasterFrameBased extends VideoFrameBased {
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

export interface SampledAudio {
    setAudioParams(params:SampledAudioParams) : void;
    sendAudioFrame(samples:Uint16Array) : void;
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
  constructor(bus : Bus, profiler : ProfilerInterface) {
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
  constructor(cpu : CPU&ClockBased, profiler : ProfilerInterface) {
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
  constructor(cpu : CPU&InstructionBased, profiler : ProfilerInterface) {
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

export interface ProfilerInterface {
  logExecute(address:number);
  logRead(address:number);
  logWrite(address:number);
  logIORead(address:number);
  logIOWrite(address:number);
  logInterrupt(type:number);
}

/// DEBUGGING

class EmuBreakpoint extends Error {
}

