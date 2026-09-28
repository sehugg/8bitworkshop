// Bridges the existing Platform objects to the deterministic timeline.
//
// Most platforms are built on a Machine and get MachineCore, which can stop
// between instructions. The ones that aren't -- vcs (Javatari), verilog, x86 --
// only know how to run a whole frame, so they get FramePlatformCore, which says
// so through its granularity instead of pretending to sub-frame accuracy.

import { Platform } from "./baseplatform";
import { getNoiseSeed, setNoiseSeed } from "./emu";
import { FrameInputSource } from "./history";
import {
  DeterministicCore,
  formatTimestamp,
  Granularity,
  MachineCore,
  RunResult,
  Timestamp,
  timestamp,
} from "./timeline";
import { TrapCondition } from "./devices";

export interface RecordedKey {
  key: number;
  code: number;
  flags: number;
}

export interface PlatformInputOptions {
  /** Which frame an incoming key event belongs to. */
  currentFrame?: () => number;
  /** How to re-deliver a recorded key event during a replay. */
  dispatchKey?: (key: number, code: number, flags: number) => void;
}

/**
 * Captures and replays what varies between otherwise identical frames: the
 * controls, the seed of the shared PRNG, and the key events themselves.
 *
 * Snapshotting the controls is not enough on its own. Some platforms *act* on a
 * key event rather than only latching it -- atari8 raises a POKEY interrupt on
 * key-down (atari8.ts, getKeyboardFunction) -- and that effect lands in POKEY's
 * registers, which saveControlsState() does not cover. A replay that only
 * restored controls would silently lose the interrupt.
 *
 * So when a dispatcher is supplied, the recorded events are the source of truth
 * and the controls snapshot is not restored at all. The two must not be
 * combined: a checkpoint already contains the effect of every earlier event, so
 * redelivering on top of a restore applies them twice -- on c64 the key goes
 * into a queue inside the WASM state, and the doubled press diverges
 * immediately. Replaying just the events that came after the checkpoint is both
 * necessary and sufficient. Without a dispatcher there is nothing to replay, so
 * the controls snapshot is used instead.
 *
 * Frames are a fine granularity for this because the browser cannot deliver a
 * key event in the middle of advanceFrame() -- JS is single-threaded, so events
 * queue until the frame returns.
 */
export class PlatformFrameInput implements FrameInputSource {
  private frames = new Map<number, { controls: any, seed: number }>();
  private keys = new Map<number, RecordedKey[]>();
  private oldest = 0;

  constructor(readonly platform: Platform, readonly opts: PlatformInputOptions = {}) { }

  /** Note a key event as it is delivered, so the replay can redeliver it. */
  recordKey(key: number, code: number, flags: number): void {
    const frame = this.opts.currentFrame ? this.opts.currentFrame() : 0;
    var evs = this.keys.get(frame);
    if (!evs) this.keys.set(frame, evs = []);
    evs.push({ key, code, flags });
  }

  capture(frame: number): void {
    this.frames.set(frame, {
      controls: this.platform.saveControlsState ? this.platform.saveControlsState() : undefined,
      seed: getNoiseSeed(),
    });
  }

  replay(frame: number): void {
    const rec = this.frames.get(frame);
    if (rec) {
      if (!this.opts.dispatchKey && rec.controls !== undefined && this.platform.loadControlsState) {
        this.platform.loadControlsState(rec.controls);
      }
      setNoiseSeed(rec.seed);
    }
    const evs = this.opts.dispatchKey && this.keys.get(frame);
    if (evs) {
      for (const e of evs) this.opts.dispatchKey(e.key, e.code, e.flags);
    }
  }

  trim(firstFrame: number): void {
    while (this.oldest < firstFrame) {
      this.frames.delete(this.oldest);
      this.keys.delete(this.oldest);
      this.oldest++;
    }
  }

  get size(): number { return this.frames.size; }
  get keyEventCount(): number {
    var n = 0;
    this.keys.forEach((v) => n += v.length);
    return n;
  }
}

/**
 * A core for platforms with no Machine behind them. Frames are the only thing
 * it can count, so every target is rounded down to a frame boundary and
 * clamp() tells the history layer as much -- without that, a caller asking for
 * a sub-frame position would spin waiting for progress that can never happen.
 */
export class FramePlatformCore implements DeterministicCore {

  readonly granularity: Granularity = 'frame';
  private frame: number = 0;

  constructor(readonly platform: Platform) { }

  now(): Timestamp { return timestamp(this.frame, 0); }

  clamp(t: Timestamp): Timestamp {
    return t.step === 0 ? t : timestamp(t.frame, 0);
  }

  snapshot() { return this.platform.saveState(); }

  restore(state: any, at: Timestamp): void {
    if (at.step !== 0) {
      throw new Error(`can only restore at a frame boundary, not ${formatTimestamp(at)}`);
    }
    this.platform.loadState(state);
    this.frame = at.frame;
  }

  runUntil(target: Timestamp, trap?: TrapCondition | null): RunResult {
    while (this.frame < target.frame) {
      if (trap && trap()) return { at: this.now(), trapped: true };
      this.advanceFrame();
      this.frame++;
    }
    return { at: this.now(), trapped: false };
  }

  private advanceFrame(): void {
    const p = this.platform as any;
    // advance() is the bare frame; nextFrame() would also poll controls and
    // drive the old recorder, which would fight with this one
    if (p.advance) p.advance(true);
    else if (p.nextFrame) p.nextFrame(true);
    else throw new Error('platform cannot advance a frame');
  }
}

/** True if this platform can be rewound at all. */
export function isRewindable(platform: Platform): boolean {
  return !!(platform && platform.saveState && platform.loadState &&
    ((platform as any).machine || (platform as any).advance));
}

/**
 * Pick the most precise core the platform supports. WASM machines trap per
 * clock tick, JS machines per instruction; both are exposed as "steps" but the
 * granularity is reported so the UI can label the sub-frame axis honestly.
 */
export function createCore(platform: Platform): DeterministicCore {
  const machine = (platform as any).machine;
  if (machine && typeof machine.advanceFrame === 'function' && typeof machine.saveState === 'function') {
    const granularity: Granularity = typeof machine.advanceFrameClock === 'function' ? 'clock' : 'insn';
    return new MachineCore(machine, granularity);
  }
  return new FramePlatformCore(platform);
}
