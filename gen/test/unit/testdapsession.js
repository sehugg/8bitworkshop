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
async function launch() {
    const backend = new daplocal_1.LocalDebugBackend(async () => {
        const target = await (0, emutarget_1.loadPlatform)('mw8080bw');
        await target.start();
        await target.loadROM(build.output);
        return { target, root: ROOT, debugInfo: { listings: build.listings, symbols: build.symbolmap, mainPath: 'game2.c' } };
    });
    const c = new dapclient_1.DapClient(new dapsession_1.EmuDebugSession(backend));
    const caps = await c.request('initialize', { adapterID: '8bitworkshop', linesStartAt1: true, columnsStartAt1: true, pathFormat: 'path' });
    assert_1.default.ok(caps.supportsDisassembleRequest);
    await c.request('launch', { program: 'game2.c' });
    await c.event('initialized');
    assert_1.default.strictEqual((await c.event('capabilities')).capabilities.supportsStepBack, true);
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
//# sourceMappingURL=testdapsession.js.map