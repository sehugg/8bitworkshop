
export interface SavesState<S> {
    saveState() : S;
    loadState(state:S) : void;
}

export interface Bus {
    read(a:number) : number;
    write(a:number, v:number) : void;
    readConst?(a:number) : number;
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
  getRasterY() : number;
  getRasterX() : number;
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

export interface IOBusConnected {
    connectIOBus(bus:Bus) : void;
}

export interface CPU extends MemoryBusConnected, Resettable, SavesState<any> {
    getPC() : number;
    getSP() : number;
    isStable() : boolean;
}

export interface HasCPU extends Resettable {
    cpu : CPU;
}

export interface Interruptable<IT> {
    interrupt(type:IT) : void;
}

export interface SavesInputState<CS> {
    loadControlsState(cs:CS) : void;
    saveControlsState() : CS;
}

// TODO
export interface AcceptsKeyInput {
    setKeyInput(key:number, code:number, flags:number) : void;
}

export interface Probeable {
    connectProbe(probe: ProbeAll) : void;
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
  constructor(bus : Bus, profiler : ProbeBus) {
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
  constructor(cpu : CPU&ClockBased, profiler : ProbeCPU) {
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
  constructor(cpu : CPU&InstructionBased, profiler : ProbeCPU) {
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

export interface ProbeCPU {
  logExecute(address:number);
  logInterrupt(type:number);
}

export interface ProbeBus {
  logRead(address:number);
  logWrite(address:number);
}

export interface ProbeIO {
  logIORead(address:number);
  logIOWrite(address:number);
}

export interface ProbeAll extends ProbeCPU, ProbeBus, ProbeIO {
}

export class NullProbe implements ProbeAll {
  logExecute()		{}
  logInterrupt()	{}
  logRead()		{}
  logWrite()		{}
  logIORead()		{}
  logIOWrite()		{}
}

/// CONVENIENCE

export interface BasicMachineControlsState {
  in: Uint8Array;
}

export interface BasicMachineState extends BasicMachineControlsState {
  c: any; // TODO
  b: Uint8Array;
}

export abstract class BasicMachine implements HasCPU, Bus, SampledAudioSource, AcceptsROM,
  SavesState<BasicMachineState>, SavesInputState<BasicMachineControlsState> {

  abstract cpuFrequency : number;
  abstract canvasWidth : number;
  abstract numVisibleScanlines : number;
  abstract defaultROMSize : number;
  abstract sampleRate : number;
  overscan : boolean = false;
  rotate : number = 0;
  
  abstract cpu : CPU;
  abstract ram : Uint8Array;
  
  rom : Uint8Array;
  pixels : Uint32Array;
  audio : SampledAudioSink;
  inputs : Uint8Array = new Uint8Array(32);

  scanline : number;
  frameCycles : number;
  
  abstract read(a:number) : number;
  abstract write(a:number, v:number) : void;
  abstract startScanline() : void;
  abstract drawScanline() : void;

  getAudioParams() : SampledAudioParams {
    return {sampleRate:this.sampleRate, stereo:false};
  }
  connectAudio(audio : SampledAudioSink) : void {
    this.audio = audio;
  }
  getVideoParams() : VideoParams {
    return {width:this.canvasWidth, height:this.numVisibleScanlines, overscan:this.overscan, rotate:this.rotate};
  }
  connectVideo(pixels:Uint32Array) : void {
    this.pixels = pixels;
  }
  reset() {
    this.cpu.reset();
  }
  loadROM(data:Uint8Array, title?:string) : void {
    if (!this.rom) this.rom = new Uint8Array(this.defaultROMSize);
    this.rom.set(data);
  }
  loadState(state) {
    this.cpu.loadState(state.c);
    this.ram.set(state.b);
    this.inputs.set(state.in);
  }
  saveState() {
    return {
      c:this.cpu.saveState(),
      b:this.ram.slice(0),
      in:this.inputs.slice(0),
    };
  }
  loadControlsState(state) {
    this.inputs.set(state.in);
  }
  saveControlsState() {
    return {
      in:this.inputs.slice(0)
    };
  }
  advance(cycles : number) : number {
    for (var i=0; i<cycles; i+=this.advanceCPU())
      ;
    return i;
  }
  advanceCPU() {
    var c = this.cpu as any;
    if (c.advanceClock) return c.advanceClock();
    else if (c.advanceInsn) return c.advanceInsn(1);
  }
}

export abstract class BasicScanlineMachine extends BasicMachine implements RasterFrameBased {

  abstract numTotalScanlines : number;
  abstract cpuCyclesPerLine : number;

  advanceFrame(maxClocks:number, trap) : number {
    var clock = 0;
    var endLineClock = 0;
    for (var sl=0; sl<this.numTotalScanlines; sl++) {
      endLineClock += this.cpuCyclesPerLine;
      this.scanline = sl;
      this.frameCycles = clock;
      this.startScanline();
      while (clock < endLineClock) {
        if (trap && trap()) {
          sl = 999;
          break;
        }
        clock += this.advance(endLineClock - clock);
      }
      this.drawScanline();
    }
    return clock;
  }
  getRasterY() { return this.scanline; }
  getRasterX() { return this.frameCycles % this.cpuCyclesPerLine; }
}
