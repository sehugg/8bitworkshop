"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const emu_1 = require("../../src/common/emu");
const timeline_1 = require("../../src/common/timeline");
// A machine with the same awkward property the real ones have: advanceFrame()
// restarts the frame from the top instead of resuming it, so breaking out
// mid-frame and calling it again re-runs the frame. MachineCore has to replay
// from a frame-start snapshot to get back to a sub-frame position.
class FakeMachine {
    constructor() {
        this.stepsPerFrame = 10;
        this.acc = 0; // one increment per step
        this.ram = new Uint8Array(16);
    }
    advanceFrame(trap) {
        var n = 0;
        for (var i = 0; i < this.stepsPerFrame; i++) {
            if (trap && trap())
                break;
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
function stateOf(m) {
    return JSON.stringify({ acc: m.acc, ram: Array.from(m.ram) });
}
(0, mocha_1.describe)('Timestamp', function () {
    (0, mocha_1.it)('orders lexicographically by frame then step', function () {
        assert_1.default.ok((0, timeline_1.compareTimestamps)((0, timeline_1.timestamp)(1, 5), (0, timeline_1.timestamp)(2, 0)) < 0);
        assert_1.default.ok((0, timeline_1.compareTimestamps)((0, timeline_1.timestamp)(2, 0), (0, timeline_1.timestamp)(1, 5)) > 0);
        assert_1.default.ok((0, timeline_1.compareTimestamps)((0, timeline_1.timestamp)(2, 3), (0, timeline_1.timestamp)(2, 4)) < 0);
        assert_1.default.strictEqual((0, timeline_1.compareTimestamps)((0, timeline_1.timestamp)(2, 3), (0, timeline_1.timestamp)(2, 3)), 0);
        assert_1.default.ok((0, timeline_1.timestampsEqual)((0, timeline_1.timestamp)(2, 3), (0, timeline_1.timestamp)(2, 3)));
        assert_1.default.strictEqual((0, timeline_1.formatTimestamp)((0, timeline_1.timestamp)(2, 3)), '2:3');
    });
});
(0, mocha_1.describe)('MachineCore', function () {
    (0, mocha_1.it)('finishes a frame it stopped in before running whole frames', function () {
        const m = new FakeMachine();
        const c = new timeline_1.MachineCore(m);
        c.runUntil((0, timeline_1.timestamp)(2, 5));
        // no trap and a frame-boundary target: must not restart frame 2 midway
        c.runUntil((0, timeline_1.timestamp)(4, 0));
        assert_1.default.strictEqual(m.acc, 40);
    });
    (0, mocha_1.it)('ignores an error from the frame tail after a stop, but not otherwise', function () {
        // like galaxian: code after the CPU loop mutates state and may throw
        class TailMachine extends FakeMachine {
            constructor() {
                super(...arguments);
                this.watchdog = 0;
            }
            advanceFrame(trap) {
                const n = super.advanceFrame(trap);
                this.acc += 1000;
                if (++this.watchdog >= 3)
                    throw new Error('watchdog');
                return n;
            }
            saveState() { return Object.assign(Object.assign({}, super.saveState()), { watchdog: this.watchdog }); }
            loadState(s) { super.loadState(s); this.watchdog = s.watchdog; }
        }
        const m = new TailMachine();
        const c = new timeline_1.MachineCore(m);
        c.runUntil((0, timeline_1.timestamp)(2, 0));
        // the tail throws on this frame, but the stop comes first
        var steps = 0;
        const r = c.runUntil((0, timeline_1.timestamp)(3, 0), () => steps++ === 5);
        assert_1.default.ok(r.trapped);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(2, 5)), (0, timeline_1.formatTimestamp)(r.at));
        assert_1.default.strictEqual(m.acc, 2025);
        assert_1.default.strictEqual(m.watchdog, 2);
        // finishing the frame runs the tail for real
        assert_1.default.throws(() => c.runUntil((0, timeline_1.timestamp)(3, 0)), /watchdog/);
    });
    (0, mocha_1.it)('counts frames monotonically and never rewinds the clock', function () {
        const m = new FakeMachine();
        const c = new timeline_1.MachineCore(m);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(c.now(), (0, timeline_1.timestamp)(0, 0)));
        c.runUntil((0, timeline_1.timestamp)(3, 0));
        // the old debugger reset its clock every frame; this must not
        assert_1.default.ok((0, timeline_1.timestampsEqual)(c.now(), (0, timeline_1.timestamp)(3, 0)));
        assert_1.default.strictEqual(m.acc, 30);
    });
    (0, mocha_1.it)('lands exactly on a sub-frame target', function () {
        const m = new FakeMachine();
        const c = new timeline_1.MachineCore(m);
        const r = c.runUntil((0, timeline_1.timestamp)(2, 5));
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(2, 5)), (0, timeline_1.formatTimestamp)(r.at));
        assert_1.default.strictEqual(r.trapped, false);
        assert_1.default.strictEqual(m.acc, 25);
    });
    (0, mocha_1.it)('evaluates a trap across frame boundaries', function () {
        const m = new FakeMachine();
        const c = new timeline_1.MachineCore(m);
        // 23 steps in => frame 2, step 3; the trap has to survive two frame ends
        const r = c.runUntil((0, timeline_1.timestamp)(9, 0), () => m.acc === 23);
        assert_1.default.strictEqual(r.trapped, true);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(2, 3)), (0, timeline_1.formatTimestamp)(r.at));
        assert_1.default.strictEqual(m.acc, 23);
    });
    (0, mocha_1.it)('reports no trap when the condition never holds', function () {
        const m = new FakeMachine();
        const c = new timeline_1.MachineCore(m);
        const r = c.runUntil((0, timeline_1.timestamp)(2, 0), () => m.acc === 9999);
        assert_1.default.strictEqual(r.trapped, false);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(2, 0)));
    });
    (0, mocha_1.it)('resumes within a frame without re-running the trap on replayed steps', function () {
        const m = new FakeMachine();
        const c = new timeline_1.MachineCore(m);
        c.runUntil((0, timeline_1.timestamp)(1, 4));
        assert_1.default.strictEqual(m.acc, 14);
        // getting from 1:4 to 1:9 replays the frame from its start internally,
        // but the trap must only see positions 4..8
        const seen = [];
        const r = c.runUntil((0, timeline_1.timestamp)(1, 9), () => { seen.push(m.acc); return false; });
        assert_1.default.deepStrictEqual(seen, [14, 15, 16, 17, 18]);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(1, 9)));
        assert_1.default.strictEqual(m.acc, 19);
    });
    (0, mocha_1.it)('reproduces the same state when replayed from a snapshot', function () {
        const m = new FakeMachine();
        const c = new timeline_1.MachineCore(m);
        const snap0 = c.snapshot();
        c.runUntil((0, timeline_1.timestamp)(3, 7));
        const expected = stateOf(m);
        c.restore(snap0, (0, timeline_1.timestamp)(0, 0));
        assert_1.default.ok((0, timeline_1.timestampsEqual)(c.now(), (0, timeline_1.timestamp)(0, 0)));
        c.runUntil((0, timeline_1.timestamp)(3, 7));
        assert_1.default.strictEqual(stateOf(m), expected);
    });
    (0, mocha_1.it)('seeks backwards to a sub-frame position exactly', function () {
        // what the state should be at 2:3, established independently
        const fresh = new FakeMachine();
        new timeline_1.MachineCore(fresh).runUntil((0, timeline_1.timestamp)(2, 3));
        const expected = stateOf(fresh);
        const m = new FakeMachine();
        const c = new timeline_1.MachineCore(m);
        const snap0 = c.snapshot();
        c.runUntil((0, timeline_1.timestamp)(2, 9));
        assert_1.default.notStrictEqual(stateOf(m), expected);
        c.restore(snap0, (0, timeline_1.timestamp)(0, 0));
        c.runUntil((0, timeline_1.timestamp)(2, 3));
        assert_1.default.ok((0, timeline_1.timestampsEqual)(c.now(), (0, timeline_1.timestamp)(2, 3)));
        assert_1.default.strictEqual(stateOf(m), expected);
    });
    (0, mocha_1.it)('restores a checkpoint taken mid-recording', function () {
        const m = new FakeMachine();
        const c = new timeline_1.MachineCore(m);
        c.runUntil((0, timeline_1.timestamp)(5, 0));
        const snap5 = c.snapshot();
        c.runUntil((0, timeline_1.timestamp)(8, 2));
        const at82 = stateOf(m);
        c.restore(snap5, (0, timeline_1.timestamp)(5, 0));
        assert_1.default.strictEqual(m.acc, 50);
        c.runUntil((0, timeline_1.timestamp)(8, 2));
        assert_1.default.strictEqual(stateOf(m), at82);
    });
    (0, mocha_1.it)('refuses to restore at a non-frame boundary', function () {
        const m = new FakeMachine();
        const c = new timeline_1.MachineCore(m);
        assert_1.default.throws(() => c.restore(c.snapshot(), (0, timeline_1.timestamp)(1, 3)), /frame boundary/);
    });
    (0, mocha_1.it)('does nothing when the target is already reached', function () {
        const m = new FakeMachine();
        const c = new timeline_1.MachineCore(m);
        c.runUntil((0, timeline_1.timestamp)(2, 4));
        const before = stateOf(m);
        const r = c.runUntil((0, timeline_1.timestamp)(1, 0));
        assert_1.default.strictEqual(stateOf(m), before);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(2, 4)));
    });
});
// A machine whose CPU executes a halt instruction (6502 KIL) when acc reaches
// haltAt: the step throws EmuHalt partway through, as MOS6502 does.
class HaltingMachine extends FakeMachine {
    constructor() {
        super(...arguments);
        this.haltAt = 23;
        this.error = () => new emu_1.EmuHalt('CPU executed halt instruction');
    }
    advanceFrame(trap) {
        var n = 0;
        for (var i = 0; i < this.stepsPerFrame; i++) {
            if (trap && trap())
                break;
            if (this.acc === this.haltAt)
                throw this.error();
            this.acc = (this.acc + 1) | 0;
            n++;
        }
        return n;
    }
}
(0, mocha_1.describe)('MachineCore halts', function () {
    (0, mocha_1.it)('reports a halt as a stop before the halting step, running unmetered', function () {
        const m = new HaltingMachine();
        const c = new timeline_1.MachineCore(m);
        const r = c.runUntil((0, timeline_1.timestamp)(5, 0));
        assert_1.default.ok(r.halt instanceof emu_1.EmuHalt, 'expected a halt');
        assert_1.default.strictEqual(r.trapped, false);
        // frame 2 starts at acc 20; step 3 is the one that halts
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(2, 3)), (0, timeline_1.formatTimestamp)(r.at));
        assert_1.default.ok((0, timeline_1.timestampsEqual)(c.now(), (0, timeline_1.timestamp)(2, 3)));
        assert_1.default.strictEqual(m.acc, 23);
    });
    (0, mocha_1.it)('reports the same halt when metered', function () {
        const m = new HaltingMachine();
        const c = new timeline_1.MachineCore(m);
        const r = c.runUntil((0, timeline_1.timestamp)(5, 0), () => false);
        assert_1.default.ok(r.halt instanceof emu_1.EmuHalt);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(2, 3)), (0, timeline_1.formatTimestamp)(r.at));
        assert_1.default.strictEqual(m.acc, 23);
    });
    (0, mocha_1.it)('halts again, without progress, when run on from a halt', function () {
        const m = new HaltingMachine();
        const c = new timeline_1.MachineCore(m);
        c.runUntil((0, timeline_1.timestamp)(5, 0));
        const r = c.runUntil((0, timeline_1.timestamp)(5, 0));
        assert_1.default.ok(r.halt instanceof emu_1.EmuHalt);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(2, 3)), (0, timeline_1.formatTimestamp)(r.at));
        assert_1.default.strictEqual(m.acc, 23);
    });
    (0, mocha_1.it)('can reach every step up to the halt without halting', function () {
        const m = new HaltingMachine();
        const c = new timeline_1.MachineCore(m);
        const snap = c.snapshot();
        const r = c.runUntil((0, timeline_1.timestamp)(2, 3));
        assert_1.default.strictEqual(r.halt, undefined);
        assert_1.default.strictEqual(m.acc, 23);
        c.restore(snap, (0, timeline_1.timestamp)(0, 0));
        assert_1.default.strictEqual(c.runUntil((0, timeline_1.timestamp)(2, 2)).halt, undefined);
        assert_1.default.strictEqual(m.acc, 22);
    });
    (0, mocha_1.it)('lets errors that are not halts propagate', function () {
        const m = new HaltingMachine();
        m.error = () => new TypeError('emulator bug');
        const c = new timeline_1.MachineCore(m);
        assert_1.default.throws(() => c.runUntil((0, timeline_1.timestamp)(5, 0)), TypeError);
    });
});
//# sourceMappingURL=testtimeline.js.map