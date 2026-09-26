// autobuild - decides when to build as the user types and saves. No vscode
// imports, and the clock is injectable, so tests can drive it.
//
// Changes wait for a pause in typing; a save builds at once. A build never
// overlaps another: changes during a build ask for one more, which starts
// when it finishes with the newest buffers. Slow builds stretch the pause.

export type BuildReason = 'type' | 'save' | 'command';

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): any;
  clearTimeout(handle: any): void;
}

export const realClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h),
};

export interface SchedulerOptions {
  /** wait this long after the last change */
  debounceMs?: number;
  /** builds slower than this stretch the wait to twice their time */
  slowMs?: number;
  clock?: Clock;
}

const PRIORITY: { [r in BuildReason]: number } = { type: 0, save: 1, command: 2 };

export class BuildScheduler {
  readonly debounceMs: number;
  readonly slowMs: number;
  readonly clock: Clock;
  /** how long the last build took */
  lastBuildMs = 0;
  /** when the user last changed something */
  lastChange = 0;
  private timer: any = null;
  private building = false;
  private pending: BuildReason | null = null;

  /** `build` runs one build; its promise settles when the build is done. */
  constructor(readonly build: (reason: BuildReason) => Promise<void>, opts: SchedulerOptions = {}) {
    this.debounceMs = opts.debounceMs ?? 300;
    this.slowMs = opts.slowMs ?? 1000;
    this.clock = opts.clock ?? realClock;
  }

  /** The wait after a change: the debounce, or longer after slow builds. */
  get delayMs(): number {
    return this.lastBuildMs > this.slowMs ? Math.max(this.debounceMs, this.lastBuildMs * 2) : this.debounceMs;
  }

  get busy(): boolean {
    return this.building || this.timer != null;
  }

  /** A file the build reads changed (typing). */
  changed() {
    this.lastChange = this.clock.now();
    this.cancelTimer();
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      this.request('type');
    }, this.delayMs);
  }

  /** A file the build reads was saved, or the user asked for a build. */
  now(reason: BuildReason = 'save') {
    this.cancelTimer();
    return this.request(reason);
  }

  /** Drop a waiting build (the project went away). */
  cancel() {
    this.cancelTimer();
    this.pending = null;
  }

  private cancelTimer() {
    if (this.timer != null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  private async request(reason: BuildReason): Promise<void> {
    if (this.building) {
      // one more build when this one ends, for the strongest reason asked
      if (this.pending == null || PRIORITY[reason] > PRIORITY[this.pending]) this.pending = reason;
      return;
    }
    this.building = true;
    var t0 = this.clock.now();
    try {
      await this.build(reason);
    } finally {
      this.lastBuildMs = this.clock.now() - t0;
      this.building = false;
    }
    if (this.pending != null) {
      var next = this.pending;
      this.pending = null;
      await this.request(next);
    }
  }
}
