import assert from "assert";
import { before, describe, it } from "mocha";
import { EmuDebugSession } from "../../src/tools/dapsession";
import { DapClient } from "./dapclient";
import { LocalDebugBackend } from "../../src/tools/daplocal";
import { loadPlatform } from "../../src/tools/emutarget";
import { compileSourceFile, preload } from "../../src/tools/testlib";

// The debug adapter, driven with DAP messages as VS Code sends them, over the
// in-process backend `8bws dap` uses.

const ROOT = '/proj';
let build: any;

async function launch(): Promise<DapClient> {
  const backend = new LocalDebugBackend(async () => {
    const target = await loadPlatform('mw8080bw');
    await target.start();
    await target.loadROM(build.output);
    return { target, root: ROOT, debugInfo: { listings: build.listings, symbols: build.symbolmap, mainPath: 'game2.c' } };
  });
  const c = new DapClient(new EmuDebugSession(backend));
  const caps = await c.request('initialize', { adapterID: '8bitworkshop', linesStartAt1: true, columnsStartAt1: true, pathFormat: 'path', supportsMemoryEvent: true, supportsInvalidatedEvent: true });
  assert.ok(caps.supportsDisassembleRequest);
  await c.request('launch', { program: 'game2.c' });
  await c.event('initialized');
  const { capabilities } = await c.event('capabilities');
  assert.strictEqual(capabilities.supportsStepBack, true);
  assert.strictEqual(capabilities.supportsWriteMemoryRequest, true);
  return c;
}

describe('Debug adapter', function () {
  this.timeout(120000);

  before(async function () {
    await preload('sdcc', 'mw8080bw');
    build = await compileSourceFile('sdcc', 'mw8080bw', 'presets/mw8080bw/game2.c');
    assert.deepStrictEqual(build.errors || [], []);
  });

  it('stops at a source breakpoint, steps by line, and steps back', async function () {
    const c = await launch();
    const { breakpoints } = await c.request('setBreakpoints', { source: { path: `${ROOT}/game2.c` }, breakpoints: [{ line: 166 }] });
    assert.strictEqual(breakpoints[0].verified, true);
    assert.strictEqual(breakpoints[0].line, 166);
    await c.request('configurationDone');
    const hit = await c.event('stopped');
    assert.strictEqual(hit.reason, 'breakpoint');
    assert.deepStrictEqual(hit.hitBreakpointIds, [breakpoints[0].id]);
    let frame = await c.where();
    assert.strictEqual(frame.source.path, `${ROOT}/game2.c`);
    assert.strictEqual(frame.line, 166);
    assert.strictEqual(frame.name, '_draw_string+18');

    await c.request('next', { threadId: 1 });
    assert.strictEqual((await c.event('stopped')).reason, 'step');
    assert.strictEqual((await c.where()).line, 167);

    await c.request('stepBack', { threadId: 1 });
    assert.strictEqual((await c.event('stopped')).reason, 'step');
    frame = await c.where();
    assert.strictEqual(frame.line, 166);
    assert.strictEqual(frame.name, '_draw_string+18');
  });

  it('shows registers, memory and disassembly around the PC', async function () {
    const c = await launch();
    await c.request('setFunctionBreakpoints', { breakpoints: [{ name: 'draw_char' }] });
    await c.request('configurationDone');
    assert.strictEqual((await c.event('stopped')).reason, 'breakpoint');
    const frame = await c.where();
    const pc = parseInt(frame.instructionPointerReference, 16);
    assert.strictEqual(pc, build.symbolmap['_draw_char']);

    const { scopes } = await c.request('scopes', { frameId: frame.id });
    const { variables } = await c.request('variables', { variablesReference: scopes[0].variablesReference });
    const reg = variables.find((v: any) => v.name === 'PC');
    assert.strictEqual(parseInt(reg.value.slice(1), 16), pc);

    const mem = await c.request('readMemory', { memoryReference: frame.instructionPointerReference, count: 4 });
    assert.strictEqual(Buffer.from(mem.data, 'base64').length, 4);

    const { instructions } = await c.request('disassemble', { memoryReference: frame.instructionPointerReference, instructionOffset: -3, instructionCount: 6 });
    assert.strictEqual(instructions.length, 6);
    assert.strictEqual(parseInt(instructions[3].address, 16), pc);
    assert.strictEqual(instructions[3].symbol, '_draw_char');
  });

  it('shows the machine tree and symbols, and writes memory', async function () {
    const c = await launch();
    await c.request('setFunctionBreakpoints', { breakpoints: [{ name: 'draw_char' }] });
    await c.request('configurationDone');
    await c.event('stopped');
    await c.event('memory');
    const frame = await c.where();
    const { scopes } = await c.request('scopes', { frameId: frame.id });
    assert.deepStrictEqual(scopes.map((s: any) => s.name), ['Registers', 'Machine', 'Symbols']);

    const machine = await c.request('variables', { variablesReference: scopes[1].variablesReference });
    const state = machine.variables.find((v: any) => v.name === 'state');
    assert.ok(state.variablesReference);
    const stateVars = await c.request('variables', { variablesReference: state.variablesReference });
    assert.ok(stateVars.variables.find((v: any) => v.name === 'c'), 'CPU state under state');

    const addr = build.symbolmap['_draw_char'];
    const syms = await c.request('variables', { variablesReference: scopes[2].variablesReference });
    const sym = syms.variables.find((v: any) => v.name === '_draw_char');
    assert.strictEqual(parseInt(sym.memoryReference, 16), addr);

    // video RAM
    const { bytesWritten } = await c.request('writeMemory', { memoryReference: '0x2400', data: Buffer.from([0x12, 0x34]).toString('base64') });
    assert.strictEqual(bytesWritten, 2);
    await c.event('invalidated');
    const mem = await c.request('readMemory', { memoryReference: '0x2400', count: 2 });
    assert.deepStrictEqual([...Buffer.from(mem.data, 'base64')], [0x12, 0x34]);
  });

  it('runs run-script commands in the Debug Console, and expressions in watches', async function () {
    const c = await launch();
    await c.request('setFunctionBreakpoints', { breakpoints: [{ name: 'draw_char' }] });
    await c.request('configurationDone');
    await c.event('stopped');
    const hover = await c.request('evaluate', { expression: 'SP', context: 'hover' });
    assert.match(hover.result, /^\$[0-9A-F]{4} \(\d+\)$/);
    const back = await c.request('evaluate', { expression: 'back 3', context: 'repl' });
    assert.match(back.result, /back 3: PC=/);
    assert.strictEqual((await c.event('stopped')).reason, 'goto');
    const now = await c.request('evaluate', { expression: 'now', context: 'repl' });
    assert.match(now.result, /past; recorded/);
    await assert.rejects(c.request('evaluate', { expression: 'bogus', context: 'repl' }), /unknown command/);
  });

  it('runs backwards to the previous breakpoint hit', async function () {
    const c = await launch();
    await c.request('setFunctionBreakpoints', { breakpoints: [{ name: 'draw_char' }] });
    await c.request('configurationDone');
    await c.event('stopped');
    const first = await c.where();
    await c.request('continue', { threadId: 1 });
    await c.event('stopped');
    await c.request('reverseContinue', { threadId: 1 });
    assert.strictEqual((await c.event('stopped')).reason, 'breakpoint');
    await c.request('reverseContinue', { threadId: 1 });
    assert.strictEqual((await c.event('stopped')).reason, 'entry');
    assert.strictEqual(first.name, '_draw_char');
  });

  it('pauses a running program', async function () {
    const c = await launch();
    await c.request('configurationDone');
    await new Promise(resolve => setTimeout(resolve, 50));
    await c.request('pause', { threadId: 1 });
    assert.strictEqual((await c.event('stopped')).reason, 'pause');
    assert.ok((await c.where()).instructionPointerReference);
  });
});
