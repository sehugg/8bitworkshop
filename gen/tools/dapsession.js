"use strict";
// The Debug Adapter Protocol side of the debugger: translates DAP requests
// into DebugService calls. The service may be in this process (`8bws dap`,
// tests) or behind an RPC (the VS Code extension's emulator worker); either
// way it is reached through a DebugBackend, whose calls are all async.
//
// The machine has one thread. Its call stack is the PC, then the calls a
// scan of the stack finds (src/common/stackwalk.ts).
// Where the build has no source line for the PC (a library, a ROM), the frame
// shows a disassembly of the routine around it instead, so VS Code still has
// something to open and focus. Breakpoints set in it are address breakpoints.
// Its scopes are the CPU's registers, the platform's debug tree (browsed a
// level at a time, by path), and the build's symbols with the byte at each.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmuDebugSession = void 0;
const debugadapter_1 = require("@vscode/debugadapter");
const path = __importStar(require("path"));
const util_1 = require("../common/util");
const THREAD_ID = 1;
const REGISTERS_REF = 1;
const SYMBOLS_REF = 2;
// debug tree nodes get references from here up, anew at each stop
const FIRST_TREE_REF = 100;
// a routine's listing starts at its symbol if the PC is at most this far in
const MAX_ROUTINE_BYTES = 0x800;
// instructions to list: at most, and past the PC when no symbol ends it
const MAX_LISTING = 1024;
const LISTING_AFTER_PC = 64;
// instructions before the PC when there's no symbol to start from
const LISTING_BEFORE_PC = 16;
class EmuDebugSession extends debugadapter_1.LoggingDebugSession {
    constructor(backend) {
        var _a;
        super();
        this.backend = backend;
        this.root = '';
        this.stopOnEntry = false;
        this.sourceBps = new Map();
        this.functionBps = [];
        this.instructionBps = [];
        this.nextBpId = 1;
        this.hasTree = false;
        /** debug tree paths, by variablesReference; valid until the next stop */
        this.treeRefs = [];
        this.treeRefByPath = new Map();
        /** disassembly listings by sourceReference, and each one's reference by its text */
        this.listings = [];
        this.listingRefs = new Map();
        this.clientMemoryEvents = false;
        this.clientInvalidatedEvents = false;
        this.setDebuggerLinesStartAt1(true);
        this.setDebuggerColumnsStartAt1(true);
        this.launched = new Promise(resolve => this.resolveLaunched = resolve);
        backend.onStop(e => this.stopped(e));
        (_a = backend.onOutput) === null || _a === void 0 ? void 0 : _a.call(backend, text => this.sendEvent(new debugadapter_1.OutputEvent(text, 'console')));
    }
    initializeRequest(response, args) {
        this.clientMemoryEvents = !!args.supportsMemoryEvent;
        this.clientInvalidatedEvents = !!args.supportsInvalidatedEvent;
        response.body = {
            supportsConfigurationDoneRequest: true,
            supportsConditionalBreakpoints: true,
            supportsFunctionBreakpoints: true,
            supportsInstructionBreakpoints: true,
            supportsSteppingGranularity: true,
            supportsReadMemoryRequest: true,
            supportsDisassembleRequest: true,
            supportsEvaluateForHovers: true,
            supportsTerminateRequest: true,
            // until launch says whether this platform can
            supportsStepBack: false,
            supportsWriteMemoryRequest: false,
        };
        this.sendResponse(response);
    }
    async launchRequest(response, args) {
        await this.run(response, async () => {
            const r = await this.backend.launch(args);
            this.root = r.root;
            this.stopOnEntry = !!args.stopOnEntry;
            this.hasTree = r.capabilities.tree;
            if (r.capabilities.rewind || r.capabilities.write) {
                this.sendEvent(new debugadapter_1.CapabilitiesEvent({ supportsStepBack: r.capabilities.rewind, supportsWriteMemoryRequest: r.capabilities.write }));
            }
            if (!r.capabilities.step) {
                this.sendEvent(new debugadapter_1.OutputEvent(`This platform stops only between frames: stepping and breakpoints are frame by frame.\n`, 'console'));
            }
            this.resolveLaunched();
            // breakpoints come next, then configurationDone
            this.sendEvent(new debugadapter_1.InitializedEvent());
        });
    }
    async configurationDoneRequest(response) {
        await this.run(response, async () => {
            await this.launched;
            if (this.stopOnEntry)
                this.stopped(Object.assign(Object.assign({}, (await this.backend.location())), { reason: 'entry' }));
            else
                await this.backend.continue();
        });
    }
    //// breakpoints: the backend holds one list, so each request sends them all
    async setBreakPointsRequest(response, args) {
        await this.run(response, async () => {
            const listing = args.source.sourceReference ? this.listings[args.source.sourceReference - 1] : null;
            if (listing) {
                const key = `listing:${args.source.sourceReference}`;
                const lines = (args.breakpoints || []).map(b => ({ b, addr: listing.lineAddrs[b.line - 1] }));
                const bps = lines.filter(l => l.addr != null).map(({ b, addr }) => this.newBreakpoint({ type: 'address', target: '$' + (0, util_1.hex)(addr, 4), condition: b.condition }));
                this.sourceBps.set(key, bps);
                const results = await this.sendBreakpoints(bps);
                // report each on its own line of the listing
                let i = 0;
                response.body = {
                    breakpoints: lines.map(({ b, addr }) => {
                        if (addr == null)
                            return new debugadapter_1.Breakpoint(false, b.line);
                        const r = results[i++];
                        r.line = b.line;
                        return r;
                    }),
                };
                return;
            }
            const file = this.toProjectPath(args.source.path || args.source.name);
            const bps = (args.breakpoints || []).map(b => this.newBreakpoint({ type: 'source', file, line: b.line, condition: b.condition }));
            this.sourceBps.set(file, bps);
            response.body = { breakpoints: await this.sendBreakpoints(bps) };
        });
    }
    async setFunctionBreakPointsRequest(response, args) {
        await this.run(response, async () => {
            this.functionBps = args.breakpoints.map(b => this.newBreakpoint({ type: 'address', target: b.name, condition: b.condition }));
            response.body = { breakpoints: await this.sendBreakpoints(this.functionBps) };
        });
    }
    async setInstructionBreakpointsRequest(response, args) {
        await this.run(response, async () => {
            this.instructionBps = args.breakpoints.map(b => this.newBreakpoint({
                type: 'address', target: '$' + (0, util_1.hex)(parseAddress(b.instructionReference) + (b.offset || 0), 4), condition: b.condition,
            }));
            response.body = { breakpoints: await this.sendBreakpoints(this.instructionBps) };
        });
    }
    newBreakpoint(bp) {
        return Object.assign({ id: this.nextBpId++, enabled: true }, bp);
    }
    /** Send every breakpoint; report on the ones in `mine`. */
    async sendBreakpoints(mine) {
        await this.launched;
        const all = [...[...this.sourceBps.values()].flat(), ...this.functionBps, ...this.instructionBps];
        const results = await this.backend.setBreakpoints(all);
        const byId = new Map(results.map(r => [r.id, r]));
        return mine.map(bp => {
            var _a;
            const r = byId.get(bp.id);
            const out = new debugadapter_1.Breakpoint(!!(r === null || r === void 0 ? void 0 : r.verified), (_a = r === null || r === void 0 ? void 0 : r.line) !== null && _a !== void 0 ? _a : bp.line);
            out.id = bp.id;
            if (r === null || r === void 0 ? void 0 : r.message)
                out.message = r.message;
            if ((r === null || r === void 0 ? void 0 : r.pc) != null)
                out.instructionReference = addressRef(r.pc);
            return out;
        });
    }
    //// running
    async continueRequest(response) {
        await this.run(response, () => this.backend.continue());
    }
    async nextRequest(response, args) {
        await this.run(response, () => this.backend.step('over', granularity(args.granularity)));
    }
    async stepInRequest(response, args) {
        await this.run(response, () => this.backend.step('in', granularity(args.granularity)));
    }
    async stepOutRequest(response) {
        await this.run(response, () => this.backend.step('out'));
    }
    async stepBackRequest(response, args) {
        await this.run(response, () => this.backend.stepBack(granularity(args.granularity)));
    }
    async reverseContinueRequest(response) {
        await this.run(response, () => this.backend.reverseContinue());
    }
    async pauseRequest(response) {
        await this.run(response, () => this.backend.pause());
    }
    stopped(e) {
        this.treeRefs = [];
        this.treeRefByPath.clear();
        const reason = e.reason === 'halt' ? 'pause' : e.reason;
        const ev = new debugadapter_1.StoppedEvent(reason, THREAD_ID, e.reason === 'exception' ? e.message : undefined);
        ev.body.allThreadsStopped = true;
        if (e.reason === 'halt')
            ev.body.description = `Program ended${e.message ? ': ' + e.message : ''}`;
        else if (e.message)
            ev.body.description = e.message;
        if (e.breakpoints)
            ev.body.hitBreakpointIds = e.breakpoints;
        this.sendEvent(ev);
        // anything showing memory reads it again
        if (this.clientMemoryEvents)
            this.sendEvent(new debugadapter_1.MemoryEvent(addressRef(0), 0, 0x10000));
    }
    //// where it is
    threadsRequest(response) {
        response.body = { threads: [new debugadapter_1.Thread(THREAD_ID, 'CPU')] };
        this.sendResponse(response);
    }
    async stackTraceRequest(response, args) {
        await this.run(response, async () => {
            const all = await this.backend.callStack();
            const start = args.startFrame || 0;
            const want = all.slice(start, args.levels ? start + args.levels : undefined);
            const stackFrames = await Promise.all(want.map((f, i) => this.stackFrame(start + i, f)));
            response.body = { stackFrames, totalFrames: all.length };
        });
    }
    async stackFrame(id, f) {
        const name = (f.symbol ? f.symbol.name + (f.symbol.offset ? `+${f.symbol.offset}` : '') : '$' + (0, util_1.hex)(f.pc, 4))
            + (f.unsure ? ' ?' : '');
        let frame;
        if (f.source) {
            frame = new debugadapter_1.StackFrame(id, name, this.toSource(f.source.path), f.source.line, 1);
        }
        else {
            const listing = await this.listingAt(f.pc, f.symbol);
            const line = listing ? listing.lines.lineAddrs.indexOf(f.pc) + 1 : 0;
            frame = listing && line > 0
                ? new debugadapter_1.StackFrame(id, name, new debugadapter_1.Source(listing.lines.name, undefined, listing.ref, 'disassembly'), line, 1)
                : new debugadapter_1.StackFrame(id, name);
        }
        frame.instructionPointerReference = addressRef(f.pc);
        // a guess from the stack: show it, but don't make it look certain
        if (f.unsure)
            frame.presentationHint = 'subtle';
        return frame;
    }
    /** The disassembly listing for a PC with no source line. */
    async listingAt(pc, symbol) {
        const find = (lines) => lines.findIndex(d => d.addr === pc);
        let lines = [];
        let at = -1;
        if (symbol && symbol.offset <= MAX_ROUTINE_BYTES) {
            lines = await this.backend.disassemble(pc - symbol.offset, 0, MAX_LISTING);
            at = find(lines);
        }
        if (at < 0) {
            symbol = undefined;
            lines = await this.backend.disassemble(pc, -LISTING_BEFORE_PC, LISTING_BEFORE_PC + LISTING_AFTER_PC);
            at = find(lines);
        }
        if (at < 0) {
            lines = await this.backend.disassemble(pc, 0, LISTING_AFTER_PC);
            at = find(lines);
        }
        if (at < 0)
            return null;
        // stop at the next routine, or a way past the PC
        let end = lines.findIndex((d, i) => i > at && d.symbol);
        if (end < 0)
            end = Math.min(lines.length, at + LISTING_AFTER_PC);
        lines = lines.slice(0, end);
        const text = [];
        const lineAddrs = [];
        for (const d of lines) {
            if (d.symbol) {
                text.push(`${d.symbol}:`);
                lineAddrs.push(null);
            }
            text.push(`  $${(0, util_1.hex)(d.addr, 4)}  ${d.bytes.padEnd(12)}${d.text}`);
            lineAddrs.push(d.addr);
        }
        const listing = {
            name: `${symbol ? symbol.name : '$' + (0, util_1.hex)(lines[0].addr, 4)} (disassembly)`,
            text: text.join('\n') + '\n',
            lineAddrs,
        };
        // the same text keeps the same reference, so VS Code keeps the same editor
        let ref = this.listingRefs.get(listing.text);
        if (ref == null) {
            ref = this.listings.push(listing);
            this.listingRefs.set(listing.text, ref);
        }
        return { ref, lines: this.listings[ref - 1] };
    }
    sourceRequest(response, args) {
        var _a, _b;
        const listing = this.listings[((_b = (_a = args.source) === null || _a === void 0 ? void 0 : _a.sourceReference) !== null && _b !== void 0 ? _b : args.sourceReference) - 1];
        if (!listing) {
            this.sendErrorResponse(response, { id: 2, format: 'no such listing', showUser: false });
            return;
        }
        response.body = { content: listing.text, mimeType: 'text/plain' };
        this.sendResponse(response);
    }
    scopesRequest(response) {
        const scopes = [new debugadapter_1.Scope('Registers', REGISTERS_REF, false)];
        if (this.hasTree)
            scopes.push(new debugadapter_1.Scope('Machine', this.treeRef([]), true));
        scopes.push(new debugadapter_1.Scope('Symbols', SYMBOLS_REF, true));
        response.body = { scopes };
        this.sendResponse(response);
    }
    async variablesRequest(response, args) {
        await this.run(response, async () => {
            response.body = { variables: await this.variables(args.variablesReference) };
        });
    }
    async variables(ref) {
        if (ref === REGISTERS_REF) {
            const regs = await this.backend.registers();
            return regs.map(r => ({ name: r.name, value: r.text, variablesReference: 0, memoryReference: addressRef(r.value) }));
        }
        if (ref === SYMBOLS_REF) {
            const syms = await this.backend.symbols();
            return syms.map(s => ({
                name: s.name, value: `$${(0, util_1.hex)(s.addr, 4)}: $${(0, util_1.hex)(s.value, 2)}`, variablesReference: 0, memoryReference: addressRef(s.addr),
            }));
        }
        const path = this.treeRefs[ref - FIRST_TREE_REF];
        if (!path)
            return [];
        const entries = await this.backend.debugTree(path);
        return entries.map(e => ({
            name: e.name, value: e.value, variablesReference: e.expandable ? this.treeRef([...path, e.name]) : 0,
        }));
    }
    /** A reference for a debug tree path, until the next stop. */
    treeRef(path) {
        const key = path.join('\0');
        let ref = this.treeRefByPath.get(key);
        if (ref == null) {
            ref = FIRST_TREE_REF + this.treeRefs.push(path) - 1;
            this.treeRefByPath.set(key, ref);
        }
        return ref;
    }
    async readMemoryRequest(response, args) {
        await this.run(response, async () => {
            const addr = parseAddress(args.memoryReference) + (args.offset || 0);
            const bytes = await this.backend.readMemory(addr, Math.min(args.count, 0x10000));
            response.body = { address: addressRef(addr), data: Buffer.from(bytes).toString('base64') };
        });
    }
    async writeMemoryRequest(response, args) {
        await this.run(response, async () => {
            const addr = parseAddress(args.memoryReference) + (args.offset || 0);
            const bytes = [...Buffer.from(args.data, 'base64')];
            response.body = { bytesWritten: await this.backend.writeMemory(addr, bytes) };
            // the symbols and the machine may show what changed
            if (this.clientInvalidatedEvents)
                this.sendEvent(new debugadapter_1.InvalidatedEvent(['variables']));
        });
    }
    async disassembleRequest(response, args) {
        await this.run(response, async () => {
            const addr = parseAddress(args.memoryReference) + (args.offset || 0);
            const lines = await this.backend.disassemble(addr, args.instructionOffset || 0, args.instructionCount);
            response.body = {
                instructions: lines.map(d => {
                    const insn = {
                        address: addressRef(d.addr), instructionBytes: d.bytes, instruction: d.text,
                    };
                    if (d.symbol)
                        insn.symbol = d.symbol;
                    if (d.source) {
                        insn.location = this.toSource(d.source.path);
                        insn.line = d.source.line;
                    }
                    return insn;
                }),
            };
        });
    }
    /** The Debug Console runs run-script commands; watches and hovers are expressions. */
    async evaluateRequest(response, args) {
        await this.run(response, async () => {
            const r = await this.backend.evaluate(args.expression, args.context || 'repl');
            response.body = { result: r.result, variablesReference: 0 };
            if (r.value != null)
                response.body.memoryReference = addressRef(r.value);
            if (r.moved)
                this.stopped(Object.assign(Object.assign({}, (await this.backend.location())), { reason: 'goto' }));
        });
    }
    async terminateRequest(response) {
        await this.run(response, async () => {
            await this.backend.terminate();
            this.sendEvent(new debugadapter_1.TerminatedEvent());
        });
    }
    async disconnectRequest(response) {
        await this.run(response, () => this.backend.terminate());
    }
    //// helpers
    /** Answer the request, or report what went wrong with it. */
    async run(response, body) {
        try {
            await body();
            this.sendResponse(response);
        }
        catch (e) {
            this.sendErrorResponse(response, { id: 1, format: String((e === null || e === void 0 ? void 0 : e.message) || e), showUser: false });
        }
    }
    toProjectPath(p) {
        if (!this.root || !path.isAbsolute(p))
            return p;
        return path.relative(this.root, p).split(path.sep).join('/');
    }
    toSource(projectPath) {
        const abs = this.root ? path.resolve(this.root, projectPath) : projectPath;
        return new debugadapter_1.Source(path.basename(projectPath), abs);
    }
}
exports.EmuDebugSession = EmuDebugSession;
function granularity(g) {
    return g === 'instruction' ? 'instruction' : 'line';
}
function addressRef(addr) {
    return '0x' + (0, util_1.hex)(addr, 4);
}
function parseAddress(ref) {
    const n = ref.startsWith('$') ? parseInt(ref.slice(1), 16) : Number(ref);
    if (isNaN(n))
        throw new Error(`not an address: ${ref}`);
    return n;
}
//# sourceMappingURL=dapsession.js.map