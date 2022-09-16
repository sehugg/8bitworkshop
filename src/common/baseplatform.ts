
import { RasterVideo, dumpRAM, AnimationTimer, ControllerPoller } from "./emu";
import { hex, printFlags, invertMap, byteToASCII } from "./util";
import { CodeAnalyzer } from "./analysis";
import { Segment, FileData } from "./workertypes";
import { disassemble6502 } from "./cpu/disasm6502";
import { disassembleZ80 } from "./cpu/disasmz80";
import { Z80 } from "./cpu/ZilogZ80";

import { Bus, Resettable, FrameBased, VideoSource, SampledAudioSource, AcceptsROM, AcceptsBIOS, AcceptsKeyInput, SavesState, SavesInputState, HasCPU, HasSerialIO, SerialIOInterface, AcceptsJoyInput } from "./devices";
import { Probeable, RasterFrameBased, AcceptsPaddleInput } from "./devices";
import { SampledAudio } from "./audio";
import { ProbeRecorder } from "./probe";
import { BaseWASMMachine } from "./wasmplatform";
import { CPU6809 } from "./cpu/6809";
import { _MOS6502 } from "./cpu/MOS6502";

///

export interface OpcodeMetadata {
  minCycles: number;
  maxCycles: number;
  insnlength: number;
  opcode: number;
}

export interface CpuState {
  PC:number;
  EPC?:number; // effective PC (for bankswitching)
  o?:number;/*opcode*/
  SP?:number
  /*
  A:number, X:number, Y:number, SP:number, R:boolean,
  N,V,D,Z,C:boolean*/
};
export interface EmuState {
  c?:CpuState,	// CPU state
  b?:Uint8Array|number[], 	// RAM (TODO: not for vcs, support Uint8Array)
  ram?:Uint8Array,
  o?:{},				// verilog
};
export interface EmuControlsState {
}
export type DisasmLine = {
  line:string,
  nbytes:number,
  isaddr:boolean
};

export type SymbolMap = {[ident:string]:number};
export type AddrSymbolMap = {[address:number]:string};

export class DebugSymbols {
  symbolmap : SymbolMap;	// symbol -> address
  addr2symbol : AddrSymbolMap;	// address -> symbol
  debuginfo : {}; // extra platform-specific debug info

  constructor(symbolmap : SymbolMap, debuginfo : {}) {
    this.symbolmap = symbolmap;
    this.debuginfo = debuginfo;
    this.addr2symbol = invertMap(symbolmap);
    //// TODO: shouldn't be necc.
    if (!this.addr2symbol[0x0]) this.addr2symbol[0x0] = '$00'; // needed for ...
    this.addr2symbol[0x10000] = '__END__'; // ... dump memory to work
  }
}

type MemoryMapType = "main" | "vram";
type MemoryMap = { [type:string] : Segment[] };

export function isDebuggable(arg:any): arg is Debuggable {
    return arg && typeof arg.getDebugCategories === 'function';
}

export interface Debuggable {
  getDebugCategories?() : string[];
  getDebugInfo?(category:string, state:EmuState) : string;
}

export interface Platform {
  start() : void | Promise<void>;
  reset() : void;
  isRunning() : boolean;
  getToolForFilename(s:string) : string;
  getDefaultExtension() : string;
  getPresets?() : Preset[];
  pause() : void;
  resume() : void;
  loadROM(title:string, rom:any); // TODO: Uint8Array
  loadBIOS?(title:string, rom:Uint8Array);
  getROMExtension?(rom:FileData) : string;

  loadState?(state : EmuState) : void;
  saveState?() : EmuState;
  loadControlsState?(state : EmuControlsState) : void;
  saveControlsState?() : EmuControlsState;

  inspect?(ident:string) : string;
  disassemble?(addr:number, readfn:(addr:number)=>number) : DisasmLine;
  readAddress?(addr:number) : number;
  readVRAMAddress?(addr:number) : number;
  
  setFrameRate?(fps:number) : void;
  getFrameRate?() : number;

  setupDebug?(callback : BreakpointCallback) : void;
  clearDebug?() : void;
  step?() : void;
  runToVsync?() : void;
  runToPC?(pc:number) : void;
  runUntilReturn?() : void;
  stepBack?() : void;
  runEval?(evalfunc : DebugEvalCondition) : void;
  runToFrameClock?(clock : number) : void;
  stepOver?() : void;
  restartAtPC?(pc:number) : boolean;

  getOpcodeMetadata?(opcode:number, offset:number) : OpcodeMetadata; //TODO
  getSP?() : number;
  getPC?() : number;
  getOriginPC?() : number;
  newCodeAnalyzer?() : CodeAnalyzer;
  
  getPlatformName?() : string;
  getMemoryMap?() : MemoryMap;

  setRecorder?(recorder : EmuRecorder) : void;
  advance?(novideo? : boolean) : number;
  advanceFrameClock?(trap:DebugCondition, step:number) : number;
  showHelp?() : string;
  resize?() : void;

  getRasterScanline?() : number;
  getRasterLineClock?() : number;
  setBreakpoint?(id : string, cond : DebugCondition);
  clearBreakpoint?(id : string);
  hasBreakpoint?(id : string) : boolean;
  getCPUState?() : CpuState;

  debugSymbols? : DebugSymbols;
  getDebugTree?() : {};
  
  startProbing?() : ProbeRecorder;
  stopProbing?() : void;

  isBlocked?() : boolean; // is blocked, halted, or waiting for input?

  readFile?(path: string) : FileData;
  writeFile?(path: string, data: FileData) : boolean;
  sourceFileFetch?: (path:string) => FileData;

  getDownloadFile?() : {extension:string, blob:Blob};
  getDebugSymbolFile?() : {extension:string, blob:Blob};
}

export interface Preset {
  id : string;
  name : string;
  chapter? : number;
  title? : string;
}

export interface MemoryBus {
  read : (address:number) => number;
  write : (address:number, value:number) => void;
  contend?: (address:number, cycles:number) => number;
  isContended?: (address:number) => boolean;
}

export type DebugCondition = () => boolean;
export type DebugEvalCondition = (c:CpuState) => boolean;
export type BreakpointCallback = (s:EmuState, msg?:string) => void;
// for composite breakpoints w/ single debug function
export class BreakpointList {
  id2bp : {[id:string] : Breakpoint} = {};
  getDebugCondition() : DebugCondition {
    if (Object.keys(this.id2bp).length == 0) {
      return null; // no breakpoints
    } else {
      // evaluate all breakpoints
      return () => {
        var result = false;
        for (var id in this.id2bp)
          if (this.id2bp[id].cond())
            result = true;
        return result;
      };
    }
  }
}
export interface Breakpoint {
  cond: DebugCondition;
};

export interface EmuRecorder {
  frameRequested() : boolean;
  recordFrame(state : EmuState);
}

/////

export abstract class BasePlatform {
  recorder : EmuRecorder = null;
  debugSymbols : DebugSymbols;
  internalFiles : {[path:string] : FileData} = {};

  abstract loadState(state : EmuState) : void;
  abstract saveState() : EmuState;
  abstract pause() : void;
  abstract resume() : void;
  abstract advance(novideo? : boolean) : number;

  setRecorder(recorder : EmuRecorder) : void {
    this.recorder = recorder;
  }
  updateRecorder() {
    // are we recording and do we need to save a frame?
    if (this.recorder && (<Platform><any>this).isRunning() && this.recorder.frameRequested()) {
      this.recorder.recordFrame(this.saveState());
    }
  }
  inspect(sym: string) : string {
    return inspectSymbol((this as any) as Platform, sym);
  }
  getDebugTree() : {} {
    var o : any = { };
    o.state = this.saveState();
    if (this.debugSymbols?.debuginfo) o.debuginfo = this.debugSymbols.debuginfo;
    return o;
  }
  readFile(path: string) : FileData {
    return this.internalFiles[path];
  }
  writeFile(path: string, data: FileData) : boolean {
    this.internalFiles[path] = data;
    return true;
  }
}

export abstract class BaseDebugPlatform extends BasePlatform {
  onBreakpointHit : BreakpointCallback;
  debugCallback : DebugCondition;
  debugSavedState : EmuState = null;
  debugBreakState : EmuState = null;
  debugTargetClock : number = 0;
  debugClock : number = 0;
  breakpoints : BreakpointList = new BreakpointList();
  frameCount : number = 0;

  abstract getCPUState() : CpuState;

  setBreakpoint(id : string, cond : DebugCondition) {
    if (cond) {
      this.breakpoints.id2bp[id] = {cond:cond};
      this.restartDebugging();
    } else {
      this.clearBreakpoint(id);
    }
  }
  clearBreakpoint(id : string) {
    delete this.breakpoints.id2bp[id];
  }
  hasBreakpoint(id : string) {
    return this.breakpoints.id2bp[id] != null;
  }
  getDebugCallback() : DebugCondition {
    return this.breakpoints.getDebugCondition();
  }
  setupDebug(callback : BreakpointCallback) : void {
    this.onBreakpointHit = callback;
  }
  clearDebug() {
    if (this.debugBreakState != null) {
      this.loadState(this.debugSavedState);
    }
    this.debugSavedState = null;
    this.debugBreakState = null;
    this.debugTargetClock = -1;
    this.debugClock = 0;
    this.onBreakpointHit = null;
    this.clearBreakpoint('debug');
    this.frameCount = 0;
  }
  setDebugCondition(debugCond : DebugCondition) {
    this.setBreakpoint('debug', debugCond);
  }
  resetDebugging() {
    if (this.debugSavedState) {
      this.loadState(this.debugSavedState);
    } else {
      this.debugSavedState = this.saveState();
    }
    this.debugClock = 0;
    this.debugCallback = this.getDebugCallback();
    this.debugBreakState = null;
  }
  restartDebugging() {
    this.resetDebugging();
    this.resume();
  }
  preFrame() {
    // save state before frame, to record any inputs that happened pre-frame
    if (this.debugCallback && !this.debugBreakState) {
      // save state every frame and rewind debug clocks
      this.debugSavedState = this.saveState();
      this.debugTargetClock -= this.debugClock;
      this.debugClock = 0;
    }
  }
  postFrame() {
    // reload debug state at end of frame after breakpoint
    if (this.debugCallback && this.debugBreakState) {
      this.loadState(this.debugBreakState);
    }
    this.frameCount++;
  }
  pollControls() {
  }
  nextFrame(novideo : boolean) : number {
    this.pollControls();
    this.updateRecorder();
    this.preFrame();
    var steps = this.advance(novideo);
    this.postFrame();
    return steps;
  }
  // default debugging
  abstract getSP() : number;
  abstract getPC() : number;
  abstract isStable() : boolean;

  evalDebugCondition() {
    if (this.debugCallback && !this.debugBreakState) {
      this.debugCallback();
    }
  }
  wasBreakpointHit() : boolean {
    return this.debugBreakState != null;
  }
  breakpointHit(targetClock : number, reason? : string) {
    console.log(this.debugTargetClock, targetClock, this.debugClock, this.isStable());
    this.debugTargetClock = targetClock;
    this.debugBreakState = this.saveState();
    console.log("Breakpoint at clk", this.debugClock, "PC", this.debugBreakState.c.PC.toString(16));
    this.pause();
    if (this.onBreakpointHit) {
      this.onBreakpointHit(this.debugBreakState, reason);
    }
  }
  haltAndCatchFire(reason : string) {
    this.breakpointHit(this.debugClock, reason);
  }
  runEval(evalfunc : DebugEvalCondition) {
    this.setDebugCondition( () => {
      if (++this.debugClock >= this.debugTargetClock && this.isStable()) {
        var cpuState = this.getCPUState();
        if (evalfunc(cpuState)) {
          this.breakpointHit(this.debugClock);
          return true;
        } else {
          return false;
        }
      }
    });
  }
  runToPC(pc: number) {
    this.debugTargetClock++;
    this.runEval((c) => {
      return c.PC == pc;
    });
  }
  runUntilReturn() {
    var SP0 = this.getSP();
    this.runEval( (c:CpuState) : boolean => {
      return c.SP > SP0; // TODO: check for RTS/RET opcode
    });
  }
  runToFrameClock(clock : number) : void {
    this.restartDebugging();
    this.debugTargetClock = clock;
    this.runEval(() : boolean => { return true; });
  }
  step() {
    this.runToFrameClock(this.debugClock+1);
  }
  stepBack() {
    var prevState;
    var prevClock;
    var clock0 = this.debugTargetClock;
    this.restartDebugging();
    this.debugTargetClock = clock0 - 25; // TODO: depends on CPU
    this.runEval( (c:CpuState) : boolean => {
      if (this.debugClock < clock0) {
        prevState = this.saveState();
        prevClock = this.debugClock;
        return false;
      } else {
        if (prevState) {
          this.loadState(prevState);
          this.debugClock = prevClock;
        }
        return true;
      }
    });
  }
  runToVsync() {
    this.restartDebugging();
    var frame0 = this.frameCount;
    this.runEval( () : boolean => {
      return this.frameCount > frame0;
    });
  }
}

export function inspectSymbol(platform : Platform, sym : string) : string {
  if (!platform.debugSymbols) return;
  var symmap = platform.debugSymbols.symbolmap;
  var addr2sym = platform.debugSymbols.addr2symbol;
  if (!symmap || !platform.readAddress) return null;
  var addr = symmap["_"+sym] || symmap[sym]; // look for C or asm symbol
  if (!(typeof addr == 'number')) return null;
  var b = platform.readAddress(addr);
  // don't show 2 bytes if there's a symbol at the next address
  if (addr2sym && addr2sym[addr+1] != null) {
    return "$"+hex(addr,4) + " = $"+hex(b,2)+" ("+b+" decimal)"; // unsigned
  } else {
    let b2 = platform.readAddress(addr+1);
    let w = b | (b2<<8);
    return "$"+hex(addr,4) + " = $"+hex(b,2)+" $"+hex(b2,2)+" ("+((w<<16)>>16)+" decimal)"; // signed
  }
}

////// 6502

export function getToolForFilename_6502(fn:string) : string {
  if (fn.endsWith(".pla")) return "plasm";
  if (fn.endsWith(".c")) return "cc65";
  if (fn.endsWith(".h")) return "cc65";
  if (fn.endsWith(".s")) return "ca65";
  if (fn.endsWith(".ca65")) return "ca65";
  if (fn.endsWith(".dasm")) return "dasm";
  if (fn.endsWith(".acme")) return "acme";
  if (fn.endsWith(".wiz")) return "wiz";
  if (fn.endsWith(".ecs")) return "ecs";
  return "dasm"; // .a
}

// TODO: can merge w/ Z80?
export abstract class Base6502Platform extends BaseDebugPlatform {

  // some platforms store their PC one byte before or after the first opcode
  // so we correct when saving and loading from state
  debugPCDelta = -1;
  fixPC(c)   { c.PC = (c.PC + this.debugPCDelta) & 0xffff; return c; }
  unfixPC(c) { c.PC = (c.PC - this.debugPCDelta) & 0xffff; return c;}
  getSP()    { return this.getCPUState().SP };
  getPC()    { return this.getCPUState().PC };
  isStable() { return !this.getCPUState()['T']; }
  abstract readAddress(addr:number) : number;

  newCPU(membus : MemoryBus) {
    var cpu = new _MOS6502();
    cpu.connectBus(membus);
    return cpu;
  }

  getOpcodeMetadata(opcode, offset) {
    return getOpcodeMetadata_6502(opcode, offset);
  }

  getOriginPC() : number {
    return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
  }

  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    return disassemble6502(pc, read(pc), read(pc+1), read(pc+2));
  }
  getToolForFilename = getToolForFilename_6502;
  getDefaultExtension() { return ".a"; };

  getDebugCategories() {
    return ['CPU','ZPRAM','Stack'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_6502(state.c);
      case 'ZPRAM': return dumpRAM(state.b||state.ram, 0x0, 0x100);
      case 'Stack': return dumpStackToString(<Platform><any>this, state.b||state.ram, 0x100, 0x1ff, 0x100+state.c.SP, 0x20);
    }
  }
}

export function cpuStateToLongString_6502(c) : string {
  function decodeFlags(c) {
    var s = "";
    s += c.N ? " N" : " -";
    s += c.V ? " V" : " -";
    s += c.D ? " D" : " -";
    s += c.Z ? " Z" : " -";
    s += c.C ? " C" : " -";
    s += c.I ? " I" : " -";
    return s;
  }
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c) + "\n"
       + " A " + hex(c.A)    + "     " + (c.R ? "" : "BUSY") + "\n"
       + " X " + hex(c.X)    + "\n"
       + " Y " + hex(c.Y)    + "     " + "SP " + hex(c.SP) + "\n";
}

var OPMETA_6502 = {
  cycletime: [
  7, 6, 0, 8, 3, 3, 5, 5, 3, 2, 2, 2, 4, 4, 6, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7,    6, 6, 0, 8, 3, 3, 5, 5, 4, 2, 2, 2, 4, 4, 6, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7,    6, 6, 0, 8, 3, 3, 5, 5, 3, 2, 2, 2, 3, 4, 6, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7,    6, 6, 0, 8, 3, 3, 5, 5, 4, 2, 2, 2, 5, 4, 6, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7,    0, 6, 0, 6, 3, 3, 3, 3, 2, 0, 2, 0, 4, 4, 4, 4,    2, 6, 0, 0, 4, 4, 4, 4, 2, 5, 2, 0, 0, 5, 0, 0,    2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 0, 4, 4, 4, 4,    2, 5, 0, 5, 4, 4, 4, 4, 2, 4, 2, 0, 4, 4, 4, 4,    2, 6, 0, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 3, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7,    2, 6, 0, 8, 3, 3, 5, 5, 2, 2, 2, 0, 4, 4, 6, 6,    2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7
  ],
  extracycles: [
  0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1,    0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,    2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1
  ],
  insnlengths: [
  1, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3,    3, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3,    1, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3,    1, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3,    0, 2, 0, 2, 2, 2, 2, 2, 1, 0, 1, 0, 3, 3, 3, 3,    2, 2, 0, 0, 2, 2, 2, 3, 1, 3, 1, 0, 0, 3, 0, 0,    2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 0, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 1, 0, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 0, 3, 3, 3, 3,    2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3
  ],
  validinsns: [
  1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 0, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,    3, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,    1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,    1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,    0, 2, 0, 0, 2, 2, 2, 0, 1, 0, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 0, 3, 0, 0,    2, 2, 2, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0,    2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0,    2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0
  ],
}

export function getOpcodeMetadata_6502(opcode, address) {
  // TODO: more intelligent maximum cycles
  // TODO: must always be new object, b/c we might modify it
  return {
    opcode:opcode,
    minCycles:OPMETA_6502.cycletime[opcode],
    maxCycles:OPMETA_6502.cycletime[opcode] + OPMETA_6502.extracycles[opcode],
    insnlength:OPMETA_6502.insnlengths[opcode]
  };
}

////// Z80

export function cpuStateToLongString_Z80(c) {
  function decodeFlags(flags) {
    return printFlags(flags, ["S","Z",,"H",,"V","N","C"], true);
  }
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c.AF) + " " + (c.iff1?"I":"-") + (c.iff2?"I":"-") + "\n"
       + "SP " + hex(c.SP,4) + "  IR " + hex(c.IR,4) + "\n"
       + "IX " + hex(c.IX,4) + "  IY " + hex(c.IY,4) + "\n"
       + "AF " + hex(c.AF,4) + "  BC " + hex(c.BC,4) + "\n"
       + "DE " + hex(c.DE,4) + "  HL " + hex(c.HL,4) + "\n"
       ;
}

export abstract class BaseZ80Platform extends BaseDebugPlatform {

  _cpu;
  waitCycles : number = 0;

  newCPU(membus : MemoryBus, iobus : MemoryBus) {
    this._cpu = new Z80();
    this._cpu.connectMemoryBus(membus);
    this._cpu.connectIOBus(iobus);
    return this._cpu;
  }

  getPC() { return this._cpu.getPC(); }
  getSP() { return this._cpu.getSP(); }
  isStable() { return true; }

  // TODO: refactor other parts into here
  runCPU(cpu, cycles:number) : number {
    this._cpu = cpu; // TODO?
    this.waitCycles = 0; // TODO: needs to spill over betwenn calls
    if (this.wasBreakpointHit())
      return 0;
    var debugCond = this.getDebugCallback();
    var n = 0;
    this.waitCycles += cycles;
    while (this.waitCycles > 0) {
      if (debugCond && debugCond()) {
        debugCond = null;
        break;
      }
      var cyc = cpu.advanceInsn();
      n += cyc;
      this.waitCycles -= cyc;
    }
    return n;
  }

  getToolForFilename = getToolForFilename_z80;
  getDefaultExtension() { return ".c"; };
  // TODO: Z80 opcode metadata
  //this.getOpcodeMetadata = function() { }

  getDebugCategories() {
    return ['CPU','Stack'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_Z80(state.c);
      case 'Stack': {
        var sp = (state.c.SP-1) & 0xffff;
        var start = sp & 0xff00;
        var end = start + 0xff;
        if (sp == 0) sp = 0x10000;
        console.log(sp,start,end);
        return dumpStackToString(<Platform><any>this, [], start, end, sp, 0xcd);
      }
    }
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    return disassembleZ80(pc, read(pc), read(pc+1), read(pc+2), read(pc+3));
  }
}

export function getToolForFilename_z80(fn:string) : string {
  if (fn.endsWith(".c")) return "sdcc";
  if (fn.endsWith(".h")) return "sdcc";
  if (fn.endsWith(".s")) return "sdasz80";
  if (fn.endsWith(".ns")) return "naken";
  if (fn.endsWith(".scc")) return "sccz80";
  if (fn.endsWith(".z")) return "zmac";
  if (fn.endsWith(".wiz")) return "wiz";
  return "zmac";
}

////// 6809

export function cpuStateToLongString_6809(c) {
  function decodeFlags(flags) {
    return printFlags(flags, ["E","F","H","I", "N","Z","V","C"], true);
  }
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c.CC) + "\n"
       + "SP " + hex(c.SP,4) + "\n"
       + "DP " + hex(c.DP,2) + "\n"
       + " A " + hex(c.A,2) + "\n"
       + " B " + hex(c.B,2) + "\n"
       + " X " + hex(c.X,4) + "\n"
       + " Y " + hex(c.Y,4) + "\n"
       + " U " + hex(c.U,4) + "\n"
       ;
}

export function getToolForFilename_6809(fn:string) : string {
  if (fn.endsWith(".c")) return "cmoc";
  if (fn.endsWith(".h")) return "cmoc";
  if (fn.endsWith(".xasm")) return "xasm6809";
  return "lwasm";
}

export abstract class Base6809Platform extends BaseZ80Platform {

  newCPU(membus : MemoryBus) {
    var cpu = Object.create(CPU6809());
    cpu.init(membus.write, membus.read, 0);
    return cpu;
  }

  cpuStateToLongString(c:CpuState) {
    return cpuStateToLongString_6809(c);
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    // TODO: don't create new CPU
    return Object.create(CPU6809()).disasm(read(pc), read(pc+1), read(pc+2), read(pc+3), read(pc+4), pc);
  }
  getDefaultExtension() : string { return ".asm"; };
  //this.getOpcodeMetadata = function() { }
  getToolForFilename = getToolForFilename_6809;
  getDebugCategories() {
    return ['CPU','Stack'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_6809(state.c);
      default:      return super.getDebugInfo(category, state);
    }
  }
}


//TODO: how to get stack_end?
export function dumpStackToString(platform:Platform, mem:Uint8Array|number[], start:number, end:number, sp:number, jsrop:number, bigendian?:boolean) : string {
  var s = "";
  var nraw = 0;
  //s = dumpRAM(mem.slice(start,start+end+1), start, end-start+1);
  function read(addr) {
    if (addr < mem.length) return mem[addr];
    else return platform.readAddress(addr);
  }
  while (sp < end) {
    sp++;
    // see if there's a JSR on the stack here
    // TODO: make work with roms and memory maps
    var addr = read(sp) + read(sp+1)*256;
    if (bigendian) { addr = ((addr & 0xff) << 8) | ((addr & 0xff00) >> 8) }
    var jsrofs = jsrop==0x20 ? -2 : -3; // 6502 vs Z80
    var opcode = read(addr + jsrofs); // might be out of bounds
    if (opcode == jsrop) { // JSR
      s += "\n$" + hex(sp) + ": ";
      s += hex(addr,4) + " " + lookupSymbol(platform, addr, true);
      sp++;
      nraw = 0;
    } else {
      if (nraw == 0)
        s += "\n$" + hex(sp) + ": ";
      s += hex(read(sp)) + " ";
      if (++nraw == 8) nraw = 0;
    }
  }
  return s+"\n";
}

// TODO: slow, funky, uses global
export function lookupSymbol(platform:Platform, addr:number, extra:boolean) {
  var start = addr;
  var addr2symbol = platform.debugSymbols && platform.debugSymbols.addr2symbol;
  while (addr2symbol && addr >= 0) {
    var sym = addr2symbol[addr];
    if (sym) { // return first symbol we find
      var sym = addr2symbol[addr];
      return extra ? (sym + " + $" + hex(start-addr)) : sym;
    }
    if (!extra) break;
    addr--;
  }
  return "";
}

/// new Machine platform adapters

export interface Machine extends Bus, Resettable, FrameBased, AcceptsROM, HasCPU, SavesState<EmuState>, SavesInputState<any> {
}

export function hasVideo(arg:any): arg is VideoSource {
    return typeof arg.connectVideo === 'function';
}
export function hasAudio(arg:any): arg is SampledAudioSource {
    return typeof arg.connectAudio === 'function';
}
export function hasKeyInput(arg:any): arg is AcceptsKeyInput {
    return typeof arg.setKeyInput === 'function';
}
export function hasJoyInput(arg:any): arg is AcceptsJoyInput {
  return typeof arg.setJoyInput === 'function';
}
export function hasPaddleInput(arg:any): arg is AcceptsPaddleInput {
    return typeof arg.setPaddleInput === 'function';
}
export function isRaster(arg:any): arg is RasterFrameBased {
    return typeof arg.getRasterY === 'function';
}
export function hasProbe(arg:any): arg is Probeable {
    return typeof arg.connectProbe == 'function';
}
export function hasBIOS(arg:any): arg is AcceptsBIOS {
  return typeof arg.loadBIOS == 'function';
}
export function hasSerialIO(arg:any): arg is HasSerialIO {
  return typeof arg.connectSerialIO === 'function';
}

export abstract class BaseMachinePlatform<T extends Machine> extends BaseDebugPlatform implements Platform {
  machine : T;
  mainElement : HTMLElement;
  timer : AnimationTimer;
  video : RasterVideo;
  audio : SampledAudio;
  poller : ControllerPoller;
  serialIOInterface : SerialIOInterface;
  serialVisualizer : SerialIOVisualizer;

  probeRecorder : ProbeRecorder;
  startProbing;
  stopProbing;

  abstract newMachine() : T;
  abstract getToolForFilename(s:string) : string;
  abstract getDefaultExtension() : string;
  abstract getPresets() : Preset[];
  
  constructor(mainElement : HTMLElement) {
    super();
    this.mainElement = mainElement;
  }

  reset() {
    this.machine.reset();
    if (this.serialVisualizer != null) this.serialVisualizer.reset();
  }
  loadState(s)   { this.machine.loadState(s); }
  saveState()    { return this.machine.saveState(); }
  getSP()        { return this.machine.cpu.getSP(); }
  getPC()        { return this.machine.cpu.getPC(); }
  isStable() 	 { return this.machine.cpu.isStable(); }
  getCPUState()  { return this.machine.cpu.saveState(); }
  loadControlsState(s)   { this.machine.loadControlsState(s); }
  saveControlsState()    { return this.machine.saveControlsState(); }
  
  async start() {
    this.machine = this.newMachine();
    const m = this.machine;
    // block on WASM loading
    if (m instanceof BaseWASMMachine) {
      await m.loadWASM();
    }
    var videoFrequency;
    if (hasVideo(m)) {
      var vp = m.getVideoParams();
      this.video = new RasterVideo(this.mainElement, vp.width, vp.height, 
        {overscan: !!vp.overscan,
           rotate: vp.rotate|0,
           aspect: vp.aspect});
      this.video.create();
      m.connectVideo(this.video.getFrameData());
      // TODO: support keyboard w/o video?
      if (hasKeyInput(m)) {
        this.video.setKeyboardEvents(m.setKeyInput.bind(m));
        this.poller = new ControllerPoller(m.setKeyInput.bind(m));
      }
      videoFrequency = vp.videoFrequency;
    }
    this.timer = new AnimationTimer(videoFrequency || 60, this.nextFrame.bind(this));
    if (hasAudio(m)) {
      var ap = m.getAudioParams();
      this.audio = new SampledAudio(ap.sampleRate);
      this.audio.start();
      m.connectAudio(this.audio);
    }
    if (hasPaddleInput(m)) {
      this.video.setupMouseEvents();
    }
    if (hasProbe(m)) {
      this.probeRecorder = new ProbeRecorder(m);
      this.startProbing = () => {
        m.connectProbe(this.probeRecorder);
        return this.probeRecorder;
      };
      this.stopProbing = () => {
        m.connectProbe(null);
      };
    }
    if (hasBIOS(m)) {
      this.loadBIOS = (title, data) => {
        m.loadBIOS(data, title);
      };
    }
    if (hasSerialIO(m)) {
      if (this.serialIOInterface == null) {
        this.serialVisualizer = new SerialIOVisualizer(this.mainElement, m);
      } else {
        m.connectSerialIO(this.serialIOInterface);
      }
    }
  }
  
  loadROM(title, data) {
    this.machine.loadROM(data, title);
    this.reset();
  }

  loadBIOS : (title, data) => void; // only set if hasBIOS() is true

  pollControls() {
    this.poller && this.poller.poll();
    if (hasPaddleInput(this.machine)) {
      this.machine.setPaddleInput(0, this.video.paddle_x);
      this.machine.setPaddleInput(1, this.video.paddle_y);
    }
    // TODO: put into interface
    if (this.machine['pollControls']) {
      this.machine['pollControls']();
    }
  }

  advance(novideo:boolean) {
    let trap = this.getDebugCallback();
    var steps = this.machine.advanceFrame(trap);
    if (!novideo && this.video) this.video.updateFrame();
    if (!novideo && this.serialVisualizer) this.serialVisualizer.refresh();
    return steps;
  }

  advanceFrameClock(trap, step) {
    if (!(step > 0)) return;
    if (this.machine instanceof BaseWASMMachine) {
      return this.machine.advanceFrameClock(trap, step);
    } else {
      return this.machine.advanceFrame(() => {
        return --step <= 0;
      });
    }
  }

  isRunning() {
    return this.timer && this.timer.isRunning();
  }

  resume() {
    this.timer.start();
    this.audio && this.audio.start();
  }

  pause() {
    this.timer.stop();
    this.audio && this.audio.stop();
  }

  // so probe views stick around TODO: must be a better way?
  runToVsync() {
    this.restartDebugging();
    var flag = false;
    this.runEval( () : boolean => {
      if (this.getRasterScanline() > 0) flag = true;
      else return flag;
    });
  }

  // TODO: reset target clock counter
  getRasterScanline() {
    return isRaster(this.machine) && this.machine.getRasterY();
  }

  readAddress(addr : number) : number {
    return this.machine.read(addr);
  }

  getDebugCategories() {
    if (isDebuggable(this.machine))
      return this.machine.getDebugCategories();
  }
  getDebugInfo(category:string, state:EmuState) : string {
    return isDebuggable(this.machine) && this.machine.getDebugInfo(category, state);
  }
}

// TODO: move debug info into CPU?

export abstract class Base6502MachinePlatform<T extends Machine> extends BaseMachinePlatform<T> {

  getOpcodeMetadata     = getOpcodeMetadata_6502;
  getToolForFilename    = getToolForFilename_6502;

  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    return disassemble6502(pc, read(pc), read(pc+1), read(pc+2));
  }
  getDebugCategories() {
    if (isDebuggable(this.machine))
      return this.machine.getDebugCategories();
    else
      return ['CPU','ZPRAM','Stack'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_6502(state.c);
      case 'ZPRAM': return dumpRAM(state.b||state.ram, 0x0, 0x100);
      case 'Stack': return dumpStackToString(<Platform><any>this, state.b||state.ram, 0x100, 0x1ff, 0x100+state.c.SP, 0x20);
      default: return isDebuggable(this.machine) && this.machine.getDebugInfo(category, state);
    }
  }
}

export abstract class BaseZ80MachinePlatform<T extends Machine> extends BaseMachinePlatform<T> {

  //getOpcodeMetadata     = getOpcodeMetadata_z80;
  getToolForFilename    = getToolForFilename_z80;

  getDebugCategories() {
    if (isDebuggable(this.machine))
      return this.machine.getDebugCategories();
    else
      return ['CPU','Stack'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_Z80(state.c);
      case 'Stack': {
        var sp = (state.c.SP-1) & 0xffff;
        var start = sp & 0xff00;
        var end = start + 0xff;
        if (sp == 0) sp = 0x10000;
        return dumpStackToString(<Platform><any>this, [], start, end, sp, 0xcd);
      }
      default: return isDebuggable(this.machine) && this.machine.getDebugInfo(category, state);
    }
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    return disassembleZ80(pc, read(pc), read(pc+1), read(pc+2), read(pc+3));
  }

}

export abstract class Base6809MachinePlatform<T extends Machine> extends BaseMachinePlatform<T> {

  getToolForFilename    = getToolForFilename_6809;

  getDebugCategories() {
    if (isDebuggable(this.machine))
      return this.machine.getDebugCategories();
    else
      return ['CPU','Stack'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return cpuStateToLongString_6809(state.c);
      case 'Stack': {
        var sp = (state.c.SP-1) & 0xffff;
        var start = sp & 0xff00;
        var end = start + 0xff;
        if (sp == 0) sp = 0x10000;
        return dumpStackToString(<Platform><any>this, [], start, end, sp, 0x17, true);
      }
      default: return super.getDebugInfo(category, state);
    }
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    // TODO: don't create new CPU
    return Object.create(CPU6809()).disasm(read(pc), read(pc+1), read(pc+2), read(pc+3), read(pc+4), pc);
  }
}

///

class SerialIOVisualizer {

  textarea : HTMLTextAreaElement;
  //vlist: VirtualTextScroller;
  device: HasSerialIO;
  lastOutCount = -1;
  lastInCount = -1;

  constructor(parentElement: HTMLElement, device: HasSerialIO) {
    this.device = device;
    this.textarea = document.createElement("textarea");
    this.textarea.classList.add('transcript');
    this.textarea.classList.add('transcript-style-2');
    this.textarea.style.display = 'none';
    parentElement.appendChild(this.textarea);
    /*
    this.vlist = new VirtualTextScroller(parentElement);
    this.vlist.create(parentElement, 1024, this.getMemoryLineAt.bind(this));
    this.vlist.maindiv.style.height = '8em';
    this.vlist.maindiv.style.overflow = 'clip';
    */
  }
  reset() {
    this.lastOutCount = 0;
    this.lastInCount = 0;
    this.textarea.style.display = 'none';
  }
  refresh() {
    var lastop = '';
    if (this.device.serialOut.length != this.lastOutCount) {
      var s = '';
      for (var ev of this.device.serialOut) {
        if (lastop != ev.op) {
          if (s != '') s += '\n';
          if (ev.op === 'read') s += '<< ';
          else if (ev.op === 'write') s += '>> ';
          lastop = ev.op;
        }
        if (ev.value == 10) { s += '\u21b5'; lastop = ''; }
        else { s += byteToASCII(ev.value); }
      }
      this.textarea.value = s;
      this.lastOutCount = this.device.serialOut.length;
      this.textarea.style.display = 'block';
    }
  }
}
