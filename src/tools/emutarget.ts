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

import {
  CpuState, DisasmLine, EmuState, Machine, Platform, hasProbe, isDebuggable,
} from "../common/baseplatform";
import { ProbeAll, TrapCondition } from "../common/devices";
import { disassemble6502 } from "../common/cpu/disasm6502";
import { disassembleZ80 } from "../common/cpu/disasmz80";
import { disassembleSM83 } from "../common/cpu/disasmSM83";
import { disassembleF8 } from "../common/cpu/disasmF8";
import { disassembleHuC6280 } from "../common/cpu/disasmHuC6280";
import { CPU6809 } from "../common/cpu/6809";
import { PLATFORMS } from "../common/emu";
import * as emu from "../common/emu";
import { getRootBasePlatform } from "../common/util";
import { mockAudio, mockDOM, mockFetch, mockGlobals } from "./nodemock";

export interface VideoOutput {
  pixels: Uint32Array;
  width: number;
  height: number;
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

// Upper bound on clocks in one instruction, so stepping can't spin forever.
const MAX_CYCLES_PER_INSN = 64;

/**
 * Headless stand-ins for RasterVideo/VectorVideo/AnimationTimer. Platform
 * modules pick these up because Platform.start() reads them off the emu module.
 */
function installHeadlessVideo() {
  let pixels: Uint32Array | null = null;
  let params: { width: number, height: number } | null = null;
  (emu as any).RasterVideo = function (_el: any, width: number, height: number) {
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
  (emu as any).VectorVideo = function () {
    this.create = function () { this.drawops = 0; };
    this.setKeyboardEvents = function () { };
    this.clear = function () { };
    this.drawLine = function () { this.drawops++; };
  };
  (emu as any).AnimationTimer = function () {
    this.running = false;
    this.start = function () { };
    this.stop = function () { };
    this.isRunning = function () { return this.running; };
  };
  return {
    get(): VideoOutput | null {
      return pixels && params ? { pixels, width: params.width, height: params.height } : null;
    }
  };
}

export class EmuTarget {
  frameCount = 0;
  private video: ReturnType<typeof installHeadlessVideo>;

  constructor(readonly id: string, readonly platform: Platform) {
    this.video = installHeadlessVideo();
  }

  /**
   * The underlying Machine, if there is one. Platforms built on
   * BaseMachinePlatform expose theirs, which is what lets us stop mid-frame
   * through the TrapCondition the FrameBased interface already defines,
   * instead of guessing at cycle counts.
   */
  get machine(): Machine | null {
    return (this.platform as any).machine || null;
  }

  async start() { await this.platform.start(); }
  reset() { this.platform.reset(); }
  loadROM(data: Uint8Array, title = 'ROM') { this.platform.loadROM(title, data); }

  loadBIOS(data: Uint8Array, title = 'BIOS'): boolean {
    if (!this.platform.loadBIOS) return false;
    this.platform.loadBIOS(title, data);
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

  setKeyInput(key: number, code: number, flags: number) {
    const target: any = this.machine || this.platform;
    if (typeof target.setKeyInput !== 'function') {
      throw new Error(`platform '${this.id}' does not accept key input`);
    }
    target.setKeyInput(key, code, flags);
  }

  connectProbe(probe: ProbeAll | null): boolean {
    const m = this.machine;
    if (!m || !hasProbe(m)) return false;
    m.connectProbe(probe);
    return true;
  }

  getVideo(): VideoOutput | null { return this.video.get(); }
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

  /**
   * A function that advances the CPU by the smallest amount the machine
   * supports -- one clock for ClockBased CPUs, one instruction for
   * InstructionBased ones -- without disturbing the frame loop. Null if the
   * machine only knows how to run whole frames.
   */
  private clockStepper(): (() => void) | null {
    const m = this.machine as any;
    if (!m) return null;
    if (typeof m.advanceCPU === 'function') return () => m.advanceCPU();          // BasicHeadlessMachine
    if (typeof m.advanceFrameClock === 'function') return () => m.advanceFrameClock(null, 1); // WASM
    return null;
  }

  /**
   * Finish any partly-executed instruction, so getPC() names a real
   * instruction. Frames can end mid-instruction on clock-based CPUs.
   */
  settle(): void {
    const clock = this.clockStepper();
    if (!clock) return;
    for (let i = 0; i < MAX_CYCLES_PER_INSN && !this.isStable(); i++) clock();
  }

  advanceFrame(trap?: TrapCondition | null): void {
    const m = this.machine;
    // With a trap we drive the Machine directly -- Platform.advance() only
    // honors traps registered as breakpoints, and installing/removing those
    // rewinds BaseDebugPlatform's saved state.
    if (trap && m) {
      m.advanceFrame(trap);
    } else {
      const p = this.platform as any;
      if (p.nextFrame) p.nextFrame();
      else if (p.advance) p.advance(false);
    }
    this.frameCount++;
  }

  isStable(): boolean {
    return this.machine ? this.machine.cpu.isStable() : true;
  }

  /** Execute exactly one instruction. Returns false if the target can't step. */
  stepInsn(): boolean {
    if (!this.machine) return false;
    const clock = this.clockStepper();
    if (clock) {
      this.settle();  // don't count an in-flight instruction as this step
      clock();
      for (let i = 0; i < MAX_CYCLES_PER_INSN && !this.isStable(); i++) clock();
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
  runUntil(pred: () => boolean, maxFrames = DEFAULT_MAX_FRAMES): boolean {
    const start = this.frameCount;
    while (this.frameCount - start < maxFrames) {
      if (this.supportsTrap) {
        let hit = false;
        this.advanceFrame(() => (hit = this.isStable() && pred()));
        if (hit) return true;
      } else {
        this.advanceFrame();
        if (pred()) return true;
      }
    }
    return false;
  }

  /** Run until the PC reaches one of `addrs`. */
  runToPC(addrs: Set<number>, maxFrames = DEFAULT_MAX_FRAMES): boolean {
    return this.runUntil(() => addrs.has(this.getPC()), maxFrames);
  }
}

/** Load a platform module by ID (e.g. "nes", "c64.wasm", "atari8-5200"). */
export async function loadPlatform(platformId: string): Promise<EmuTarget> {
  installNodeMocks();
  const baseId = getRootBasePlatform(platformId);
  await import('../platform/' + baseId);
  const PlatformClass = PLATFORMS[platformId] || PLATFORMS[baseId];
  if (!PlatformClass) {
    throw new Error(`Platform '${platformId}' not found. Available: ${Object.keys(PLATFORMS).sort().join(', ')}`);
  }
  return new EmuTarget(platformId, new PlatformClass(null));
}

let mocksInstalled = false;

/** Stub out the browser APIs that the platform modules expect. */
export function installNodeMocks() {
  if (mocksInstalled) return;
  mocksInstalled = true;
  mockGlobals();
  mockAudio();
  mockFetch();
  mockDOM();
}
