"use strict";
// The Debug Adapter Protocol side of the debugger: translates DAP requests
// into DebugService calls. The service may be in this process (`8bws dap`,
// tests) or behind an RPC (the VS Code extension's emulator worker); either
// way it is reached through a DebugBackend, whose calls are all async.
//
// The machine has one thread. Its call stack is one frame: where the PC is.
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
        this.setDebuggerLinesStartAt1(true);
        this.setDebuggerColumnsStartAt1(true);
        this.launched = new Promise(resolve => this.resolveLaunched = resolve);
        backend.onStop(e => this.stopped(e));
        (_a = backend.onOutput) === null || _a === void 0 ? void 0 : _a.call(backend, text => this.sendEvent(new debugadapter_1.OutputEvent(text, 'console')));
    }
    initializeRequest(response) {
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
        };
        this.sendResponse(response);
    }
    async launchRequest(response, args) {
        await this.run(response, async () => {
            const r = await this.backend.launch(args);
            this.root = r.root;
            this.stopOnEntry = !!args.stopOnEntry;
            if (r.capabilities.rewind)
                this.sendEvent(new debugadapter_1.CapabilitiesEvent({ supportsStepBack: true }));
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
    }
    //// where it is
    threadsRequest(response) {
        response.body = { threads: [new debugadapter_1.Thread(THREAD_ID, 'CPU')] };
        this.sendResponse(response);
    }
    async stackTraceRequest(response) {
        await this.run(response, async () => {
            var _a;
            const loc = await this.backend.location();
            const pc = (_a = loc.pc) !== null && _a !== void 0 ? _a : 0;
            const name = loc.symbol ? loc.symbol.name + (loc.symbol.offset ? `+${loc.symbol.offset}` : '') : '$' + (0, util_1.hex)(pc, 4);
            const frame = loc.source
                ? new debugadapter_1.StackFrame(0, name, this.toSource(loc.source.path), loc.source.line, 1)
                : new debugadapter_1.StackFrame(0, name);
            frame.instructionPointerReference = addressRef(pc);
            response.body = { stackFrames: [frame], totalFrames: 1 };
        });
    }
    scopesRequest(response) {
        response.body = { scopes: [new debugadapter_1.Scope('Registers', REGISTERS_REF, false)] };
        this.sendResponse(response);
    }
    async variablesRequest(response, args) {
        await this.run(response, async () => {
            const regs = args.variablesReference === REGISTERS_REF ? await this.backend.registers() : [];
            response.body = {
                variables: regs.map(r => ({ name: r.name, value: r.text, variablesReference: 0, memoryReference: addressRef(r.value) })),
            };
        });
    }
    async readMemoryRequest(response, args) {
        await this.run(response, async () => {
            const addr = parseAddress(args.memoryReference) + (args.offset || 0);
            const bytes = await this.backend.readMemory(addr, Math.min(args.count, 0x10000));
            response.body = { address: addressRef(addr), data: Buffer.from(bytes).toString('base64') };
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