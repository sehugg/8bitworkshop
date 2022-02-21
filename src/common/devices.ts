
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
    advanceFrame(trap:TrapCondition) : number;
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
    videoFrequency? : number; // default = 60
    aspect? : number;
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

export interface AcceptsBIOS {
  loadBIOS(data:Uint8Array, title?:string) : void;
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

export interface AcceptsKeyInput {
    setKeyInput(key:number, code:number, flags:number) : void;
}

export interface AcceptsPaddleInput {
    setPaddleInput(controller:number, value:number) : void;
}

// TODO: interface not yet used (setKeyInput() handles joystick)
export interface AcceptsJoyInput {
  setJoyInput(joy:number, bitmask:number) : void;
}

// SERIAL I/O

export interface SerialEvent {
  op: 'read' | 'write';
  value: number;
  nbits: number;
}

// TODO: all these needed?
export interface SerialIOInterface {
  // from machine to platform
  clearToSend() : boolean;
  sendByte(b : number);
  // from platform to machine
  byteAvailable() : boolean;
  recvByte() : number;
  // implement these too
  reset() : void;
  advance(clocks: number) : void;
//  refresh() : void;
}

export interface HasSerialIO {
  connectSerialIO(serial: SerialIOInterface);
  serialOut?: SerialEvent[];    // outgoing event log
  serialIn?: SerialEvent[];     // incoming queue
}

/// PROFILER

export interface Probeable {
    connectProbe(probe: ProbeAll) : void;
}

export interface ProbeTime {
  logClocks(clocks:number);
  logNewScanline();
  logNewFrame();
}

export interface ProbeCPU {
  logExecute(address:number, SP:number);
  logInterrupt(type:number);
  logIllegal(address:number);
}

export interface ProbeBus {
  logRead(address:number, value:number);
  logWrite(address:number, value:number);
}

export interface ProbeIO {
  logIORead(address:number, value:number);
  logIOWrite(address:number, value:number);
}

export interface ProbeVRAM {
  logVRAMRead(address:number, value:number);
  logVRAMWrite(address:number, value:number);
}

export interface ProbeAll extends ProbeTime, ProbeCPU, ProbeBus, ProbeIO, ProbeVRAM {
  logData(data:number); // entire 32 bits
  addLogBuffer(src: Uint32Array);
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
  logVRAMRead()		{}
  logVRAMWrite()	{}
  logIllegal()		{}
  logData()       {}
  addLogBuffer(src: Uint32Array) {}
}

/// CONVENIENCE

export interface BasicMachineControlsState {
  inputs: Uint8Array;
}

export interface BasicMachineState extends BasicMachineControlsState {
  c: any; // TODO
  ram: Uint8Array;
}

export abstract class BasicHeadlessMachine implements HasCPU, Bus, AcceptsROM, Probeable,
  SavesState<BasicMachineState>, SavesInputState<BasicMachineControlsState> {

  abstract cpuFrequency : number;
  abstract defaultROMSize : number;

  abstract cpu : CPU;
  abstract ram : Uint8Array;  

  rom : Uint8Array;
  inputs : Uint8Array = new Uint8Array(32);
  handler : (key,code,flags) => void; // keyboard handler

  nullProbe = new NullProbe();
  probe : ProbeAll = this.nullProbe;
  
  abstract read(a:number) : number;
  abstract write(a:number, v:number) : void;

  setKeyInput(key:number, code:number, flags:number) : void {
    this.handler && this.handler(key,code,flags);
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
  advanceCPU() {
    var c = this.cpu as any;
    var n = 1;
    if (this.cpu.isStable()) { this.probe.logExecute(this.cpu.getPC(), this.cpu.getSP()); }
    if (c.advanceClock) { c.advanceClock(); }
    else if (c.advanceInsn) { n = c.advanceInsn(1); }
    this.probe.logClocks(n);
    return n;
  }
  probeMemoryBus(membus:Bus) : Bus {
    return {
      read: (a) => {
        let val = membus.read(a);
        this.probe.logRead(a,val);
        return val;
      },
      write: (a,v) => {
        this.probe.logWrite(a,v);
        membus.write(a,v);
      }
    };
  }
  connectCPUMemoryBus(membus:Bus) : void {
    this.cpu.connectMemoryBus(this.probeMemoryBus(membus));
  }
  probeIOBus(iobus:Bus) : Bus {
    return {
      read: (a) => {
        let val = iobus.read(a);
        this.probe.logIORead(a,val);
        return val;
      },
      write: (a,v) => {
        this.probe.logIOWrite(a,v);
        iobus.write(a,v);
      }
    };
  }
  connectCPUIOBus(iobus:Bus) : void {
    this.cpu['connectIOBus'](this.probeIOBus(iobus));
  }
}

export abstract class BasicMachine extends BasicHeadlessMachine implements SampledAudioSource {

  abstract canvasWidth : number;
  abstract numVisibleScanlines : number;
  abstract sampleRate : number;
  overscan : boolean = false;
  rotate : number = 0;
  
  pixels : Uint32Array;
  audio : SampledAudioSink;

  scanline : number;
  
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
}

export abstract class BasicScanlineMachine extends BasicMachine implements RasterFrameBased {

  abstract numTotalScanlines : number;
  abstract cpuCyclesPerLine : number;

  abstract startScanline() : void;
  abstract drawScanline() : void;

  frameCycles : number;
  
  advanceFrame(trap: TrapCondition) : number {
    this.preFrame();
    var endLineClock = 0;
    var steps = 0;
    this.probe.logNewFrame();
    this.frameCycles = 0;
    for (var sl=0; sl<this.numTotalScanlines; sl++) {
      endLineClock += this.cpuCyclesPerLine; // could be fractional
      this.scanline = sl;
      this.startScanline();
      while (this.frameCycles < endLineClock) {
        if (trap && trap()) {
          sl = 999;
          break;
        }
        this.frameCycles += this.advanceCPU();
        steps++;
      }
      this.drawScanline();
      this.probe.logNewScanline();
      this.probe.logClocks(Math.floor(this.frameCycles - endLineClock)); // remainder of prev. line
    }
    this.postFrame();
    return steps; // TODO: return steps, not clock? for recorder
  }
  preFrame() { }
  postFrame() { }
  getRasterY() { return this.scanline; }
  getRasterX() { return this.frameCycles % this.cpuCyclesPerLine; }
}
