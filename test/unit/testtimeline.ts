import assert from "assert";
import { describe, it } from "mocha";
import { TrapCondition } from "../../src/common/devices";
import { EmuHalt } from "../../src/common/emu";
import {
  compareTimestamps,
  CoreMachine,
  formatTimestamp,
  MachineCore,
  timestamp,
  timestampsEqual,
} from "../../src/common/timeline";

// A machine with the same awkward property the real ones have: advanceFrame()
// restarts the frame from the top instead of resuming it, so breaking out
// mid-frame and calling it again re-runs the frame. MachineCore has to replay
// from a frame-start snapshot to get back to a sub-frame position.
class FakeMachine implements CoreMachine {
  stepsPerFrame = 10;
  acc = 0;                     // one increment per step
  ram = new Uint8Array(16);

  advanceFrame(trap: TrapCondition): number {
    var n = 0;
    for (var i = 0; i < this.stepsPerFrame; i++) {
      if (trap && trap()) break;
      this.acc = (this.acc + 1) | 0;
      this.ram[this.acc & 15] = this.acc & 0xff;
      n++;
    }
    return n;
  }
  saveState() {
    return { acc: this.acc, ram: this.ram.slice(0) };
  }
  loadState(s) {
    this.acc = s.acc;
    this.ram.set(s.ram);
  }
}

function stateOf(m: FakeMachine) {
  return JSON.stringify({ acc: m.acc, ram: Array.from(m.ram) });
}

describe('Timestamp', function () {
  it('orders lexicographically by frame then step', function () {
    assert.ok(compareTimestamps(timestamp(1, 5), timestamp(2, 0)) < 0);
    assert.ok(compareTimestamps(timestamp(2, 0), timestamp(1, 5)) > 0);
    assert.ok(compareTimestamps(timestamp(2, 3), timestamp(2, 4)) < 0);
    assert.strictEqual(compareTimestamps(timestamp(2, 3), timestamp(2, 3)), 0);
    assert.ok(timestampsEqual(timestamp(2, 3), timestamp(2, 3)));
    assert.strictEqual(formatTimestamp(timestamp(2, 3)), '2:3');
  });
});

describe('MachineCore', function () {

  it('finishes a frame it stopped in before running whole frames', function () {
    const m = new FakeMachine();
    const c = new MachineCore(m);
    c.runUntil(timestamp(2, 5));
    // no trap and a frame-boundary target: must not restart frame 2 midway
    c.runUntil(timestamp(4, 0));
    assert.strictEqual(m.acc, 40);
  });

  it('ignores an error from the frame tail after a stop, but not otherwise', function () {
    // like galaxian: code after the CPU loop mutates state and may throw
    class TailMachine extends FakeMachine {
      watchdog = 0;
      advanceFrame(trap: TrapCondition): number {
        const n = super.advanceFrame(trap);
        this.acc += 1000;
        if (++this.watchdog >= 3) throw new Error('watchdog');
        return n;
      }
      saveState() { return { ...super.saveState(), watchdog: this.watchdog }; }
      loadState(s) { super.loadState(s); this.watchdog = s.watchdog; }
    }
    const m = new TailMachine();
    const c = new MachineCore(m);
    c.runUntil(timestamp(2, 0));
    // the tail throws on this frame, but the stop comes first
    var steps = 0;
    const r = c.runUntil(timestamp(3, 0), () => steps++ === 5);
    assert.ok(r.trapped);
    assert.ok(timestampsEqual(r.at, timestamp(2, 5)), formatTimestamp(r.at));
    assert.strictEqual(m.acc, 2025);
    assert.strictEqual(m.watchdog, 2);
    // finishing the frame runs the tail for real
    assert.throws(() => c.runUntil(timestamp(3, 0)), /watchdog/);
  });


  it('counts frames monotonically and never rewinds the clock', function () {
    const m = new FakeMachine();
    const c = new MachineCore(m);
    assert.ok(timestampsEqual(c.now(), timestamp(0, 0)));
    c.runUntil(timestamp(3, 0));
    // the old debugger reset its clock every frame; this must not
    assert.ok(timestampsEqual(c.now(), timestamp(3, 0)));
    assert.strictEqual(m.acc, 30);
  });

  it('lands exactly on a sub-frame target', function () {
    const m = new FakeMachine();
    const c = new MachineCore(m);
    const r = c.runUntil(timestamp(2, 5));
    assert.ok(timestampsEqual(r.at, timestamp(2, 5)), formatTimestamp(r.at));
    assert.strictEqual(r.trapped, false);
    assert.strictEqual(m.acc, 25);
  });

  it('evaluates a trap across frame boundaries', function () {
    const m = new FakeMachine();
    const c = new MachineCore(m);
    // 23 steps in => frame 2, step 3; the trap has to survive two frame ends
    const r = c.runUntil(timestamp(9, 0), () => m.acc === 23);
    assert.strictEqual(r.trapped, true);
    assert.ok(timestampsEqual(r.at, timestamp(2, 3)), formatTimestamp(r.at));
    assert.strictEqual(m.acc, 23);
  });

  it('reports no trap when the condition never holds', function () {
    const m = new FakeMachine();
    const c = new MachineCore(m);
    const r = c.runUntil(timestamp(2, 0), () => m.acc === 9999);
    assert.strictEqual(r.trapped, false);
    assert.ok(timestampsEqual(r.at, timestamp(2, 0)));
  });

  it('resumes within a frame without re-running the trap on replayed steps', function () {
    const m = new FakeMachine();
    const c = new MachineCore(m);
    c.runUntil(timestamp(1, 4));
    assert.strictEqual(m.acc, 14);
    // getting from 1:4 to 1:9 replays the frame from its start internally,
    // but the trap must only see positions 4..8
    const seen: number[] = [];
    const r = c.runUntil(timestamp(1, 9), () => { seen.push(m.acc); return false; });
    assert.deepStrictEqual(seen, [14, 15, 16, 17, 18]);
    assert.ok(timestampsEqual(r.at, timestamp(1, 9)));
    assert.strictEqual(m.acc, 19);
  });

  it('reproduces the same state when replayed from a snapshot', function () {
    const m = new FakeMachine();
    const c = new MachineCore(m);
    const snap0 = c.snapshot();
    c.runUntil(timestamp(3, 7));
    const expected = stateOf(m);

    c.restore(snap0, timestamp(0, 0));
    assert.ok(timestampsEqual(c.now(), timestamp(0, 0)));
    c.runUntil(timestamp(3, 7));
    assert.strictEqual(stateOf(m), expected);
  });

  it('seeks backwards to a sub-frame position exactly', function () {
    // what the state should be at 2:3, established independently
    const fresh = new FakeMachine();
    new MachineCore(fresh).runUntil(timestamp(2, 3));
    const expected = stateOf(fresh);

    const m = new FakeMachine();
    const c = new MachineCore(m);
    const snap0 = c.snapshot();
    c.runUntil(timestamp(2, 9));
    assert.notStrictEqual(stateOf(m), expected);

    c.restore(snap0, timestamp(0, 0));
    c.runUntil(timestamp(2, 3));
    assert.ok(timestampsEqual(c.now(), timestamp(2, 3)));
    assert.strictEqual(stateOf(m), expected);
  });

  it('restores a checkpoint taken mid-recording', function () {
    const m = new FakeMachine();
    const c = new MachineCore(m);
    c.runUntil(timestamp(5, 0));
    const snap5 = c.snapshot();
    c.runUntil(timestamp(8, 2));
    const at82 = stateOf(m);

    c.restore(snap5, timestamp(5, 0));
    assert.strictEqual(m.acc, 50);
    c.runUntil(timestamp(8, 2));
    assert.strictEqual(stateOf(m), at82);
  });

  it('refuses to restore at a non-frame boundary', function () {
    const m = new FakeMachine();
    const c = new MachineCore(m);
    assert.throws(() => c.restore(c.snapshot(), timestamp(1, 3)), /frame boundary/);
  });

  it('does nothing when the target is already reached', function () {
    const m = new FakeMachine();
    const c = new MachineCore(m);
    c.runUntil(timestamp(2, 4));
    const before = stateOf(m);
    const r = c.runUntil(timestamp(1, 0));
    assert.strictEqual(stateOf(m), before);
    assert.ok(timestampsEqual(r.at, timestamp(2, 4)));
  });
});

// A machine whose CPU executes a halt instruction (6502 KIL) when acc reaches
// haltAt: the step throws EmuHalt partway through, as MOS6502 does.
class HaltingMachine extends FakeMachine {
  haltAt = 23;
  error: () => Error = () => new EmuHalt('CPU executed halt instruction');
  advanceFrame(trap: TrapCondition): number {
    var n = 0;
    for (var i = 0; i < this.stepsPerFrame; i++) {
      if (trap && trap()) break;
      if (this.acc === this.haltAt) throw this.error();
      this.acc = (this.acc + 1) | 0;
      n++;
    }
    return n;
  }
}

describe('MachineCore halts', function () {

  it('reports a halt as a stop before the halting step, running unmetered', function () {
    const m = new HaltingMachine();
    const c = new MachineCore(m);
    const r = c.runUntil(timestamp(5, 0));
    assert.ok(r.halt instanceof EmuHalt, 'expected a halt');
    assert.strictEqual(r.trapped, false);
    // frame 2 starts at acc 20; step 3 is the one that halts
    assert.ok(timestampsEqual(r.at, timestamp(2, 3)), formatTimestamp(r.at));
    assert.ok(timestampsEqual(c.now(), timestamp(2, 3)));
    assert.strictEqual(m.acc, 23);
  });

  it('reports the same halt when metered', function () {
    const m = new HaltingMachine();
    const c = new MachineCore(m);
    const r = c.runUntil(timestamp(5, 0), () => false);
    assert.ok(r.halt instanceof EmuHalt);
    assert.ok(timestampsEqual(r.at, timestamp(2, 3)), formatTimestamp(r.at));
    assert.strictEqual(m.acc, 23);
  });

  it('halts again, without progress, when run on from a halt', function () {
    const m = new HaltingMachine();
    const c = new MachineCore(m);
    c.runUntil(timestamp(5, 0));
    const r = c.runUntil(timestamp(5, 0));
    assert.ok(r.halt instanceof EmuHalt);
    assert.ok(timestampsEqual(r.at, timestamp(2, 3)), formatTimestamp(r.at));
    assert.strictEqual(m.acc, 23);
  });

  it('can reach every step up to the halt without halting', function () {
    const m = new HaltingMachine();
    const c = new MachineCore(m);
    const snap = c.snapshot();
    const r = c.runUntil(timestamp(2, 3));
    assert.strictEqual(r.halt, undefined);
    assert.strictEqual(m.acc, 23);
    c.restore(snap, timestamp(0, 0));
    assert.strictEqual(c.runUntil(timestamp(2, 2)).halt, undefined);
    assert.strictEqual(m.acc, 22);
  });

  it('lets errors that are not halts propagate', function () {
    const m = new HaltingMachine();
    m.error = () => new TypeError('emulator bug');
    const c = new MachineCore(m);
    assert.throws(() => c.runUntil(timestamp(5, 0)), TypeError);
  });
});

