"use strict";
// Recorded history over a DeterministicCore: periodic checkpoints plus the
// per-frame input needed to reproduce everything between them.
//
// The point of recording is not to store the past but to be able to *re-run*
// it. Nothing is kept between checkpoints, so a breakpoint condition can be
// asked about a moment that has already gone by: restore the checkpoint before
// it and replay with the condition installed as a trap. That is what findLast()
// does, and it is why reverse-step and "when did this memory last change?" are
// the same operation with different predicates.
Object.defineProperty(exports, "__esModule", { value: true });
exports.History = void 0;
const statehash_1 = require("./statehash");
const timeline_1 = require("./timeline");
function conditionTest(c) {
    return typeof c === 'function' ? c : c.test;
}
function conditionReset(c) {
    var _a;
    if (typeof c !== 'function')
        (_a = c.reset) === null || _a === void 0 ? void 0 : _a.call(c);
}
/**
 * A window of recorded emulated time, and the searches you can run over it.
 *
 * Checkpoints are only ever taken at frame boundaries, which is what lets any
 * sub-frame position be reached exactly: restore the frame's start and replay
 * into it (see MachineCore).
 */
class History {
    constructor(core, opts = {}) {
        var _a, _b, _c;
        this.checkpointBytes = 0;
        this.checkpoints = [];
        /** Latest point ever reached, i.e. the present. */
        this.head = (0, timeline_1.timestamp)(0, 0);
        this.core = core;
        this.checkpointInterval = (_a = opts.checkpointInterval) !== null && _a !== void 0 ? _a : 10;
        this.maxCheckpoints = (_b = opts.maxCheckpoints) !== null && _b !== void 0 ? _b : 300;
        // checkpoint sizes run from 8 KB (mw8080bw) to 1 MB (nes)
        this.maxBytes = (_c = opts.maxBytes) !== null && _c !== void 0 ? _c : 64 * 1024 * 1024;
        this.input = opts.input;
        this.reset();
    }
    /** Start recording again from wherever the core is now. */
    reset() {
        this.checkpoints = [];
        this.checkpointBytes = 0;
        this.addCheckpoint(this.core.now());
        this.head = this.core.now();
    }
    /** Round a target to what the core can actually stop at. */
    clamp(t) {
        return this.core.clamp ? this.core.clamp(t) : t;
    }
    /** Oldest point still reachable. Earlier checkpoints have been dropped. */
    first() { return this.checkpoints[0].at; }
    /** The present: the furthest point recording has reached. */
    last() { return this.head; }
    now() { return this.core.now(); }
    /** True if the core is showing a reconstructed past rather than the present. */
    isInPast() { return (0, timeline_1.compareTimestamps)(this.core.now(), this.head) < 0; }
    getCheckpoints() { return this.checkpoints; }
    /** Estimated bytes held by all checkpoints. */
    getCheckpointBytes() { return this.checkpointBytes; }
    /**
     * Run one frame at the head of the recording, capturing input and taking a
     * checkpoint when one is due. This is the recording loop; it must be called
     * with the core positioned at the head. If the machine halts, the head stays
     * at the halt, and every later call halts there again (see RunResult.halt).
     */
    recordFrame(trap) {
        var _a;
        const t = this.core.now();
        if ((0, timeline_1.compareTimestamps)(t, this.head) !== 0) {
            throw new Error(`not at the head of the recording: ${(0, timeline_1.formatTimestamp)(t)} != ${(0, timeline_1.formatTimestamp)(this.head)}`);
        }
        if (t.step === 0) {
            // checkpoint first: replaying from it re-applies this frame's input, so
            // it must not contain that input already
            this.checkpointIfDue(t);
            (_a = this.input) === null || _a === void 0 ? void 0 : _a.capture(t.frame);
        }
        const r = this.core.runUntil((0, timeline_1.timestamp)(t.frame + 1, 0), trap);
        this.head = r.at;
        return r;
    }
    checkpointIfDue(at) {
        var _a, _b;
        const last = this.checkpoints[this.checkpoints.length - 1];
        if (last && at.frame - last.at.frame < this.checkpointInterval)
            return;
        this.addCheckpoint(at);
        while (this.checkpoints.length > 1 &&
            (this.checkpoints.length > this.maxCheckpoints || this.checkpointBytes > this.maxBytes)) {
            this.checkpointBytes -= this.checkpoints.shift().bytes;
            (_b = (_a = this.input) === null || _a === void 0 ? void 0 : _a.trim) === null || _b === void 0 ? void 0 : _b.call(_a, this.checkpoints[0].at.frame);
        }
    }
    addCheckpoint(at) {
        const state = this.core.snapshot();
        const bytes = (0, statehash_1.stateSize)(state);
        this.checkpoints.push({ at, state, bytes });
        this.checkpointBytes += bytes;
    }
    /**
     * Make the current position the present, dropping the recorded future, so
     * recording can carry on from here -- running on after rewinding. Call it
     * before delivering any new input, or that input lands in the old future.
     */
    truncate() {
        var _a, _b;
        const now = this.core.now();
        while (this.checkpoints.length > 1 && (0, timeline_1.compareTimestamps)(this.checkpoints[this.checkpoints.length - 1].at, now) > 0) {
            this.checkpointBytes -= this.checkpoints.pop().bytes;
        }
        // a frame already under way has taken its input; later frames take new input
        (_b = (_a = this.input) === null || _a === void 0 ? void 0 : _a.truncate) === null || _b === void 0 ? void 0 : _b.call(_a, now.step === 0 ? now.frame : now.frame + 1);
        this.head = now;
    }
    /** The latest checkpoint at or before t, or null if t is before the window. */
    checkpointAtOrBefore(t) {
        for (var i = this.checkpoints.length - 1; i >= 0; i--) {
            if ((0, timeline_1.compareTimestamps)(this.checkpoints[i].at, t) <= 0)
                return this.checkpoints[i];
        }
        return null;
    }
    /**
     * Put the core at t, replaying from the nearest checkpoint. Seeking backwards
     * costs the same as seeking forwards -- that's the whole trick.
     */
    seek(t, trap) {
        t = this.clamp(t);
        if ((0, timeline_1.compareTimestamps)(t, this.head) > 0)
            t = this.head;
        const cp = this.checkpointAtOrBefore(t);
        if (!cp) {
            throw new Error(`${(0, timeline_1.formatTimestamp)(t)} is older than the recording`);
        }
        // only replay from the checkpoint if we can't just run forward to it
        const cur = this.core.now();
        if ((0, timeline_1.compareTimestamps)(cur, t) > 0 || (0, timeline_1.compareTimestamps)(cur, cp.at) < 0) {
            this.core.restore(cp.state, cp.at);
        }
        return this.runTo(t, trap);
    }
    /**
     * Run forward to t from the core's current position, re-applying recorded
     * input at each frame boundary. Frames are driven one at a time so the input
     * hook lands in the right place; the core handles everything within a frame.
     */
    runTo(t, trap) {
        var _a;
        t = this.clamp(t);
        while ((0, timeline_1.compareTimestamps)(this.core.now(), t) < 0) {
            const at = this.core.now();
            if (at.step === 0)
                (_a = this.input) === null || _a === void 0 ? void 0 : _a.replay(at.frame);
            const frameEnd = (0, timeline_1.timestamp)(at.frame + 1, 0);
            const stop = (0, timeline_1.compareTimestamps)(frameEnd, t) < 0 ? frameEnd : t;
            const r = this.core.runUntil(stop, trap);
            if (r.trapped || r.halt)
                return r;
            // a core that reports no progress can't reach t; stop rather than spin
            if ((0, timeline_1.compareTimestamps)(r.at, at) <= 0)
                break;
        }
        return { at: this.core.now(), trapped: false };
    }
    /**
     * Attach the condition's probe for the length of the search only. The core
     * runs unprobed the rest of the time, which is most of the time.
     */
    withProbe(cond, body) {
        var _a, _b, _c;
        const probe = typeof cond === 'function' ? null : cond.probe;
        if (!probe || !this.core.connectProbe)
            return body();
        const prev = (_c = (_b = (_a = this.core).getProbe) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : null;
        this.core.connectProbe(probe);
        try {
            return body();
        }
        finally {
            this.core.connectProbe(prev);
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
    findLast(cond, from, to) {
        from = this.clamp(from !== null && from !== void 0 ? from : this.first());
        to = this.clamp(to !== null && to !== void 0 ? to : this.core.now());
        if ((0, timeline_1.compareTimestamps)(from, to) >= 0)
            return null;
        return this.withProbe(cond, () => this.findLastUnprobed(cond, from, to));
    }
    findLastUnprobed(cond, from, to) {
        for (var i = this.checkpoints.length - 1; i >= 0; i--) {
            const cp = this.checkpoints[i];
            if ((0, timeline_1.compareTimestamps)(cp.at, to) >= 0)
                continue; // span is entirely ahead of us
            // search [max(cp, from), min(next checkpoint, to))
            const spanStart = (0, timeline_1.compareTimestamps)(cp.at, from) < 0 ? from : cp.at;
            const hit = this.lastHitIn(spanStart, to, cond);
            if (hit) {
                this.seek(hit);
                return hit;
            }
            to = cp.at; // nothing here; look further back
            if ((0, timeline_1.compareTimestamps)(cp.at, from) <= 0)
                break;
        }
        return null;
    }
    /** Replay [from, to) collecting every hit, and report the last one. */
    lastHitIn(from, to, cond) {
        this.seek(from);
        conditionReset(cond);
        const test = conditionTest(cond);
        var last = null;
        this.runTo(to, () => {
            if (test())
                last = this.core.now();
            return false; // keep going; we want the last hit, not the first
        });
        return last;
    }
}
exports.History = History;
//# sourceMappingURL=history.js.map