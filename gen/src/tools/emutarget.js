"use strict";
// Unified headless driver for the emulators in this codebase.
//
// A *Platform* (src/platform/*) is the full object the IDE drives: it owns its
// own video/audio/timer and implements the Platform interface in
// common/baseplatform.ts. Most platforms are built on a *Machine* (src/machine/*),
// the bare emulation core made of the interfaces in common/devices.ts -- Bus,
// FrameBased, HasCPU, VideoSource and friends.
//
// EmuTarget drives a Platform headlessly, reaching through to its Machine when
// there is one for the things only the core can do (exact traps, single
// stepping, the probe). The CLI and the run-script interpreter never have to
// ask which of those a target supports; the capability sniffing lives here.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmuTarget = exports.DEFAULT_MAX_FRAMES = exports.DISASSEMBLERS = void 0;
exports.loadPlatform = loadPlatform;
exports.installNodeMocks = installNodeMocks;
const baseplatform_1 = require("../common/baseplatform");
const disasm6502_1 = require("../common/cpu/disasm6502");
const disasmz80_1 = require("../common/cpu/disasmz80");
const disasmSM83_1 = require("../common/cpu/disasmSM83");
const disasmF8_1 = require("../common/cpu/disasmF8");
const disasmHuC6280_1 = require("../common/cpu/disasmHuC6280");
const _6809_1 = require("../common/cpu/6809");
const emu_1 = require("../common/emu");
const emu = __importStar(require("../common/emu"));
const util_1 = require("../common/util");
const nodemock_1 = require("./nodemock");
/** Disassemblers, keyed by the `arch` name used in the worker's platform params. */
exports.DISASSEMBLERS = {
    '6502': (a, r) => (0, disasm6502_1.disassemble6502)(a, r(a), r(a + 1), r(a + 2)),
    'huc6280': (a, r) => (0, disasmHuC6280_1.disassembleHuC6280)(a, r(a), r(a + 1), r(a + 2)),
    'z80': (a, r) => (0, disasmz80_1.disassembleZ80)(a, r(a), r(a + 1), r(a + 2), r(a + 3)),
    'gbz80': (a, r) => (0, disasmSM83_1.disassembleSM83)(a, r(a), r(a + 1), r(a + 2)),
    'sm83': (a, r) => (0, disasmSM83_1.disassembleSM83)(a, r(a), r(a + 1), r(a + 2)),
    'f8': (a, r) => (0, disasmF8_1.disassembleF8)(a, r(a), r(a + 1), r(a + 2)),
    '6809': (a, r) => Object.create((0, _6809_1.CPU6809)()).disasm(r(a), r(a + 1), r(a + 2), r(a + 3), r(a + 4), a),
};
/** CPU class name -> arch, for the platforms that don't implement disassemble(). */
const CPU_ARCH = {
    'MOS6502': '6502', 'HuC6280': 'huc6280',
    'Z80': 'z80', 'ZilogZ80': 'z80',
    'SM83': 'sm83', 'F8CPU': 'f8', 'CPU6809': '6809',
};
/** Work out which disassembler a CPU object wants. */
function archOf(cpu) {
    var _a;
    const arch = CPU_ARCH[(_a = cpu === null || cpu === void 0 ? void 0 : cpu.constructor) === null || _a === void 0 ? void 0 : _a.name];
    if (arch)
        return arch;
    // CPU6809 is a factory returning a plain object, so it has no class name to
    // match; it is also the only CPU here that carries its own disassembler.
    if (typeof (cpu === null || cpu === void 0 ? void 0 : cpu.disasm) === 'function')
        return '6809';
    return '';
}
// Frames to run before giving up on a `runUntil` predicate that never fires.
exports.DEFAULT_MAX_FRAMES = 1000;
// Upper bound on clocks in one instruction, so stepping can't spin forever.
const MAX_CYCLES_PER_INSN = 64;
/**
 * Headless stand-ins for RasterVideo/VectorVideo/AnimationTimer. Platform
 * modules pick these up because Platform.start() reads them off the emu module.
 */
function installHeadlessVideo() {
    let pixels = null;
    let params = null;
    emu.RasterVideo = function (_el, width, height) {
        const buffer = new ArrayBuffer(width * height * 4);
        const datau8 = new Uint8Array(buffer);
        const datau32 = new Uint32Array(buffer);
        params = { width, height };
        pixels = datau32;
        this.create = function () { this.width = width; this.height = height; };
        this.setKeyboardEvents = function () { };
        this.getFrameData = function () { return datau32; };
        this.getImageData = function () { return { data: datau8, width, height }; };
        this.updateFrame = function () { };
        this.clearRect = function () { };
        this.setupMouseEvents = function () { };
        this.canvas = this;
        this.getContext = function () { return this; };
        this.fillRect = function () { };
        this.fillStyle = '';
        this.putImageData = function () { };
        this.style = {};
    };
    emu.VectorVideo = function () {
        this.create = function () { this.drawops = 0; };
        this.setKeyboardEvents = function () { };
        this.clear = function () { };
        this.drawLine = function () { this.drawops++; };
    };
    emu.AnimationTimer = function () {
        this.running = false;
        this.start = function () { };
        this.stop = function () { };
        this.isRunning = function () { return this.running; };
    };
    return {
        get() {
            return pixels && params ? { pixels, width: params.width, height: params.height } : null;
        }
    };
}
class EmuTarget {
    constructor(id, platform) {
        this.id = id;
        this.platform = platform;
        this.frameCount = 0;
        this.video = installHeadlessVideo();
    }
    /**
     * The underlying Machine, if there is one. Platforms built on
     * BaseMachinePlatform expose theirs, which is what lets us stop mid-frame
     * through the TrapCondition the FrameBased interface already defines,
     * instead of guessing at cycle counts.
     */
    get machine() {
        return this.platform.machine || null;
    }
    async start() { await this.platform.start(); }
    reset() { this.platform.reset(); }
    loadROM(data, title = 'ROM') { this.platform.loadROM(title, data); }
    loadBIOS(data, title = 'BIOS') {
        if (!this.platform.loadBIOS)
            return false;
        this.platform.loadBIOS(title, data);
        return true;
    }
    read(addr) {
        if (this.platform.readAddress)
            return this.platform.readAddress(addr);
        const m = this.machine;
        if (m)
            return m.readConst ? m.readConst(addr) : m.read(addr);
        throw new Error(`platform '${this.id}' cannot read memory`);
    }
    getCPUState() {
        try {
            return this.platform.getCPUState ? this.platform.getCPUState() : null;
        }
        catch (e) {
            return null;
        }
    }
    getPC() {
        // Platforms may correct the PC (see debugPCDelta), so prefer getPC().
        try {
            if (this.platform.getPC)
                return this.platform.getPC();
        }
        catch (e) { }
        const s = this.getCPUState();
        return s ? s.PC : null;
    }
    disassemble(addr) {
        var _a;
        const read = (a) => this.read(a);
        try {
            if (this.platform.disassemble)
                return this.platform.disassemble(addr, read);
            // a few platforms leave it out; fall back to the machine's CPU
            const disasm = exports.DISASSEMBLERS[archOf((_a = this.machine) === null || _a === void 0 ? void 0 : _a.cpu)];
            return disasm ? disasm(addr, read) : null;
        }
        catch (e) {
            return null;
        }
    }
    setKeyInput(key, code, flags) {
        const target = this.machine || this.platform;
        if (typeof target.setKeyInput !== 'function') {
            throw new Error(`platform '${this.id}' does not accept key input`);
        }
        target.setKeyInput(key, code, flags);
    }
    connectProbe(probe) {
        const m = this.machine;
        if (!m || !(0, baseplatform_1.hasProbe)(m))
            return false;
        m.connectProbe(probe);
        return true;
    }
    getVideo() { return this.video.get(); }
    saveState() { return this.platform.saveState ? this.platform.saveState() : null; }
    getDebugInfo() {
        const state = this.saveState();
        const p = this.platform;
        if (!state || !(0, baseplatform_1.isDebuggable)(p) || !p.getDebugCategories)
            return [];
        const sections = [];
        for (const category of p.getDebugCategories() || []) {
            try {
                const text = p.getDebugInfo(category, state);
                if (text)
                    sections.push({ category, text });
            }
            catch (e) { /* a category that doesn't apply to this state */ }
        }
        return sections;
    }
    //// execution control, driven by what the target turns out to support
    /** True if execution can be stopped mid-frame at an exact instruction. */
    get supportsTrap() { return this.machine != null; }
    /** True if single instructions can be stepped. */
    get supportsStep() { return this.supportsTrap; }
    /**
     * A function that advances the CPU by the smallest amount the machine
     * supports -- one clock for ClockBased CPUs, one instruction for
     * InstructionBased ones -- without disturbing the frame loop. Null if the
     * machine only knows how to run whole frames.
     */
    clockStepper() {
        const m = this.machine;
        if (!m)
            return null;
        if (typeof m.advanceCPU === 'function')
            return () => m.advanceCPU(); // BasicHeadlessMachine
        if (typeof m.advanceFrameClock === 'function')
            return () => m.advanceFrameClock(null, 1); // WASM
        return null;
    }
    /**
     * Finish any partly-executed instruction, so getPC() names a real
     * instruction. Frames can end mid-instruction on clock-based CPUs.
     */
    settle() {
        const clock = this.clockStepper();
        if (!clock)
            return;
        for (let i = 0; i < MAX_CYCLES_PER_INSN && !this.isStable(); i++)
            clock();
    }
    advanceFrame(trap) {
        const m = this.machine;
        // With a trap we drive the Machine directly -- Platform.advance() only
        // honors traps registered as breakpoints, and installing/removing those
        // rewinds BaseDebugPlatform's saved state.
        if (trap && m) {
            m.advanceFrame(trap);
        }
        else {
            const p = this.platform;
            if (p.nextFrame)
                p.nextFrame();
            else if (p.advance)
                p.advance(false);
        }
        this.frameCount++;
    }
    isStable() {
        return this.machine ? this.machine.cpu.isStable() : true;
    }
    /** Execute exactly one instruction. Returns false if the target can't step. */
    stepInsn() {
        if (!this.machine)
            return false;
        const clock = this.clockStepper();
        if (clock) {
            this.settle(); // don't count an in-flight instruction as this step
            clock();
            for (let i = 0; i < MAX_CYCLES_PER_INSN && !this.isStable(); i++)
                clock();
            return true;
        }
        // No clock-level entry point: stop at the next instruction boundary via
        // the frame trap. This restarts the frame, so it is the last resort.
        let boundaries = 0;
        for (let frames = 0; frames < 2 && boundaries < 2; frames++) {
            this.advanceFrame(() => this.isStable() && ++boundaries >= 2);
        }
        return true;
    }
    /**
     * Run until `pred` is true, up to `maxFrames` frames. Exact to the
     * instruction on targets with a Machine; frame-granular otherwise.
     */
    runUntil(pred, maxFrames = exports.DEFAULT_MAX_FRAMES) {
        const start = this.frameCount;
        while (this.frameCount - start < maxFrames) {
            if (this.supportsTrap) {
                let hit = false;
                this.advanceFrame(() => (hit = this.isStable() && pred()));
                if (hit)
                    return true;
            }
            else {
                this.advanceFrame();
                if (pred())
                    return true;
            }
        }
        return false;
    }
    /** Run until the PC reaches one of `addrs`. */
    runToPC(addrs, maxFrames = exports.DEFAULT_MAX_FRAMES) {
        return this.runUntil(() => addrs.has(this.getPC()), maxFrames);
    }
}
exports.EmuTarget = EmuTarget;
/** Load a platform module by ID (e.g. "nes", "c64.wasm", "atari8-5200"). */
async function loadPlatform(platformId) {
    installNodeMocks();
    const baseId = (0, util_1.getRootBasePlatform)(platformId);
    await Promise.resolve(`${'../platform/' + baseId}`).then(s => __importStar(require(s)));
    const PlatformClass = emu_1.PLATFORMS[platformId] || emu_1.PLATFORMS[baseId];
    if (!PlatformClass) {
        throw new Error(`Platform '${platformId}' not found. Available: ${Object.keys(emu_1.PLATFORMS).sort().join(', ')}`);
    }
    return new EmuTarget(platformId, new PlatformClass(null));
}
let mocksInstalled = false;
/** Stub out the browser APIs that the platform modules expect. */
function installNodeMocks() {
    if (mocksInstalled)
        return;
    mocksInstalled = true;
    (0, nodemock_1.mockGlobals)();
    (0, nodemock_1.mockAudio)();
    (0, nodemock_1.mockFetch)();
    (0, nodemock_1.mockDOM)();
}
//# sourceMappingURL=emutarget.js.map