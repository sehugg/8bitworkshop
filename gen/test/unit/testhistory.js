"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const emu_1 = require("../../src/common/emu");
const statehash_1 = require("../../src/common/statehash");
const platformcore_1 = require("../../src/common/platformcore");
const history_1 = require("../../src/common/history");
const timeline_1 = require("../../src/common/timeline");
// Same shape as the real machines: advanceFrame() restarts the frame rather
// than resuming it. `inp` stands in for a controller: it changes only between
// frames, and the frame's result depends on it, so a replay that forgets to
// re-apply it diverges visibly.
class FakeMachine {
    constructor() {
        this.stepsPerFrame = 10;
        this.acc = 0;
        this.inp = 0;
    }
    advanceFrame(trap) {
        var n = 0;
        for (var i = 0; i < this.stepsPerFrame; i++) {
            if (trap && trap())
                break;
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
    const core = new timeline_1.MachineCore(m);
    return { m, core, hist: new history_1.History(core, opts) };
}
function record(hist, frames) {
    for (var i = 0; i < frames; i++)
        hist.recordFrame();
}
(0, mocha_1.describe)('History', function () {
    (0, mocha_1.it)('records frames and tracks the present', function () {
        const { m, hist } = newHistory();
        record(hist, 12);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hist.last(), (0, timeline_1.timestamp)(12, 0)), (0, timeline_1.formatTimestamp)(hist.last()));
        assert_1.default.strictEqual(m.acc, 120);
        assert_1.default.strictEqual(hist.isInPast(), false);
    });
    (0, mocha_1.it)('checkpoints at the configured interval', function () {
        const { hist } = newHistory({ checkpointInterval: 5 });
        record(hist, 21);
        const at = hist.getCheckpoints().map(c => c.at.frame);
        assert_1.default.deepStrictEqual(at, [0, 5, 10, 15, 20]);
    });
    (0, mocha_1.it)('seeks backwards to an exact past state', function () {
        const { m, hist } = newHistory();
        record(hist, 30);
        hist.seek((0, timeline_1.timestamp)(7, 3));
        assert_1.default.strictEqual(m.acc, 73);
        assert_1.default.strictEqual(hist.isInPast(), true);
        // and forward again to the present
        hist.seek(hist.last());
        assert_1.default.strictEqual(m.acc, 300);
        assert_1.default.strictEqual(hist.isInPast(), false);
    });
    (0, mocha_1.it)('replays recorded input so the past reproduces', function () {
        const m = new FakeMachine();
        const captured = {};
        // frame N runs with input N%3, which changes what the frame computes
        const input = {
            capture(frame) { m.inp = frame % 3; captured[frame] = m.inp; },
            replay(frame) { m.inp = captured[frame]; },
        };
        const hist = new history_1.History(new timeline_1.MachineCore(m), { input });
        record(hist, 20);
        const present = m.acc;
        hist.seek((0, timeline_1.timestamp)(9, 4));
        const at94 = m.acc;
        // an unrecorded replay would leave inp stuck at its last value and drift
        hist.seek(hist.last());
        assert_1.default.strictEqual(m.acc, present);
        hist.seek((0, timeline_1.timestamp)(9, 4));
        assert_1.default.strictEqual(m.acc, at94);
    });
    (0, mocha_1.it)('finds the last time a condition held, in the past', function () {
        const { m, hist } = newHistory();
        record(hist, 30);
        // acc hits 250 exactly once, at 25:0 -- 250 steps in
        const hit = hist.findLast(() => m.acc === 250);
        assert_1.default.ok(hit, 'no hit');
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hit, (0, timeline_1.timestamp)(25, 0)), (0, timeline_1.formatTimestamp)(hit));
        // and the core is parked there
        assert_1.default.strictEqual(m.acc, 250);
    });
    (0, mocha_1.it)('finds the LAST of many hits, not the first', function () {
        const { m, hist } = newHistory();
        record(hist, 30);
        // true every 7 steps; the last one at or before 300 is 294
        const hit = hist.findLast(() => m.acc % 7 === 0 && m.acc > 0);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hit, (0, timeline_1.timestamp)(29, 4)), (0, timeline_1.formatTimestamp)(hit));
        assert_1.default.strictEqual(m.acc, 294);
    });
    (0, mocha_1.it)('searches back across many checkpoint spans', function () {
        const { m, hist } = newHistory({ checkpointInterval: 4 });
        record(hist, 40);
        // only true early on, so the search has to walk back ~8 spans
        const hit = hist.findLast(() => m.acc === 37);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hit, (0, timeline_1.timestamp)(3, 7)), (0, timeline_1.formatTimestamp)(hit));
        assert_1.default.strictEqual(m.acc, 37);
    });
    (0, mocha_1.it)('returns null when the condition never held', function () {
        const { m, hist } = newHistory();
        record(hist, 20);
        assert_1.default.strictEqual(hist.findLast(() => m.acc === 99999), null);
    });
    (0, mocha_1.it)('drops the oldest checkpoints and reports the window it still has', function () {
        const trimmed = [];
        const input = {
            capture() { }, replay() { }, trim(f) { trimmed.push(f); },
        };
        const { hist } = newHistory({ checkpointInterval: 2, maxCheckpoints: 4, input });
        record(hist, 20);
        const at = hist.getCheckpoints().map(c => c.at.frame);
        assert_1.default.strictEqual(at.length, 4);
        assert_1.default.ok(at[0] > 0, 'old checkpoints should have been dropped');
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hist.first(), (0, timeline_1.timestamp)(at[0], 0)));
        // the input log is told to drop everything before the oldest checkpoint
        assert_1.default.strictEqual(trimmed[trimmed.length - 1], at[0]);
    });
    (0, mocha_1.it)('refuses to seek before the recorded window', function () {
        const { hist } = newHistory({ checkpointInterval: 2, maxCheckpoints: 3 });
        record(hist, 20);
        assert_1.default.throws(() => hist.seek((0, timeline_1.timestamp)(0, 0)), /older than the recording/);
    });
    (0, mocha_1.it)('truncates the future mid-frame and records a new one', function () {
        const truncated = [];
        const input = {
            capture() { }, replay() { }, truncate(f) { truncated.push(f); },
        };
        const { m, hist } = newHistory({ checkpointInterval: 5, input });
        record(hist, 20);
        hist.seek((0, timeline_1.timestamp)(8, 5));
        hist.truncate();
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hist.last(), (0, timeline_1.timestamp)(8, 5)), (0, timeline_1.formatTimestamp)(hist.last()));
        assert_1.default.strictEqual(hist.isInPast(), false);
        assert_1.default.deepStrictEqual(hist.getCheckpoints().map(c => c.at.frame), [0, 5]);
        // frame 8 already took its input, so only later frames are dropped
        assert_1.default.deepStrictEqual(truncated, [9]);
        // recording finishes frame 8, then carries on
        hist.recordFrame();
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hist.last(), (0, timeline_1.timestamp)(9, 0)), (0, timeline_1.formatTimestamp)(hist.last()));
        assert_1.default.strictEqual(m.acc, 90);
    });
    (0, mocha_1.it)('truncates at a frame boundary, and the new future replays', function () {
        const m = new FakeMachine();
        const log = {};
        var live = 0;
        // input comes from `live`, as a player's would
        const input = {
            capture(frame) { log[frame] = m.inp = live; },
            replay(frame) { m.inp = log[frame]; },
            truncate(f) { for (const k of Object.keys(log))
                if (+k >= f)
                    delete log[+k]; },
        };
        const hist = new history_1.History(new timeline_1.MachineCore(m), { checkpointInterval: 5, input });
        record(hist, 20);
        hist.seek((0, timeline_1.timestamp)(12, 0));
        hist.truncate();
        assert_1.default.strictEqual(log[12], undefined, 'frame 12 must take new input');
        live = 1;
        record(hist, 8);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hist.last(), (0, timeline_1.timestamp)(20, 0)));
        const present = m.acc;
        assert_1.default.strictEqual(present, 120 + 8 * 20);
        // the new branch reproduces
        hist.seek((0, timeline_1.timestamp)(3, 0));
        hist.seek(hist.last());
        assert_1.default.strictEqual(m.acc, present);
    });
    (0, mocha_1.it)('keeps checkpoints within a byte budget', function () {
        // same machine, but with 1000 bytes of RAM in its state
        class BigMachine extends FakeMachine {
            constructor() {
                super(...arguments);
                this.ram = new Uint8Array(1000);
            }
            saveState() { return Object.assign(Object.assign({}, super.saveState()), { ram: this.ram.slice() }); }
            loadState(s) { super.loadState(s); this.ram.set(s.ram); }
        }
        const one = (0, statehash_1.stateSize)(new BigMachine().saveState());
        assert_1.default.ok(one >= 1000 && one < 1100, `size ${one}`);
        const hist = new history_1.History(new timeline_1.MachineCore(new BigMachine()), { checkpointInterval: 2, maxBytes: one * 3 + 10 });
        record(hist, 20);
        assert_1.default.strictEqual(hist.getCheckpoints().length, 3);
        assert_1.default.ok(hist.getCheckpointBytes() <= one * 3 + 10);
        // taken as each frame starts, so the last is frame 18
        assert_1.default.deepStrictEqual(hist.getCheckpoints().map(c => c.at.frame), [14, 16, 18]);
    });
    (0, mocha_1.it)('keeps one checkpoint even if it is over budget', function () {
        const { hist } = newHistory({ checkpointInterval: 2, maxBytes: 1 });
        record(hist, 10);
        assert_1.default.strictEqual(hist.getCheckpoints().length, 1);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hist.first(), (0, timeline_1.timestamp)(8, 0)), (0, timeline_1.formatTimestamp)(hist.first()));
    });
    (0, mocha_1.it)('records up to a halt, stops there, and rewinds from it', function () {
        class HaltingMachine extends FakeMachine {
            advanceFrame(trap) {
                var n = 0;
                for (var i = 0; i < this.stepsPerFrame; i++) {
                    if (trap && trap())
                        break;
                    if (this.acc === 123)
                        throw new emu_1.EmuHalt('KIL');
                    this.acc = (this.acc + 1) | 0;
                    n++;
                }
                return n;
            }
        }
        const m = new HaltingMachine();
        const hist = new history_1.History(new timeline_1.MachineCore(m), { checkpointInterval: 5 });
        var r;
        for (var i = 0; i < 20 && !(r === null || r === void 0 ? void 0 : r.halt); i++)
            r = hist.recordFrame();
        assert_1.default.ok(r.halt instanceof emu_1.EmuHalt, 'expected a halt');
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hist.last(), (0, timeline_1.timestamp)(12, 3)), (0, timeline_1.formatTimestamp)(hist.last()));
        assert_1.default.strictEqual(m.acc, 123);
        // recording again halts at the same place
        r = hist.recordFrame();
        assert_1.default.ok(r.halt instanceof emu_1.EmuHalt);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hist.last(), (0, timeline_1.timestamp)(12, 3)));
        // the past before the halt is all there
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hist.findLast(() => true, hist.first(), hist.now()), (0, timeline_1.timestamp)(12, 2)));
        assert_1.default.strictEqual(m.acc, 122);
        const hit = hist.findLast(() => m.acc === 77);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hit, (0, timeline_1.timestamp)(7, 7)), (0, timeline_1.formatTimestamp)(hit));
        // and seeking back to the present doesn't halt
        assert_1.default.strictEqual(hist.seek(hist.last()).halt, undefined);
        assert_1.default.strictEqual(m.acc, 123);
    });
    (0, mocha_1.it)('reports a halt at the frame boundary on a frame-only core', function () {
        var frames = 0;
        const platform = {
            advance() { if (++frames === 4)
                throw new emu_1.EmuHalt('CPU STOPPED'); },
            saveState() { return { frames }; },
            loadState(s) { frames = s.frames; },
        };
        const core = new platformcore_1.FramePlatformCore(platform);
        const r = core.runUntil((0, timeline_1.timestamp)(10, 0));
        assert_1.default.ok(r.halt instanceof emu_1.EmuHalt, 'expected a halt');
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(3, 0)), (0, timeline_1.formatTimestamp)(r.at));
    });
    (0, mocha_1.it)('refuses to record from a replayed past', function () {
        const { hist } = newHistory();
        record(hist, 10);
        hist.seek((0, timeline_1.timestamp)(4, 0));
        assert_1.default.throws(() => hist.recordFrame(), /not at the head/);
    });
});
(0, mocha_1.describe)('History with key events', function () {
    // A key event is not idempotent: each one bumps `inp`, as a keypress that
    // lands in a queue does (c64). Delivering one twice diverges.
    function newKeyed(checkpointInterval) {
        const m = new FakeMachine();
        const core = new timeline_1.MachineCore(m);
        const input = new platformcore_1.PlatformFrameInput({}, {
            now: () => core.now(),
            dispatchKey: () => { m.inp++; },
        });
        const hist = new history_1.History(core, { checkpointInterval, input });
        return { m, core, input, hist };
    }
    (0, mocha_1.it)('replays a key pressed on a checkpoint frame once', function () {
        const { m, input, hist } = newKeyed(5);
        record(hist, 5);
        // at 5:0, where a checkpoint is due
        input.key(1, 1, 1);
        record(hist, 5);
        assert_1.default.strictEqual(m.acc, 50 + 5 * 20);
        const present = m.acc;
        hist.seek((0, timeline_1.timestamp)(6, 0));
        hist.seek(hist.last());
        assert_1.default.strictEqual(m.acc, present);
    });
    (0, mocha_1.it)('holds a key pressed mid-frame until the next frame', function () {
        const { m, input, hist } = newKeyed(5);
        record(hist, 3);
        hist.recordFrame(() => m.acc === 34); // stop at 3:4
        input.key(1, 1, 1);
        assert_1.default.strictEqual(m.inp, 0, 'delivered mid-frame');
        hist.recordFrame(); // finish frame 3 without it
        assert_1.default.strictEqual(m.acc, 40);
        hist.recordFrame(); // frame 4 has it
        assert_1.default.strictEqual(m.acc, 60);
        // and the replay agrees
        hist.seek((0, timeline_1.timestamp)(1, 0));
        hist.seek(hist.last());
        assert_1.default.strictEqual(m.acc, 60);
    });
});
//# sourceMappingURL=testhistory.js.map