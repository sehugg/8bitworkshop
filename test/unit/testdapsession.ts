import assert from "assert";
import { before, describe, it } from "mocha";
import { DebugProtocol } from "@vscode/debugprotocol";
import { EmuDebugSession } from "../../src/tools/dapsession";
import { LocalDebugBackend } from "../../src/tools/daplocal";
import { loadPlatform } from "../../src/tools/emutarget";
import { compileSourceFile, preload } from "../../src/tools/testlib";

// The debug adapter, driven with DAP messages as VS Code sends them, over the
// in-process backend `8bws dap` uses.

const ROOT = '/proj';
let build: any;

/** Just enough of a DAP client: requests by sequence number, events by name. */
class Client {
  private seq = 1;
  private pending = new Map<number, (r: DebugProtocol.Response) => void>();
  private events: DebugProtocol.Event[] = [];
  private waiting: { name: string, resolve: (e: DebugProtocol.Event) => void }[] = [];

  constructor(readonly session: EmuDebugSession) {
    session.onDidSendMessage((m: any) => {
      if (m.type === 'response') this.pending.get(m.request_seq)?.(m);
      else if (m.type === 'event') {
        const w = this.waiting.findIndex(w => w.name === m.event);
        if (w >= 0) this.waiting.splice(w, 1)[0].resolve(m);
        else this.events.push(m);
      }
    });
  }

  request(command: string, args: any = {}): Promise<any> {
    const seq = this.seq++;
    return new Promise((resolve, reject) => {
      this.pending.set(seq, (r) => r.success ? resolve(r.body) : reject(new Error(r.message)));
      this.session.handleMessage({ seq, type: 'request', command, arguments: args } as any);
    });
  }

  /** The next event of this name, including one that already came. */
  event(name: string): Promise<any> {
    const i = this.events.findIndex(e => e.event === name);
    if (i >= 0) return Promise.resolve(this.events.splice(i, 1)[0].body);
    return new Promise(resolve => this.waiting.push({ name, resolve: e => resolve(e.body) }));
  }

  async where() {
    const { stackFrames } = await this.request('stackTrace', { threadId: 1 });
    return stackFrames[0];
  }
}

async function launch(): Promise<Client> {
  const backend = new LocalDebugBackend(async () => {
    const target = await loadPlatform('mw8080bw');
    await target.start();
    await target.loadROM(build.output);
    return { target, root: ROOT, debugInfo: { listings: build.listings, symbols: build.symbolmap, mainPath: 'game2.c' } };
  });
  const c = new Client(new EmuDebugSession(backend));
  const caps = await c.request('initialize', { adapterID: '8bitworkshop', linesStartAt1: true, columnsStartAt1: true, pathFormat: 'path' });
  assert.ok(caps.supportsDisassembleRequest);
  await c.request('launch', { program: 'game2.c' });
  await c.event('initialized');
  assert.strictEqual((await c.event('capabilities')).capabilities.supportsStepBack, true);
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
