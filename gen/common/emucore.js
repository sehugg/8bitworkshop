"use strict";
// Unified headless driver for the emulators in this codebase.
//
// A *Platform* (src/platform/*) is the full object the IDE drives: it owns its
// own video/audio/timer and implements the Platform interface in
// common/baseplatform.ts. Most platforms are built on a *Machine* (src/machine/*),
// the bare emulation core made of the interfaces in common/devices.ts -- Bus,
// FrameBased, HasCPU, VideoSource and friends.
//
// EmuCore drives a Platform, reaching through to its Machine when there is
// one for the things only the core can do (exact traps, single stepping, the
// probe). The CLI and the run-script interpreter never have to ask which of
// those a target supports; the capability sniffing lives here.
//
// No DOM and no Node: start() swaps in headless video for the platform, and a
// host that already started the platform (the IDE) can wrap it without
// calling start(). The Node side (mocks, loading platform modules) is in
// src/tools/emutarget.ts.
//
// Execution goes through a History (common/history.ts) when the platform can
// save and restore its state: every frame is recorded, key input is logged,
// and the machine can be stepped backwards or moved to any recorded moment.
// Platforms that can't save state run frames directly and can't rewind.
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
exports.EmuCore = exports.DEFAULT_MAX_FRAMES = exports.DISASSEMBLERS = void 0;
const baseplatform_1 = require("./baseplatform");
const history_1 = require("./history");
const platformcore_1 = require("./platformcore");
const timeline_1 = require("./timeline");
const disasm6502_1 = require("./cpu/disasm6502");
const disasmz80_1 = require("./cpu/disasmz80");
const disasmSM83_1 = require("./cpu/disasmSM83");
const disasmF8_1 = require("./cpu/disasmF8");
const disasmHuC6280_1 = require("./cpu/disasmHuC6280");
const _6809_1 = require("./cpu/6809");
const emu = __importStar(require("./emu"));
function capturesVideo(p) {
    return typeof p.captureVideo === 'function';
}
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
/**
 * Headless stand-ins for RasterVideo/VectorVideo/AnimationTimer. Platform
 * modules pick these up because Platform.start() reads them off the emu module.
 */
function installHeadlessVideo() {
    // Platform.start() builds its video/timer by reading these classes off the
    // emu module, so we swap in headless stand-ins for the duration of start()
    // and put the real ones back afterwards. Leaving the stubs installed would
    // leak into every other module sharing the (cached) emu import -- which is
    // exactly what happens when mocha reuses a worker across test files.
    let pixels = null;
    let params = null;
    let frameRate = 60;
    // the handler a platform registers on its canvas; it's how the IDE
    // delivers keys, whether or not there's a Machine behind the platform
    let keyHandler = null;
    const setKeyboardEvents = function (callback) { keyHandler !== null && keyHandler !== void 0 ? keyHandler : (keyHandler = callback); };
    const RasterVideo = function (_el, width, height, options) {
        const buffer = new ArrayBuffer(width * height * 4);
        const datau8 = new Uint8Array(buffer);
        const datau32 = new Uint32Array(buffer);
        // the first one is the screen; later ones are debug views (nes nametables)
        const isScreen = !pixels;
        if (isScreen) {
            params = { width, height, rotate: options === null || options === void 0 ? void 0 : options.rotate, aspect: options === null || options === void 0 ? void 0 : options.aspect };
            pixels = datau32;
        }
        this.create = function () { this.width = width; this.height = height; };
        // verilog rotates at reset, when the design asks for it
        this.setRotate = function (rotate) { if (isScreen)
            params.rotate = rotate || undefined; };
        this.setKeyboardEvents = setKeyboardEvents;
        this.getFrameData = function () { return datau32; };
        this.getImageData = function () { return { data: datau8, width, height }; };
        // PCE (and other platforms) build their own ImageData from the canvas
        // context during start(), so hand out a real one
        this.createImageData = function (w, h) {
            if (w === width && h === height)
                return { data: datau8, width, height };
            return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
        };
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
    const VectorVideo = function () {
        this.create = function () { this.drawops = 0; };
        this.setKeyboardEvents = setKeyboardEvents;
        this.clear = function () { };
        this.drawLine = function () { this.drawops++; };
    };
    const AnimationTimer = function (fps) {
        if (fps > 0)
            frameRate = fps;
        this.running = false;
        this.start = function () { };
        this.stop = function () { };
        this.isRunning = function () { return this.running; };
    };
    const original = emu.setVideoClasses({ RasterVideo, VectorVideo, AnimationTimer });
    return {
        get() {
            return pixels && params ? Object.assign({ pixels }, params) : null;
        },
        get frameRate() { return frameRate; },
        get keyHandler() { return keyHandler; },
        restore() {
            emu.setVideoClasses(original);
        }
    };
}
class EmuCore {
    constructor(id, platform) {
        this.id = id;
        this.platform = platform;
        this.video = null;
        this.captured = null;
        this.recording = null;
        // the machine's state was changed from outside the recording
        this.recordingStale = true;
        this.input = null;
        this.probe = null;
        // frames run on a platform without a timeline
        this.untimedFrames = 0;
    }
    /** The recorded timeline, or null if the platform can't save its state. */
    get history() { return this.timeline; }
    get timeline() {
        if (this.recordingStale)
            this.startTimeline();
        return this.recording;
    }
    /** Frames run so far. Keeps counting across loadROM() and reset(). */
    get frameCount() {
        return this.timeline ? this.timeline.now().frame : this.untimedFrames;
    }
    /** Where the machine is: frames, and steps into the current frame. */
    now() {
        return this.timeline ? this.timeline.now() : (0, timeline_1.timestamp)(this.untimedFrames, 0);
    }
    /** True if the machine shows a recorded past rather than the present. */
    isInPast() {
        var _a;
        return !!((_a = this.timeline) === null || _a === void 0 ? void 0 : _a.isInPast());
    }
    /**
     * Start recording from the machine's current state, which was changed from
     * outside the timeline (start, a ROM or BIOS load, a reset). The past before
     * it is dropped: it can't be replayed into this state.
     */
    startTimeline() {
        var _a;
        this.recordingStale = false;
        const t = this.recording ? this.recording.now() : (0, timeline_1.timestamp)(this.untimedFrames, 0);
        if (!(0, platformcore_1.isRewindable)(this.platform)) {
            this.recording = null;
            this.input = null;
            this.untimedFrames = t.frame;
            return;
        }
        const core = (0, platformcore_1.createCore)(this.platform);
        // the new state starts a frame, which is the next one if we were mid-frame
        core.restore(core.snapshot(), (0, timeline_1.timestamp)(t.step === 0 ? t.frame : t.frame + 1, 0));
        if (this.probe)
            (_a = core.connectProbe) === null || _a === void 0 ? void 0 : _a.call(core, this.probe);
        this.input = new platformcore_1.PlatformFrameInput(this.platform, {
            now: () => core.now(),
            dispatchKey: (key, code, flags) => this.deliverKey(key, code, flags),
        });
        this.recording = new history_1.History(core, { input: this.input });
    }
    /**
     * The underlying Machine, if there is one. Platforms built on
     * BaseMachinePlatform expose theirs, which is what lets us stop mid-frame
     * through the TrapCondition the FrameBased interface already defines,
     * instead of guessing at cycle counts.
     */
    get machine() {
        // vcs keeps a stand-in `machine` object for the probe views; skip it
        const m = this.platform.machine;
        return m && typeof m.advanceFrame === 'function' ? m : null;
    }
    async start() {
        // start() is where platforms construct their video and timer, so install
        // the headless stand-ins just for that call, then restore the real classes.
        const headless = installHeadlessVideo();
        this.video = headless;
        try {
            await this.platform.start();
        }
        finally {
            headless.restore();
        }
        if (!headless.get() && capturesVideo(this.platform)) {
            this.captured = this.platform.captureVideo();
        }
        // BaseMachinePlatform starts its audio sink in start(), but a few platforms
        // (nes) only start it in resume(), which the headless driver never calls.
        // Start it here so sound sources produce samples either way.
        //
        // TODO: this is a stand-in for a proper lifecycle. EmuCore should own
        // resume()/pause() and call platform.resume()/pause(), and the CLI/extension
        // worker should drive platform state through them. Calling platform.resume()
        // as-is is not safe headless: x86 starts its own Emscripten loop, pce builds
        // a Web Audio context, vcs resumes Javatari/Stellerator. Do that refactor
        // with per-capability guards. Platforms that render through TSS MasterAudio
        // (vector, vectrex) still have no feedSample sink, so they stay silent here.
        const audio = this.platform.audio;
        if (audio && typeof audio.feedSample === 'function' && typeof audio.start === 'function') {
            try {
                audio.start();
            }
            catch (e) { /* not a SampledAudio sink */ }
        }
    }
    reset() {
        this.platform.reset();
        this.recordingStale = true;
    }
    /**
     * `data` is a ROM image, or whatever else the build produced (verilog's
     * compiled unit). Some platforms (verilog) load asynchronously; await this
     * to see their errors.
     */
    async loadROM(data, title = 'ROM') {
        await this.platform.loadROM(title, data);
        this.recordingStale = true;
    }
    /**
     * Project files the program reads at load time (verilog's $readmem), keyed
     * by the name the program uses. The IDE gets these from the open project.
     */
    setFileData(files) {
        this.platform.sourceFileFetch = (path) => files[path];
    }
    loadBIOS(data, title = 'BIOS') {
        if (!this.platform.loadBIOS)
            return false;
        this.platform.loadBIOS(title, data);
        this.recordingStale = true;
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
    get supportsWrite() { var _a; return typeof ((_a = this.machine) === null || _a === void 0 ? void 0 : _a.write) === 'function'; }
    /**
     * Write a byte through the machine's bus, as the CPU would (so an I/O
     * address does what a store there does). The recording can't replay
     * this, so it starts over from here.
     */
    write(addr, value) {
        const m = this.machine;
        if (!m)
            throw new Error(`platform '${this.id}' cannot write memory`);
        m.write(addr, value);
        this.recordingStale = true;
    }
    /** The platform's debug tree, or null if it has none. */
    getDebugTree() {
        return this.platform.getDebugTree ? this.platform.getDebugTree() : null;
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
    /**
     * The CPU, as a DISASSEMBLERS key, or '' if we can't tell: from the
     * machine's CPU, or else which base class the platform has (nes).
     */
    get arch() {
        var _a;
        const arch = archOf((_a = this.machine) === null || _a === void 0 ? void 0 : _a.cpu);
        if (arch)
            return arch;
        const p = this.platform;
        if (p instanceof baseplatform_1.Base6502Platform)
            return '6502';
        if (p instanceof baseplatform_1.Base6809Platform)
            return '6809';
        if (p instanceof baseplatform_1.BaseZ80Platform)
            return 'z80';
        return '';
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
    /**
     * Press or release a key. With a timeline, the event is logged and delivered
     * as the next frame starts, so a replay delivers it at the same moment. A
     * key pressed while showing the past makes that moment the present: the
     * recorded future is dropped.
     */
    setKeyInput(key, code, flags) {
        const deliver = this.keyReceiver();
        if (!this.timeline)
            return deliver(key, code, flags);
        if (this.timeline.isInPast())
            this.timeline.truncate();
        this.input.key(key, code, flags);
    }
    deliverKey(key, code, flags) {
        this.keyReceiver()(key, code, flags);
    }
    /** What takes key events: the platform's canvas handler, or the machine. */
    keyReceiver() {
        var _a;
        const handler = (_a = this.video) === null || _a === void 0 ? void 0 : _a.keyHandler;
        if (handler)
            return handler;
        const target = this.machine || this.platform;
        if (typeof target.setKeyInput !== 'function') {
            throw new Error(`platform '${this.id}' does not accept key input`);
        }
        return (key, code, flags) => target.setKeyInput(key, code, flags);
    }
    connectProbe(probe) {
        var _a;
        const m = this.machine;
        if (!m || !(0, baseplatform_1.hasProbe)(m))
            return false;
        this.probe = probe;
        // the core mutes the probe while it replays steps the probe already saw
        const core = (_a = this.timeline) === null || _a === void 0 ? void 0 : _a.core;
        if (core === null || core === void 0 ? void 0 : core.connectProbe)
            core.connectProbe(probe);
        else
            m.connectProbe(probe);
        return true;
    }
    getVideo() {
        var _a, _b, _c, _d;
        return (_d = (_b = (_a = this.captured) === null || _a === void 0 ? void 0 : _a.call(this)) !== null && _b !== void 0 ? _b : (_c = this.video) === null || _c === void 0 ? void 0 : _c.get()) !== null && _d !== void 0 ? _d : null;
    }
    /** Audio the platform produces, or null if it has none. */
    getAudioParams() {
        const a = this.platform.audio;
        // SampledAudio exposes sampleRate; a few platforms hold a raw SampleAudio
        // (nes), whose rate is the `sr` it records once start() has run. Platforms
        // with their own TSS MasterAudio report nothing here.
        const rate = a && (a.sampleRate || a.sr);
        if (!rate)
            return null;
        return { sampleRate: rate, stereo: false };
    }
    /** Frames per second the platform's timer asked for (60 if unknown). */
    get frameRate() { return this.video ? this.video.frameRate : 60; }
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
    /** True if the machine can be stepped backwards and moved around in time. */
    get supportsRewind() { return this.timeline != null; }
    /**
     * Run to the end of the current frame, or until `trap` returns true. The
     * trap sees every step from the current position on: a clock on a 6502 or
     * a WASM machine, an instruction elsewhere, a whole frame on a target
     * without a Machine. Returns true if the trap stopped the run.
     *
     * In the past, this replays the recorded future (with its input) rather
     * than recording a new one. A halt (KIL, a watchdog) is thrown as the
     * EmuHalt, with the machine parked just before it.
     */
    advanceFrame(trap) {
        const h = this.timeline;
        if (!h)
            return this.advanceUntimed(trap);
        const t = h.now();
        const r = h.isInPast() ? h.seek((0, timeline_1.timestamp)(t.frame + 1, 0), trap) : h.recordFrame(trap);
        if (r.halt)
            throw r.halt;
        return r.trapped;
    }
    advanceUntimed(trap) {
        const m = this.machine;
        let hit = false;
        // With a trap we drive the Machine directly -- Platform.advance() only
        // honors traps registered as breakpoints, and installing/removing those
        // rewinds BaseDebugPlatform's saved state.
        if (trap && m) {
            m.advanceFrame(() => (hit = hit || !!trap()));
        }
        else {
            const p = this.platform;
            if (p.nextFrame)
                p.nextFrame();
            else if (p.advance)
                p.advance(false);
            hit = !!(trap === null || trap === void 0 ? void 0 : trap());
        }
        this.untimedFrames++;
        return hit;
    }
    isStable() {
        return this.machine ? this.machine.cpu.isStable() : true;
    }
    /**
     * Run until `pred` is true at an instruction boundary, up to `maxFrames`
     * frames. `pred` is first asked about the current position. Exact to the
     * instruction on targets with a Machine; frame-granular otherwise.
     */
    runUntil(pred, maxFrames = exports.DEFAULT_MAX_FRAMES) {
        const trap = () => this.isStable() && pred();
        const start = this.frameCount;
        while (this.frameCount - start < maxFrames) {
            if (this.advanceFrame(trap))
                return true;
        }
        return false;
    }
    /**
     * Finish any partly-executed instruction, so getPC() names a real
     * instruction. Frames can end mid-instruction on clock-based CPUs.
     */
    settle() {
        if (!this.supportsStep || this.isStable())
            return;
        this.runUntil(() => true, 2);
    }
    /**
     * Execute `n` instructions, calling `each` before each one. Stops early,
     * returning false, if `each` returns true. Throws if the target can't step.
     */
    stepInsn(n = 1, each) {
        if (!this.supportsStep)
            throw new Error(`'${this.id}' does not support instruction stepping`);
        this.settle(); // don't count an in-flight instruction as a step
        let seen = 0;
        let stopped = false;
        // the first boundary is the current position, so n steps end at the n+1th
        this.runUntil(() => {
            if (seen++ === n)
                return true;
            if (each && each())
                return stopped = true;
            return false;
        });
        return !stopped;
    }
    /**
     * Go back `n` instructions, by replaying the recorded past. Returns false,
     * and stays put, if the recording doesn't reach back that far.
     */
    stepBack(n = 1) {
        const h = this.timeline;
        if (!h || !this.supportsStep)
            return false;
        const start = h.now();
        for (let i = 0; i < n; i++) {
            if (!this.stepBackUntil(() => true)) {
                h.seek(start);
                return false;
            }
        }
        return true;
    }
    /**
     * Go back to the last instruction boundary before now where `pred` holds.
     * Returns false, and stays put, if there is none in the recording.
     */
    stepBackUntil(pred) {
        const h = this.timeline;
        if (!h)
            throw new Error(`'${this.id}' cannot rewind`);
        const t = h.now();
        const test = () => this.isStable() && pred();
        // most searches end in this frame, so try it before the whole past
        const frameStart = (0, timeline_1.timestamp)(t.frame, 0);
        if ((0, timeline_1.compareTimestamps)(frameStart, h.first()) >= 0 && h.findLast(test, frameStart, t))
            return true;
        if (h.findLast(test, h.first(), t))
            return true;
        h.seek(t);
        return false;
    }
    /** Move to a recorded moment, past or present. Throws if it isn't recorded. */
    seek(t) {
        if (!this.timeline)
            throw new Error(`'${this.id}' cannot rewind`);
        const r = this.timeline.seek(t);
        if (r.halt)
            throw r.halt;
    }
    /**
     * Run backwards to the last moment `pred` held at an instruction boundary.
     * Returns false, and stays put, if it never held in the recording.
     */
    reverseRunUntil(pred) {
        const h = this.timeline;
        if (!h)
            throw new Error(`'${this.id}' cannot rewind`);
        const start = h.now();
        if (h.findLast(() => this.isStable() && pred(), h.first(), start))
            return true;
        h.seek(start);
        return false;
    }
    /** Run until the PC reaches one of `addrs`. */
    runToPC(addrs, maxFrames = exports.DEFAULT_MAX_FRAMES) {
        return this.runUntil(() => addrs.has(this.getPC()), maxFrames);
    }
}
exports.EmuCore = EmuCore;
//# sourceMappingURL=emucore.js.map