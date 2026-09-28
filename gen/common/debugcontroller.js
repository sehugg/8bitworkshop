"use strict";
// The debugger every host shares: the CLI's run scripts, the VS Code debug
// adapter, and later the IDE. It runs on EmuCore, so going backwards replays
// the recording, and it knows nothing about how a host shows things.
//
// Forward commands (continue, the steps, runTo) set a goal; run() then works
// toward it a bounded number of frames at a time, so a host can keep its UI
// alive and pause between calls. Backward commands (stepBack,
// reverseContinue, seek) search the recording and finish at once.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugController = void 0;
exports.isCallInsn = isCallInsn;
exports.isReturnInsn = isReturnInsn;
exports.buildDebugContext = buildDebugContext;
const breakpoints_1 = require("./breakpoints");
const emu_1 = require("./emu");
const emucore_1 = require("./emucore");
const projectcore_1 = require("./projectcore");
const timeline_1 = require("./timeline");
const util_1 = require("./util");
const workertypes_1 = require("./workertypes");
// bytes a PC may be past the start of its source line (as in the IDE)
const PC_LINE_LOOKBEHIND = 64;
// how many instructions a line step back may walk before giving up
const MAX_LINE_STEPS_BACK = 10000;
const CALL_INSN = /^(JSR|JSL|CALL|BSR|LBSR|RST)\b/i;
const RETURN_INSN = /^(RTS|RTL|RTI|RET|RETI|RETN)\b|^PUL[SU]\b.*\bPC\b/i;
/** True if the disassembled instruction calls a subroutine. */
function isCallInsn(line) { return CALL_INSN.test(line.trim()); }
/** True if the disassembled instruction returns from one. */
function isReturnInsn(line) { return RETURN_INSN.test(line.trim()); }
class DebugController {
    constructor(core, ctx = {}) {
        this.core = core;
        this.resolved = [];
        this.byPC = new Map();
        this.goal = null;
        this.sortedSymbols = null;
        this.setContext(ctx);
    }
    /** A new build: new symbols and listings. Breakpoints resolve again. */
    setContext(ctx) {
        this.ctx = Object.assign({ platform: this.core.platform }, ctx);
        this.sortedSymbols = null;
        this.setBreakpoints(this.resolved.map(r => r.bp));
    }
    get context() { return this.ctx; }
    /** Replace the breakpoints. Returns how each one resolved. */
    setBreakpoints(bps) {
        this.resolved = bps.map(bp => (0, breakpoints_1.resolveBreakpoint)(bp, this.ctx));
        this.byPC.clear();
        for (const r of this.resolved) {
            if (!r.bp.enabled || r.error || !(r.pc >= 0))
                continue;
            const list = this.byPC.get(r.pc);
            if (list)
                list.push(r);
            else
                this.byPC.set(r.pc, [r]);
        }
        return this.resolved;
    }
    /** True while a forward command has not stopped yet. */
    get running() { return this.goal != null; }
    //// forward: set a goal, then call run()
    continue() {
        this.setGoal('breakpoint', () => false);
        this.goal.free = true;
    }
    /** Run until the PC reaches `addr`, which may be where it already is. */
    runTo(addr) {
        this.setGoal('breakpoint', pc => pc === addr);
    }
    stepInstruction() {
        this.requireStep();
        this.setGoal('step', (_pc, first) => !first);
    }
    /**
     * Step to the next source line, into any call on this one, or one
     * instruction. Without source for the current PC, steps one instruction.
     */
    stepIn(granularity = 'line') {
        this.requireStep();
        const line = granularity === 'line' ? this.sourceAt(this.core.getPC()) : null;
        this.setGoal('step', (pc, first) => {
            if (first)
                return false;
            if (!line)
                return true;
            const here = this.sourceAt(pc);
            return !!here && !sameLine(here, line);
        });
    }
    /**
     * Step to the next source line, or instruction, running calls to their
     * return. Without source for the current PC, steps one instruction.
     */
    stepOver(granularity = 'line') {
        this.requireStep();
        const line = granularity === 'line' ? this.sourceAt(this.core.getPC()) : null;
        let ret = null;
        this.setGoal('step', (pc, first) => {
            if (ret) {
                if (pc !== ret.pc || this.sp() < ret.sp)
                    return false;
                ret = null;
            }
            if (!first) {
                if (!line)
                    return true;
                const here = this.sourceAt(pc);
                if (here && !sameLine(here, line))
                    return true;
            }
            const d = this.core.disassemble(pc);
            if (d && isCallInsn(d.line))
                ret = { pc: pc + d.nbytes, sp: this.sp() };
            return false;
        });
    }
    /** Run until the current subroutine returns to its caller. */
    stepOut() {
        this.requireStep();
        const sp0 = this.sp();
        let returned = false;
        this.setGoal('step', pc => {
            const d = this.core.disassemble(pc);
            // without a disassembler, any pop past the entry level counts
            if ((returned || !d) && this.sp() > sp0)
                return true;
            returned = !!d && isReturnInsn(d.line);
            return false;
        });
    }
    /** Stop at the next instruction boundary (or frame, where that's all there is). */
    pause() {
        this.goal = null;
        return this.stopEvent('pause');
    }
    /**
     * Work toward the goal for up to `maxFrames` frames. Returns how it
     * stopped, or null if it is still going (or there is no goal).
     */
    run(maxFrames = emucore_1.DEFAULT_MAX_FRAMES) {
        const g = this.goal;
        if (!g)
            return null;
        if (g.free && this.byPC.size === 0)
            return this.runFree(maxFrames);
        let stop = null;
        const pred = () => {
            const first = g.atStart;
            g.atStart = false;
            const pc = this.core.getPC();
            if (!first) {
                const ids = this.breakpointsAt(pc);
                if (ids) {
                    stop = this.stopEvent('breakpoint', { breakpoints: ids });
                    return true;
                }
            }
            if (g.test(pc, first)) {
                stop = this.stopEvent(g.reason);
                return true;
            }
            return false;
        };
        return this.stopOnHalt(() => {
            this.core.runUntil(pred, maxFrames);
            if (stop)
                this.goal = null;
            return stop;
        });
    }
    /** Whole frames with no trap, which is as fast as the emulator runs. */
    runFree(maxFrames) {
        return this.stopOnHalt(() => {
            for (let i = 0; i < maxFrames; i++)
                this.core.advanceFrame();
            return null;
        });
    }
    /** A halt (KIL, a watchdog, a program's exit) is a stop, not an error. */
    stopOnHalt(body) {
        try {
            return body();
        }
        catch (e) {
            if (!(e instanceof emu_1.EmuHalt))
                throw e;
            this.goal = null;
            return this.stopEvent(e.normal ? 'halt' : 'exception', { message: e.message });
        }
    }
    /** run() until it stops, for hosts that can wait: null if it ran out of frames. */
    runToStop(maxFrames = emucore_1.DEFAULT_MAX_FRAMES) {
        const stop = this.run(maxFrames);
        if (!stop)
            this.goal = null;
        return stop;
    }
    //// backward: search the recording and finish at once
    /** Step back one instruction, or to the start of the previous source line. */
    stepBack(granularity = 'line') {
        this.requireRewind();
        this.requireStep();
        this.goal = null;
        const line = granularity === 'line' ? this.sourceAt(this.core.getPC()) : null;
        if (!line)
            return this.core.stepBack() ? this.stopEvent('step') : null;
        // the last moment on another line, not inside a call from this one
        const sp0 = this.sp();
        const start = this.core.now();
        let prev = null;
        if (!this.core.stepBackUntil(() => this.sp() >= sp0 && !!(prev = this.sourceAt(this.core.getPC())) && !sameLine(prev, line))) {
            return null;
        }
        // then back to where that line started
        const depth = this.sp();
        for (let i = 0; i < MAX_LINE_STEPS_BACK; i++) {
            const t = this.core.now();
            if (!this.core.stepBackUntil(() => this.sp() >= depth))
                break;
            const here = this.sourceAt(this.core.getPC());
            if (!here || !sameLine(here, prev)) {
                this.core.seek(t);
                break;
            }
        }
        return (0, timeline_1.timestampsEqual)(this.core.now(), start) ? null : this.stopEvent('step');
    }
    /**
     * Run backwards to the last breakpoint hit before now, or to the start of
     * the recording if there is none.
     */
    reverseContinue() {
        this.requireRewind();
        this.goal = null;
        let ids = null;
        if (this.byPC.size && this.core.reverseRunUntil(() => !!(ids = this.breakpointsAt(this.core.getPC())))) {
            return this.stopEvent('breakpoint', { breakpoints: ids });
        }
        this.core.seek(this.core.history.first());
        return this.stopEvent('entry', { message: 'start of recording' });
    }
    /** Move to a recorded moment. */
    seek(t) {
        this.requireRewind();
        this.goal = null;
        this.core.seek(t);
        return this.stopEvent('goto');
    }
    /** Move to the start of a recorded frame, clamped to what's recorded. */
    seekFrame(frame) {
        this.requireRewind();
        const h = this.core.history;
        const f = Math.max(h.first().frame, Math.min(frame, h.last().frame));
        return this.seek((0, timeline_1.timestamp)(f, 0));
    }
    //// where it is
    location() {
        const pc = this.core.getPC();
        const loc = { at: this.core.now(), pc };
        const source = this.sourceAt(pc);
        if (source)
            loc.source = source;
        const symbol = pc != null ? this.symbolAt(pc) : null;
        if (symbol)
            loc.symbol = symbol;
        return loc;
    }
    sourceAt(pc) {
        return pc != null && this.ctx.sourceAt ? this.ctx.sourceAt(pc) : null;
    }
    /** The nearest symbol at or before `addr`. */
    symbolAt(addr) {
        if (!this.sortedSymbols) {
            this.sortedSymbols = Object.entries(this.ctx.symbols || {}).sort((a, b) => a[1] - b[1]);
        }
        const syms = this.sortedSymbols;
        let lo = 0, hi = syms.length - 1, best = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (syms[mid][1] <= addr) {
                best = mid;
                lo = mid + 1;
            }
            else
                hi = mid - 1;
        }
        return best < 0 ? null : { name: syms[best][0], offset: addr - syms[best][1] };
    }
    //// internals
    setGoal(reason, test) {
        // finish a partly-run instruction first, so the start is a boundary
        this.core.settle();
        // run() sees the starting position first on every target that can
        // stop mid-frame or rewind; on the rest the first check is a frame on
        this.goal = { reason, test, atStart: this.core.supportsTrap || this.core.supportsRewind };
    }
    breakpointsAt(pc) {
        const list = pc != null && this.byPC.get(pc);
        if (!list)
            return null;
        let ids = null;
        let state;
        for (const r of list) {
            if (r.condFn && !r.condFn(state = state || this.core.getCPUState()))
                continue;
            (ids = ids || []).push(r.bp.id);
        }
        return ids;
    }
    sp() {
        const s = this.core.getCPUState();
        return s && s.SP != null ? s.SP : 0;
    }
    stopEvent(reason, extra) {
        return Object.assign({ reason, at: this.core.now(), pc: this.core.getPC() }, extra);
    }
    requireStep() {
        if (!this.core.supportsStep)
            throw new Error(`'${this.core.id}' does not support instruction stepping`);
    }
    requireRewind() {
        if (!this.core.supportsRewind)
            throw new Error(`'${this.core.id}' cannot rewind (it can't save its state)`);
    }
}
exports.DebugController = DebugController;
function sameLine(a, b) {
    return a.line === b.line && a.path === b.path;
}
/**
 * A DebugContext from a build: source lines from its listings, and symbols.
 * `paths` are the project files, which name the source a listing came from.
 */
function buildDebugContext(build) {
    const listings = build.listings || {};
    // listings that came over an RPC have lost their SourceFile methods
    if (Object.values(listings).some(l => l.lines && !(l.sourcefile instanceof workertypes_1.SourceFile)))
        (0, projectcore_1.processListings)(listings);
    const paths = build.paths && build.paths.length ? build.paths : [build.mainPath];
    const byName = (name) => {
        const want = (0, util_1.getFilenamePrefix)((0, util_1.getFilenameForPath)((0, projectcore_1.stripLocalPath)(name, build.mainPath)));
        return paths.find(p => (0, util_1.getFilenamePrefix)((0, util_1.getFilenameForPath)(p)) === want) || name;
    };
    const symbolAddrs = [...new Set(Object.values(build.symbols || {}))].sort((a, b) => a - b);
    return {
        symbols: build.symbols,
        getListingForFile: path => (0, projectcore_1.getListingForFile)(listings, path, build.mainPath),
        sourceAt(pc) {
            const fnStart = lastAtOrBefore(symbolAddrs, pc);
            let best = null;
            let bestName = '';
            for (const name in listings) {
                const lst = listings[name];
                const files = lst.sourcefiles ? Object.entries(lst.sourcefiles) : [[name, lst.sourcefile]];
                for (const [p, sf] of files) {
                    const loc = sf && lineAt(sf, pc, fnStart);
                    if (loc && (!best || Math.abs(pc - loc.offset) < Math.abs(pc - best.offset))) {
                        best = loc;
                        bestName = loc.path || p;
                    }
                }
            }
            return best ? Object.assign(Object.assign({}, best), { path: byName(bestName) }) : null;
        },
    };
}
/**
 * The source line `pc` is on. A line never reaches back across the start of
 * a symbol: code between a function's label and its first listed line (the
 * prologue, which compilers often leave unlisted) belongs to that first line,
 * not to the end of the function before it.
 */
function lineAt(sf, pc, fnStart) {
    const loc = sf.findLineForOffset(pc, PC_LINE_LOOKBEHIND);
    if (!loc || fnStart == null || loc.offset >= fnStart)
        return loc;
    const next = firstAtOrAfter(sf.sortedOffsets, fnStart);
    return next != null && next - pc <= PC_LINE_LOOKBEHIND ? sf.offset2loc.get(next) : null;
}
function lastAtOrBefore(sorted, x) {
    let lo = 0, hi = sorted.length - 1, best = null;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid] <= x) {
            best = sorted[mid];
            lo = mid + 1;
        }
        else
            hi = mid - 1;
    }
    return best;
}
function firstAtOrAfter(sorted, x) {
    let lo = 0, hi = sorted.length - 1, best = null;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (sorted[mid] >= x) {
            best = sorted[mid];
            hi = mid - 1;
        }
        else
            lo = mid + 1;
    }
    return best;
}
//# sourceMappingURL=debugcontroller.js.map