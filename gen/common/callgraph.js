"use strict";
// The call graph behind the IDE's Call Graph window, built from probe events
// (see probe.ts). A call is a call instruction (or an interrupt) after which
// the stack pointer went down; a return is a return instruction after which
// it went up. Conditional calls and returns that aren't taken leave SP alone,
// so they don't count, and neither do pushes and pops of data.
//
// Clocks (CLOCKS events) are charged to the routine running: `self` to it
// alone, `total` to it and everything above it on the stack. A call or
// return instruction's own clocks count in the routine it started in.
//
// An interrupt is a call too, whether or not the machine reports it.
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
        return { $$SP: sp, $$PC: pc, count: 0, self: 0, total: 0, startLine: null, endLine: null, calls: {} };
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
            this.graph.total = old.total;
            this.graph.calls[this.name(this.lastpc)] = old;
            this.stack = [this.graph];
        }
    }
    /** Charge `n` clocks to the routine running now. */
    clocks(n) {
        const stack = this.stack;
        if (!stack.length)
            return;
        stack[stack.length - 1].self += n;
        for (const node of stack)
            node.total += n;
    }
    /** One probe event (for CLOCKS, `addr` is the number of clocks). */
    event(op, addr, row) {
        var _a;
        switch (op) {
            case probe_1.ProbeFlags.CLOCKS:
                this.clocks(addr);
                break;
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
                    // A push that ends in a jump can only be an interrupt or BRK, since
                    // a PUSH falls through. Many machines don't log their interrupts.
                    const implicitIrq = kind === 'other' && pushed && Math.abs(addr - this.lastpc) >= 4;
                    if ((kind === 'call' || this.interrupted || implicitIrq) && pushed)
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