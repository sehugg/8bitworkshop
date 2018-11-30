
import { RAM, RasterVideo, dumpRAM } from "./emu";
import { hex, printFlags, invertMap } from "./util";
import { CodeAnalyzer } from "./analysis";
import { disassemble6502 } from "./cpu/disasm6502";
import { disassembleZ80 } from "./cpu/disasmz80";

declare var Z80_fast, jt, CPU6809;

export interface OpcodeMetadata {
  minCycles: number;
  maxCycles: number;
  insnlength: number;
  opcode: number;
}

export interface CpuState {
  PC:number;
  EPC?:number; // effective PC (for bankswitching)
  T?:number;
  o?:number;/*opcode*/
  SP?:number
  /*
  A:number, X:number, Y:number, SP:number, R:boolean,
  N,V,D,Z,C:boolean*/
};
export interface EmuState {
  c?:CpuState,	// CPU state
  b?:Uint8Array|number[], 	// RAM (TODO: not for vcs, support Uint8Array)
  o?:{},				// verilog
  T?:number,		// verilog
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
  symbolmap : SymbolMap;				// symbol -> address
  addr2symbol : AddrSymbolMap;	// address -> symbol

  constructor(symbolmap : SymbolMap) {
    this.symbolmap = symbolmap;
    this.addr2symbol = invertMap(symbolmap);
    if (!this.addr2symbol[0x0]) this.addr2symbol[0x0] = '__START__'; // needed for ...
    this.addr2symbol[0x10000] = '__END__'; // ... dump memory to work
  }
}

export interface Platform {
  start() : void;
  reset() : void;
  isRunning() : boolean;
  getToolForFilename(s:string) : string;
  getDefaultExtension() : string;
  getPresets() : Preset[];
  pause() : void;
  resume() : void;
  loadROM(title:string, rom:any); // TODO: Uint8Array

  loadState?(state : EmuState) : void;
  saveState?() : EmuState;
  loadControlsState?(state : EmuControlsState) : void;
  saveControlsState?() : EmuControlsState;

  inspect?(ident:string) : string;
  disassemble?(addr:number, readfn:(addr:number)=>number) : DisasmLine;
  readAddress?(addr:number) : number;
  setFrameRate?(fps:number) : void;
  getFrameRate?() : number;

  isDebugging() : boolean;
  setupDebug?(debugfn : (state)=>void) : void;
  clearDebug?() : void;
  step?() : void;
  runToVsync?() : void;
  runToPC?(pc:number) : void;
  runUntilReturn?() : void;
  stepBack?() : void;
  runEval?(evalfunc/* : DebugEvalCondition*/) : void;

  getOpcodeMetadata?(opcode:number, offset:number) : OpcodeMetadata; //TODO
  getSP?() : number;
  getOriginPC?() : number;
  newCodeAnalyzer?() : CodeAnalyzer;

  getDebugCategories?() : string[];
  getDebugInfo?(category:string, state:EmuState) : string;

  setRecorder?(recorder : EmuRecorder) : void;
  advance?(novideo? : boolean) : void;
  showHelp?(tool:string, ident?:string) : void;
  resize?() : void;

  debugSymbols? : DebugSymbols;
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
}

type DebugCondition = () => boolean;
type DebugEvalCondition = (c:CpuState) => boolean;
type BreakpointCallback = (EmuState) => void;

export interface EmuRecorder {
  frameRequested() : boolean;
  recordFrame(state : EmuState);
}

/////

export abstract class BasePlatform {
  recorder : EmuRecorder = null;
  debugSymbols : DebugSymbols;

  abstract loadState(state : EmuState) : void;
  abstract saveState() : EmuState;
  abstract pause() : void;
  abstract resume() : void;
  abstract advance(novideo? : boolean) : void;

  setRecorder(recorder : EmuRecorder) : void {
    this.recorder = recorder;
  }
  updateRecorder() {
    // are we recording and do we need to save a frame?
    if (this.recorder && (<Platform><any>this).isRunning() && this.recorder.frameRequested()) {
      this.recorder.recordFrame(this.saveState());
    }
  }
}

export abstract class BaseDebugPlatform extends BasePlatform {
  onBreakpointHit : BreakpointCallback;
  debugCondition : DebugCondition;
  debugSavedState : EmuState = null;
  debugBreakState : EmuState = null;
  debugTargetClock : number = 0;
  debugClock : number = 0;

  abstract getCPUState() : CpuState;
  abstract readAddress(addr:number) : number;

  getDebugCallback() : DebugCondition {
    return this.debugCondition;
  }
  isDebugging() : boolean {
    return this.debugCondition != null;
  }
  setupDebug(callback : BreakpointCallback) {
    this.onBreakpointHit = callback;
  }
  clearDebug() {
    this.debugSavedState = null;
    this.debugBreakState = null;
    this.debugTargetClock = -1;
    this.debugClock = 0;
    this.onBreakpointHit = null;
    this.debugCondition = null;
  }
  setDebugCondition(debugCond : DebugCondition) {
    if (this.debugSavedState) {
      this.loadState(this.debugSavedState);
    } else {
      this.debugSavedState = this.saveState();
    }
    this.debugClock = 0;
    this.debugCondition = debugCond;
    this.debugBreakState = null;
    this.resume();
  }
  preFrame() {
    this.updateRecorder();
  }
  postFrame() {
  }
  nextFrame(novideo : boolean) {
    this.preFrame();
    this.advance(novideo);
    this.postFrame();
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

  debugPCDelta = -1;

  evalDebugCondition() {
    if (this.debugCondition && !this.debugBreakState) {
      this.debugCondition();
    }
  }
  postFrame() {
    // save state every frame and rewind debug clocks
    var debugging = this.debugCondition && !this.debugBreakState;
    if (debugging) {
      this.debugSavedState = this.saveState();
      this.debugTargetClock -= this.debugClock;
      this.debugClock = 0;
    }
  }
  breakpointHit(targetClock : number) {
    this.debugTargetClock = targetClock;
    this.debugBreakState = this.saveState();
    this.debugBreakState.c.PC = (this.debugBreakState.c.PC + this.debugPCDelta) & 0xffff;
    console.log("Breakpoint at clk", this.debugClock, "PC", this.debugBreakState.c.PC.toString(16));
    this.pause();
    if (this.onBreakpointHit) {
      this.onBreakpointHit(this.debugBreakState);
    }
  }
  runEval(evalfunc : DebugEvalCondition) {
    this.setDebugCondition( () => {
      if (this.debugClock++ > this.debugTargetClock) {
        var cpuState = this.getCPUState();
        cpuState.PC = (cpuState.PC + this.debugPCDelta) & 0xffff;
        if (evalfunc(cpuState)) {
          this.breakpointHit(this.debugClock-1);
          return true;
        } else {
          return false;
        }
      }
    });
  }
  step() {
    var previousPC = -1;
    this.setDebugCondition( () => {
      //console.log(this.debugClock, this.debugTargetClock, this.getCPUState().PC, this.getCPUState());
      if (this.debugClock++ >= this.debugTargetClock) {
        var thisState = this.getCPUState();
        if (previousPC < 0) {
          previousPC = thisState.PC;
        } else {
          // doesn't work w/ endless loops
          if (thisState.PC != previousPC && thisState.T == 0) {
            this.breakpointHit(this.debugClock-1);
            return true;
          }
        }
      }
      return false;
    });
  }
  stepBack() {
    var prevState;
    var prevClock;
    this.setDebugCondition( () => {
      if (this.debugClock++ >= this.debugTargetClock && prevState) {
        this.loadState(prevState);
        this.breakpointHit(prevClock-1);
        return true;
      } else if (this.debugClock > this.debugTargetClock-10 && this.debugClock < this.debugTargetClock) {
        if (this.getCPUState().T == 0) {
          prevState = this.saveState();
          prevClock = this.debugClock;
        }
      }
      return false;
    });
  }

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

  runUntilReturn() {
    var depth = 1;
    this.runEval( (c:CpuState) => {
      if (depth <= 0 && c.T == 0)
        return true;
      if (c.o == 0x20)
        depth++;
      else if (c.o == 0x60 || c.o == 0x40)
        --depth;
      return false;
    });
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
      case 'ZPRAM': return dumpRAM(state.b, 0x0, 0x100);
      case 'Stack': return dumpStackToString(<Platform><any>this, state.b, 0x100, 0x1ff, 0x100+state.c.SP, 0x20);
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
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c.AF) + "\n"
       + "SP " + hex(c.SP,4) + "  IR " + hex(c.IR,4) + "\n"
       + "IX " + hex(c.IX,4) + "  IY " + hex(c.IY,4) + "\n"
       + "AF " + hex(c.AF,4) + "  BC " + hex(c.BC,4) + "\n"
       + "DE " + hex(c.DE,4) + "  HL " + hex(c.HL,4) + "\n"
       ;
}

export function BusProbe(bus : MemoryBus) {
  var active = false;
  var callback;
  this.activate = function(_callback) {
    active = true;
    callback = _callback;
  }
  this.deactivate = function() {
    active = false;
    callback = null;
  }
  this.read = function(a) {
    if (active) {
      callback(a);
    }
    return bus.read(a);
  }
  this.write = function(a,v) {
    if (active) {
      callback(a,v);
    }
    bus.write(a,v);
  }
}

export abstract class BaseZ80Platform extends BaseDebugPlatform {

  _cpu;
  probe;

  newCPU(membus : MemoryBus, iobus : MemoryBus) {
    this.probe = new BusProbe(membus);
    this._cpu = Z80_fast({
     display: {},
     memory: this.probe,
     ioBus: iobus
   });
   return this._cpu;
  }

  getProbe() { return this.probe; }
  getPC() { return this._cpu.getPC(); }
  getSP() { return this._cpu.getSP(); }

  // TODO: refactor other parts into here
  runCPU(cpu, cycles) {
    this._cpu = cpu; // TODO?
    if (this.wasBreakpointHit())
      return 0;
    var debugCond = this.getDebugCallback();
    var targetTstates = cpu.getTstates() + cycles;
    try {
      if (debugCond) { // || trace) {
        while (cpu.getTstates() < targetTstates) {
          if (debugCond && debugCond()) {
            debugCond = null;
            break;
          }
          cpu.runFrame(cpu.getTstates() + 1);
        }
      } else {
        cpu.runFrame(targetTstates);
      }
    } catch (e) {
      // TODO: show alert w/ error msg
      this.breakpointHit(cpu.getTstates());
    }
    return cpu.getTstates() - targetTstates;
  }
  requestInterrupt(cpu, data) {
    if (!this.wasBreakpointHit())
      cpu.requestInterrupt(data);
  }
  postFrame() {
    if (this.debugCondition && !this.debugBreakState) {
      this.debugSavedState = this.saveState();
      if (this.debugTargetClock > 0)
        this.debugTargetClock -= this.debugSavedState.c.T;
      this.debugSavedState.c.T = 0;
      this.loadState(this.debugSavedState);
    }
  }
  breakpointHit(targetClock : number) {
    this.debugTargetClock = targetClock;
    this.debugBreakState = this.saveState();
    console.log("Breakpoint at clk", this.debugBreakState.c.T, "PC", this.debugBreakState.c.PC.toString(16));
    this.pause();
    if (this.onBreakpointHit) {
      this.onBreakpointHit(this.debugBreakState);
    }
  }
  wasBreakpointHit() : boolean {
    return this.debugBreakState != null;
  }
  // TODO: lower bound of clock value
  step() {
    this.setDebugCondition( () => {
      var cpuState = this.getCPUState();
      if (cpuState.T > this.debugTargetClock) {
        this.breakpointHit(cpuState.T);
        return true;
      }
      return false;
    });
  }
  stepBack() {
    var prevState;
    var prevClock;
    this.setDebugCondition( () => {
      var cpuState = this.getCPUState();
      var debugClock = cpuState.T;
      if (debugClock >= this.debugTargetClock && prevState) {
        this.loadState(prevState);
        this.breakpointHit(prevClock);
        return true;
      } else if (debugClock > this.debugTargetClock-20 && debugClock < this.debugTargetClock) {
        prevState = this.saveState();
        prevClock = debugClock;
      }
      return false;
    });
  }
  runEval(evalfunc : DebugEvalCondition) {
    this.setDebugCondition( () => {
      var cpuState = this.getCPUState();
      if (cpuState.T > this.debugTargetClock) {
        if (evalfunc(cpuState)) {
          this.breakpointHit(cpuState.T);
          return true;
        }
      }
      return false;
    });
  }
  runUntilReturn() {
    var depth = 1;
    this.runEval( (c) => {
      if (depth <= 0)
        return true;
      var op = this.readAddress(c.PC);
      if (op == 0xcd) // CALL
        depth++;
      else if (op == 0xc0 || op == 0xc8 || op == 0xc9 || op == 0xd0) // RET (TODO?)
        --depth;
      return false;
    });
  }
  runToVsync() {
    this.runEval((c) => { return c['intp']; });
  }
  getToolForFilename = getToolForFilename_z80;
  getDefaultExtension() { return ".c"; };
  // TODO
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

export function getToolForFilename_z80(fn) {
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
       + " A " + hex(c.A,2) + "\n"
       + " B " + hex(c.B,2) + "\n"
       + " X " + hex(c.X,4) + "\n"
       + " Y " + hex(c.Y,4) + "\n"
       + " U " + hex(c.U,4) + "\n"
       ;
}

export abstract class Base6809Platform extends BaseZ80Platform {

  newCPU(membus : MemoryBus) {
    var cpu = new CPU6809();
    cpu.init(membus.write, membus.read, 0);
    return cpu;
  }

	runUntilReturn() {
    var depth = 1;
    this.runEval((c:CpuState) => {
      if (depth <= 0)
        return true;
			var op = this.readAddress(c.PC);
      // TODO: 6809 opcodes
      if (op == 0x9d || op == 0xad || op == 0xbd) // CALL
        depth++;
      else if (op == 0x3b || op == 0x39) // RET
        --depth;
      return false;
    });
  }

	cpuStateToLongString(c:CpuState) {
    return cpuStateToLongString_6809(c);
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    // TODO: don't create new CPU
    return new CPU6809().disasm(read(pc), read(pc+1), read(pc+2), read(pc+3), read(pc+4), pc);
  }
  getDefaultExtension() { return ".asm"; };
  //this.getOpcodeMetadata = function() { }
}

/// MAME SUPPORT

declare var FS, ENV, Module; // mame emscripten

export abstract class BaseMAMEPlatform {

  loaded = false;
  preinitted = false;
  romfn;
  romdata;
  video;
  preload_files;
  running = false;
  console_vars : {[varname:string]:string[]} = {};
  console_varname;
  initluavars = false;
  luadebugscript;
  js_lua_string;
  onBreakpointHit;
  mainElement;

  constructor(mainElement) {
    this.mainElement = mainElement;
  }

  luareset() {
    this.console_vars = {};
  }

  // http://docs.mamedev.org/techspecs/luaengine.html
  luacall(s) {
    this.console_varname = null;
    //Module.ccall('_Z13js_lua_stringPKc', 'void', ['string'], [s+""]);
    if (!this.js_lua_string) this.js_lua_string = Module.cwrap('_Z13js_lua_stringPKc', 'void', ['string']);
    this.js_lua_string(s || "");
  }

  pause() {
    if (this.loaded && this.running) {
      this.luacall('emu.pause()');
      this.running = false;
    }
  }

  resume() {
    if (this.loaded && !this.running) { // TODO
      this.luacall('emu.unpause()');
      this.running = true;
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
    if (!s) return;
    if (s.startsWith(">>>")) {
      this.console_varname = s.length > 3 ? s.slice(3) : null;
      if (this.console_varname) this.console_vars[this.console_varname] = [];
    } else if (this.console_varname) {
      this.console_vars[this.console_varname].push(s);
      if (this.console_varname == 'debug_stopped') {
        var debugSaveState = this.preserveState();
        this.pause();
        if (this.onBreakpointHit) {
          this.onBreakpointHit(debugSaveState);
        }
      }
    } else {
      console.log(s);
    }
  }

  startModule(mainElement, opts) {
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
        if (romfn)
          FS.writeFile(romfn, romdata, {encoding:'binary'});
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
      oReq2.send();
    }
    // start loading script
    $.when(fetch_lua, fetch_cfg, fetch_bios, fetch_wasm).done( () => {
      var script = document.createElement('script');
      script.src = 'mame/' + opts.jsfile;
      document.getElementsByTagName('head')[0].appendChild(script);
      console.log("created script element");
    });
  }

  loadROMFile(data) {
    this.romdata = data;
    if (this.preinitted && this.romfn) {
      FS.writeFile(this.romfn, data, {encoding:'binary'});
    }
  }

  loadRegion(region, data) {
    if (this.loaded) {
      //this.luacall('cart=manager:machine().images["cart"]\nprint(cart:filename())\ncart:load("' + romfn + '")\n');
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

  preserveState() {
    var state = {c:{}};
    for (var k in this.console_vars) {
      if (k.startsWith("cpu_")) {
        var v = parseInt(this.console_vars[k][0]);
        state.c[k.slice(4)] = v;
      }
    }
    // TODO: memory?
    return state;
  }

/*
  saveState() {
    this.luareset();
    this.luacall('mamedbg.printstate()');
    return this.preserveState();
  }
*/
  initlua() {
    if (!this.initluavars) {
      this.luacall(this.luadebugscript);
      this.luacall('mamedbg.init()')
      this.initluavars = true;
    }
  }

  readAddress(a) {
    this.initlua();
    this.luacall('print(">>>v"); print(mem:read_u8(' + a + '))');
    return parseInt(this.console_vars.v[0]);
  }

  // DEBUGGING SUPPORT

  clearDebug() {
    this.onBreakpointHit = null;
  }
  getDebugCallback() {
    return this.onBreakpointHit;// TODO?
  }
  isDebugging() : boolean {
    return this.onBreakpointHit != null;
  }
  setupDebug(callback) {
    if (this.loaded) { // TODO?
      this.initlua();
      this.luareset();
    }
    this.onBreakpointHit = callback;
  }
  runToPC(pc) {
    this.luacall('mamedbg.runTo(' + pc + ')');
    this.resume();
  }
  runToVsync() {
    this.luacall('mamedbg.runToVsync()');
    this.resume();
  }
  runUntilReturn() {
    this.luacall('mamedbg.runUntilReturn()');
    this.resume();
  }
  step() {
    this.luacall('mamedbg.step()');
    this.resume();
  }
  // TODO: other than z80
  cpuStateToLongString(c) {
    if (c.HL)
      return cpuStateToLongString_Z80(c);
    else
      return null; // TODO
  }
}

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
    var jsrofs = (jsrop == 0xcd) ? -3 : -2;
    var opcode = read(addr + jsrofs); // might be out of bounds
    if (opcode == jsrop) { // JSR
      s += "\n$" + hex(sp) + ": ";
      s += hex(addr,4) + " " + lookupSymbol(platform, addr);
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

export function lookupSymbol(platform:Platform, addr:number) {
  var start = addr;
  var foundsym;
  var addr2symbol = platform.debugSymbols && platform.debugSymbols.addr2symbol;
  while (addr2symbol && addr >= 0) {
    var sym = addr2symbol[addr];
    if (sym && sym.startsWith('_')) { // return first C symbol we find
      return addr2symbol[addr] + " + " + (start-addr);
    } else if (sym && !foundsym) { // cache first non-C symbol found
      foundsym = sym;
    }
    addr--;
  }
  return foundsym || "";
}

