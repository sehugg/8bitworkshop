"use strict";
// The debugger as a service: everything a debug adapter asks of the machine,
// with plain-data arguments and results so it can sit behind an RPC. The
// VS Code emulator worker and `8bws dap` each host one.
//
// Every stop, whatever caused it, goes out through `onStop`. Forward commands
// (continue, step) only set a goal; the host's loop calls advance() to work
// toward it, a few frames at a time, so it can still take a pause request.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DebugService = void 0;
const breakpoints_1 = require("../common/breakpoints");
const breakcond_1 = require("../common/breakcond");
const debugtree_1 = require("../common/debugtree");
const stackwalk_1 = require("../common/stackwalk");
const debugcontroller_1 = require("../common/debugcontroller");
const symbolfile_1 = require("../common/symbols/symbolfile");
const util_1 = require("../common/util");
const runscript_1 = require("./runscript");
// how far before an address to start disassembling, per instruction wanted
const MAX_INSN_BYTES = 4;
class DebugService {
    constructor(target, onStop) {
        this.target = target;
        this.onStop = onStop;
        this.scriptOut = '';
        this.debug = new debugcontroller_1.DebugController(target);
        this.script = new runscript_1.RunScript(target, s => { this.scriptOut += s; }, this.debug);
    }
    /** A new build: its listings and symbols. */
    setBuild(build) {
        this.script.setDebugContext((0, debugcontroller_1.buildDebugContext)(build));
    }
    capabilities() {
        const t = this.target;
        return {
            step: t.supportsStep,
            rewind: t.supportsRewind,
            granularity: t.history ? t.history.core.granularity : (t.supportsStep ? 'insn' : 'frame'),
            write: t.supportsWrite,
            tree: !!t.platform.getDebugTree,
        };
    }
    setBreakpoints(bps) {
        return this.debug.setBreakpoints(bps).map(r => {
            const res = { id: r.bp.id, verified: !r.error && r.pc >= 0 };
            if (r.error)
                res.message = r.error;
            if (r.pc >= 0) {
                res.pc = r.pc;
                const src = this.debug.sourceAt(r.pc);
                if (src)
                    res.line = src.line;
            }
            return res;
        });
    }
    get running() { return this.debug.running; }
    continue() { this.debug.continue(); }
    step(kind, granularity = 'line') {
        if (kind === 'in')
            this.debug.stepIn(granularity);
        else if (kind === 'over')
            this.debug.stepOver(granularity);
        else
            this.debug.stepOut();
    }
    pause() { this.onStop(this.debug.pause()); }
    /** Work toward the goal for up to `frames` frames. */
    advance(frames) {
        const stop = this.debug.run(frames);
        if (stop)
            this.onStop(stop);
        return stop;
    }
    stepBack(granularity = 'line') {
        const stop = this.debug.stepBack(granularity);
        if (stop)
            return this.onStop(stop);
        // nothing further back: say where it still is
        const { at, pc } = this.debug.location();
        this.onStop({ reason: 'entry', at, pc, message: 'start of recording' });
    }
    reverseContinue() { this.onStop(this.debug.reverseContinue()); }
    seekFrame(frame) { this.onStop(this.debug.seekFrame(frame)); }
    location() { return this.debug.location(); }
    /**
     * Where it is and how it got there: the PC, then each call found on the
     * stack (see stackwalk.ts), innermost first.
     */
    callStack(maxFrames = 64) {
        var _a;
        const t = this.target;
        const pc = t.getPC();
        if (pc == null)
            return [];
        const regs = t.getCPUState() || {};
        const frames = (0, stackwalk_1.walkStack)({
            arch: t.arch,
            sp: (_a = regs.SP) !== null && _a !== void 0 ? _a : 0,
            read: a => t.read(a & 0xffff),
            disassemble: a => t.disassemble(a & 0xffff),
            isCode: a => { var _a, _b; return !!this.debug.sourceAt(a) || ((_b = (_a = this.debug.symbolAt(a)) === null || _a === void 0 ? void 0 : _a.offset) !== null && _b !== void 0 ? _b : Infinity) < 0x1000; },
        }, pc, maxFrames);
        return frames.map(f => {
            const frame = { pc: f.pc };
            const source = this.debug.sourceAt(f.pc);
            if (source)
                frame.source = { path: source.path, line: source.line };
            const symbol = this.debug.symbolAt(f.pc);
            if (symbol)
                frame.symbol = symbol;
            if (f.matched === false)
                frame.unsure = true;
            return frame;
        });
    }
    timeline() {
        const h = this.target.history;
        if (!h)
            return null;
        return { first: h.first().frame, last: h.last().frame, now: h.now(), past: h.isInPast() };
    }
    registers() {
        const state = this.target.getCPUState();
        if (!state)
            return [];
        return (0, runscript_1.cpuRegisters)(state).map(({ name, value }) => {
            const wide = /^(E?PC|SP|AF|BC|DE|HL|IX|IY)$/.test(name) || value > 0xff;
            return { name, value, text: '$' + (0, util_1.hex)(value, wide ? 4 : 2) };
        });
    }
    readMemory(addr, count) {
        const bytes = [];
        for (let i = 0; i < count; i++)
            bytes.push(this.target.read((addr + i) & 0xffff) & 0xff);
        return bytes;
    }
    /** Write bytes; returns how many. */
    writeMemory(addr, bytes) {
        bytes.forEach((b, i) => this.target.write((addr + i) & 0xffff, b & 0xff));
        return bytes.length;
    }
    /** The debug tree's entries under `path` (names from earlier calls). */
    debugTree(path) {
        const tree = this.target.getDebugTree();
        if (!tree)
            throw new Error('this platform has no debug tree');
        return (0, debugtree_1.treeChildren)(tree, path);
    }
    /** The build's symbols, by name, with the byte at each. */
    symbols() {
        const syms = this.debug.context.symbols || {};
        return Object.keys(syms)
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
            .map(name => ({ name, addr: syms[name], value: this.target.read(syms[name] & 0xffff) & 0xff }));
    }
    /**
     * `count` instructions starting `insnOffset` instructions from `addr`
     * (which may be negative). Instructions vary in length, so going back
     * tries each start that disassembles into `addr` and keeps the one that
     * lands on it.
     */
    disassemble(addr, insnOffset, count) {
        let start = addr;
        if (insnOffset < 0)
            start = this.alignBack(addr, -insnOffset);
        else
            for (let i = 0; i < insnOffset; i++)
                start += this.insnSize(start);
        const out = [];
        let a = start;
        for (let i = 0; i < count; i++) {
            const d = this.target.disassemble(a & 0xffff);
            const n = d ? d.nbytes : 1;
            let bytes = '';
            for (let b = 0; b < n; b++)
                bytes += (0, util_1.hex)(this.target.read((a + b) & 0xffff), 2) + ' ';
            const line = { addr: a & 0xffff, bytes: bytes.trim(), text: d ? d.line : '???' };
            const sym = this.debug.symbolAt(a & 0xffff);
            if (sym && sym.offset === 0)
                line.symbol = sym.name;
            const src = this.debug.sourceAt(a & 0xffff);
            if (src)
                line.source = { path: src.path, line: src.line };
            out.push(line);
            a += n;
        }
        return out;
    }
    insnSize(addr) {
        const d = this.target.disassemble(addr & 0xffff);
        return d ? d.nbytes : 1;
    }
    alignBack(addr, n) {
        for (let start = addr - n * MAX_INSN_BYTES; start < addr; start++) {
            let a = start, count = 0;
            while (a < addr) {
                a += this.insnSize(a);
                count++;
            }
            if (a === addr && count >= n) {
                // skip the extra instructions at the front
                for (let i = 0; i < count - n; i++)
                    start += this.insnSize(start);
                return start;
            }
        }
        return addr - n;
    }
    /**
     * `repl`: a run-script command line (`mem $200 16`, `back 3`, `help`).
     * Anything else: an expression, as in a breakpoint condition (`[score]`,
     * `A`, `#mem16[ptr]`), or a symbol.
     */
    evaluate(expr, context) {
        expr = expr.trim();
        if (context === 'repl')
            return this.runScript(expr);
        const ctx = (0, breakpoints_1.makeCondContext)(this.debug.context);
        let value;
        const sym = (0, symbolfile_1.lookupSymbol)(this.debug.context.symbols, expr);
        if (sym != null)
            value = sym;
        else
            value = (0, breakcond_1.compileExpression)(expr, ctx)(this.target.getCPUState());
        if (typeof value !== 'number' || isNaN(value))
            throw new Error(`'${expr}' has no value`);
        return { result: `$${(0, util_1.hex)(value, value > 0xff ? 4 : 2)} (${value})`, value };
    }
    runScript(line) {
        if (line === 'help' || line === '?')
            return { result: runscript_1.RUN_SCRIPT_HELP };
        const before = this.target.now();
        this.scriptOut = '';
        this.script.run(line);
        const after = this.target.now();
        const moved = before.frame !== after.frame || before.step !== after.step;
        return { result: this.scriptOut.replace(/\n$/, ''), moved };
    }
}
exports.DebugService = DebugService;
//# sourceMappingURL=debugservice.js.map