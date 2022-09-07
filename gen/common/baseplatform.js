"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Base6809MachinePlatform = exports.BaseZ80MachinePlatform = exports.Base6502MachinePlatform = exports.BaseMachinePlatform = exports.hasSerialIO = exports.hasBIOS = exports.hasProbe = exports.isRaster = exports.hasPaddleInput = exports.hasJoyInput = exports.hasKeyInput = exports.hasAudio = exports.hasVideo = exports.lookupSymbol = exports.dumpStackToString = exports.Base6809Platform = exports.getToolForFilename_6809 = exports.cpuStateToLongString_6809 = exports.getToolForFilename_z80 = exports.BaseZ80Platform = exports.cpuStateToLongString_Z80 = exports.getOpcodeMetadata_6502 = exports.cpuStateToLongString_6502 = exports.Base6502Platform = exports.getToolForFilename_6502 = exports.inspectSymbol = exports.BaseDebugPlatform = exports.BasePlatform = exports.BreakpointList = exports.isDebuggable = exports.DebugSymbols = void 0;
const emu_1 = require("./emu");
const util_1 = require("./util");
const disasm6502_1 = require("./cpu/disasm6502");
const disasmz80_1 = require("./cpu/disasmz80");
const ZilogZ80_1 = require("./cpu/ZilogZ80");
const audio_1 = require("./audio");
const probe_1 = require("./probe");
const wasmplatform_1 = require("./wasmplatform");
const _6809_1 = require("./cpu/6809");
const MOS6502_1 = require("./cpu/MOS6502");
;
;
class DebugSymbols {
    constructor(symbolmap, debuginfo) {
        this.symbolmap = symbolmap;
        this.debuginfo = debuginfo;
        this.addr2symbol = (0, util_1.invertMap)(symbolmap);
        //// TODO: shouldn't be necc.
        if (!this.addr2symbol[0x0])
            this.addr2symbol[0x0] = '$00'; // needed for ...
        this.addr2symbol[0x10000] = '__END__'; // ... dump memory to work
    }
}
exports.DebugSymbols = DebugSymbols;
function isDebuggable(arg) {
    return arg && typeof arg.getDebugCategories === 'function';
}
exports.isDebuggable = isDebuggable;
// for composite breakpoints w/ single debug function
class BreakpointList {
    constructor() {
        this.id2bp = {};
    }
    getDebugCondition() {
        if (Object.keys(this.id2bp).length == 0) {
            return null; // no breakpoints
        }
        else {
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
exports.BreakpointList = BreakpointList;
;
/////
class BasePlatform {
    constructor() {
        this.recorder = null;
        this.internalFiles = {};
    }
    setRecorder(recorder) {
        this.recorder = recorder;
    }
    updateRecorder() {
        // are we recording and do we need to save a frame?
        if (this.recorder && this.isRunning() && this.recorder.frameRequested()) {
            this.recorder.recordFrame(this.saveState());
        }
    }
    inspect(sym) {
        return inspectSymbol(this, sym);
    }
    getDebugTree() {
        var _a;
        var o = {};
        o.state = this.saveState();
        if ((_a = this.debugSymbols) === null || _a === void 0 ? void 0 : _a.debuginfo)
            o.debuginfo = this.debugSymbols.debuginfo;
        return o;
    }
    readFile(path) {
        return this.internalFiles[path];
    }
    writeFile(path, data) {
        this.internalFiles[path] = data;
        return true;
    }
}
exports.BasePlatform = BasePlatform;
class BaseDebugPlatform extends BasePlatform {
    constructor() {
        super(...arguments);
        this.debugSavedState = null;
        this.debugBreakState = null;
        this.debugTargetClock = 0;
        this.debugClock = 0;
        this.breakpoints = new BreakpointList();
        this.frameCount = 0;
    }
    setBreakpoint(id, cond) {
        if (cond) {
            this.breakpoints.id2bp[id] = { cond: cond };
            this.restartDebugging();
        }
        else {
            this.clearBreakpoint(id);
        }
    }
    clearBreakpoint(id) {
        delete this.breakpoints.id2bp[id];
    }
    hasBreakpoint(id) {
        return this.breakpoints.id2bp[id] != null;
    }
    getDebugCallback() {
        return this.breakpoints.getDebugCondition();
    }
    setupDebug(callback) {
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
    setDebugCondition(debugCond) {
        this.setBreakpoint('debug', debugCond);
    }
    resetDebugging() {
        if (this.debugSavedState) {
            this.loadState(this.debugSavedState);
        }
        else {
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
    nextFrame(novideo) {
        this.pollControls();
        this.updateRecorder();
        this.preFrame();
        var steps = this.advance(novideo);
        this.postFrame();
        return steps;
    }
    evalDebugCondition() {
        if (this.debugCallback && !this.debugBreakState) {
            this.debugCallback();
        }
    }
    wasBreakpointHit() {
        return this.debugBreakState != null;
    }
    breakpointHit(targetClock, reason) {
        console.log(this.debugTargetClock, targetClock, this.debugClock, this.isStable());
        this.debugTargetClock = targetClock;
        this.debugBreakState = this.saveState();
        console.log("Breakpoint at clk", this.debugClock, "PC", this.debugBreakState.c.PC.toString(16));
        this.pause();
        if (this.onBreakpointHit) {
            this.onBreakpointHit(this.debugBreakState, reason);
        }
    }
    haltAndCatchFire(reason) {
        this.breakpointHit(this.debugClock, reason);
    }
    runEval(evalfunc) {
        this.setDebugCondition(() => {
            if (++this.debugClock >= this.debugTargetClock && this.isStable()) {
                var cpuState = this.getCPUState();
                if (evalfunc(cpuState)) {
                    this.breakpointHit(this.debugClock);
                    return true;
                }
                else {
                    return false;
                }
            }
        });
    }
    runToPC(pc) {
        this.debugTargetClock++;
        this.runEval((c) => {
            return c.PC == pc;
        });
    }
    runUntilReturn() {
        var SP0 = this.getSP();
        this.runEval((c) => {
            return c.SP > SP0; // TODO: check for RTS/RET opcode
        });
    }
    runToFrameClock(clock) {
        this.restartDebugging();
        this.debugTargetClock = clock;
        this.runEval(() => { return true; });
    }
    step() {
        this.runToFrameClock(this.debugClock + 1);
    }
    stepBack() {
        var prevState;
        var prevClock;
        var clock0 = this.debugTargetClock;
        this.restartDebugging();
        this.debugTargetClock = clock0 - 25; // TODO: depends on CPU
        this.runEval((c) => {
            if (this.debugClock < clock0) {
                prevState = this.saveState();
                prevClock = this.debugClock;
                return false;
            }
            else {
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
        this.runEval(() => {
            return this.frameCount > frame0;
        });
    }
}
exports.BaseDebugPlatform = BaseDebugPlatform;
function inspectSymbol(platform, sym) {
    if (!platform.debugSymbols)
        return;
    var symmap = platform.debugSymbols.symbolmap;
    var addr2sym = platform.debugSymbols.addr2symbol;
    if (!symmap || !platform.readAddress)
        return null;
    var addr = symmap["_" + sym] || symmap[sym]; // look for C or asm symbol
    if (!(typeof addr == 'number'))
        return null;
    var b = platform.readAddress(addr);
    // don't show 2 bytes if there's a symbol at the next address
    if (addr2sym && addr2sym[addr + 1] != null) {
        return "$" + (0, util_1.hex)(addr, 4) + " = $" + (0, util_1.hex)(b, 2) + " (" + b + " decimal)"; // unsigned
    }
    else {
        let b2 = platform.readAddress(addr + 1);
        let w = b | (b2 << 8);
        return "$" + (0, util_1.hex)(addr, 4) + " = $" + (0, util_1.hex)(b, 2) + " $" + (0, util_1.hex)(b2, 2) + " (" + ((w << 16) >> 16) + " decimal)"; // signed
    }
}
exports.inspectSymbol = inspectSymbol;
////// 6502
function getToolForFilename_6502(fn) {
    if (fn.endsWith(".pla"))
        return "plasm";
    if (fn.endsWith(".c"))
        return "cc65";
    if (fn.endsWith(".h"))
        return "cc65";
    if (fn.endsWith(".s"))
        return "ca65";
    if (fn.endsWith(".ca65"))
        return "ca65";
    if (fn.endsWith(".dasm"))
        return "dasm";
    if (fn.endsWith(".acme"))
        return "acme";
    if (fn.endsWith(".wiz"))
        return "wiz";
    if (fn.endsWith(".ecs"))
        return "ecs";
    return "dasm"; // .a
}
exports.getToolForFilename_6502 = getToolForFilename_6502;
// TODO: can merge w/ Z80?
class Base6502Platform extends BaseDebugPlatform {
    constructor() {
        super(...arguments);
        // some platforms store their PC one byte before or after the first opcode
        // so we correct when saving and loading from state
        this.debugPCDelta = -1;
        this.getToolForFilename = getToolForFilename_6502;
    }
    fixPC(c) { c.PC = (c.PC + this.debugPCDelta) & 0xffff; return c; }
    unfixPC(c) { c.PC = (c.PC - this.debugPCDelta) & 0xffff; return c; }
    getSP() { return this.getCPUState().SP; }
    ;
    getPC() { return this.getCPUState().PC; }
    ;
    isStable() { return !this.getCPUState()['T']; }
    newCPU(membus) {
        var cpu = new MOS6502_1._MOS6502();
        cpu.connectBus(membus);
        return cpu;
    }
    getOpcodeMetadata(opcode, offset) {
        return getOpcodeMetadata_6502(opcode, offset);
    }
    getOriginPC() {
        return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
    }
    disassemble(pc, read) {
        return (0, disasm6502_1.disassemble6502)(pc, read(pc), read(pc + 1), read(pc + 2));
    }
    getDefaultExtension() { return ".a"; }
    ;
    getDebugCategories() {
        return ['CPU', 'ZPRAM', 'Stack'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'CPU': return cpuStateToLongString_6502(state.c);
            case 'ZPRAM': return (0, emu_1.dumpRAM)(state.b || state.ram, 0x0, 0x100);
            case 'Stack': return dumpStackToString(this, state.b || state.ram, 0x100, 0x1ff, 0x100 + state.c.SP, 0x20);
        }
    }
}
exports.Base6502Platform = Base6502Platform;
function cpuStateToLongString_6502(c) {
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
    return "PC " + (0, util_1.hex)(c.PC, 4) + "  " + decodeFlags(c) + "\n"
        + " A " + (0, util_1.hex)(c.A) + "     " + (c.R ? "" : "BUSY") + "\n"
        + " X " + (0, util_1.hex)(c.X) + "\n"
        + " Y " + (0, util_1.hex)(c.Y) + "     " + "SP " + (0, util_1.hex)(c.SP) + "\n";
}
exports.cpuStateToLongString_6502 = cpuStateToLongString_6502;
var OPMETA_6502 = {
    cycletime: [
        7, 6, 0, 8, 3, 3, 5, 5, 3, 2, 2, 2, 4, 4, 6, 6, 2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7, 6, 6, 0, 8, 3, 3, 5, 5, 4, 2, 2, 2, 4, 4, 6, 6, 2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7, 6, 6, 0, 8, 3, 3, 5, 5, 3, 2, 2, 2, 3, 4, 6, 6, 2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7, 6, 6, 0, 8, 3, 3, 5, 5, 4, 2, 2, 2, 5, 4, 6, 6, 2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7, 0, 6, 0, 6, 3, 3, 3, 3, 2, 0, 2, 0, 4, 4, 4, 4, 2, 6, 0, 0, 4, 4, 4, 4, 2, 5, 2, 0, 0, 5, 0, 0, 2, 6, 2, 6, 3, 3, 3, 3, 2, 2, 2, 0, 4, 4, 4, 4, 2, 5, 0, 5, 4, 4, 4, 4, 2, 4, 2, 0, 4, 4, 4, 4, 2, 6, 0, 8, 3, 3, 5, 5, 2, 2, 2, 2, 4, 4, 3, 6, 2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7, 2, 6, 0, 8, 3, 3, 5, 5, 2, 2, 2, 0, 4, 4, 6, 6, 2, 5, 0, 8, 4, 4, 6, 6, 2, 4, 0, 7, 4, 4, 7, 7
    ],
    extracycles: [
        0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1
    ],
    insnlengths: [
        1, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3, 2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3, 3, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3, 2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3, 1, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3, 2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3, 1, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3, 2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3, 0, 2, 0, 2, 2, 2, 2, 2, 1, 0, 1, 0, 3, 3, 3, 3, 2, 2, 0, 0, 2, 2, 2, 3, 1, 3, 1, 0, 0, 3, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 1, 0, 3, 3, 3, 3, 2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 1, 0, 3, 3, 3, 3, 2, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 2, 3, 3, 3, 3, 2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3, 2, 2, 0, 2, 2, 2, 2, 2, 1, 2, 1, 0, 3, 3, 3, 3, 2, 2, 0, 2, 2, 2, 2, 2, 1, 3, 0, 3, 3, 3, 3, 3
    ],
    validinsns: [
        1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 0, 3, 3, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, 3, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, 1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, 1, 2, 0, 0, 0, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, 0, 2, 0, 0, 2, 2, 2, 0, 1, 0, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 0, 3, 0, 0, 2, 2, 2, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 2, 2, 2, 0, 1, 3, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0, 2, 2, 0, 0, 2, 2, 2, 0, 1, 2, 1, 0, 3, 3, 3, 0, 2, 2, 0, 0, 0, 2, 2, 0, 1, 3, 0, 0, 0, 3, 3, 0
    ],
};
function getOpcodeMetadata_6502(opcode, address) {
    // TODO: more intelligent maximum cycles
    // TODO: must always be new object, b/c we might modify it
    return {
        opcode: opcode,
        minCycles: OPMETA_6502.cycletime[opcode],
        maxCycles: OPMETA_6502.cycletime[opcode] + OPMETA_6502.extracycles[opcode],
        insnlength: OPMETA_6502.insnlengths[opcode]
    };
}
exports.getOpcodeMetadata_6502 = getOpcodeMetadata_6502;
////// Z80
function cpuStateToLongString_Z80(c) {
    function decodeFlags(flags) {
        return (0, util_1.printFlags)(flags, ["S", "Z", , "H", , "V", "N", "C"], true);
    }
    return "PC " + (0, util_1.hex)(c.PC, 4) + "  " + decodeFlags(c.AF) + " " + (c.iff1 ? "I" : "-") + (c.iff2 ? "I" : "-") + "\n"
        + "SP " + (0, util_1.hex)(c.SP, 4) + "  IR " + (0, util_1.hex)(c.IR, 4) + "\n"
        + "IX " + (0, util_1.hex)(c.IX, 4) + "  IY " + (0, util_1.hex)(c.IY, 4) + "\n"
        + "AF " + (0, util_1.hex)(c.AF, 4) + "  BC " + (0, util_1.hex)(c.BC, 4) + "\n"
        + "DE " + (0, util_1.hex)(c.DE, 4) + "  HL " + (0, util_1.hex)(c.HL, 4) + "\n";
}
exports.cpuStateToLongString_Z80 = cpuStateToLongString_Z80;
class BaseZ80Platform extends BaseDebugPlatform {
    constructor() {
        super(...arguments);
        this.waitCycles = 0;
        this.getToolForFilename = getToolForFilename_z80;
    }
    newCPU(membus, iobus) {
        this._cpu = new ZilogZ80_1.Z80();
        this._cpu.connectMemoryBus(membus);
        this._cpu.connectIOBus(iobus);
        return this._cpu;
    }
    getPC() { return this._cpu.getPC(); }
    getSP() { return this._cpu.getSP(); }
    isStable() { return true; }
    // TODO: refactor other parts into here
    runCPU(cpu, cycles) {
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
    getDefaultExtension() { return ".c"; }
    ;
    // TODO: Z80 opcode metadata
    //this.getOpcodeMetadata = function() { }
    getDebugCategories() {
        return ['CPU', 'Stack'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'CPU': return cpuStateToLongString_Z80(state.c);
            case 'Stack': {
                var sp = (state.c.SP - 1) & 0xffff;
                var start = sp & 0xff00;
                var end = start + 0xff;
                if (sp == 0)
                    sp = 0x10000;
                console.log(sp, start, end);
                return dumpStackToString(this, [], start, end, sp, 0xcd);
            }
        }
    }
    disassemble(pc, read) {
        return (0, disasmz80_1.disassembleZ80)(pc, read(pc), read(pc + 1), read(pc + 2), read(pc + 3));
    }
}
exports.BaseZ80Platform = BaseZ80Platform;
function getToolForFilename_z80(fn) {
    if (fn.endsWith(".c"))
        return "sdcc";
    if (fn.endsWith(".h"))
        return "sdcc";
    if (fn.endsWith(".s"))
        return "sdasz80";
    if (fn.endsWith(".ns"))
        return "naken";
    if (fn.endsWith(".scc"))
        return "sccz80";
    if (fn.endsWith(".z"))
        return "zmac";
    if (fn.endsWith(".wiz"))
        return "wiz";
    return "zmac";
}
exports.getToolForFilename_z80 = getToolForFilename_z80;
////// 6809
function cpuStateToLongString_6809(c) {
    function decodeFlags(flags) {
        return (0, util_1.printFlags)(flags, ["E", "F", "H", "I", "N", "Z", "V", "C"], true);
    }
    return "PC " + (0, util_1.hex)(c.PC, 4) + "  " + decodeFlags(c.CC) + "\n"
        + "SP " + (0, util_1.hex)(c.SP, 4) + "\n"
        + "DP " + (0, util_1.hex)(c.DP, 2) + "\n"
        + " A " + (0, util_1.hex)(c.A, 2) + "\n"
        + " B " + (0, util_1.hex)(c.B, 2) + "\n"
        + " X " + (0, util_1.hex)(c.X, 4) + "\n"
        + " Y " + (0, util_1.hex)(c.Y, 4) + "\n"
        + " U " + (0, util_1.hex)(c.U, 4) + "\n";
}
exports.cpuStateToLongString_6809 = cpuStateToLongString_6809;
function getToolForFilename_6809(fn) {
    if (fn.endsWith(".c"))
        return "cmoc";
    if (fn.endsWith(".h"))
        return "cmoc";
    if (fn.endsWith(".xasm"))
        return "xasm6809";
    return "lwasm";
}
exports.getToolForFilename_6809 = getToolForFilename_6809;
class Base6809Platform extends BaseZ80Platform {
    constructor() {
        super(...arguments);
        //this.getOpcodeMetadata = function() { }
        this.getToolForFilename = getToolForFilename_6809;
    }
    newCPU(membus) {
        var cpu = Object.create((0, _6809_1.CPU6809)());
        cpu.init(membus.write, membus.read, 0);
        return cpu;
    }
    cpuStateToLongString(c) {
        return cpuStateToLongString_6809(c);
    }
    disassemble(pc, read) {
        // TODO: don't create new CPU
        return Object.create((0, _6809_1.CPU6809)()).disasm(read(pc), read(pc + 1), read(pc + 2), read(pc + 3), read(pc + 4), pc);
    }
    getDefaultExtension() { return ".asm"; }
    ;
    getDebugCategories() {
        return ['CPU', 'Stack'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'CPU': return cpuStateToLongString_6809(state.c);
            default: return super.getDebugInfo(category, state);
        }
    }
}
exports.Base6809Platform = Base6809Platform;
//TODO: how to get stack_end?
function dumpStackToString(platform, mem, start, end, sp, jsrop, bigendian) {
    var s = "";
    var nraw = 0;
    //s = dumpRAM(mem.slice(start,start+end+1), start, end-start+1);
    function read(addr) {
        if (addr < mem.length)
            return mem[addr];
        else
            return platform.readAddress(addr);
    }
    while (sp < end) {
        sp++;
        // see if there's a JSR on the stack here
        // TODO: make work with roms and memory maps
        var addr = read(sp) + read(sp + 1) * 256;
        if (bigendian) {
            addr = ((addr & 0xff) << 8) | ((addr & 0xff00) >> 8);
        }
        var jsrofs = jsrop == 0x20 ? -2 : -3; // 6502 vs Z80
        var opcode = read(addr + jsrofs); // might be out of bounds
        if (opcode == jsrop) { // JSR
            s += "\n$" + (0, util_1.hex)(sp) + ": ";
            s += (0, util_1.hex)(addr, 4) + " " + lookupSymbol(platform, addr, true);
            sp++;
            nraw = 0;
        }
        else {
            if (nraw == 0)
                s += "\n$" + (0, util_1.hex)(sp) + ": ";
            s += (0, util_1.hex)(read(sp)) + " ";
            if (++nraw == 8)
                nraw = 0;
        }
    }
    return s + "\n";
}
exports.dumpStackToString = dumpStackToString;
// TODO: slow, funky, uses global
function lookupSymbol(platform, addr, extra) {
    var start = addr;
    var addr2symbol = platform.debugSymbols && platform.debugSymbols.addr2symbol;
    while (addr2symbol && addr >= 0) {
        var sym = addr2symbol[addr];
        if (sym) { // return first symbol we find
            var sym = addr2symbol[addr];
            return extra ? (sym + " + $" + (0, util_1.hex)(start - addr)) : sym;
        }
        if (!extra)
            break;
        addr--;
    }
    return "";
}
exports.lookupSymbol = lookupSymbol;
function hasVideo(arg) {
    return typeof arg.connectVideo === 'function';
}
exports.hasVideo = hasVideo;
function hasAudio(arg) {
    return typeof arg.connectAudio === 'function';
}
exports.hasAudio = hasAudio;
function hasKeyInput(arg) {
    return typeof arg.setKeyInput === 'function';
}
exports.hasKeyInput = hasKeyInput;
function hasJoyInput(arg) {
    return typeof arg.setJoyInput === 'function';
}
exports.hasJoyInput = hasJoyInput;
function hasPaddleInput(arg) {
    return typeof arg.setPaddleInput === 'function';
}
exports.hasPaddleInput = hasPaddleInput;
function isRaster(arg) {
    return typeof arg.getRasterY === 'function';
}
exports.isRaster = isRaster;
function hasProbe(arg) {
    return typeof arg.connectProbe == 'function';
}
exports.hasProbe = hasProbe;
function hasBIOS(arg) {
    return typeof arg.loadBIOS == 'function';
}
exports.hasBIOS = hasBIOS;
function hasSerialIO(arg) {
    return typeof arg.connectSerialIO === 'function';
}
exports.hasSerialIO = hasSerialIO;
class BaseMachinePlatform extends BaseDebugPlatform {
    constructor(mainElement) {
        super();
        this.mainElement = mainElement;
    }
    reset() {
        this.machine.reset();
        if (this.serialVisualizer != null)
            this.serialVisualizer.reset();
    }
    loadState(s) { this.machine.loadState(s); }
    saveState() { return this.machine.saveState(); }
    getSP() { return this.machine.cpu.getSP(); }
    getPC() { return this.machine.cpu.getPC(); }
    isStable() { return this.machine.cpu.isStable(); }
    getCPUState() { return this.machine.cpu.saveState(); }
    loadControlsState(s) { this.machine.loadControlsState(s); }
    saveControlsState() { return this.machine.saveControlsState(); }
    async start() {
        this.machine = this.newMachine();
        const m = this.machine;
        // block on WASM loading
        if (m instanceof wasmplatform_1.BaseWASMMachine) {
            await m.loadWASM();
        }
        var videoFrequency;
        if (hasVideo(m)) {
            var vp = m.getVideoParams();
            this.video = new emu_1.RasterVideo(this.mainElement, vp.width, vp.height, { overscan: !!vp.overscan,
                rotate: vp.rotate | 0,
                aspect: vp.aspect });
            this.video.create();
            m.connectVideo(this.video.getFrameData());
            // TODO: support keyboard w/o video?
            if (hasKeyInput(m)) {
                this.video.setKeyboardEvents(m.setKeyInput.bind(m));
                this.poller = new emu_1.ControllerPoller(m.setKeyInput.bind(m));
            }
            videoFrequency = vp.videoFrequency;
        }
        this.timer = new emu_1.AnimationTimer(videoFrequency || 60, this.nextFrame.bind(this));
        if (hasAudio(m)) {
            var ap = m.getAudioParams();
            this.audio = new audio_1.SampledAudio(ap.sampleRate);
            this.audio.start();
            m.connectAudio(this.audio);
        }
        if (hasPaddleInput(m)) {
            this.video.setupMouseEvents();
        }
        if (hasProbe(m)) {
            this.probeRecorder = new probe_1.ProbeRecorder(m);
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
            }
            else {
                m.connectSerialIO(this.serialIOInterface);
            }
        }
    }
    loadROM(title, data) {
        this.machine.loadROM(data, title);
        this.reset();
    }
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
    advance(novideo) {
        let trap = this.getDebugCallback();
        var steps = this.machine.advanceFrame(trap);
        if (!novideo && this.video)
            this.video.updateFrame();
        if (!novideo && this.serialVisualizer)
            this.serialVisualizer.refresh();
        return steps;
    }
    advanceFrameClock(trap, step) {
        if (!(step > 0))
            return;
        if (this.machine instanceof wasmplatform_1.BaseWASMMachine) {
            return this.machine.advanceFrameClock(trap, step);
        }
        else {
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
        this.runEval(() => {
            if (this.getRasterScanline() > 0)
                flag = true;
            else
                return flag;
        });
    }
    // TODO: reset target clock counter
    getRasterScanline() {
        return isRaster(this.machine) && this.machine.getRasterY();
    }
    readAddress(addr) {
        return this.machine.read(addr);
    }
    getDebugCategories() {
        if (isDebuggable(this.machine))
            return this.machine.getDebugCategories();
    }
    getDebugInfo(category, state) {
        return isDebuggable(this.machine) && this.machine.getDebugInfo(category, state);
    }
}
exports.BaseMachinePlatform = BaseMachinePlatform;
// TODO: move debug info into CPU?
class Base6502MachinePlatform extends BaseMachinePlatform {
    constructor() {
        super(...arguments);
        this.getOpcodeMetadata = getOpcodeMetadata_6502;
        this.getToolForFilename = getToolForFilename_6502;
    }
    disassemble(pc, read) {
        return (0, disasm6502_1.disassemble6502)(pc, read(pc), read(pc + 1), read(pc + 2));
    }
    getDebugCategories() {
        if (isDebuggable(this.machine))
            return this.machine.getDebugCategories();
        else
            return ['CPU', 'ZPRAM', 'Stack'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'CPU': return cpuStateToLongString_6502(state.c);
            case 'ZPRAM': return (0, emu_1.dumpRAM)(state.b || state.ram, 0x0, 0x100);
            case 'Stack': return dumpStackToString(this, state.b || state.ram, 0x100, 0x1ff, 0x100 + state.c.SP, 0x20);
            default: return isDebuggable(this.machine) && this.machine.getDebugInfo(category, state);
        }
    }
}
exports.Base6502MachinePlatform = Base6502MachinePlatform;
class BaseZ80MachinePlatform extends BaseMachinePlatform {
    constructor() {
        super(...arguments);
        //getOpcodeMetadata     = getOpcodeMetadata_z80;
        this.getToolForFilename = getToolForFilename_z80;
    }
    getDebugCategories() {
        if (isDebuggable(this.machine))
            return this.machine.getDebugCategories();
        else
            return ['CPU', 'Stack'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'CPU': return cpuStateToLongString_Z80(state.c);
            case 'Stack': {
                var sp = (state.c.SP - 1) & 0xffff;
                var start = sp & 0xff00;
                var end = start + 0xff;
                if (sp == 0)
                    sp = 0x10000;
                return dumpStackToString(this, [], start, end, sp, 0xcd);
            }
            default: return isDebuggable(this.machine) && this.machine.getDebugInfo(category, state);
        }
    }
    disassemble(pc, read) {
        return (0, disasmz80_1.disassembleZ80)(pc, read(pc), read(pc + 1), read(pc + 2), read(pc + 3));
    }
}
exports.BaseZ80MachinePlatform = BaseZ80MachinePlatform;
class Base6809MachinePlatform extends BaseMachinePlatform {
    constructor() {
        super(...arguments);
        this.getToolForFilename = getToolForFilename_6809;
    }
    getDebugCategories() {
        if (isDebuggable(this.machine))
            return this.machine.getDebugCategories();
        else
            return ['CPU', 'Stack'];
    }
    getDebugInfo(category, state) {
        switch (category) {
            case 'CPU': return cpuStateToLongString_6809(state.c);
            case 'Stack': {
                var sp = (state.c.SP - 1) & 0xffff;
                var start = sp & 0xff00;
                var end = start + 0xff;
                if (sp == 0)
                    sp = 0x10000;
                return dumpStackToString(this, [], start, end, sp, 0x17, true);
            }
            default: return super.getDebugInfo(category, state);
        }
    }
    disassemble(pc, read) {
        // TODO: don't create new CPU
        return Object.create((0, _6809_1.CPU6809)()).disasm(read(pc), read(pc + 1), read(pc + 2), read(pc + 3), read(pc + 4), pc);
    }
}
exports.Base6809MachinePlatform = Base6809MachinePlatform;
///
class SerialIOVisualizer {
    constructor(parentElement, device) {
        this.lastOutCount = -1;
        this.lastInCount = -1;
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
                    if (s != '')
                        s += '\n';
                    if (ev.op === 'read')
                        s += '<< ';
                    else if (ev.op === 'write')
                        s += '>> ';
                    lastop = ev.op;
                }
                if (ev.value == 10) {
                    s += '\u21b5';
                    lastop = '';
                }
                else {
                    s += (0, util_1.byteToASCII)(ev.value);
                }
            }
            this.textarea.value = s;
            this.lastOutCount = this.device.serialOut.length;
            this.textarea.style.display = 'block';
        }
    }
}
//# sourceMappingURL=baseplatform.js.map