"use strict";
// Deterministic timeline: a monotonic time coordinate for the debugger, and
// the narrow core interface that rewinding needs.
//
// The old debugger keyed everything on frames plus a per-frame clock that was
// rewound on every frame boundary (BaseDebugPlatform.preFrame), which is why a
// breakpoint condition could not span frames. Here time is a (frame, step) pair
// that only ever moves forward as the machine runs, so "run until T" and "when
// was P last true?" are expressible without caring where frames begin and end.
//
// A *step* is one invocation of the TrapCondition that FrameBased.advanceFrame()
// already defines. That means the unit is whatever the machine traps on -- one
// instruction for a Z80 or 6809 BasicScanlineMachine, one clock tick for a
// 6502 one and for the WASM machines -- and it is consistent within a machine,
// which is all the timeline needs. A clock step can land mid-instruction, so
// "the previous instruction" is the last step where cpu.isStable(). It is the same unit the replay bar's "Step" slider uses.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MachineCore = void 0;
exports.timestamp = timestamp;
exports.compareTimestamps = compareTimestamps;
exports.timestampsEqual = timestampsEqual;
exports.formatTimestamp = formatTimestamp;
const devices_1 = require("./devices");
const emu_1 = require("./emu");
function timestamp(frame, step = 0) {
    return { frame, step };
}
/** Lexicographic order: <0 if a is before b, 0 if equal, >0 if after. */
function compareTimestamps(a, b) {
    return a.frame - b.frame || a.step - b.step;
}
function timestampsEqual(a, b) {
    return a.frame === b.frame && a.step === b.step;
}
function formatTimestamp(t) {
    return `${t.frame}:${t.step}`;
}
/**
 * Adapts any FrameBased + SavesState machine to DeterministicCore.
 *
 * The one subtlety is that advanceFrame() is not resumable on most machines:
 * BasicScanlineMachine restarts its scanline loop from the top on every call,
 * so breaking out mid-frame and calling it again re-runs the frame rather than
 * continuing it. So a frame is the atomic replay unit here: the core keeps the
 * snapshot taken at the start of the current frame, and any sub-frame position
 * is reached by restoring that snapshot and replaying to the wanted step. That
 * is what makes stepping backwards inside a frame exact instead of approximate,
 * and it costs one snapshot per frame -- which the recorder wants anyway.
 */
class MachineCore {
    /**
     * `wholeFrame` runs one whole frame with no trap, if the host has more to do
     * per frame than the machine does (a platform's advance() also checks for a
     * finished program). Frames with a trap always go to the machine.
     */
    constructor(machine, granularity = 'insn', wholeFrame) {
        this.wholeFrame = wholeFrame;
        this.frame = 0;
        this.step = 0;
        // state at the start of the current frame; the anchor for sub-frame seeks
        this.frameStart = null;
        this.probe = null;
        // stands in for the probe while replaying steps it has already seen
        this.mute = new devices_1.NullProbe();
        this.machine = machine;
        this.granularity = granularity;
        this.frameStart = machine.saveState();
    }
    now() {
        return { frame: this.frame, step: this.step };
    }
    snapshot() {
        return this.machine.saveState();
    }
    restore(state, at) {
        if (at.step !== 0) {
            // Restoring mid-frame would leave us without a frame-start anchor, so
            // any later sub-frame seek in that frame would be unreachable. Callers
            // seek to a mid-frame position by restoring the frame and running to it.
            throw new Error(`can only restore at a frame boundary, not ${formatTimestamp(at)}`);
        }
        this.machine.loadState(state);
        this.frame = at.frame;
        this.step = 0;
        this.frameStart = state;
    }
    connectProbe(probe) {
        var _a, _b;
        this.probe = probe;
        (_b = (_a = this.machine).connectProbe) === null || _b === void 0 ? void 0 : _b.call(_a, probe);
    }
    getProbe() {
        return this.probe;
    }
    /**
     * Run `body` with the probe muted: it re-executes steps that already ran,
     * and the probe saw them the first time.
     */
    replaying(body) {
        var _a, _b, _c, _d;
        if (!this.probe)
            return body();
        (_b = (_a = this.machine).connectProbe) === null || _b === void 0 ? void 0 : _b.call(_a, this.mute);
        try {
            return body();
        }
        finally {
            (_d = (_c = this.machine).connectProbe) === null || _d === void 0 ? void 0 : _d.call(_c, this.probe);
        }
    }
    runUntil(target, trap) {
        while (compareTimestamps(this.now(), target) < 0) {
            // run to the end of this frame, or to target.step if the target is in it
            const untilStep = this.frame < target.frame ? Infinity : target.step;
            const stop = this.runFrame(untilStep, trap);
            if (stop === 'trap')
                return { at: this.now(), trapped: true };
            if (stop instanceof emu_1.EmuHalt)
                return { at: this.now(), trapped: false, halt: stop };
        }
        return { at: this.now(), trapped: false };
    }
    /**
     * Advance within the current frame to `untilStep` (Infinity = end of frame).
     * Returns 'trap' if `trap` stopped the run, the EmuHalt if the machine
     * halted, or null if it reached `untilStep`.
     */
    runFrame(untilStep, trap) {
        var _a, _b, _c, _d, _e, _f;
        // Unmetered fast path: a whole frame from its start with nothing to
        // evaluate. Machines can take their bulk-execution route (e.g.
        // machine_exec) instead of paying for a trap call per tick.
        if (untilStep === Infinity && !trap && this.step === 0) {
            try {
                if (this.wholeFrame)
                    this.wholeFrame();
                else
                    this.machine.advanceFrame(null);
            }
            catch (e) {
                if (!(e instanceof emu_1.EmuHalt))
                    throw e;
                // unmetered, so we don't know which step halted: find out
                return this.parkAtHalt(this.findHaltStep(), e);
            }
            this.endFrame();
            return null;
        }
        // Re-run the frame from its start if we're already partway into it, since
        // advanceFrame() restarts rather than resumes. Steps before our current
        // position already happened, so the caller's trap must not see them again.
        const from = this.step;
        // steps before `from` already happened: the probe hears them once
        let muted = from > 0 && this.probe != null;
        if (from > 0) {
            this.machine.loadState(this.frameStart);
        }
        if (muted)
            (_b = (_a = this.machine).connectProbe) === null || _b === void 0 ? void 0 : _b.call(_a, this.mute);
        let n = 0;
        let trapped = false;
        // A trap stops the CPU loop, not the frame: advanceFrame() still runs its
        // tail (drawing the line, the vblank interrupt, a watchdog) after the loop
        // exits. So the state is saved inside the trap, at the exact stop, and
        // loaded back once advanceFrame() returns.
        let stopState = null;
        // The trap runs before each step, so when it returns true exactly n steps
        // have executed -- n is the position, not the step about to run. step is
        // published before calling the caller's trap so that now() is the current
        // position while the condition is being evaluated; a search relies on that
        // to record where a hit happened.
        try {
            this.machine.advanceFrame(() => {
                var _a, _b;
                this.step = n;
                if (muted && n >= from) {
                    muted = false;
                    (_b = (_a = this.machine).connectProbe) === null || _b === void 0 ? void 0 : _b.call(_a, this.probe);
                }
                if (n >= untilStep || (n >= from && trap && (trapped = !!trap()))) {
                    stopState = this.machine.saveState();
                    return true;
                }
                n++;
                return false;
            });
        }
        catch (e) {
            if (muted)
                (_d = (_c = this.machine).connectProbe) === null || _d === void 0 ? void 0 : _d.call(_c, this.probe);
            // Once stopped, only the frame's tail runs, and it runs early: the frame
            // hasn't really ended. An error from it (galaxian's watchdog) is not an
            // error at the stop. Resuming replays the whole frame, so a real one is
            // raised again then.
            if (!stopState) {
                if (!(e instanceof emu_1.EmuHalt))
                    throw e;
                // the last step the trap saw is the one that halted (or the frame's
                // tail halted after it)
                return this.parkAtHalt(n > 0 ? n - 1 : 0, e);
            }
        }
        if (muted)
            (_f = (_e = this.machine).connectProbe) === null || _f === void 0 ? void 0 : _f.call(_e, this.probe);
        if (stopState) {
            this.machine.loadState(stopState);
            this.step = n;
            return trapped ? 'trap' : null;
        }
        // ran off the end of the frame without stopping
        this.endFrame();
        return null;
    }
    /**
     * Replay the current frame from its start, counting steps, to find which one
     * halts. Only needed after an unmetered run, which doesn't count.
     */
    findHaltStep() {
        this.machine.loadState(this.frameStart);
        let n = 0;
        try {
            this.replaying(() => this.machine.advanceFrame(() => { n++; return false; }));
        }
        catch (e) {
            if (e instanceof emu_1.EmuHalt)
                return n > 0 ? n - 1 : 0;
            throw e;
        }
        throw new Error(`halt at frame ${this.frame} did not happen again on replay; the machine is not deterministic`);
    }
    /**
     * Put the machine just before the step that halted, so the PC shows the
     * halting instruction instead of the mess the halt left behind.
     */
    parkAtHalt(haltStep, halt) {
        this.machine.loadState(this.frameStart);
        this.step = 0;
        // stops before the halting step, so it can't halt again
        if (haltStep > 0)
            this.replaying(() => this.runFrame(haltStep, null));
        return halt;
    }
    endFrame() {
        this.frame++;
        this.step = 0;
        this.frameStart = this.machine.saveState();
    }
}
exports.MachineCore = MachineCore;
//# sourceMappingURL=timeline.js.map