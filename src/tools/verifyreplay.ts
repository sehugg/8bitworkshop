// Record a run with input, replay it, and check every frame matches. This is
// what keeps the deterministic debugger honest: rewinding is only meaningful
// on platforms that reproduce, and a platform that quietly picks up entropy
// (an unseeded Math.random, a clock) shows up here as a diverging frame rather
// than as a mystery months later. Used by `8bws verify-replay` and the tests.

import { KeyFlags } from '../common/emu';
import { EmuCore } from '../common/emucore';
import { hashState } from '../common/statehash';
import { formatTimestamp, Granularity, timestamp } from '../common/timeline';

/**
 * Keys worth mashing: the directions and the fire/start buttons, which is what
 * a joystick-driven platform reads. Pressing arbitrary keyboard keys would be
 * noisier without testing anything more.
 */
const EXERCISE_KEYS = [37, 38, 39, 40, 32, 13];   // left up right down space enter

/**
 * A seeded button masher. Verification is only meaningful if the recording has
 * input in it -- without input the controls path is never exercised, and a
 * platform whose loadControlsState() is not the inverse of saveControlsState()
 * passes for the wrong reason. Seeded so a failure is reproducible.
 */
class InputExerciser {
  private state = 1;
  private held = new Map<number, boolean>();
  events = 0;

  constructor(readonly target: EmuCore, seed: number) {
    this.state = seed | 0 || 1;
  }

  private next(): number {
    // xorshift32, same shape as the emulator's own noise()
    let x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (this.state = x) >>> 0;
  }

  /** Press or release a key or two, as if a player were at the controls. */
  frame(): void {
    for (const key of EXERCISE_KEYS) {
      if ((this.next() & 7) !== 0) continue;         // ~1 change per key per 8 frames
      const down = !this.held.get(key);
      this.held.set(key, down);
      this.target.setKeyInput(key, key, down ? KeyFlags.KeyDown : KeyFlags.KeyUp);
      this.events++;
    }
  }
}

export interface ReplayOptions {
  frames: number;
  /** mash keys while recording (default true) */
  keys?: boolean;
  seed?: number;
}

export interface ReplayReport {
  /** 'keys', 'none', or 'unsupported' if the target takes no key input */
  input: 'keys' | 'none' | 'unsupported';
  /** distinct control states seen; 1 means the input never reached the machine */
  controlStates: number;
  keyEvents: number;
  granularity: Granularity;
  /** frames whose replayed state differs from the recording (the first 5) */
  diverged: number[];
  recordedTo: string;
}

/**
 * Record `frames` frames from the target's current state, replay them from the
 * start, and compare the state at every frame boundary.
 */
export function verifyReplay(target: EmuCore, opts: ReplayOptions): ReplayReport {
  const hist = target.history;
  if (!hist) throw new Error(`'${target.id}' cannot save and restore state`);
  const platform = target.platform;
  const frames = opts.frames;
  // one checkpoint only, so the replay re-runs the whole span rather than
  // being handed a fresh state part way through
  hist.checkpointInterval = frames + 1;

  let exerciser: InputExerciser | null = null;
  let input: ReplayReport['input'] = 'none';
  if (opts.keys ?? true) {
    exerciser = new InputExerciser(target, opts.seed ?? 12345);
    try {
      exerciser.frame();          // fails fast if the target takes no key input
      input = 'keys';
    } catch (e) {
      exerciser = null;
      input = 'unsupported';
    }
  }

  // record, hashing the state at every frame boundary
  const start = hist.now();
  const recorded: number[] = [];
  const controlStates = new Set<number>();
  for (let i = 0; i < frames; i++) {
    // keys are queued here and delivered as the frame starts, which is what
    // the replay has to reproduce
    if (i > 0) exerciser?.frame();
    target.advanceFrame();
    if (platform.saveControlsState) controlStates.add(hashState(platform.saveControlsState()));
    recorded.push(hashState(hist.core.snapshot()));
  }

  // replay the same span and compare
  const diverged: number[] = [];
  hist.seek(start);
  for (let i = 0; i < frames && diverged.length < 5; i++) {
    const t = timestamp(start.frame + i + 1, 0);
    hist.seek(t);
    if (hashState(hist.core.snapshot()) !== recorded[i]) diverged.push(t.frame);
  }

  return {
    input,
    controlStates: controlStates.size,
    keyEvents: exerciser?.events ?? 0,
    granularity: hist.core.granularity,
    diverged,
    recordedTo: formatTimestamp(hist.last()),
  };
}
