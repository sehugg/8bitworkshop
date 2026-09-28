import assert from "assert";
import { describe, it } from "mocha";
import { TrapCondition } from "../../src/common/devices";
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

  it('counts steps only for metered frames', function () {
    const m = new FakeMachine();
    const c = new MachineCore(m);
    c.runUntil(timestamp(1, 0));            // no trap: unmetered fast path
    assert.strictEqual(c.getLastFrameSteps(), -1);
    c.runUntil(timestamp(2, 0), () => false); // trap: counted
    assert.strictEqual(c.getLastFrameSteps(), 10);
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
