import assert from "assert";
import { before, describe, it } from "mocha";
import { Breakpoint } from "../../src/common/breakpoints";
import { buildDebugContext, DebugController, isCallInsn, isReturnInsn } from "../../src/common/debugcontroller";
import { hashState } from "../../src/common/statehash";
import { timestampsEqual } from "../../src/common/timeline";
import { EmuTarget, loadPlatform } from "../../src/tools/emutarget";
import { RunScript } from "../../src/tools/runscript";
import { compileSourceFile, preload } from "../../src/tools/testlib";

// The debugger the CLI and the VS Code adapter share, on a C program built
// with its listings, so steps can go by source line.

let build: any;

async function open(): Promise<{ t: EmuTarget, dc: DebugController }> {
  const t = await loadPlatform('mw8080bw');
  await t.start();
  await t.loadROM(build.output);
  const dc = new DebugController(t, buildDebugContext({ listings: build.listings, symbolmap: build.symbolmap, mainPath: 'game2.c' }));
  return { t, dc };
}

function bp(id: number, target: string, condition?: string): Breakpoint {
  return { id, type: 'address', target, enabled: true, condition };
}

function sp(t: EmuTarget): number { return (t.getCPUState() as any).SP; }

/** Stop at the first call to `fn`. */
async function openAt(fn: string) {
  const o = await open();
  o.dc.setBreakpoints([bp(1, fn)]);
  o.dc.continue();
  const stop = o.dc.run(600);
  assert.strictEqual(stop?.reason, 'breakpoint');
  o.dc.setBreakpoints([]);
  return o;
}

describe('DebugController', function () {
  this.timeout(120000);

  before(async function () {
    await preload('sdcc', 'mw8080bw');
    build = await compileSourceFile('sdcc', 'mw8080bw', 'presets/mw8080bw/game2.c');
    assert.deepStrictEqual(build.errors || [], []);
  });

  it('knows calls and returns when it sees them', function () {
    for (const s of ['JSR $1234', 'CALL $1234', 'CALL NZ,$1234', 'RST $08', 'LBSR $10', 'call $4000']) assert.ok(isCallInsn(s), s);
    for (const s of ['RTS', 'RET', 'RET Z', 'RTI', 'RETI', 'PULS A,B,PC']) assert.ok(isReturnInsn(s), s);
    for (const s of ['JMP $1234', 'JP $1234', 'PULS A,B', 'LD A,(HL)']) assert.ok(!isCallInsn(s) && !isReturnInsn(s), s);
  });

  it('stops at a breakpoint, and continues past it to the next hit', async function () {
    const { t, dc } = await open();
    const addr = build.symbolmap['_draw_char'];
    const [r] = dc.setBreakpoints([bp(7, 'draw_char')]);
    assert.strictEqual(r.pc, addr);
    dc.continue();
    const first = dc.run(600);
    assert.strictEqual(first.reason, 'breakpoint');
    assert.deepStrictEqual(first.breakpoints, [7]);
    assert.strictEqual(t.getPC(), addr);
    assert.ok(!dc.running);
    dc.continue();
    const second = dc.run(600);
    assert.strictEqual(second.reason, 'breakpoint');
    assert.ok(second.at.frame > first.at.frame || second.at.step > first.at.step, 'did not move');
  });

  it('skips a breakpoint whose condition is false', async function () {
    const { dc } = await open();
    dc.setBreakpoints([bp(1, 'draw_char', 'A == 999')]);
    dc.continue();
    assert.strictEqual(dc.run(60), null);
    assert.ok(dc.running);
    assert.strictEqual(dc.pause().reason, 'pause');
    assert.ok(!dc.running);
  });

  it('reports where it stopped in the source', async function () {
    const { dc } = await openAt('draw_string');
    const loc = dc.location();
    assert.strictEqual(loc.source?.path, 'game2.c');
    assert.ok(loc.source.line >= 164 && loc.source.line <= 171, `line ${loc.source.line}`);
    assert.deepStrictEqual(loc.symbol, { name: '_draw_string', offset: 0 });
  });

  it('steps over a call instruction to the one after it', async function () {
    const { t, dc } = await openAt('draw_string');
    t.runUntil(() => { const d = t.disassemble(t.getPC()); return !!d && /^CALL \$/.test(d.line); });
    const pc = t.getPC();
    const size = t.disassemble(pc).nbytes;
    const depth = sp(t);
    const before = t.now();
    dc.stepOver('instruction');
    assert.strictEqual(dc.runToStop().reason, 'step');
    assert.strictEqual(t.getPC(), pc + size);
    assert.strictEqual(sp(t), depth);
    assert.ok(t.now().frame > before.frame || t.now().step - before.step > 1, 'the call did not run');
  });

  it('steps over source lines without going into the calls on them', async function () {
    const { t, dc } = await openAt('draw_string');
    const depth = sp(t);
    let line = dc.location().source.line;
    for (let i = 0; i < 6; i++) {
      assert.strictEqual(dc.stepOver(), undefined);
      assert.strictEqual(dc.runToStop().reason, 'step');
      const loc = dc.location();
      if (sp(t) > depth) break;  // returned to the caller
      assert.strictEqual(loc.symbol.name, '_draw_string', `went into ${loc.symbol.name}`);
      assert.notStrictEqual(loc.source.line, line);
      line = loc.source.line;
    }
  });

  it('steps out to the caller', async function () {
    const { t, dc } = await openAt('draw_char');
    const depth = sp(t);
    const ret = t.read(depth) | (t.read(depth + 1) << 8);
    dc.stepOut();
    assert.strictEqual(dc.runToStop().reason, 'step');
    assert.strictEqual(t.getPC(), ret);
    assert.strictEqual(sp(t), depth + 2);
    assert.strictEqual(dc.location().symbol.name, '_draw_string');
  });

  it('steps back to the start of the line it stepped over', async function () {
    const { t, dc } = await openAt('draw_string');
    dc.stepOver();
    dc.runToStop();
    const pc = t.getPC();
    const state = hashState(t.machine.saveState());
    const line = dc.location().source.line;
    dc.stepOver();
    dc.runToStop();
    assert.notStrictEqual(dc.location().source.line, line);
    assert.strictEqual(dc.stepBack().reason, 'step');
    assert.strictEqual(t.getPC(), pc);
    assert.strictEqual(hashState(t.machine.saveState()), state);
  });

  it('steps back one instruction', async function () {
    const { t, dc } = await openAt('draw_string');
    const pc = t.getPC();
    dc.stepInstruction();
    dc.runToStop();
    assert.notStrictEqual(t.getPC(), pc);
    assert.strictEqual(dc.stepBack('instruction').reason, 'step');
    assert.strictEqual(t.getPC(), pc);
  });

  it('runs backwards to the last breakpoint hit, then to the start', async function () {
    const { t, dc } = await open();
    dc.setBreakpoints([bp(1, 'draw_char')]);
    dc.continue();
    const first = dc.run(600);
    dc.continue();
    const second = dc.run(600);
    dc.continue();
    dc.run(600);
    let back = dc.reverseContinue();
    assert.strictEqual(back.reason, 'breakpoint');
    assert.ok(timestampsEqual(back.at, second.at));
    back = dc.reverseContinue();
    assert.ok(timestampsEqual(back.at, first.at));
    back = dc.reverseContinue();
    assert.strictEqual(back.reason, 'entry');
    assert.ok(timestampsEqual(t.now(), t.history.first()));
  });

  it('drives the run-script commands, with source lines in the output', async function () {
    const { t, dc } = await open();
    let out = '';
    const script = new RunScript(t, (s: string) => { out += s; }, dc);
    script.addSymbols(build.symbolmap);
    script.run('break draw_string; over 2');
    assert.match(out, /^\[\d+:\d+\] PC=\$[0-9A-F]{4} \(game2\.c:167\)$/m);
    script.run('break draw_char');
    const depth = sp(t);
    const ret = t.read(depth) | (t.read(depth + 1) << 8);
    script.run('out');
    assert.strictEqual(t.getPC(), ret);
  });
});
