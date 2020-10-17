
import { RAM, RasterVideo, KeyFlags, dumpRAM, AnimationTimer, setKeyboardFromMap, padBytes, ControllerPoller } from "./emu";
import { hex, printFlags, invertMap, getBasePlatform } from "./util";
import { CodeAnalyzer } from "./analysis";
import { Segment, FileData } from "./workertypes";
import { disassemble6502 } from "./cpu/disasm6502";
import { disassembleZ80 } from "./cpu/disasmz80";
import { Z80 } from "./cpu/ZilogZ80";

declare var jt, CPU6809;

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
    return typeof arg.getDebugCategories === 'function';
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
  getPresets() : Preset[];
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
  showHelp?(tool:string, ident?:string) : void;
  resize?() : void;

  getRasterScanline?() : number;
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
    return this.saveState();
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
  restartDebugging() {
    if (this.debugSavedState) {
      this.loadState(this.debugSavedState);
    } else {
      this.debugSavedState = this.saveState();
    }
    this.debugClock = 0;
    this.debugCallback = this.getDebugCallback();
    this.debugBreakState = null;
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
    var cpu = new jt.M6502();
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

export function getToolForFilename_z80(fn) : string {
  if (fn.endsWith(".c")) return "sdcc";
  if (fn.endsWith(".h")) return "sdcc";
  if (fn.endsWith(".s")) return "sdasz80";
  if (fn.endsWith(".ns")) return "naken";
  if (fn.endsWith(".scc")) return "sccz80";
  if (fn.endsWith(".z")) return "zmac";
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
    var cpu = new CPU6809();
    cpu.init(membus.write, membus.read, 0);
    return cpu;
  }

  cpuStateToLongString(c:CpuState) {
    return cpuStateToLongString_6809(c);
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    // TODO: don't create new CPU
    return new CPU6809().disasm(read(pc), read(pc+1), read(pc+2), read(pc+3), read(pc+4), pc);
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

/// MAME SUPPORT

declare var FS, ENV, Module; // mame emscripten

export abstract class BaseMAMEPlatform {

  loaded : boolean = false;
  preinitted : boolean = false;
  started : boolean = false;
  romfn : string;
  romdata : Uint8Array;
  video;
  running = false;
  initluavars : boolean = false;
  luadebugscript : string;
  js_lua_string;
  onBreakpointHit;
  mainElement : HTMLElement;
  timer : AnimationTimer;

  constructor(mainElement) {
    this.mainElement = mainElement;
    this.timer = new AnimationTimer(20, this.poll.bind(this));
  }

  // http://docs.mamedev.org/techspecs/luaengine.html
  luacall(s:string) : string {
    if (!this.js_lua_string) this.js_lua_string = Module.cwrap('_Z13js_lua_stringPKc', 'string', ['string']);
    return this.js_lua_string(s || "");
  }

  _pause() {
    this.running = false;
    this.timer.stop();
  }
  pause() {
    if (this.loaded && this.running) {
      this.luacall('emu.pause()');
      this._pause();
    }
  }

  _resume() {
    this.luacall('emu.unpause()');
    this.running = true;
    this.timer.start();
  }
  resume() {
    if (this.loaded && !this.running) { // TODO
      this._resume();
    }
  }

  reset() {
    if (this.loaded) {
      this.luacall('manager:machine():soft_reset()');
      this.running = true;
      this.initluavars = false;
    }
  }

  isRunning() {
    return this.running;
  }

  bufferConsoleOutput(s) {
    if (typeof s !== 'string') return;
    console.log(s);
  }

  startModule(mainElement, opts) {
    this.started = true;
    var romfn = this.romfn = this.romfn || opts.romfn;
    var romdata = this.romdata = this.romdata || opts.romdata || new RAM(opts.romsize).mem;
    // create canvas
    var video = this.video = new RasterVideo(this.mainElement, opts.width, opts.height);
    video.create();
    $(video.canvas).attr('id','canvas');
    // load asm.js module
    console.log("loading", opts.jsfile);
    var modargs = [opts.driver,
      '-debug',
      '-debugger', 'none',
      '-verbose', '-window', '-nokeepaspect',
      '-resolution', video.canvas.width+'x'+video.canvas.height
    ];
    if (romfn) modargs.push('-cart', romfn);
    window['JSMESS'] = {};
    window['Module'] = {
      arguments: modargs,
      screenIsReadOnly: true,
      print: this.bufferConsoleOutput,
      canvas:video.canvas,
      doNotCaptureKeyboard:true,
      keyboardListeningElement:video.canvas,
      preInit: () => {
        console.log("loading FS");
        ENV.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT = 'canvas';
        if (opts.cfgfile) {
          FS.mkdir('/cfg');
          FS.writeFile('/cfg/' + opts.cfgfile, opts.cfgdata, {encoding:'utf8'});
        }
        if (opts.biosfile) {
          FS.mkdir('/roms');
          FS.mkdir('/roms/' + opts.driver);
          FS.writeFile('/roms/' + opts.biosfile, opts.biosdata, {encoding:'binary'});
        }
        FS.mkdir('/emulator');
        if (romfn) {
          FS.writeFile(romfn, romdata, {encoding:'binary'});
        }
        //FS.writeFile('/debug.ini', 'debugger none\n', {encoding:'utf8'});
        if (opts.preInit) {
          opts.preInit(self);
        }
        this.preinitted = true;
      },
      preRun: [
        () => {
          $(video.canvas).click((e) =>{
            video.canvas.focus();
          });
          this.loaded = true;
          console.log("about to run...");
        }
      ]
    };
    // preload files
    // TODO: ensure loaded
    var fetch_cfg, fetch_lua;
    var fetch_bios = $.Deferred();
    var fetch_wasm = $.Deferred();
    // fetch config file
    if (opts.cfgfile) {
      fetch_cfg = $.get('mame/cfg/' + opts.cfgfile, (data) => {
        opts.cfgdata = data;
        console.log("loaded " + opts.cfgfile);
      }, 'text');
    }
    // fetch BIOS file
    if (opts.biosfile) {
      var oReq1 = new XMLHttpRequest();
      oReq1.open("GET", 'mame/roms/' + opts.biosfile, true);
      oReq1.responseType = "arraybuffer";
      oReq1.onload = (oEvent) => {
        opts.biosdata = new Uint8Array(oReq1.response);
        console.log("loaded " + opts.biosfile); // + " (" + oEvent.total + " bytes)");
        fetch_bios.resolve();
      };
      oReq1.ontimeout = function (oEvent) {
        throw Error("Timeout loading " + opts.biosfile);
      }
      oReq1.send();
    } else {
      fetch_bios.resolve();
    }
    // load debugger Lua script
    fetch_lua = $.get('mame/debugger.lua', (data) => {
      this.luadebugscript = data;
      console.log("loaded debugger.lua");
    }, 'text');
    // load WASM
    {
      var oReq2 = new XMLHttpRequest();
      oReq2.open("GET", 'mame/' + opts.jsfile.replace('.js','.wasm'), true);
      oReq2.responseType = "arraybuffer";
      oReq2.onload = (oEvent) => {
        console.log("loaded WASM file");
        window['Module'].wasmBinary = new Uint8Array(oReq2.response);
        fetch_wasm.resolve();
      };
      oReq2.ontimeout = function (oEvent) {
        throw Error("Timeout loading " + opts.jsfile);
      }
      oReq2.send();
    }
    // start loading script
    $.when(fetch_lua, fetch_cfg, fetch_bios, fetch_wasm).done( () => {
      var script = document.createElement('script');
      script.src = 'mame/' + opts.jsfile;
      document.getElementsByTagName('head')[0].appendChild(script);
      console.log("created script element");
    });
    // for debugging via browser console
    window['mamelua'] = (s:string) => {
      this.initlua();
      return this.luacall(s);
    };
  }

  loadROMFile(data) {
    this.romdata = data;
    if (this.preinitted && this.romfn) {
      FS.writeFile(this.romfn, data, {encoding:'binary'});
    }
  }

  loadRegion(region, data) {
    if (this.loaded && data.length > 0) {
      //this.luacall('cart=manager:machine().images["cart"]\nprint(cart:filename())\ncart:load("' + region + '")\n');
      var s = 'rgn = manager:machine():memory().regions["' + region + '"]\n';
      //s += 'print(rgn.size)\n';
      for (var i=0; i<data.length; i+=4) {
        var v = data[i] + (data[i+1]<<8) + (data[i+2]<<16) + (data[i+3]<<24);
        s += 'rgn:write_u32(' + i + ',' + v + ')\n'; // TODO: endian?
      }
      this.luacall(s);
      this.reset();
    }
  }

  // DEBUGGING SUPPORT
  
  initlua() {
    if (!this.initluavars) {
      this.luacall(this.luadebugscript);
      this.luacall('mamedbg.init()')
      this.initluavars = true;
    }
  }
  
  readAddress(a:number) : number {
    this.initlua();
    return parseInt(this.luacall('return mem:read_u8(' + a + ')'));
  }
  
  getCPUReg(reg:string) {
    if (!this.loaded) return 0; // TODO
    this.initlua();
    return parseInt(this.luacall('return cpu.state.'+reg+'.value'));
  }
  
  getPC() : number {
    return this.getCPUReg('PC');
  }

  getSP() : number {
    return this.getCPUReg('SP');
  }

  isStable() 	 { return true; }
  
  getCPUState()  {
    return {
      PC:this.getPC(),
      SP:this.getSP(),
      A:this.getCPUReg('A'),
      X:this.getCPUReg('X'),
      Y:this.getCPUReg('Y'),
      //flags:this.getCPUReg('CURFLAGS'),
    };
  }
  
  grabState(expr:string) {
    this.initlua();
    return {
      c:this.getCPUState(),
      buf:this.luacall("return string.tohex(" + expr + ")")
    }
  }
  
  saveState() {
    return this.grabState("manager:machine():buffer_save()");
  }

  loadState(state) {
    this.initlua();
    return this.luacall("manager:machine():buffer_load(string.fromhex('" + state.buf + "'))");
  }

  poll() {
    if (this.onBreakpointHit && this.luacall("return tostring(mamedbg.is_stopped())") == 'true') {
      this._pause();
      //this.luacall("manager:machine():buffer_load(lastBreakState)");
      var state = this.grabState("lastBreakState");
      this.onBreakpointHit(state);
    }
  }
  clearDebug() {
    this.onBreakpointHit = null;
    if (this.loaded) {
      this.initlua();
      this.luacall('mamedbg.reset()');
    }
  }
  getDebugCallback() {
    return this.onBreakpointHit;// TODO?
  }
  setupDebug(callback) {
    this.onBreakpointHit = callback;
  }
  debugcmd(s) {
    this.initlua()
    this.luacall(s);
    this._resume();
  }
  runToPC(pc) {
    this.debugcmd('mamedbg.runTo(' + pc + ')');
  }
  runToVsync() {
    this.debugcmd('mamedbg.runToVsync()');
  }
  runUntilReturn() {
    this.debugcmd('mamedbg.runUntilReturn()');
  }
  // TODO
  runEval() {
    this.reset();
    this.step();
  }
  step() {
    this.debugcmd('mamedbg.step()');
  }
  getDebugCategories() {
    return ['CPU'];
  }
  getDebugInfo(category:string, state:EmuState) : string {
    switch (category) {
      case 'CPU':   return this.cpuStateToLongString(state.c);
    }
  }
  // TODO: other than z80
  cpuStateToLongString(c) {
    if (c.HL)
      return cpuStateToLongString_Z80(c);
    else
      return cpuStateToLongString_6502(c); // TODO
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    // TODO: z80
    return disassemble6502(pc, read(pc), read(pc+1), read(pc+2));
  }
}

//TODO: how to get stack_end?
export function dumpStackToString(platform:Platform, mem:Uint8Array|number[], start:number, end:number, sp:number, jsrop:number) : string {
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

import { Bus, Resettable, FrameBased, VideoSource, SampledAudioSource, AcceptsROM, AcceptsBIOS, AcceptsKeyInput, SavesState, SavesInputState, HasCPU, TrapCondition, CPU, HasSerialIO, SerialIOInterface } from "./devices";
import { Probeable, RasterFrameBased, AcceptsPaddleInput, SampledAudioSink, ProbeAll, NullProbe } from "./devices";
import { SampledAudio } from "./audio";
import { ProbeRecorder } from "./recorder";

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
    this.machine = this.newMachine();
  }

  reset()        { this.machine.reset(); }
  loadState(s)   { this.machine.loadState(s); }
  saveState()    { return this.machine.saveState(); }
  getSP()        { return this.machine.cpu.getSP(); }
  getPC()        { return this.machine.cpu.getPC(); }
  isStable() 	 { return this.machine.cpu.isStable(); }
  getCPUState()  { return this.machine.cpu.saveState(); }
  loadControlsState(s)   { this.machine.loadControlsState(s); }
  saveControlsState()    { return this.machine.saveControlsState(); }
  
  start() {
    const m = this.machine;
    var videoFrequency;
    if (hasVideo(m)) {
      var vp = m.getVideoParams();
      this.video = new RasterVideo(this.mainElement, vp.width, vp.height, {overscan:!!vp.overscan,rotate:vp.rotate|0});
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
    if (hasSerialIO(m) && this.serialIOInterface) {
      m.connectSerialIO(this.serialIOInterface);
    }
  }
  
  loadROM(title, data) {
    this.machine.loadROM(data);
    this.reset();
  }

  loadBIOS : (title, data) => void; // only set if hasBIOS() is true

  serialIOInterface : SerialIOInterface; // set if hasSerialIO() is true

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
    var steps = this.machine.advanceFrame(this.getDebugCallback());
    if (!novideo && this.video) this.video.updateFrame();
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
    // i guess for runToVsync()?
    if (this.probeRecorder) {
      this.probeRecorder.singleFrame = true;
    }
  }
  // so probe views stick around TODO: must be a better way?
  runToVsync() {
    if (this.probeRecorder) {
      this.probeRecorder.clear();
      this.probeRecorder.singleFrame = false;
    }
    super.runToVsync();
  }

// TODO: reset target clock counter
  getRasterScanline() {
    return isRaster(this.machine) && this.machine.getRasterY();
  }

  readAddress(addr : number) : number {
    return this.machine.read(addr);
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
        console.log(sp,start,end);
        return dumpStackToString(<Platform><any>this, [], start, end, sp, 0xcd);
      }
      default: return isDebuggable(this.machine) && this.machine.getDebugInfo(category, state);
    }
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    return disassembleZ80(pc, read(pc), read(pc+1), read(pc+2), read(pc+3));
  }

}

// WASM Support
// TODO: detangle from c64

export abstract class BaseWASMMachine {
  prefix : string;
  instance : WebAssembly.Instance;
  exports : any;
  sys : number;
  pixel_dest : Uint32Array;
  pixel_src : Uint32Array;
  stateptr : number;
  statearr : Uint8Array;
  cpustateptr : number;
  cpustatearr : Uint8Array;
  ctrlstateptr : number;
  ctrlstatearr : Uint8Array;
  cpu : CPU;
  romptr : number;
  romlen : number;
  romarr : Uint8Array;
  biosptr : number;
  biosarr : Uint8Array;
  audio : SampledAudioSink;
  audioarr : Float32Array;
  probe : ProbeAll;

  abstract getCPUState() : CpuState;

  constructor(prefix: string) {
    this.prefix = prefix;
    var self = this;
    this.cpu = {
      getPC: self.getPC.bind(self),
      getSP: self.getSP.bind(self),
      isStable: self.isStable.bind(self),
      reset: self.reset.bind(self),
      saveState: () => {
        return self.getCPUState();
      },
      loadState: () => {
        console.log("loadState not implemented")
      },
      connectMemoryBus() {
        console.log("connectMemoryBus not implemented")
      },
    }
  }
  async loadWASM() {
    // fetch WASM
    var wasmResponse = await fetch('res/'+this.prefix+'.wasm');
    var wasmBinary = await wasmResponse.arrayBuffer();
    var wasmCompiled = await WebAssembly.compile(wasmBinary);
    var wasmResult = await WebAssembly.instantiate(wasmCompiled);
    this.instance = wasmResult;
    this.exports = wasmResult.exports;
    this.exports.memory.grow(64); // TODO: need more when probing?
    // fetch BIOS
    var biosResponse = await fetch('res/'+this.prefix+'.bios');
    var biosBinary = await biosResponse.arrayBuffer();
    this.biosptr = this.exports.malloc(biosBinary.byteLength);
    this.biosarr = new Uint8Array(this.exports.memory.buffer, this.biosptr, biosBinary.byteLength);
    this.loadBIOS(new Uint8Array(biosBinary));
    // init machine instance
    this.sys = this.exports.machine_init(this.biosptr);
    console.log('machine_init', this.sys);
    // create state buffers
    var statesize = this.exports.machine_get_state_size();
    this.stateptr = this.exports.malloc(statesize);
    this.statearr = new Uint8Array(this.exports.memory.buffer, this.stateptr, statesize);
    var ctrlstatesize = this.exports.machine_get_controls_state_size();
    this.ctrlstateptr = this.exports.malloc(ctrlstatesize);
    this.ctrlstatearr = new Uint8Array(this.exports.memory.buffer, this.ctrlstateptr, ctrlstatesize);
    var cpustatesize = this.exports.machine_get_cpu_state_size();
    this.cpustateptr = this.exports.malloc(cpustatesize);
    this.cpustatearr = new Uint8Array(this.exports.memory.buffer, this.cpustateptr, cpustatesize);
    // create audio buffer
    var sampbufsize = 4096*4;
    this.audioarr = new Float32Array(this.exports.memory.buffer, this.exports.machine_get_sample_buffer(), sampbufsize);
    // enable c64 joystick map to arrow keys (TODO)
    //this.exports.c64_set_joystick_type(this.sys, 1);
  }
  getPC() : number {
    return this.exports.machine_cpu_get_pc(this.sys);
  }
  getSP() : number {
    return this.exports.machine_cpu_get_sp(this.sys);
  }
  isStable() : boolean {
    return this.exports.machine_cpu_is_stable(this.sys);
  }
  loadROM(rom: Uint8Array) {
    if (!this.romptr) {
      this.romptr = this.exports.malloc(0x10000);
      this.romarr = new Uint8Array(this.exports.memory.buffer, this.romptr, 0x10000);
    }
    this.romarr.set(rom);
    this.romlen = rom.length;
    this.reset();
  }
  // TODO: can't load after machine_init
  loadBIOS(srcArray: Uint8Array) {
    this.biosarr.set(srcArray);
  }
  reset() {
    this.exports.machine_reset(this.sys);
  }
  /* TODO: we don't need this because c64_exec does this?
  pollControls() {
    this.exports.machine_start_frame(this.sys);
  }
  */
  read(address: number) : number {
    return this.exports.machine_mem_read(this.sys, address & 0xffff);
  }
  readConst(address: number) : number {
    return this.exports.machine_mem_read(this.sys, address & 0xffff);
  }
  write(address: number, value: number) : void {
    this.exports.machine_mem_write(this.sys, address & 0xffff, value & 0xff);
  }
  getAudioParams() {
    return {sampleRate:44100, stereo:false};
  }
  connectVideo(pixels:Uint32Array) : void {
    this.pixel_dest = pixels;
    // save video pointer
    var pixbuf = this.exports.machine_get_pixel_buffer(this.sys);
    this.pixel_src = new Uint32Array(this.exports.memory.buffer, pixbuf, pixels.length);
    console.log(pixbuf, pixels.length);
  }
  syncVideo() {
    if (this.pixel_dest != null) {
      this.pixel_dest.set(this.pixel_src);
    }
  }
  // assume controls buffer is smaller than cpu buffer
  saveControlsState() : any {
    //console.log(1, this.romptr, this.romlen, this.ctrlstateptr, this.romarr.slice(0,4), this.ctrlstatearr.slice(0,4));
    this.exports.machine_save_controls_state(this.sys, this.ctrlstateptr);
    //console.log(2, this.romptr, this.romlen, this.ctrlstateptr, this.romarr.slice(0,4), this.ctrlstatearr.slice(0,4));
    return { controls:this.ctrlstatearr.slice(0) }
  }
  loadControlsState(state) : void {
    this.ctrlstatearr.set(state.controls);
    this.exports.machine_load_controls_state(this.sys, this.ctrlstateptr);
  }
  connectAudio(audio : SampledAudioSink) : void {
    this.audio = audio;
  }
  syncAudio() {
    if (this.audio != null) {
      var n = this.exports.machine_get_sample_count();
      for (var i=0; i<n; i++) {
        this.audio.feedSample(this.audioarr[i], 1);
      }
    }
  }
  // TODO: tick might advance 1 instruction
  advanceFrameClock(trap, cpf:number) : number {
    var i : number;
    if (trap) {
      for (i=0; i<cpf; i++) {
        if (trap()) {
          break;
        }
        this.exports.machine_tick(this.sys);
      }
    } else {
      this.exports.machine_exec(this.sys, cpf);
      i = cpf;
    }
    this.syncVideo();
    this.syncAudio();
    return i;
  }
  copyProbeData() {
    if (this.probe && !(this.probe instanceof NullProbe)) {
      var datalen = this.exports.machine_get_probe_buffer_size();
      var dataaddr = this.exports.machine_get_probe_buffer_address();
      // TODO: more efficient way to put into probe
      var databuf = new Uint32Array(this.exports.memory.buffer, dataaddr, datalen);
      this.probe.logNewFrame(); // TODO: machine should do this
      this.probe.addLogBuffer(databuf);
    }
  }
  connectProbe(probe: ProbeAll): void {
    this.probe = probe;
  }
}

