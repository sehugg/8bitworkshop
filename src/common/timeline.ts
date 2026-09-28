// Deterministic timeline: a monotonic time coordinate for the debugger, and
// the narrow core interface that rewinding needs.
//
// The old debugger keyed everything on frames plus a per-frame clock that was
// rewound on every frame boundary (BaseDebugPlatform.preFrame), which is why a
// breakpoint condition could not span frames. Here time is a (frame, step) pair
// that only ever moves forward as the machine runs, so "run until T" and "when
// was P last true?" are expressible without caring where frames begin and end.
//
// A *step* is one invocation of the TrapCondition that FrameBased.advanceFrame()
// already defines. That means the unit is whatever the machine traps on -- one
// instruction for a Z80 or 6809 BasicScanlineMachine, one clock tick for a
// 6502 one and for the WASM machines -- and it is consistent within a machine,
// which is all the timeline needs. A clock step can land mid-instruction, so
// "the previous instruction" is the last step where cpu.isStable(), not
// previousStep(). It is the same unit the replay bar's "Step" slider uses.

import { FrameBased, NullProbe, ProbeAll, SavesState, TrapCondition } from "./devices";
import { EmuHalt } from "./emu";

/**
 * A point in emulated time. Frames count from the start of recording and are
 * never reset; step counts trap invocations since the start of the frame.
 */
export interface Timestamp {
  readonly frame: number;
  readonly step: number;
}

export const TIMESTAMP_ZERO: Timestamp = { frame: 0, step: 0 };

export function timestamp(frame: number, step: number = 0): Timestamp {
  return { frame, step };
}

/** Lexicographic order: <0 if a is before b, 0 if equal, >0 if after. */
export function compareTimestamps(a: Timestamp, b: Timestamp): number {
  return a.frame - b.frame || a.step - b.step;
}

export function timestampsEqual(a: Timestamp, b: Timestamp): boolean {
  return a.frame === b.frame && a.step === b.step;
}

export function formatTimestamp(t: Timestamp): string {
  return `${t.frame}:${t.step}`;
}

/**
 * How finely a core can be positioned in time. Cores that can only stop at
 * frame boundaries say so instead of silently ignoring sub-frame targets, so
 * the UI can disable sub-frame seeking rather than lie about it.
 */
export type Granularity = 'clock' | 'insn' | 'frame';

export interface RunResult {
  /** Where the core ended up. */
  at: Timestamp;
  /** True if the caller's trap stopped the run before the target. */
  trapped: boolean;
  /**
   * Set if the machine halted (a KIL opcode, a watchdog). `at` is then the
   * position just before the step that halted, and the machine is parked
   * there. Running on from it halts again at the same place.
   */
  halt?: EmuHalt;
}

/**
 * The minimum an emulator must provide to be rewound and searched. Deliberately
 * smaller than Platform or Machine: no video, audio, input or disassembly, so
 * that emulators which don't descend from Machine (Javatari, jsnes) can be
 * adapted without being rewritten.
 */
export interface DeterministicCore<S = any> {
  readonly granularity: Granularity;

  /** Current position in emulated time. */
  now(): Timestamp;

  /**
   * Capture the machine state. Only states captured at a frame boundary
   * (step 0) may be passed back to restore(); see the class comment on
   * MachineCore for why.
   */
  snapshot(): S;

  /** Restore a frame-boundary snapshot and declare the time it was taken. */
  restore(state: S, at: Timestamp): void;

  /**
   * Run forward until now() reaches `target`, or until `trap` returns true.
   * `trap` is evaluated at every step from the current position onward, so a
   * run that crosses frame boundaries evaluates it continuously -- there is no
   * per-frame reset.
   */
  runUntil(target: Timestamp, trap?: TrapCondition | null): RunResult;

  /**
   * Round a target to something this core can actually stop at. A frame-only
   * core rounds sub-frame targets down; without this a caller could ask for a
   * position the core can never reach and wait forever for progress.
   */
  clamp?(t: Timestamp): Timestamp;

  /** Connect a probe (null to disconnect), if this core supports probing. */
  connectProbe?(probe: ProbeAll | null): void;
  /** The probe connected now, or null. */
  getProbe?(): ProbeAll | null;
}

/**
 * What MachineCore needs from a machine. Any src/machine/* Machine satisfies
 * this structurally; the interface is stated in terms of devices.ts alone so
 * this module doesn't drag in baseplatform.ts and the DOM with it.
 */
export interface CoreMachine extends FrameBased, SavesState<any> {
  connectProbe?(probe: ProbeAll): void;
}

/**
 * Adapts any FrameBased + SavesState machine to DeterministicCore.
 *
 * The one subtlety is that advanceFrame() is not resumable on most machines:
 * BasicScanlineMachine restarts its scanline loop from the top on every call,
 * so breaking out mid-frame and calling it again re-runs the frame rather than
 * continuing it. So a frame is the atomic replay unit here: the core keeps the
 * snapshot taken at the start of the current frame, and any sub-frame position
 * is reached by restoring that snapshot and replaying to the wanted step. That
 * is what makes stepping backwards inside a frame exact instead of approximate,
 * and it costs one snapshot per frame -- which the recorder wants anyway.
 */
export class MachineCore<T extends CoreMachine> implements DeterministicCore {

  readonly machine: T;
  readonly granularity: Granularity;

  private frame: number = 0;
  private step: number = 0;
  // state at the start of the current frame; the anchor for sub-frame seeks
  private frameStart: any = null;
  // steps in the last frame we counted, or -1 if that frame ran unmetered
  private lastFrameSteps: number = -1;
  private probe: ProbeAll | null = null;
  // stands in for the probe while replaying steps it has already seen
  private readonly mute = new NullProbe();

  /**
   * `wholeFrame` runs one whole frame with no trap, if the host has more to do
   * per frame than the machine does (a platform's advance() also checks for a
   * finished program). Frames with a trap always go to the machine.
   */
  constructor(machine: T, granularity: Granularity = 'insn', private wholeFrame?: () => void) {
    this.machine = machine;
    this.granularity = granularity;
    this.frameStart = machine.saveState();
  }

  now(): Timestamp {
    return { frame: this.frame, step: this.step };
  }

  snapshot() {
    return this.machine.saveState();
  }

  restore(state: any, at: Timestamp): void {
    if (at.step !== 0) {
      // Restoring mid-frame would leave us without a frame-start anchor, so
      // any later sub-frame seek in that frame would be unreachable. Callers
      // seek to a mid-frame position by restoring the frame and running to it.
      throw new Error(`can only restore at a frame boundary, not ${formatTimestamp(at)}`);
    }
    this.machine.loadState(state);
    this.frame = at.frame;
    this.step = 0;
    this.frameStart = state;
    this.lastFrameSteps = -1;
  }

  /**
   * Steps counted in the most recently completed frame, or -1 if that frame
   * ran without a trap and so was never counted. The UI uses this for the
   * range of the sub-frame slider.
   */
  getLastFrameSteps(): number {
    return this.lastFrameSteps;
  }

  connectProbe(probe: ProbeAll | null): void {
    this.probe = probe;
    this.machine.connectProbe?.(probe);
  }

  getProbe(): ProbeAll | null {
    return this.probe;
  }

  /**
   * Run `body` with the probe muted: it re-executes steps that already ran,
   * and the probe saw them the first time.
   */
  private replaying<R>(body: () => R): R {
    if (!this.probe) return body();
    this.machine.connectProbe?.(this.mute);
    try {
      return body();
    } finally {
      this.machine.connectProbe?.(this.probe);
    }
  }

  runUntil(target: Timestamp, trap?: TrapCondition | null): RunResult {
    while (compareTimestamps(this.now(), target) < 0) {
      // run to the end of this frame, or to target.step if the target is in it
      const untilStep = this.frame < target.frame ? Infinity : target.step;
      const stop = this.runFrame(untilStep, trap);
      if (stop === 'trap') return { at: this.now(), trapped: true };
      if (stop instanceof EmuHalt) return { at: this.now(), trapped: false, halt: stop };
    }
    return { at: this.now(), trapped: false };
  }

  /**
   * Advance within the current frame to `untilStep` (Infinity = end of frame).
   * Returns 'trap' if `trap` stopped the run, the EmuHalt if the machine
   * halted, or null if it reached `untilStep`.
   */
  private runFrame(untilStep: number, trap?: TrapCondition | null): 'trap' | EmuHalt | null {
    // Unmetered fast path: a whole frame from its start with nothing to
    // evaluate. Machines can take their bulk-execution route (e.g.
    // machine_exec) instead of paying for a trap call per tick.
    if (untilStep === Infinity && !trap && this.step === 0) {
      try {
        if (this.wholeFrame) this.wholeFrame();
        else this.machine.advanceFrame(null);
      } catch (e) {
        if (!(e instanceof EmuHalt)) throw e;
        // unmetered, so we don't know which step halted: find out
        return this.parkAtHalt(this.findHaltStep(), e);
      }
      this.endFrame(-1);
      return null;
    }
    // Re-run the frame from its start if we're already partway into it, since
    // advanceFrame() restarts rather than resumes. Steps before our current
    // position already happened, so the caller's trap must not see them again.
    const from = this.step;
    // steps before `from` already happened: the probe hears them once
    let muted = from > 0 && this.probe != null;
    if (from > 0) {
      this.machine.loadState(this.frameStart);
    }
    if (muted) this.machine.connectProbe?.(this.mute);
    let n = 0;
    let trapped = false;
    // A trap stops the CPU loop, not the frame: advanceFrame() still runs its
    // tail (drawing the line, the vblank interrupt, a watchdog) after the loop
    // exits. So the state is saved inside the trap, at the exact stop, and
    // loaded back once advanceFrame() returns.
    let stopState: any = null;
    // The trap runs before each step, so when it returns true exactly n steps
    // have executed -- n is the position, not the step about to run. step is
    // published before calling the caller's trap so that now() is the current
    // position while the condition is being evaluated; a search relies on that
    // to record where a hit happened.
    try {
      this.machine.advanceFrame(() => {
        this.step = n;
        if (muted && n >= from) {
          muted = false;
          this.machine.connectProbe?.(this.probe);
        }
        if (n >= untilStep || (n >= from && trap && (trapped = !!trap()))) {
          stopState = this.machine.saveState();
          return true;
        }
        n++;
        return false;
      });
    } catch (e) {
      if (muted) this.machine.connectProbe?.(this.probe);
      // Once stopped, only the frame's tail runs, and it runs early: the frame
      // hasn't really ended. An error from it (galaxian's watchdog) is not an
      // error at the stop. Resuming replays the whole frame, so a real one is
      // raised again then.
      if (!stopState) {
        if (!(e instanceof EmuHalt)) throw e;
        // the last step the trap saw is the one that halted (or the frame's
        // tail halted after it)
        return this.parkAtHalt(n > 0 ? n - 1 : 0, e);
      }
    }
    if (muted) this.machine.connectProbe?.(this.probe);
    if (stopState) {
      this.machine.loadState(stopState);
      this.step = n;
      return trapped ? 'trap' : null;
    }
    // ran off the end of the frame without stopping
    this.endFrame(n);
    return null;
  }

  /**
   * Replay the current frame from its start, counting steps, to find which one
   * halts. Only needed after an unmetered run, which doesn't count.
   */
  private findHaltStep(): number {
    this.machine.loadState(this.frameStart);
    let n = 0;
    try {
      this.replaying(() => this.machine.advanceFrame(() => { n++; return false; }));
    } catch (e) {
      if (e instanceof EmuHalt) return n > 0 ? n - 1 : 0;
      throw e;
    }
    throw new Error(`halt at frame ${this.frame} did not happen again on replay; the machine is not deterministic`);
  }

  /**
   * Put the machine just before the step that halted, so the PC shows the
   * halting instruction instead of the mess the halt left behind.
   */
  private parkAtHalt(haltStep: number, halt: EmuHalt): EmuHalt {
    this.machine.loadState(this.frameStart);
    this.step = 0;
    // stops before the halting step, so it can't halt again
    if (haltStep > 0) this.replaying(() => this.runFrame(haltStep, null));
    return halt;
  }

  private endFrame(steps: number): void {
    this.frame++;
    this.step = 0;
    this.lastFrameSteps = steps;
    this.frameStart = this.machine.saveState();
  }
}
