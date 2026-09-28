// Recorded history over a DeterministicCore: periodic checkpoints plus the
// per-frame input needed to reproduce everything between them.
//
// The point of recording is not to store the past but to be able to *re-run*
// it. Nothing is kept between checkpoints, so a breakpoint condition can be
// asked about a moment that has already gone by: restore the checkpoint before
// it and replay with the condition installed as a trap. That is what findLast()
// does, and it is why reverse-step and "when did this memory last change?" are
// the same operation with different predicates.

import { ProbeAll, TrapCondition } from "./devices";
import {
  compareTimestamps,
  DeterministicCore,
  formatTimestamp,
  RunResult,
  Timestamp,
  timestamp,
} from "./timeline";

/**
 * Everything that has to be re-applied at a frame boundary for a replay to
 * reproduce the original run: controls, and the seed of the one PRNG a machine
 * is allowed to touch. Implemented by the platform, which knows what its input
 * looks like; the history layer only knows *when* to call it.
 */
export interface FrameInputSource {
  /** Record whatever input applies to this frame, as it is about to run. */
  capture(frame: number): void;
  /** Re-apply the input recorded for this frame before re-running it. */
  replay(frame: number): void;
  /** Drop everything recorded for frames before this one. */
  trim?(firstFrame: number): void;
}

export interface Checkpoint<S = any> {
  at: Timestamp;
  state: S;
}

/**
 * A condition to search for. A plain predicate is enough for anything that only
 * looks at current state (a PC, a register). A condition built on the probe
 * needs two more things:
 *
 * - `probe` is attached only for the duration of the search and detached after,
 *   because probing costs real time (the probe wrapper roughly doubles the cost
 *   of a frame) and recording must not pay for a question nobody has asked yet.
 *   Determinism is what makes this safe: the probe sees the replay, and the
 *   replay is the same execution as the original.
 * - `reset` drops what the probe latched, and is called after every reposition,
 *   since a search seeks around and a latch set during a seek is not a hit.
 */
export interface ProbeCondition {
  test: TrapCondition;
  reset?: () => void;
  probe?: ProbeAll;
}

export type SearchCondition = TrapCondition | ProbeCondition;

function conditionTest(c: SearchCondition): TrapCondition {
  return typeof c === 'function' ? c : c.test;
}

function conditionReset(c: SearchCondition): void {
  if (typeof c !== 'function') c.reset?.();
}

export interface HistoryOptions {
  /** Frames between checkpoints. Larger = less memory, slower seeks. */
  checkpointInterval?: number;
  /** Oldest checkpoints are dropped past this. */
  maxCheckpoints?: number;
  input?: FrameInputSource;
}

/**
 * A window of recorded emulated time, and the searches you can run over it.
 *
 * Checkpoints are only ever taken at frame boundaries, which is what lets any
 * sub-frame position be reached exactly: restore the frame's start and replay
 * into it (see MachineCore).
 */
export class History<S = any> {

  readonly core: DeterministicCore<S>;
  checkpointInterval: number;
  maxCheckpoints: number;
  private input?: FrameInputSource;
  private checkpoints: Checkpoint<S>[] = [];
  /** Latest point ever reached, i.e. the present. */
  private head: Timestamp = timestamp(0, 0);

  /** Called when the recorded range changes, for the UI's timeline. */
  onChange: () => void = null;

  constructor(core: DeterministicCore<S>, opts: HistoryOptions = {}) {
    this.core = core;
    this.checkpointInterval = opts.checkpointInterval ?? 10;
    this.maxCheckpoints = opts.maxCheckpoints ?? 300;
    this.input = opts.input;
    this.reset();
  }

  /** Start recording again from wherever the core is now. */
  reset(): void {
    this.checkpoints = [{ at: this.core.now(), state: this.core.snapshot() }];
    this.head = this.core.now();
    this.onChange?.();
  }

  /** Round a target to what the core can actually stop at. */
  clamp(t: Timestamp): Timestamp {
    return this.core.clamp ? this.core.clamp(t) : t;
  }

  /** Oldest point still reachable. Earlier checkpoints have been dropped. */
  first(): Timestamp { return this.checkpoints[0].at; }
  /** The present: the furthest point recording has reached. */
  last(): Timestamp { return this.head; }
  now(): Timestamp { return this.core.now(); }
  /** True if the core is showing a reconstructed past rather than the present. */
  isInPast(): boolean { return compareTimestamps(this.core.now(), this.head) < 0; }
  getCheckpoints(): ReadonlyArray<Checkpoint<S>> { return this.checkpoints; }

  /**
   * Run one frame at the head of the recording, capturing input and taking a
   * checkpoint when one is due. This is the recording loop; it must be called
   * with the core positioned at the head.
   */
  recordFrame(trap?: TrapCondition | null): RunResult {
    const t = this.core.now();
    if (compareTimestamps(t, this.head) !== 0) {
      throw new Error(`not at the head of the recording: ${formatTimestamp(t)} != ${formatTimestamp(this.head)}`);
    }
    if (t.step === 0) {
      this.input?.capture(t.frame);
      this.checkpointIfDue(t);
    }
    const r = this.core.runUntil(timestamp(t.frame + 1, 0), trap);
    this.head = r.at;
    this.onChange?.();
    return r;
  }

  private checkpointIfDue(at: Timestamp): void {
    const last = this.checkpoints[this.checkpoints.length - 1];
    if (last && at.frame - last.at.frame < this.checkpointInterval) return;
    this.checkpoints.push({ at, state: this.core.snapshot() });
    while (this.checkpoints.length > this.maxCheckpoints) {
      this.checkpoints.shift();
      this.input?.trim?.(this.checkpoints[0].at.frame);
    }
  }

  /** The latest checkpoint at or before t, or null if t is before the window. */
  checkpointAtOrBefore(t: Timestamp): Checkpoint<S> | null {
    for (var i = this.checkpoints.length - 1; i >= 0; i--) {
      if (compareTimestamps(this.checkpoints[i].at, t) <= 0) return this.checkpoints[i];
    }
    return null;
  }

  /**
   * Put the core at t, replaying from the nearest checkpoint. Seeking backwards
   * costs the same as seeking forwards -- that's the whole trick.
   */
  seek(t: Timestamp, trap?: TrapCondition | null): RunResult {
    t = this.clamp(t);
    if (compareTimestamps(t, this.head) > 0) t = this.head;
    const cp = this.checkpointAtOrBefore(t);
    if (!cp) {
      throw new Error(`${formatTimestamp(t)} is older than the recording`);
    }
    // only replay from the checkpoint if we can't just run forward to it
    const cur = this.core.now();
    if (compareTimestamps(cur, t) > 0 || compareTimestamps(cur, cp.at) < 0) {
      this.core.restore(cp.state, cp.at);
    }
    return this.runTo(t, trap);
  }

  /**
   * Run forward to t from the core's current position, re-applying recorded
   * input at each frame boundary. Frames are driven one at a time so the input
   * hook lands in the right place; the core handles everything within a frame.
   */
  private runTo(t: Timestamp, trap?: TrapCondition | null): RunResult {
    t = this.clamp(t);
    while (compareTimestamps(this.core.now(), t) < 0) {
      const at = this.core.now();
      if (at.step === 0) this.input?.replay(at.frame);
      const frameEnd = timestamp(at.frame + 1, 0);
      const stop = compareTimestamps(frameEnd, t) < 0 ? frameEnd : t;
      const r = this.core.runUntil(stop, trap);
      if (r.trapped) return r;
      // a core that reports no progress can't reach t; stop rather than spin
      if (compareTimestamps(r.at, at) <= 0) break;
    }
    return { at: this.core.now(), trapped: false };
  }

  /**
   * First moment in [from, to) where pred holds, or null. Leaves the core at
   * the hit, or at `to` if there wasn't one.
   */
  findNext(cond: SearchCondition, from?: Timestamp, to?: Timestamp): Timestamp | null {
    from = this.clamp(from ?? this.core.now());
    to = this.clamp(to ?? this.head);
    if (compareTimestamps(from, to) >= 0) return null;
    return this.withProbe(cond, () => {
      this.seek(from);
      conditionReset(cond);
      const r = this.runTo(to, conditionTest(cond));
      return r.trapped ? r.at : null;
    });
  }

  /**
   * Attach the condition's probe for the length of the search only. The core
   * runs unprobed the rest of the time, which is most of the time.
   */
  private withProbe<R>(cond: SearchCondition, body: () => R): R {
    const probe = typeof cond === 'function' ? null : cond.probe;
    if (!probe || !this.core.connectProbe) return body();
    this.core.connectProbe(probe);
    try {
      return body();
    } finally {
      this.core.connectProbe(null);
    }
  }

  /**
   * Last moment in [from, to) where pred holds, or null -- the reverse search
   * that "break on a condition that already happened" is built from.
   *
   * Walks back a checkpoint at a time and replays each span forward collecting
   * hits, so the cost is bounded by the checkpoint interval rather than by how
   * far back the answer is. Leaves the core parked on the hit.
   */
  findLast(cond: SearchCondition, from?: Timestamp, to?: Timestamp): Timestamp | null {
    from = this.clamp(from ?? this.first());
    to = this.clamp(to ?? this.core.now());
    if (compareTimestamps(from, to) >= 0) return null;
    return this.withProbe(cond, () => this.findLastUnprobed(cond, from, to));
  }

  private findLastUnprobed(cond: SearchCondition, from: Timestamp, to: Timestamp): Timestamp | null {
    for (var i = this.checkpoints.length - 1; i >= 0; i--) {
      const cp = this.checkpoints[i];
      if (compareTimestamps(cp.at, to) >= 0) continue;      // span is entirely ahead of us
      // search [max(cp, from), min(next checkpoint, to))
      const spanStart = compareTimestamps(cp.at, from) < 0 ? from : cp.at;
      const hit = this.lastHitIn(spanStart, to, cond);
      if (hit) {
        this.seek(hit);
        return hit;
      }
      to = cp.at;                                            // nothing here; look further back
      if (compareTimestamps(cp.at, from) <= 0) break;
    }
    return null;
  }

  /** Replay [from, to) collecting every hit, and report the last one. */
  private lastHitIn(from: Timestamp, to: Timestamp, cond: SearchCondition): Timestamp | null {
    this.seek(from);
    conditionReset(cond);
    const test = conditionTest(cond);
    var last: Timestamp = null;
    this.runTo(to, () => {
      if (test()) last = this.core.now();
      return false;    // keep going; we want the last hit, not the first
    });
    return last;
  }

  /**
   * The moment one step before t: reverse single-step. Exact, because it is
   * reached by replaying rather than by guessing a cycle count backwards.
   */
  previousStep(t?: Timestamp): Timestamp | null {
    t = t ?? this.core.now();
    if (compareTimestamps(t, this.first()) <= 0) return null;
    if (t.step > 0) {
      const prev = timestamp(t.frame, t.step - 1);
      this.seek(prev);
      return prev;
    }
    // step 0 of a frame: the previous step is the last step of the frame before
    if (t.frame - 1 < this.first().frame) return null;
    var steps = 0;
    this.seek(timestamp(t.frame - 1, 0));
    this.runTo(timestamp(t.frame, 0), () => { steps++; return false; });
    if (steps === 0) return null;
    const prev = timestamp(t.frame - 1, steps - 1);
    this.seek(prev);
    return prev;
  }
}
