"use strict";
// The call graph behind the IDE's Call Stack window, built from probe events
// (see probe.ts). A call is a call instruction (or an interrupt) after which
// the stack pointer went down; a return is a return instruction after which
// it went up. Conditional calls and returns that aren't taken leave SP alone,
// so they don't count, and neither do pushes and pops of data.
//
// Where the instruction can't be told (no disassembler), it falls back to
// guessing from how far SP moved and how far the PC jumped.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallGraphBuilder = void 0;
const probe_1 = require("./probe");
class CallGraphBuilder {
    /**
     * `classify` says what the instruction at an address is; `name` names a
     * routine by its address (a symbol, or hex).
     */
    constructor(classify, name) {
        this.classify = classify;
        this.name = name;
        this.graph = null;
        /** the root first, the routine running now last */
        this.stack = [];
        this.lastsp = -1;
        this.lastpc = 0;
        /** SP as the last instruction started */
        this.spAtLastExec = -1;
        this.interrupted = false;
        // for the fallback guess
        this.jsr = false;
        this.rts = false;
    }
    /** Forget everything. */
    clear() {
        this.graph = null;
        this.reset();
    }
    /** Forget where it is, but keep the graph. */
    reset() {
        this.stack = [];
        this.lastsp = -1;
        this.lastpc = 0;
        this.spAtLastExec = -1;
        this.interrupted = false;
        this.jsr = false;
        this.rts = false;
    }
    newNode(pc, sp) {
        return { $$SP: sp, $$PC: pc, count: 0, startLine: null, endLine: null, calls: {} };
    }
    enter(pc, row) {
        const top = this.stack[this.stack.length - 1];
        const sym = this.name(pc);
        let child = top.calls[sym];
        if (child == null)
            child = top.calls[sym] = this.newNode(pc, this.lastsp);
        else if (child.$$PC == null)
            child.$$PC = pc;
        this.stack.push(child);
        child.count++;
        child.startLine = row;
    }
    leave(row) {
        if (this.stack.length > 1) {
            this.stack.pop().endLine = row;
        }
        else {
            // it returned from where it was when we started: into a caller we
            // didn't see call, which becomes the new root
            const old = this.stack[0];
            this.graph = this.newNode(null, this.lastsp);
            this.graph.calls[this.name(this.lastpc)] = old;
            this.stack = [this.graph];
        }
    }
    /** One probe event. */
    event(op, addr, row) {
        var _a;
        switch (op) {
            case probe_1.ProbeFlags.INTERRUPT:
                this.interrupted = true;
                break;
            case probe_1.ProbeFlags.SP_POP:
            case probe_1.ProbeFlags.SP_PUSH:
                if (this.stack.length) {
                    const top = this.stack[this.stack.length - 1];
                    const delta = this.lastsp - addr;
                    if ((delta == 2 || delta == 3) && addr < top.$$SP)
                        this.jsr = true;
                    if ((delta == -2 || delta == -3) && this.stack.length > 1 && addr > top.$$SP)
                        this.rts = true;
                }
                this.lastsp = addr;
                break;
            case probe_1.ProbeFlags.EXECUTE: {
                if (!this.stack.length) {
                    (_a = this.graph) !== null && _a !== void 0 ? _a : (this.graph = this.newNode(null, this.lastsp));
                    this.stack = [this.graph];
                }
                const kind = this.spAtLastExec >= 0 ? this.classify(this.lastpc) : 'unknown';
                if (kind === 'unknown' && !this.interrupted) {
                    this.guess(addr, row);
                }
                else {
                    const pushed = this.lastsp < this.spAtLastExec;
                    const popped = this.lastsp > this.spAtLastExec;
                    if ((kind === 'call' || this.interrupted) && pushed)
                        this.enter(addr, row);
                    else if (kind === 'return' && popped)
                        this.leave(row);
                    this.jsr = this.rts = false;
                }
                this.interrupted = false;
                this.lastpc = addr;
                this.spAtLastExec = this.lastsp;
                break;
            }
        }
    }
    /** The old guess: SP moved by an address's worth, and the PC jumped. */
    guess(addr, row) {
        if (Math.abs(addr - this.lastpc) >= 4) {
            if (this.jsr)
                this.enter(addr, row);
            if (this.rts)
                this.leave(row);
            this.jsr = this.rts = false;
        }
    }
}
exports.CallGraphBuilder = CallGraphBuilder;
//# sourceMappingURL=callgraph.js.map