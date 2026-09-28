"use strict";
// Bridges the existing Platform objects to the deterministic timeline.
//
// Most platforms are built on a Machine and get MachineCore, which can stop
// between instructions. The ones that aren't -- vcs (Javatari), verilog, x86 --
// only know how to run a whole frame, so they get FramePlatformCore, which says
// so through its granularity instead of pretending to sub-frame accuracy.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FramePlatformCore = exports.PlatformFrameInput = void 0;
exports.isRewindable = isRewindable;
exports.createCore = createCore;
const emu_1 = require("./emu");
const timeline_1 = require("./timeline");
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
 * Events are delivered only at frame boundaries, by capture() as the frame
 * starts, so that recording and replay deliver them at the same moment. An
 * event that arrives while the debugger is stopped mid-frame waits for the next
 * frame; delivering it on the spot would put it where a replay can't.
 */
class PlatformFrameInput {
    constructor(platform, opts = {}) {
        this.platform = platform;
        this.opts = opts;
        this.frames = new Map();
        this.keys = new Map();
        this.oldest = 0;
    }
    /**
     * Queue a key event for the next frame to start: this one if the core is at
     * its start, the next one if it is stopped partway through.
     */
    key(key, code, flags) {
        if (!this.opts.dispatchKey)
            throw new Error('no dispatchKey to deliver key events with');
        const t = this.opts.now ? this.opts.now() : (0, timeline_1.timestamp)(0, 0);
        const frame = t.step === 0 ? t.frame : t.frame + 1;
        var evs = this.keys.get(frame);
        if (!evs)
            this.keys.set(frame, evs = []);
        evs.push({ key, code, flags });
    }
    /** Deliver the frame's key events, then record the rest of its input. */
    capture(frame) {
        this.dispatchKeys(frame);
        this.frames.set(frame, {
            controls: this.platform.saveControlsState ? this.platform.saveControlsState() : undefined,
            seed: (0, emu_1.getNoiseSeed)(),
        });
    }
    replay(frame) {
        // same order as capture(): keys, then the seed as it was after them
        this.dispatchKeys(frame);
        const rec = this.frames.get(frame);
        if (rec) {
            if (!this.opts.dispatchKey && rec.controls !== undefined && this.platform.loadControlsState) {
                this.platform.loadControlsState(rec.controls);
            }
            (0, emu_1.setNoiseSeed)(rec.seed);
        }
    }
    dispatchKeys(frame) {
        const evs = this.opts.dispatchKey && this.keys.get(frame);
        if (evs) {
            for (const e of evs)
                this.opts.dispatchKey(e.key, e.code, e.flags);
        }
    }
    trim(firstFrame) {
        while (this.oldest < firstFrame) {
            this.frames.delete(this.oldest);
            this.keys.delete(this.oldest);
            this.oldest++;
        }
    }
    truncate(fromFrame) {
        for (const f of [...this.frames.keys()])
            if (f >= fromFrame)
                this.frames.delete(f);
        for (const f of [...this.keys.keys()])
            if (f >= fromFrame)
                this.keys.delete(f);
    }
}
exports.PlatformFrameInput = PlatformFrameInput;
/**
 * A core for platforms with no Machine behind them. Frames are the only thing
 * it can count, so every target is rounded down to a frame boundary and
 * clamp() tells the history layer as much -- without that, a caller asking for
 * a sub-frame position would spin waiting for progress that can never happen.
 */
class FramePlatformCore {
    constructor(platform) {
        this.platform = platform;
        this.granularity = 'frame';
        this.frame = 0;
    }
    now() { return (0, timeline_1.timestamp)(this.frame, 0); }
    clamp(t) {
        return t.step === 0 ? t : (0, timeline_1.timestamp)(t.frame, 0);
    }
    snapshot() { return this.platform.saveState(); }
    restore(state, at) {
        if (at.step !== 0) {
            throw new Error(`can only restore at a frame boundary, not ${(0, timeline_1.formatTimestamp)(at)}`);
        }
        this.platform.loadState(state);
        this.frame = at.frame;
    }
    runUntil(target, trap) {
        while (this.frame < target.frame) {
            if (trap && trap())
                return { at: this.now(), trapped: true };
            try {
                this.advanceFrame();
            }
            catch (e) {
                // Frames are all this core can count, so the halt is reported at the
                // start of the frame it happened in. The platform is left as the halt
                // left it; seeking restores it from a checkpoint.
                if (e instanceof emu_1.EmuHalt)
                    return { at: this.now(), trapped: false, halt: e };
                throw e;
            }
            this.frame++;
        }
        return { at: this.now(), trapped: false };
    }
    advanceFrame() {
        const p = this.platform;
        // advance() is the bare frame; nextFrame() would also poll controls and
        // drive the old recorder, which would fight with this one. Video stays on:
        // a replay has to draw the frame it lands on.
        if (p.advance)
            p.advance(false);
        else if (p.nextFrame)
            p.nextFrame(false);
        else
            throw new Error('platform cannot advance a frame');
    }
}
exports.FramePlatformCore = FramePlatformCore;
/** True if this platform can be rewound at all. */
function isRewindable(platform) {
    return !!(platform && platform.saveState && platform.loadState &&
        (platform.machine || platform.advance));
}
/**
 * Pick the most precise core the platform supports. WASM machines trap per
 * clock tick, and so do JS machines with a clock-based CPU (6502); the rest
 * trap per instruction. Both are exposed as "steps" but the granularity is
 * reported so the UI can label the sub-frame axis honestly.
 */
function createCore(platform) {
    var _a;
    const machine = platform.machine;
    if (machine && typeof machine.advanceFrame === 'function' && typeof machine.saveState === 'function') {
        const clocked = typeof machine.advanceFrameClock === 'function' || typeof ((_a = machine.cpu) === null || _a === void 0 ? void 0 : _a.advanceClock) === 'function';
        const granularity = clocked ? 'clock' : 'insn';
        // whole frames go through the platform, which may do more than the machine
        const p = platform;
        const wholeFrame = typeof p.advance === 'function' ? () => { p.advance(false); } : undefined;
        return new timeline_1.MachineCore(machine, granularity, wholeFrame);
    }
    return new FramePlatformCore(platform);
}
//# sourceMappingURL=platformcore.js.map