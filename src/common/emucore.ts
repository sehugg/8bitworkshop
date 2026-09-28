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

import {
  CpuState, DisasmLine, EmuState, Machine, Platform, hasProbe, isDebuggable,
} from "./baseplatform";
import { ProbeAll, SampledAudioParams, TrapCondition } from "./devices";
import { History } from "./history";
import { createCore, isRewindable, PlatformFrameInput } from "./platformcore";
import { compareTimestamps, Timestamp, timestamp } from "./timeline";
import { FileData } from "./workertypes";
import { disassemble6502 } from "./cpu/disasm6502";
import { disassembleZ80 } from "./cpu/disasmz80";
import { disassembleSM83 } from "./cpu/disasmSM83";
import { disassembleF8 } from "./cpu/disasmF8";
import { disassembleHuC6280 } from "./cpu/disasmHuC6280";
import { CPU6809 } from "./cpu/6809";
import * as emu from "./emu";

export interface VideoOutput {
  pixels: Uint32Array;
  width: number;
  height: number;
  /** display rotation in degrees (RasterVideo's `rotate` option) */
  rotate?: number;
  /** display aspect ratio, if not width/height */
  aspect?: number;
}

/** A platform that draws its own screen (vcs) hands EmuCore its frames this way. */
interface CapturesVideo {
  captureVideo(): () => VideoOutput | null;
}
function capturesVideo(p: any): p is CapturesVideo {
  return typeof p.captureVideo === 'function';
}

export interface DebugSection {
  category: string;
  text: string;
}

/** Disassemblers, keyed by the `arch` name used in the worker's platform params. */
export const DISASSEMBLERS: { [arch: string]: (addr: number, read: (a: number) => number) => DisasmLine } = {
  '6502': (a, r) => disassemble6502(a, r(a), r(a + 1), r(a + 2)),
  'huc6280': (a, r) => disassembleHuC6280(a, r(a), r(a + 1), r(a + 2)),
  'z80': (a, r) => disassembleZ80(a, r(a), r(a + 1), r(a + 2), r(a + 3)),
  'gbz80': (a, r) => disassembleSM83(a, r(a), r(a + 1), r(a + 2)),
  'sm83': (a, r) => disassembleSM83(a, r(a), r(a + 1), r(a + 2)),
  'f8': (a, r) => disassembleF8(a, r(a), r(a + 1), r(a + 2)),
  '6809': (a, r) => Object.create(CPU6809()).disasm(r(a), r(a + 1), r(a + 2), r(a + 3), r(a + 4), a),
};

/** CPU class name -> arch, for the platforms that don't implement disassemble(). */
const CPU_ARCH: { [cls: string]: string } = {
  'MOS6502': '6502', 'HuC6280': 'huc6280',
  'Z80': 'z80', 'ZilogZ80': 'z80',
  'SM83': 'sm83', 'F8CPU': 'f8', 'CPU6809': '6809',
};

/** Work out which disassembler a CPU object wants. */
function archOf(cpu: any): string {
  const arch = CPU_ARCH[cpu?.constructor?.name];
  if (arch) return arch;
  // CPU6809 is a factory returning a plain object, so it has no class name to
  // match; it is also the only CPU here that carries its own disassembler.
  if (typeof cpu?.disasm === 'function') return '6809';
  return '';
}

// Frames to run before giving up on a `runUntil` predicate that never fires.
export const DEFAULT_MAX_FRAMES = 1000;

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
  let pixels: Uint32Array | null = null;
  let params: { width: number, height: number, rotate?: number, aspect?: number } | null = null;
  let frameRate = 60;
  // the handler a platform registers on its canvas; it's how the IDE
  // delivers keys, whether or not there's a Machine behind the platform
  let keyHandler: ((key: number, code: number, flags: number) => void) | null = null;
  const setKeyboardEvents = function (callback) { keyHandler ??= callback; };
  const RasterVideo: any = function (_el: any, width: number, height: number, options?: { rotate?: number, aspect?: number }) {
    const buffer = new ArrayBuffer(width * height * 4);
    const datau8 = new Uint8Array(buffer);
    const datau32 = new Uint32Array(buffer);
    // the first one is the screen; later ones are debug views (nes nametables)
    const isScreen = !pixels;
    if (isScreen) {
      params = { width, height, rotate: options?.rotate, aspect: options?.aspect };
      pixels = datau32;
    }
    this.create = function () { this.width = width; this.height = height; };
    // verilog rotates at reset, when the design asks for it
    this.setRotate = function (rotate: number) { if (isScreen) params.rotate = rotate || undefined; };
    this.setKeyboardEvents = setKeyboardEvents;
    this.getFrameData = function () { return datau32; };
    this.getImageData = function () { return { data: datau8, width, height }; };
    // PCE (and other platforms) build their own ImageData from the canvas
    // context during start(), so hand out a real one
    this.createImageData = function (w: number, h: number) {
      if (w === width && h === height) return { data: datau8, width, height };
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
  const VectorVideo: any = function () {
    this.create = function () { this.drawops = 0; };
    this.setKeyboardEvents = setKeyboardEvents;
    this.clear = function () { };
    this.drawLine = function () { this.drawops++; };
  };
  const AnimationTimer: any = function (fps: number) {
    if (fps > 0) frameRate = fps;
    this.running = false;
    this.start = function () { };
    this.stop = function () { };
    this.isRunning = function () { return this.running; };
  };
  const original = emu.setVideoClasses({ RasterVideo, VectorVideo, AnimationTimer });
  return {
    get(): VideoOutput | null {
      return pixels && params ? { pixels, ...params } : null;
    },
    get frameRate() { return frameRate; },
    get keyHandler() { return keyHandler; },
    restore() {
      emu.setVideoClasses(original);
    }
  };
}

export class EmuCore {
  private video: ReturnType<typeof installHeadlessVideo> | null = null;
  private captured: (() => VideoOutput | null) | null = null;
  private recording: History | null = null;
  // the machine's state was changed from outside the recording
  private recordingStale = true;
  private input: PlatformFrameInput | null = null;
  private probe: ProbeAll | null = null;
  // frames run on a platform without a timeline
  private untimedFrames = 0;

  constructor(readonly id: string, readonly platform: Platform) {
  }

  /** The recorded timeline, or null if the platform can't save its state. */
  get history(): History | null { return this.timeline; }

  private get timeline(): History | null {
    if (this.recordingStale) this.startTimeline();
    return this.recording;
  }

  /** Frames run so far. Keeps counting across loadROM() and reset(). */
  get frameCount(): number {
    return this.timeline ? this.timeline.now().frame : this.untimedFrames;
  }

  /** Where the machine is: frames, and steps into the current frame. */
  now(): Timestamp {
    return this.timeline ? this.timeline.now() : timestamp(this.untimedFrames, 0);
  }

  /** True if the machine shows a recorded past rather than the present. */
  isInPast(): boolean {
    return !!this.timeline?.isInPast();
  }

  /**
   * Start recording from the machine's current state, which was changed from
   * outside the timeline (start, a ROM or BIOS load, a reset). The past before
   * it is dropped: it can't be replayed into this state.
   */
  private startTimeline() {
    this.recordingStale = false;
    const t = this.recording ? this.recording.now() : timestamp(this.untimedFrames, 0);
    if (!isRewindable(this.platform)) {
      this.recording = null;
      this.input = null;
      this.untimedFrames = t.frame;
      return;
    }
    const core = createCore(this.platform);
    // the new state starts a frame, which is the next one if we were mid-frame
    core.restore(core.snapshot(), timestamp(t.step === 0 ? t.frame : t.frame + 1, 0));
    if (this.probe) core.connectProbe?.(this.probe);
    this.input = new PlatformFrameInput(this.platform, {
      now: () => core.now(),
      dispatchKey: (key, code, flags) => this.deliverKey(key, code, flags),
    });
    this.recording = new History(core, { input: this.input });
  }

  /**
   * The underlying Machine, if there is one. Platforms built on
   * BaseMachinePlatform expose theirs, which is what lets us stop mid-frame
   * through the TrapCondition the FrameBased interface already defines,
   * instead of guessing at cycle counts.
   */
  get machine(): Machine | null {
    // vcs keeps a stand-in `machine` object for the probe views; skip it
    const m = (this.platform as any).machine;
    return m && typeof m.advanceFrame === 'function' ? m : null;
  }

  async start() {
    // start() is where platforms construct their video and timer, so install
    // the headless stand-ins just for that call, then restore the real classes.
    const headless = installHeadlessVideo();
    this.video = headless;
    try {
      await this.platform.start();
    } finally {
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
    const audio: any = (this.platform as any).audio;
    if (audio && typeof audio.feedSample === 'function' && typeof audio.start === 'function') {
      try { audio.start(); } catch (e) { /* not a SampledAudio sink */ }
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
  async loadROM(data: Uint8Array | object, title = 'ROM') {
    await this.platform.loadROM(title, data);
    this.recordingStale = true;
  }

  /**
   * Project files the program reads at load time (verilog's $readmem), keyed
   * by the name the program uses. The IDE gets these from the open project.
   */
  setFileData(files: { [path: string]: FileData }) {
    this.platform.sourceFileFetch = (path) => files[path];
  }

  loadBIOS(data: Uint8Array, title = 'BIOS'): boolean {
    if (!this.platform.loadBIOS) return false;
    this.platform.loadBIOS(title, data);
    this.recordingStale = true;
    return true;
  }

  read(addr: number): number {
    if (this.platform.readAddress) return this.platform.readAddress(addr);
    const m = this.machine;
    if (m) return m.readConst ? m.readConst(addr) : m.read(addr);
    throw new Error(`platform '${this.id}' cannot read memory`);
  }

  getCPUState(): CpuState | null {
    try { return this.platform.getCPUState ? this.platform.getCPUState() : null; }
    catch (e) { return null; }
  }

  getPC(): number | null {
    // Platforms may correct the PC (see debugPCDelta), so prefer getPC().
    try { if (this.platform.getPC) return this.platform.getPC(); } catch (e) { }
    const s = this.getCPUState();
    return s ? s.PC : null;
  }

  disassemble(addr: number): DisasmLine | null {
    const read = (a: number) => this.read(a);
    try {
      if (this.platform.disassemble) return this.platform.disassemble(addr, read);
      // a few platforms leave it out; fall back to the machine's CPU
      const disasm = DISASSEMBLERS[archOf(this.machine?.cpu)];
      return disasm ? disasm(addr, read) : null;
    } catch (e) { return null; }
  }

  /**
   * Press or release a key. With a timeline, the event is logged and delivered
   * as the next frame starts, so a replay delivers it at the same moment. A
   * key pressed while showing the past makes that moment the present: the
   * recorded future is dropped.
   */
  setKeyInput(key: number, code: number, flags: number) {
    const deliver = this.keyReceiver();
    if (!this.timeline) return deliver(key, code, flags);
    if (this.timeline.isInPast()) this.timeline.truncate();
    this.input.key(key, code, flags);
  }

  private deliverKey(key: number, code: number, flags: number) {
    this.keyReceiver()(key, code, flags);
  }

  /** What takes key events: the platform's canvas handler, or the machine. */
  private keyReceiver(): (key: number, code: number, flags: number) => void {
    const handler = this.video?.keyHandler;
    if (handler) return handler;
    const target: any = this.machine || this.platform;
    if (typeof target.setKeyInput !== 'function') {
      throw new Error(`platform '${this.id}' does not accept key input`);
    }
    return (key, code, flags) => target.setKeyInput(key, code, flags);
  }

  connectProbe(probe: ProbeAll | null): boolean {
    const m = this.machine;
    if (!m || !hasProbe(m)) return false;
    this.probe = probe;
    // the core mutes the probe while it replays steps the probe already saw
    const core = this.timeline?.core;
    if (core?.connectProbe) core.connectProbe(probe);
    else m.connectProbe(probe);
    return true;
  }

  getVideo(): VideoOutput | null {
    return this.captured?.() ?? this.video?.get() ?? null;
  }

  /** Audio the platform produces, or null if it has none. */
  getAudioParams(): SampledAudioParams | null {
    const a: any = (this.platform as any).audio;
    // SampledAudio exposes sampleRate; a few platforms hold a raw SampleAudio
    // (nes), whose rate is the `sr` it records once start() has run. Platforms
    // with their own TSS MasterAudio report nothing here.
    const rate = a && (a.sampleRate || a.sr);
    if (!rate) return null;
    return { sampleRate: rate, stereo: false };
  }
  /** Frames per second the platform's timer asked for (60 if unknown). */
  get frameRate(): number { return this.video ? this.video.frameRate : 60; }
  saveState(): EmuState | null { return this.platform.saveState ? this.platform.saveState() : null; }

  getDebugInfo(): DebugSection[] {
    const state = this.saveState();
    const p: any = this.platform;
    if (!state || !isDebuggable(p) || !p.getDebugCategories) return [];
    const sections: DebugSection[] = [];
    for (const category of p.getDebugCategories() || []) {
      try {
        const text = p.getDebugInfo(category, state);
        if (text) sections.push({ category, text });
      } catch (e) { /* a category that doesn't apply to this state */ }
    }
    return sections;
  }

  //// execution control, driven by what the target turns out to support

  /** True if execution can be stopped mid-frame at an exact instruction. */
  get supportsTrap(): boolean { return this.machine != null; }

  /** True if single instructions can be stepped. */
  get supportsStep(): boolean { return this.supportsTrap; }

  /** True if the machine can be stepped backwards and moved around in time. */
  get supportsRewind(): boolean { return this.timeline != null; }

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
  advanceFrame(trap?: TrapCondition | null): boolean {
    const h = this.timeline;
    if (!h) return this.advanceUntimed(trap);
    const t = h.now();
    const r = h.isInPast() ? h.seek(timestamp(t.frame + 1, 0), trap) : h.recordFrame(trap);
    if (r.halt) throw r.halt;
    return r.trapped;
  }

  private advanceUntimed(trap?: TrapCondition | null): boolean {
    const m = this.machine;
    let hit = false;
    // With a trap we drive the Machine directly -- Platform.advance() only
    // honors traps registered as breakpoints, and installing/removing those
    // rewinds BaseDebugPlatform's saved state.
    if (trap && m) {
      m.advanceFrame(() => (hit = hit || !!trap()));
    } else {
      const p = this.platform as any;
      if (p.nextFrame) p.nextFrame();
      else if (p.advance) p.advance(false);
      hit = !!trap?.();
    }
    this.untimedFrames++;
    return hit;
  }

  isStable(): boolean {
    return this.machine ? this.machine.cpu.isStable() : true;
  }

  /**
   * Run until `pred` is true at an instruction boundary, up to `maxFrames`
   * frames. `pred` is first asked about the current position. Exact to the
   * instruction on targets with a Machine; frame-granular otherwise.
   */
  runUntil(pred: () => boolean, maxFrames = DEFAULT_MAX_FRAMES): boolean {
    const trap = () => this.isStable() && pred();
    const start = this.frameCount;
    while (this.frameCount - start < maxFrames) {
      if (this.advanceFrame(trap)) return true;
    }
    return false;
  }

  /**
   * Finish any partly-executed instruction, so getPC() names a real
   * instruction. Frames can end mid-instruction on clock-based CPUs.
   */
  settle(): void {
    if (!this.supportsStep || this.isStable()) return;
    this.runUntil(() => true, 2);
  }

  /**
   * Execute `n` instructions, calling `each` before each one. Stops early,
   * returning false, if `each` returns true. Throws if the target can't step.
   */
  stepInsn(n = 1, each?: () => boolean | void): boolean {
    if (!this.supportsStep) throw new Error(`'${this.id}' does not support instruction stepping`);
    this.settle();  // don't count an in-flight instruction as a step
    let seen = 0;
    let stopped = false;
    // the first boundary is the current position, so n steps end at the n+1th
    this.runUntil(() => {
      if (seen++ === n) return true;
      if (each && each()) return stopped = true;
      return false;
    });
    return !stopped;
  }

  /**
   * Go back `n` instructions, by replaying the recorded past. Returns false,
   * and stays put, if the recording doesn't reach back that far.
   */
  stepBack(n = 1): boolean {
    const h = this.timeline;
    if (!h || !this.supportsStep) return false;
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
  stepBackUntil(pred: () => boolean): boolean {
    const h = this.timeline;
    if (!h) throw new Error(`'${this.id}' cannot rewind`);
    const t = h.now();
    const test = () => this.isStable() && pred();
    // most searches end in this frame, so try it before the whole past
    const frameStart = timestamp(t.frame, 0);
    if (compareTimestamps(frameStart, h.first()) >= 0 && h.findLast(test, frameStart, t)) return true;
    if (h.findLast(test, h.first(), t)) return true;
    h.seek(t);
    return false;
  }

  /** Move to a recorded moment, past or present. Throws if it isn't recorded. */
  seek(t: Timestamp): void {
    if (!this.timeline) throw new Error(`'${this.id}' cannot rewind`);
    const r = this.timeline.seek(t);
    if (r.halt) throw r.halt;
  }

  /**
   * Run backwards to the last moment `pred` held at an instruction boundary.
   * Returns false, and stays put, if it never held in the recording.
   */
  reverseRunUntil(pred: () => boolean): boolean {
    const h = this.timeline;
    if (!h) throw new Error(`'${this.id}' cannot rewind`);
    const start = h.now();
    if (h.findLast(() => this.isStable() && pred(), h.first(), start)) return true;
    h.seek(start);
    return false;
  }

  /** Run until the PC reaches one of `addrs`. */
  runToPC(addrs: Set<number>, maxFrames = DEFAULT_MAX_FRAMES): boolean {
    return this.runUntil(() => addrs.has(this.getPC()), maxFrames);
  }
}
