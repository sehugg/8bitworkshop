"use strict";
// Record a run with input, replay it, and check every frame matches. This is
// what keeps the deterministic debugger honest: rewinding is only meaningful
// on platforms that reproduce, and a platform that quietly picks up entropy
// (an unseeded Math.random, a clock) shows up here as a diverging frame rather
// than as a mystery months later. Used by `8bws verify-replay` and the tests.
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyReplay = verifyReplay;
const emu_1 = require("../common/emu");
const statehash_1 = require("../common/statehash");
const timeline_1 = require("../common/timeline");
/**
 * Keys worth mashing: the directions and the fire/start buttons, which is what
 * a joystick-driven platform reads. Pressing arbitrary keyboard keys would be
 * noisier without testing anything more.
 */
const EXERCISE_KEYS = [37, 38, 39, 40, 32, 13]; // left up right down space enter
/**
 * A seeded button masher. Verification is only meaningful if the recording has
 * input in it -- without input the controls path is never exercised, and a
 * platform whose loadControlsState() is not the inverse of saveControlsState()
 * passes for the wrong reason. Seeded so a failure is reproducible.
 */
class InputExerciser {
    constructor(target, seed) {
        this.target = target;
        this.state = 1;
        this.held = new Map();
        this.events = 0;
        this.state = seed | 0 || 1;
    }
    next() {
        // xorshift32, same shape as the emulator's own noise()
        let x = this.state;
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (this.state = x) >>> 0;
    }
    /** Press or release a key or two, as if a player were at the controls. */
    frame() {
        for (const key of EXERCISE_KEYS) {
            if ((this.next() & 7) !== 0)
                continue; // ~1 change per key per 8 frames
            const down = !this.held.get(key);
            this.held.set(key, down);
            this.target.setKeyInput(key, key, down ? emu_1.KeyFlags.KeyDown : emu_1.KeyFlags.KeyUp);
            this.events++;
        }
    }
}
/**
 * Record `frames` frames from the target's current state, replay them from the
 * start, and compare the state at every frame boundary.
 */
function verifyReplay(target, opts) {
    var _a, _b, _c;
    const hist = target.history;
    if (!hist)
        throw new Error(`'${target.id}' cannot save and restore state`);
    const platform = target.platform;
    const frames = opts.frames;
    // one checkpoint only, so the replay re-runs the whole span rather than
    // being handed a fresh state part way through
    hist.checkpointInterval = frames + 1;
    let exerciser = null;
    let input = 'none';
    if ((_a = opts.keys) !== null && _a !== void 0 ? _a : true) {
        exerciser = new InputExerciser(target, (_b = opts.seed) !== null && _b !== void 0 ? _b : 12345);
        try {
            exerciser.frame(); // fails fast if the target takes no key input
            input = 'keys';
        }
        catch (e) {
            exerciser = null;
            input = 'unsupported';
        }
    }
    // record, hashing the state at every frame boundary
    const start = hist.now();
    const recorded = [];
    const controlStates = new Set();
    for (let i = 0; i < frames; i++) {
        // keys are queued here and delivered as the frame starts, which is what
        // the replay has to reproduce
        if (i > 0)
            exerciser === null || exerciser === void 0 ? void 0 : exerciser.frame();
        target.advanceFrame();
        if (platform.saveControlsState)
            controlStates.add((0, statehash_1.hashState)(platform.saveControlsState()));
        recorded.push((0, statehash_1.hashState)(hist.core.snapshot()));
    }
    // replay the same span and compare
    const diverged = [];
    hist.seek(start);
    for (let i = 0; i < frames && diverged.length < 5; i++) {
        const t = (0, timeline_1.timestamp)(start.frame + i + 1, 0);
        hist.seek(t);
        if ((0, statehash_1.hashState)(hist.core.snapshot()) !== recorded[i])
            diverged.push(t.frame);
    }
    return {
        input,
        controlStates: controlStates.size,
        keyEvents: (_c = exerciser === null || exerciser === void 0 ? void 0 : exerciser.events) !== null && _c !== void 0 ? _c : 0,
        granularity: hist.core.granularity,
        diverged,
        recordedTo: (0, timeline_1.formatTimestamp)(hist.last()),
    };
}
//# sourceMappingURL=verifyreplay.js.map