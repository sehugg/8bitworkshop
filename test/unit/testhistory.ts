import assert from "assert";
import { describe, it } from "mocha";
import { TrapCondition } from "../../src/common/devices";
import { EmuHalt } from "../../src/common/emu";
import { stateSize } from "../../src/common/statehash";
import { FramePlatformCore } from "../../src/common/platformcore";
import { FrameInputSource, History } from "../../src/common/history";
import {
  formatTimestamp,
  MachineCore,
  timestamp,
  timestampsEqual,
} from "../../src/common/timeline";

// Same shape as the real machines: advanceFrame() restarts the frame rather
// than resuming it. `inp` stands in for a controller: it changes only between
// frames, and the frame's result depends on it, so a replay that forgets to
// re-apply it diverges visibly.
class FakeMachine {
  stepsPerFrame = 10;
  acc = 0;
  inp = 0;

  advanceFrame(trap: TrapCondition): number {
    var n = 0;
    for (var i = 0; i < this.stepsPerFrame; i++) {
      if (trap && trap()) break;
      this.acc = (this.acc + 1 + this.inp) | 0;
      n++;
    }
    return n;
  }
  saveState() { return { acc: this.acc, inp: this.inp }; }
  loadState(s) { this.acc = s.acc; this.inp = s.inp; }
}

function newHistory(opts = {}) {
  const m = new FakeMachine();
  const core = new MachineCore(m);
  return { m, core, hist: new History(core, opts) };
}

function record(hist: History, frames: number) {
  for (var i = 0; i < frames; i++) hist.recordFrame();
}

describe('History', function () {

  it('records frames and tracks the present', function () {
    const { m, hist } = newHistory();
    record(hist, 12);
    assert.ok(timestampsEqual(hist.last(), timestamp(12, 0)), formatTimestamp(hist.last()));
    assert.strictEqual(m.acc, 120);
    assert.strictEqual(hist.isInPast(), false);
  });

  it('checkpoints at the configured interval', function () {
    const { hist } = newHistory({ checkpointInterval: 5 });
    record(hist, 21);
    const at = hist.getCheckpoints().map(c => c.at.frame);
    assert.deepStrictEqual(at, [0, 5, 10, 15, 20]);
  });

  it('seeks backwards to an exact past state', function () {
    const { m, hist } = newHistory();
    record(hist, 30);
    hist.seek(timestamp(7, 3));
    assert.strictEqual(m.acc, 73);
    assert.strictEqual(hist.isInPast(), true);
    // and forward again to the present
    hist.seek(hist.last());
    assert.strictEqual(m.acc, 300);
    assert.strictEqual(hist.isInPast(), false);
  });

  it('replays recorded input so the past reproduces', function () {
    const m = new FakeMachine();
    const captured: { [frame: number]: number } = {};
    // frame N runs with input N%3, which changes what the frame computes
    const input: FrameInputSource = {
      capture(frame) { m.inp = frame % 3; captured[frame] = m.inp; },
      replay(frame) { m.inp = captured[frame]; },
    };
    const hist = new History(new MachineCore(m), { input });
    record(hist, 20);
    const present = m.acc;

    hist.seek(timestamp(9, 4));
    const at94 = m.acc;
    // an unrecorded replay would leave inp stuck at its last value and drift
    hist.seek(hist.last());
    assert.strictEqual(m.acc, present);
    hist.seek(timestamp(9, 4));
    assert.strictEqual(m.acc, at94);
  });

  it('finds the last time a condition held, in the past', function () {
    const { m, hist } = newHistory();
    record(hist, 30);
    // acc hits 250 exactly once, at 25:0 -- 250 steps in
    const hit = hist.findLast(() => m.acc === 250);
    assert.ok(hit, 'no hit');
    assert.ok(timestampsEqual(hit, timestamp(25, 0)), formatTimestamp(hit));
    // and the core is parked there
    assert.strictEqual(m.acc, 250);
  });

  it('finds the LAST of many hits, not the first', function () {
    const { m, hist } = newHistory();
    record(hist, 30);
    // true every 7 steps; the last one at or before 300 is 294
    const hit = hist.findLast(() => m.acc % 7 === 0 && m.acc > 0);
    assert.ok(timestampsEqual(hit, timestamp(29, 4)), formatTimestamp(hit));
    assert.strictEqual(m.acc, 294);
  });

  it('searches back across many checkpoint spans', function () {
    const { m, hist } = newHistory({ checkpointInterval: 4 });
    record(hist, 40);
    // only true early on, so the search has to walk back ~8 spans
    const hit = hist.findLast(() => m.acc === 37);
    assert.ok(timestampsEqual(hit, timestamp(3, 7)), formatTimestamp(hit));
    assert.strictEqual(m.acc, 37);
  });

  it('returns null when the condition never held', function () {
    const { m, hist } = newHistory();
    record(hist, 20);
    assert.strictEqual(hist.findLast(() => m.acc === 99999), null);
  });

  it('finds the next time a condition holds', function () {
    const { m, hist } = newHistory();
    record(hist, 30);
    hist.seek(timestamp(5, 0));
    const hit = hist.findNext(() => m.acc === 123, timestamp(5, 0), hist.last());
    assert.ok(timestampsEqual(hit, timestamp(12, 3)), formatTimestamp(hit));
    assert.strictEqual(m.acc, 123);
  });

  it('steps backwards exactly, within a frame', function () {
    const { m, hist } = newHistory();
    record(hist, 20);
    hist.seek(timestamp(8, 5));
    const prev = hist.previousStep();
    assert.ok(timestampsEqual(prev, timestamp(8, 4)), formatTimestamp(prev));
    assert.strictEqual(m.acc, 84);
  });

  it('steps backwards across a frame boundary', function () {
    const { m, hist } = newHistory();
    record(hist, 20);
    hist.seek(timestamp(8, 0));
    const prev = hist.previousStep();
    // last step of frame 7 is position 9, i.e. 79 steps in
    assert.ok(timestampsEqual(prev, timestamp(7, 9)), formatTimestamp(prev));
    assert.strictEqual(m.acc, 79);
  });

  it('drops the oldest checkpoints and reports the window it still has', function () {
    const trimmed: number[] = [];
    const input: FrameInputSource = {
      capture() { }, replay() { }, trim(f) { trimmed.push(f); },
    };
    const { hist } = newHistory({ checkpointInterval: 2, maxCheckpoints: 4, input });
    record(hist, 20);
    const at = hist.getCheckpoints().map(c => c.at.frame);
    assert.strictEqual(at.length, 4);
    assert.ok(at[0] > 0, 'old checkpoints should have been dropped');
    assert.ok(timestampsEqual(hist.first(), timestamp(at[0], 0)));
    // the input log is told to drop everything before the oldest checkpoint
    assert.strictEqual(trimmed[trimmed.length - 1], at[0]);
  });

  it('refuses to seek before the recorded window', function () {
    const { hist } = newHistory({ checkpointInterval: 2, maxCheckpoints: 3 });
    record(hist, 20);
    assert.throws(() => hist.seek(timestamp(0, 0)), /older than the recording/);
  });

  it('truncates the future mid-frame and records a new one', function () {
    const truncated: number[] = [];
    const input: FrameInputSource = {
      capture() { }, replay() { }, truncate(f) { truncated.push(f); },
    };
    const { m, hist } = newHistory({ checkpointInterval: 5, input });
    record(hist, 20);
    hist.seek(timestamp(8, 5));
    hist.truncate();
    assert.ok(timestampsEqual(hist.last(), timestamp(8, 5)), formatTimestamp(hist.last()));
    assert.strictEqual(hist.isInPast(), false);
    assert.deepStrictEqual(hist.getCheckpoints().map(c => c.at.frame), [0, 5]);
    // frame 8 already took its input, so only later frames are dropped
    assert.deepStrictEqual(truncated, [9]);
    // recording finishes frame 8, then carries on
    hist.recordFrame();
    assert.ok(timestampsEqual(hist.last(), timestamp(9, 0)), formatTimestamp(hist.last()));
    assert.strictEqual(m.acc, 90);
  });

  it('truncates at a frame boundary, and the new future replays', function () {
    const m = new FakeMachine();
    const log: { [frame: number]: number } = {};
    var live = 0;
    // input comes from `live`, as a player's would
    const input: FrameInputSource = {
      capture(frame) { log[frame] = m.inp = live; },
      replay(frame) { m.inp = log[frame]; },
      truncate(f) { for (const k of Object.keys(log)) if (+k >= f) delete log[+k]; },
    };
    const hist = new History(new MachineCore(m), { checkpointInterval: 5, input });
    record(hist, 20);
    hist.seek(timestamp(12, 0));
    hist.truncate();
    assert.strictEqual(log[12], undefined, 'frame 12 must take new input');
    live = 1;
    record(hist, 8);
    assert.ok(timestampsEqual(hist.last(), timestamp(20, 0)));
    const present = m.acc;
    assert.strictEqual(present, 120 + 8 * 20);
    // the new branch reproduces
    hist.seek(timestamp(3, 0));
    hist.seek(hist.last());
    assert.strictEqual(m.acc, present);
  });

  it('keeps checkpoints within a byte budget', function () {
    // same machine, but with 1000 bytes of RAM in its state
    class BigMachine extends FakeMachine {
      ram = new Uint8Array(1000);
      saveState() { return { ...super.saveState(), ram: this.ram.slice() }; }
      loadState(s) { super.loadState(s); this.ram.set(s.ram); }
    }
    const one = stateSize(new BigMachine().saveState());
    assert.ok(one >= 1000 && one < 1100, `size ${one}`);
    const hist = new History(new MachineCore(new BigMachine()), { checkpointInterval: 2, maxBytes: one * 3 + 10 });
    record(hist, 20);
    assert.strictEqual(hist.getCheckpoints().length, 3);
    assert.ok(hist.getCheckpointBytes() <= one * 3 + 10);
    // taken as each frame starts, so the last is frame 18
    assert.deepStrictEqual(hist.getCheckpoints().map(c => c.at.frame), [14, 16, 18]);
  });

  it('keeps one checkpoint even if it is over budget', function () {
    const { hist } = newHistory({ checkpointInterval: 2, maxBytes: 1 });
    record(hist, 10);
    assert.strictEqual(hist.getCheckpoints().length, 1);
    assert.ok(timestampsEqual(hist.first(), timestamp(8, 0)), formatTimestamp(hist.first()));
  });

  it('records up to a halt, stops there, and rewinds from it', function () {
    class HaltingMachine extends FakeMachine {
      advanceFrame(trap: TrapCondition): number {
        var n = 0;
        for (var i = 0; i < this.stepsPerFrame; i++) {
          if (trap && trap()) break;
          if (this.acc === 123) throw new EmuHalt('KIL');
          this.acc = (this.acc + 1) | 0;
          n++;
        }
        return n;
      }
    }
    const m = new HaltingMachine();
    const hist = new History(new MachineCore(m), { checkpointInterval: 5 });
    var r;
    for (var i = 0; i < 20 && !r?.halt; i++) r = hist.recordFrame();
    assert.ok(r.halt instanceof EmuHalt, 'expected a halt');
    assert.ok(timestampsEqual(hist.last(), timestamp(12, 3)), formatTimestamp(hist.last()));
    assert.strictEqual(m.acc, 123);
    // recording again halts at the same place
    r = hist.recordFrame();
    assert.ok(r.halt instanceof EmuHalt);
    assert.ok(timestampsEqual(hist.last(), timestamp(12, 3)));
    // the past before the halt is all there
    assert.ok(timestampsEqual(hist.previousStep(), timestamp(12, 2)));
    assert.strictEqual(m.acc, 122);
    const hit = hist.findLast(() => m.acc === 77);
    assert.ok(timestampsEqual(hit, timestamp(7, 7)), formatTimestamp(hit));
    // and seeking back to the present doesn't halt
    assert.strictEqual(hist.seek(hist.last()).halt, undefined);
    assert.strictEqual(m.acc, 123);
  });

  it('reports a halt at the frame boundary on a frame-only core', function () {
    var frames = 0;
    const platform: any = {
      advance() { if (++frames === 4) throw new EmuHalt('CPU STOPPED'); },
      saveState() { return { frames }; },
      loadState(s) { frames = s.frames; },
    };
    const core = new FramePlatformCore(platform);
    const r = core.runUntil(timestamp(10, 0));
    assert.ok(r.halt instanceof EmuHalt, 'expected a halt');
    assert.ok(timestampsEqual(r.at, timestamp(3, 0)), formatTimestamp(r.at));
  });

  it('refuses to record from a replayed past', function () {
    const { hist } = newHistory();
    record(hist, 10);
    hist.seek(timestamp(4, 0));
    assert.throws(() => hist.recordFrame(), /not at the head/);
  });
});
