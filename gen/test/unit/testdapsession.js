"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const dapsession_1 = require("../../src/tools/dapsession");
const dapclient_1 = require("./dapclient");
const daplocal_1 = require("../../src/tools/daplocal");
const emutarget_1 = require("../../src/tools/emutarget");
const testlib_1 = require("../../src/tools/testlib");
// The debug adapter, driven with DAP messages as VS Code sends them, over the
// in-process backend `8bws dap` uses.
const ROOT = '/proj';
let build;
async function launch(args = {}) {
    const backend = new daplocal_1.LocalDebugBackend(async () => {
        const target = await (0, emutarget_1.loadPlatform)('mw8080bw');
        await target.start();
        await target.loadROM(build.output);
        return { target, root: ROOT, debugInfo: { listings: build.listings, symbols: build.symbolmap, mainPath: 'game2.c' } };
    });
    const c = new dapclient_1.DapClient(new dapsession_1.EmuDebugSession(backend));
    const caps = await c.request('initialize', { adapterID: '8bitworkshop', linesStartAt1: true, columnsStartAt1: true, pathFormat: 'path', supportsMemoryEvent: true, supportsInvalidatedEvent: true });
    assert_1.default.ok(caps.supportsDisassembleRequest);
    await c.request('launch', Object.assign({ program: 'game2.c' }, args));
    await c.event('initialized');
    const { capabilities } = await c.event('capabilities');
    assert_1.default.strictEqual(capabilities.supportsStepBack, true);
    assert_1.default.strictEqual(capabilities.supportsWriteMemoryRequest, true);
    return c;
}
(0, mocha_1.describe)('Debug adapter', function () {
    this.timeout(120000);
    (0, mocha_1.before)(async function () {
        await (0, testlib_1.preload)('sdcc', 'mw8080bw');
        build = await (0, testlib_1.compileSourceFile)('sdcc', 'mw8080bw', 'presets/mw8080bw/game2.c');
        assert_1.default.deepStrictEqual(build.errors || [], []);
    });
    (0, mocha_1.it)('stops at a source breakpoint, steps by line, and steps back', async function () {
        const c = await launch();
        const { breakpoints } = await c.request('setBreakpoints', { source: { path: `${ROOT}/game2.c` }, breakpoints: [{ line: 166 }] });
        assert_1.default.strictEqual(breakpoints[0].verified, true);
        assert_1.default.strictEqual(breakpoints[0].line, 166);
        await c.request('configurationDone');
        const hit = await c.event('stopped');
        assert_1.default.strictEqual(hit.reason, 'breakpoint');
        assert_1.default.deepStrictEqual(hit.hitBreakpointIds, [breakpoints[0].id]);
        let frame = await c.where();
        assert_1.default.strictEqual(frame.source.path, `${ROOT}/game2.c`);
        assert_1.default.strictEqual(frame.line, 166);
        assert_1.default.strictEqual(frame.name, '_draw_string+18');
        await c.request('next', { threadId: 1 });
        assert_1.default.strictEqual((await c.event('stopped')).reason, 'step');
        assert_1.default.strictEqual((await c.where()).line, 167);
        await c.request('stepBack', { threadId: 1 });
        assert_1.default.strictEqual((await c.event('stopped')).reason, 'step');
        frame = await c.where();
        assert_1.default.strictEqual(frame.line, 166);
        assert_1.default.strictEqual(frame.name, '_draw_string+18');
    });
    (0, mocha_1.it)('shows registers, memory and disassembly around the PC', async function () {
        const c = await launch();
        await c.request('setFunctionBreakpoints', { breakpoints: [{ name: 'draw_char' }] });
        await c.request('configurationDone');
        assert_1.default.strictEqual((await c.event('stopped')).reason, 'breakpoint');
        const frame = await c.where();
        const pc = parseInt(frame.instructionPointerReference, 16);
        assert_1.default.strictEqual(pc, build.symbolmap['_draw_char']);
        // the callers, from return addresses on the stack
        const { stackFrames, totalFrames } = await c.request('stackTrace', { threadId: 1 });
        assert_1.default.deepStrictEqual(stackFrames.map((f) => `${f.name.replace(/\+\d+$/, '')} ${f.line}`), ['_draw_char 155', '_draw_string 168', '_draw_playfield 391', '_play_round 487', '_play_game 533', '_main 552']);
        assert_1.default.strictEqual(totalFrames, 6);
        assert_1.default.ok(stackFrames.every((f) => !f.presentationHint));
        const callers = await c.request('stackTrace', { threadId: 1, startFrame: 1, levels: 2 });
        assert_1.default.deepStrictEqual(callers.stackFrames.map((f) => f.id), [1, 2]);
        const { scopes } = await c.request('scopes', { frameId: frame.id });
        const { variables } = await c.request('variables', { variablesReference: scopes[0].variablesReference });
        const reg = variables.find((v) => v.name === 'PC');
        assert_1.default.strictEqual(parseInt(reg.value.slice(1), 16), pc);
        const mem = await c.request('readMemory', { memoryReference: frame.instructionPointerReference, count: 4 });
        assert_1.default.strictEqual(Buffer.from(mem.data, 'base64').length, 4);
        const { instructions } = await c.request('disassemble', { memoryReference: frame.instructionPointerReference, instructionOffset: -3, instructionCount: 6 });
        assert_1.default.strictEqual(instructions.length, 6);
        assert_1.default.strictEqual(parseInt(instructions[3].address, 16), pc);
        assert_1.default.strictEqual(instructions[3].symbol, '_draw_char');
    });
    (0, mocha_1.it)('shows the machine tree and symbols, and writes memory', async function () {
        const c = await launch();
        await c.request('setFunctionBreakpoints', { breakpoints: [{ name: 'draw_char' }] });
        await c.request('configurationDone');
        await c.event('stopped');
        await c.event('memory');
        const frame = await c.where();
        const { scopes } = await c.request('scopes', { frameId: frame.id });
        assert_1.default.deepStrictEqual(scopes.map((s) => s.name), ['Registers', 'Machine', 'Symbols']);
        const machine = await c.request('variables', { variablesReference: scopes[1].variablesReference });
        const state = machine.variables.find((v) => v.name === 'state');
        assert_1.default.ok(state.variablesReference);
        const stateVars = await c.request('variables', { variablesReference: state.variablesReference });
        assert_1.default.ok(stateVars.variables.find((v) => v.name === 'c'), 'CPU state under state');
        const addr = build.symbolmap['_draw_char'];
        const syms = await c.request('variables', { variablesReference: scopes[2].variablesReference });
        const sym = syms.variables.find((v) => v.name === '_draw_char');
        assert_1.default.strictEqual(parseInt(sym.memoryReference, 16), addr);
        // video RAM
        const { bytesWritten } = await c.request('writeMemory', { memoryReference: '0x2400', data: Buffer.from([0x12, 0x34]).toString('base64') });
        assert_1.default.strictEqual(bytesWritten, 2);
        await c.event('invalidated');
        const mem = await c.request('readMemory', { memoryReference: '0x2400', count: 2 });
        assert_1.default.deepStrictEqual([...Buffer.from(mem.data, 'base64')], [0x12, 0x34]);
    });
    (0, mocha_1.it)('runs run-script commands in the Debug Console, and expressions in watches', async function () {
        const c = await launch();
        await c.request('setFunctionBreakpoints', { breakpoints: [{ name: 'draw_char' }] });
        await c.request('configurationDone');
        await c.event('stopped');
        const hover = await c.request('evaluate', { expression: 'SP', context: 'hover' });
        assert_1.default.match(hover.result, /^\$[0-9A-F]{4} \(\d+\)$/);
        const back = await c.request('evaluate', { expression: 'back 3', context: 'repl' });
        assert_1.default.match(back.result, /back 3: PC=/);
        assert_1.default.strictEqual((await c.event('stopped')).reason, 'goto');
        const now = await c.request('evaluate', { expression: 'now', context: 'repl' });
        assert_1.default.match(now.result, /past; recorded/);
        await assert_1.default.rejects(c.request('evaluate', { expression: 'bogus', context: 'repl' }), /unknown command/);
    });
    (0, mocha_1.it)('runs backwards to the previous breakpoint hit', async function () {
        const c = await launch();
        await c.request('setFunctionBreakpoints', { breakpoints: [{ name: 'draw_char' }] });
        await c.request('configurationDone');
        await c.event('stopped');
        const first = await c.where();
        await c.request('continue', { threadId: 1 });
        await c.event('stopped');
        await c.request('reverseContinue', { threadId: 1 });
        assert_1.default.strictEqual((await c.event('stopped')).reason, 'breakpoint');
        await c.request('reverseContinue', { threadId: 1 });
        assert_1.default.strictEqual((await c.event('stopped')).reason, 'entry');
        assert_1.default.strictEqual(first.name, '_draw_char');
    });
    (0, mocha_1.it)('pauses a running program', async function () {
        const c = await launch();
        await c.request('configurationDone');
        await new Promise(resolve => setTimeout(resolve, 50));
        await c.request('pause', { threadId: 1 });
        assert_1.default.strictEqual((await c.event('stopped')).reason, 'pause');
        assert_1.default.ok((await c.where()).instructionPointerReference);
    });
});
(0, mocha_1.describe)('Debug adapter, where there is no source', function () {
    // a routine `lib` at $1000 of one-byte NOPs, the PC 3 bytes in, and
    // another routine at $1008
    const PC = 0x1003;
    let bpsSent = [];
    const backend = {
        launch: async () => ({ capabilities: { step: true, rewind: false, granularity: 'insn', write: false, tree: false }, root: ROOT }),
        terminate: async () => { },
        onStop: () => { },
        setBreakpoints: async (bps) => { bpsSent = bps; return bps.map(b => ({ id: b.id, verified: true, pc: parseInt(b.target.slice(1), 16) })); },
        continue: async () => { }, step: async () => { }, pause: async () => { }, stepBack: async () => { }, reverseContinue: async () => { },
        location: async () => ({ at: { frame: 0, step: 0 }, pc: PC, symbol: { name: 'lib', offset: PC - 0x1000 } }),
        callStack: async () => [{ pc: PC, symbol: { name: 'lib', offset: PC - 0x1000 } }],
        registers: async () => [], readMemory: async () => [], writeMemory: async () => 0,
        debugTree: async () => [], symbols: async () => [],
        evaluate: async () => ({ result: '' }),
        disassemble: async (addr, insnOffset, count) => Array.from({ length: count }, (_, i) => {
            const a = addr + insnOffset + i;
            return { addr: a, bytes: '00', text: 'NOP', symbol: a === 0x1000 ? 'lib' : a === 0x1008 ? 'next' : undefined };
        }),
    };
    (0, mocha_1.it)('shows a disassembly of the routine, and takes breakpoints in it', async function () {
        const c = new dapclient_1.DapClient(new dapsession_1.EmuDebugSession(backend));
        await c.request('initialize', { adapterID: '8bitworkshop', linesStartAt1: true, columnsStartAt1: true, pathFormat: 'path' });
        await c.request('launch', { program: 'x.s' });
        const frame = await c.where();
        assert_1.default.strictEqual(frame.source.name, 'lib (disassembly)');
        assert_1.default.ok(frame.source.sourceReference > 0);
        const { content } = await c.request('source', { source: frame.source, sourceReference: frame.source.sourceReference });
        const lines = content.split('\n');
        assert_1.default.deepStrictEqual(lines.slice(0, 3), ['lib:', '  $1000  00          NOP', '  $1001  00          NOP']);
        // up to the next routine
        assert_1.default.strictEqual(lines.length, 1 + 8 + 1);
        assert_1.default.strictEqual(frame.line, 1 + 4);
        assert_1.default.match(lines[frame.line - 1], /^  \$1003 /);
        // the same code keeps the same reference
        assert_1.default.strictEqual((await c.where()).source.sourceReference, frame.source.sourceReference);
        // breakpoints go on instructions' lines, not labels'
        const { breakpoints } = await c.request('setBreakpoints', { source: frame.source, breakpoints: [{ line: 3 }, { line: 1 }] });
        assert_1.default.deepStrictEqual(bpsSent.map(b => b.target), ['$1001']);
        assert_1.default.strictEqual(breakpoints[0].verified, true);
        assert_1.default.strictEqual(breakpoints[0].line, 3);
        assert_1.default.strictEqual(breakpoints[1].verified, false);
    });
});
//# sourceMappingURL=testdapsession.js.map