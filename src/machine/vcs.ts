
// Atari 2600 (VCS) Machine, built from the Javatari core
// (javatari.js/release/core/javatari-core.js, built with `grunt core`).
//
// The components are assembled here without Javatari's AtariConsole or its
// room/DOM layer, so the machine runs headlessly like the other src/machine/*
// Machines. Tia.frame(trap) asks the trap before every CPU clock, so a step is
// one CPU clock and MachineCore can stop, rewind and replay at any cycle.

import { EmuHalt, KeyFlags, Keys, makeKeycodeMap } from "../common/emu";
import { AcceptsKeyInput, AcceptsROM, FrameBased, NullProbe, Probeable, ProbeAll, RasterFrameBased, Resettable, SampledAudioParams, SampledAudioSink, SampledAudioSource, SavesState, TrapCondition, VideoParams, VideoSource } from "../common/devices";

const { jt } = require('../../javatari.js/release/core/javatari-core.js');

// store savestate arrays as plain copies, not deflated base64 strings
jt.Util.rawStates = true;
jt.Util.log = () => { };

// ConsoleControls ids
const C = jt.ConsoleControls;

export const VCS_KEYCODE_MAP = makeKeycodeMap([
  [Keys.UP, 0, C.JOY0_UP],
  [Keys.DOWN, 0, C.JOY0_DOWN],
  [Keys.LEFT, 0, C.JOY0_LEFT],
  [Keys.RIGHT, 0, C.JOY0_RIGHT],
  [Keys.A, 0, C.JOY0_BUTTON],
  [Keys.P2_UP, 0, C.JOY1_UP],
  [Keys.P2_DOWN, 0, C.JOY1_DOWN],
  [Keys.P2_LEFT, 0, C.JOY1_LEFT],
  [Keys.P2_RIGHT, 0, C.JOY1_RIGHT],
  [Keys.P2_A, 0, C.JOY1_BUTTON],
  // console switches, on Javatari's keys
  [Keys.VK_F2, 0, C.BLACK_WHITE],
  [Keys.VK_F4, 0, C.DIFFICULTY0],
  [Keys.VK_F9, 0, C.DIFFICULTY1],
  [Keys.VK_F11, 0, C.SELECT],
  [Keys.VK_F12, 0, C.RESET],
]);

// NTSC frame: 262 lines, synced within Javatari's Monitor tolerances
const NTSC = jt.VideoStandard.NTSC;
const LINE_WIDTH = NTSC.totalWidth;         // 228 TIA clocks
const HBLANK = 68;
const VISIBLE_WIDTH = LINE_WIDTH - HBLANK;  // 160
const VISIBLE_ORIGIN_Y = Math.floor(NTSC.defaultOriginYPct / 100 * NTSC.totalHeight);
const VISIBLE_HEIGHT = Math.floor(NTSC.defaultHeightPct / 100 * NTSC.totalHeight);
const MIN_LINES_TO_SYNC = NTSC.totalHeight - 16;
const MAX_LINES_TO_SYNC = NTSC.totalHeight + 16 + 5;

export const VCS_SAMPLE_RATE = 31440;       // TIA audio clock, 2 pulses per line
const AUDIO_VOLUME = 0.4;

// Cartridge addresses (masked to 0xfff) whose reads may switch banks or
// clock a coprocessor. readConst() puts the cartridge back after reading them.
function isCartHotspot(format: string, a: number) {
  a &= 0xfff;
  if (a >= 0xfe0 && a <= 0xffb) return true;
  // DPC and FA2 registers, AR write latch
  return a < 0x100 && (format == 'DPC' || format == 'FA2' || format == 'FA2cu' || format == 'AR');
}

export class JavatariMachine implements FrameBased, RasterFrameBased, VideoSource, SampledAudioSource,
  AcceptsROM, AcceptsKeyInput, Probeable, Resettable, SavesState<any> {

  readonly cpuCyclesPerLine = 76;
  readonly cpuFrequency = 1193182;
  readonly numTotalScanlines = NTSC.totalHeight;

  // javatari components
  readonly m6502 = new jt.M6502();
  readonly pia = new jt.Pia();
  readonly tia = new jt.Tia(this.m6502, this.pia);
  readonly ram = new jt.Ram();
  readonly bus = new jt.Bus(this.m6502, this.tia, this.pia, this.ram);
  cart = null;

  cpu = {
    getPC: () => this.m6502.getPC(),
    getSP: () => this.m6502.getSP(),
    // a WSYNC halt stops the CPU with T=0 for the rest of the line
    isStable: () => this.m6502.isStable() && this.m6502.isRDY(),
    reset: () => this.reset(),
  };

  pixels: Uint32Array;
  audio: SampledAudioSink;
  probe: ProbeAll = new NullProbe();
  probing = false;
  line = 0;             // scanline within the frame, from the last vsync

  constructor() {
    const video = this.tia.getVideoOutput();
    video.connectMonitor({
      nextLine: (pixels: Uint32Array, vsync: boolean) => this.nextLine(pixels, vsync),
      refresh: () => { },
      setVideoStandard: () => { },
      videoSignalOff: () => { },
      showOSD: () => { },
    });
    const tiaAudio = this.tia.getAudioOutput();
    tiaAudio.connectAudioSocket({
      connectAudioSignal: () => { },
      disconnectAudioSignal: () => { },
      // always take the sample: the DPC cartridge's audio is clocked by it
      audioClockPulse: () => {
        const s = tiaAudio.nextSample() * AUDIO_VOLUME;
        if (this.audio) this.audio.feedSample(s, 1);
      },
    });
    this.tia.setVideoStandard(NTSC);
    this.m6502.onHalt = (pc: number) => {
      throw new EmuHalt(`CPU halted at $${pc.toString(16)}`);
    };
    this.probeBus();
  }

  loadROM(data: Uint8Array, title?: string) {
    // MD5 of the ROM wants a plain Array
    const rom = new jt.ROM(title || 'rom', Array.from(data));
    this.insertCartridge(jt.CartridgeCreator.createCartridgeFromRom(rom));
    this.reset();
  }

  insertCartridge(cart) {
    this.cart = cart;
    this.bus.setCartridge(cart);
    this.tia.getAudioOutput().cartridgeInserted(cart);
  }

  getCartridgeFormat(): string {
    return this.cart?.format.name;
  }

  reset() {
    this.bus.powerOn();
    this.line = 0;
  }

  // VIDEO

  getVideoParams(): VideoParams {
    return { width: VISIBLE_WIDTH, height: VISIBLE_HEIGHT, aspect: VISIBLE_WIDTH * 2 / VISIBLE_HEIGHT, overscan: true };
  }
  connectVideo(pixels: Uint32Array) {
    this.pixels = pixels;
  }

  // Monitor.nextLine(): returns true to end the frame
  nextLine(linePixels: Uint32Array, vsync: boolean): boolean {
    const y = this.line - VISIBLE_ORIGIN_Y;
    if (this.pixels && y >= 0 && y < VISIBLE_HEIGHT) {
      this.pixels.set(linePixels.subarray(HBLANK, LINE_WIDTH), y * VISIBLE_WIDTH);
    }
    this.line++;
    this.probe.logNewScanline();
    if ((vsync && this.line >= MIN_LINES_TO_SYNC) || this.line > MAX_LINES_TO_SYNC) {
      this.line = 0;
      return true;
    }
    return false;
  }

  getRasterY() { return this.line; }
  getRasterX() { return this.tia.getCPUClockInLine(); }

  // AUDIO

  getAudioParams(): SampledAudioParams {
    return { sampleRate: VCS_SAMPLE_RATE, stereo: false };
  }
  connectAudio(audio: SampledAudioSink) {
    this.audio = audio;
  }

  // EXECUTION

  advanceFrame(trap: TrapCondition): number {
    this.probe.logNewFrame();
    let steps = 0;
    if (this.probing) {
      // log each CPU clock, and the instruction boundaries
      this.tia.frame(() => {
        if (trap && trap()) return true;
        if (this.cpu.isStable()) this.probe.logExecute(this.cpu.getPC(), this.cpu.getSP());
        this.probe.logClocks(1);
        steps++;
        return false;
      });
    } else if (trap) {
      this.tia.frame(() => {
        if (trap()) return true;
        steps++;
        return false;
      });
    } else {
      this.tia.frame();   // the fast path, which doesn't count steps
    }
    return steps;
  }

  // MEMORY

  read(a: number): number {
    return this.bus.read(a & 0x1fff);
  }
  write(a: number, v: number) {
    this.bus.write(a & 0x1fff, v);
  }
  // no side effects: skips PIA reads, and undoes bank switches
  readConst(a: number): number {
    a &= 0x1fff;
    if (a & 0x1000) {
      if (!this.cart) return 0;
      if (isCartHotspot(this.cart.format.name, a)) {
        const s = this.cart.saveState();
        const v = this.cart.read(a);
        this.cart.loadState(s);
        return v;
      }
      return this.cart.read(a);
    }
    if ((a & 0x280) === 0x80) return this.ram.read(a);
    return 0; // TIA and PIA
  }

  // wraps the CPU's view of the bus, so the probe sees its accesses
  probeBus() {
    const bus = this.bus;
    const read = bus.read, write = bus.write;
    const isIO = (a: number) => (a & 0x1080) === 0 || (a & 0x1280) === 0x280;
    const probed = {
      read: (a: number) => {
        const v = read(a);
        if (isIO(a)) this.probe.logIORead(a, v);
        else this.probe.logRead(a, v);
        return v;
      },
      write: (a: number, v: number) => {
        if (isIO(a)) {
          this.probe.logIOWrite(a, v);
          if ((a & 0x3f) === 0x02) this.probe.logWait(a); // WSYNC
        } else this.probe.logWrite(a, v);
        write(a, v);
      },
    };
    this.setProbedBus = (on: boolean) => {
      // the CPU and cartridges call bus.read/bus.write through the bus object
      bus.read = on ? probed.read : read;
      bus.write = on ? probed.write : write;
    };
  }
  private setProbedBus: (on: boolean) => void;

  connectProbe(probe: ProbeAll) {
    this.probe = probe || new NullProbe();
    this.probing = !!probe;
    this.setProbedBus(this.probing);
  }

  // INPUT

  setKeyInput(key: number, code: number, flags: number) {
    const o = VCS_KEYCODE_MAP[key];
    if (o && (flags & (KeyFlags.KeyDown | KeyFlags.KeyUp))) this.setControl(o.mask, !!(flags & KeyFlags.KeyDown));
  }

  setControl(control: number, pressed: boolean) {
    this.pia.controlStateChanged(control, pressed);
    this.tia.controlStateChanged(control, pressed);
  }

  // STATE

  saveState() {
    return {
      c: this.m6502.saveState(),
      p: this.pia.saveState(),
      t: this.tia.saveState(),
      r: this.ram.saveState(),
      b: this.bus.saveState(),
      ca: this.cart && this.cart.saveState(),
      line: this.line,
    };
  }
  loadState(s) {
    if (s.ca && (!this.cart || this.cart.format.name != s.ca.f)) {
      this.insertCartridge(jt.CartridgeCreator.recreateCartridgeFromSaveState(s.ca, this.cart));
    }
    this.m6502.loadState(s.c);
    this.pia.loadState(s.p);
    this.tia.loadState(s.t);
    this.ram.loadState(s.r);
    this.bus.loadState(s.b);
    if (this.cart && s.ca) this.cart.loadState(s.ca);
    this.line = s.line;
  }
}
