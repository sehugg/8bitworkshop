
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

// TODO: joystick
export interface AcceptsKeyInput {
    setKeyInput(key:number, code:number, flags:number) : void;
}

export interface AcceptsPaddleInput {
    setPaddleInput(controller:number, value:number) : void;
}

export interface Probeable {
    connectProbe(probe: ProbeAll) : void;
}

export function xorshift32(x : number) : number {
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
      var val = oldread(a);
      profiler.logRead(a,val);
      return val;
    }
    bus.write = (a:number,v:number) => {
      profiler.logWrite(a,v);
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

export interface ProbeTime {
  logClocks(clocks:number);
  logNewScanline();
  logNewFrame();
}

export interface ProbeCPU {
  logExecute(address:number);
  logInterrupt(type:number);
}

export interface ProbeBus {
  logRead(address:number, value:number);
  logWrite(address:number, value:number);
}

export interface ProbeIO {
  logIORead(address:number, value:number);
  logIOWrite(address:number, value:number);
}

export interface ProbeAll extends ProbeTime, ProbeCPU, ProbeBus, ProbeIO {
}

export class NullProbe implements ProbeAll {
  logClocks()		{}
  logNewScanline()	{}
  logNewFrame()		{}
  logExecute()		{}
  logInterrupt()	{}
  logRead()		{}
  logWrite()		{}
  logIORead()		{}
  logIOWrite()		{}
}

/// CONVENIENCE

export interface BasicMachineControlsState {
  inputs: Uint8Array;
}

export interface BasicMachineState extends BasicMachineControlsState {
  c: any; // TODO
  ram: Uint8Array;
}

export abstract class BasicMachine implements HasCPU, Bus, SampledAudioSource, AcceptsROM, Probeable,
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
  // TODO? abstract handler; // keyboard handler
  
  rom : Uint8Array;
  pixels : Uint32Array;
  audio : SampledAudioSink;
  inputs : Uint8Array = new Uint8Array(32);

  scanline : number;
  frameCycles : number;
  
  nullProbe = new NullProbe();
  probe : ProbeAll = this.nullProbe;
  
  abstract read(a:number) : number;
  abstract write(a:number, v:number) : void;

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
  connectProbe(probe: ProbeAll) : void {
    this.probe = probe || this.nullProbe;
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
    this.ram.set(state.ram);
    this.inputs.set(state.inputs);
  }
  saveState() {
    return {
      c:this.cpu.saveState(),
      ram:this.ram.slice(0),
      inputs:this.inputs.slice(0),
    };
  }
  loadControlsState(state) {
    this.inputs.set(state.inputs);
  }
  saveControlsState() {
    return {
      inputs:this.inputs.slice(0)
    };
  }
  advanceCPUMultiple(cycles : number) : number {
    for (var i=0; i<cycles; i+=this.advanceCPU())
      ;
    return i;
  }
  advanceCPU() {
    var c = this.cpu as any;
    var n = 1;
    if (this.cpu.isStable()) { this.probe.logExecute(this.cpu.getPC()); }
    if (c.advanceClock) { c.advanceClock(); }
    else if (c.advanceInsn) { n = c.advanceInsn(1); }
    this.probe.logClocks(n);
    return n;
  }
  connectCPUMemoryBus(membus:Bus) : void {
    this.cpu.connectMemoryBus({
      read: (a) => {
        let val = membus.read(a);
        this.probe.logRead(a,val);
        return val;
      },
      write: (a,v) => {
        this.probe.logWrite(a,v);
        membus.write(a,v);
      }
    });
  }
  connectCPUIOBus(iobus:Bus) : void {
    this.cpu['connectIOBus']({
      read: (a) => {
        let val = iobus.read(a);
        this.probe.logIORead(a,val);
        return val;
      },
      write: (a,v) => {
        this.probe.logIOWrite(a,v);
        iobus.write(a,v);
      }
    });
  }
}

export abstract class BasicScanlineMachine extends BasicMachine implements RasterFrameBased {

  abstract numTotalScanlines : number;
  abstract cpuCyclesPerLine : number;

  abstract startScanline() : void;
  abstract drawScanline() : void;
  
  advanceFrame(maxClocks:number, trap) : number {
    this.preFrame();
    var clock = 0;
    var endLineClock = 0;
    this.probe.logNewFrame();
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
        clock += this.advanceCPU();
      }
      this.drawScanline();
      this.probe.logNewScanline();
      this.probe.logClocks(clock-endLineClock);
    }
    this.postFrame();
    return clock;
  }
  preFrame() { }
  postFrame() { }
  getRasterY() { return this.scanline; }
  getRasterX() { return this.frameCycles % this.cpuCyclesPerLine; }
}
