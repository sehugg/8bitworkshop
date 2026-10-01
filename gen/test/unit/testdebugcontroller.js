"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const debugcontroller_1 = require("../../src/common/debugcontroller");
const statehash_1 = require("../../src/common/statehash");
const timeline_1 = require("../../src/common/timeline");
const emutarget_1 = require("../../src/tools/emutarget");
const runscript_1 = require("../../src/tools/runscript");
const testlib_1 = require("../../src/tools/testlib");
// The debugger the CLI and the VS Code adapter share, on a C program built
// with its listings, so steps can go by source line.
let build;
async function open() {
    const t = await (0, emutarget_1.loadPlatform)('mw8080bw');
    await t.start();
    await t.loadROM(build.output);
    const dc = new debugcontroller_1.DebugController(t, (0, debugcontroller_1.buildDebugContext)({ listings: build.listings, symbolmap: build.symbolmap, mainPath: 'game2.c' }));
    return { t, dc };
}
function bp(id, target, condition) {
    return { id, type: 'address', target, enabled: true, condition };
}
function sp(t) { return t.getCPUState().SP; }
/** Stop at the first call to `fn`. */
async function openAt(fn) {
    const o = await open();
    o.dc.setBreakpoints([bp(1, fn)]);
    o.dc.continue();
    const stop = o.dc.run(600);
    assert_1.default.strictEqual(stop === null || stop === void 0 ? void 0 : stop.reason, 'breakpoint');
    o.dc.setBreakpoints([]);
    return o;
}
(0, mocha_1.describe)('DebugController', function () {
    this.timeout(120000);
    (0, mocha_1.before)(async function () {
        await (0, testlib_1.preload)('sdcc', 'mw8080bw');
        build = await (0, testlib_1.compileSourceFile)('sdcc', 'mw8080bw', 'presets/mw8080bw/game2.c');
        assert_1.default.deepStrictEqual(build.errors || [], []);
    });
    (0, mocha_1.it)('knows calls and returns when it sees them', function () {
        for (const s of ['JSR $1234', 'CALL $1234', 'CALL NZ,$1234', 'RST $08', 'LBSR $10', 'call $4000'])
            assert_1.default.ok((0, debugcontroller_1.isCallInsn)(s), s);
        for (const s of ['RTS', 'RET', 'RET Z', 'RTI', 'RETI', 'PULS A,B,PC'])
            assert_1.default.ok((0, debugcontroller_1.isReturnInsn)(s), s);
        for (const s of ['JMP $1234', 'JP $1234', 'PULS A,B', 'LD A,(HL)'])
            assert_1.default.ok(!(0, debugcontroller_1.isCallInsn)(s) && !(0, debugcontroller_1.isReturnInsn)(s), s);
    });
    (0, mocha_1.it)('stops at a breakpoint, and continues past it to the next hit', async function () {
        const { t, dc } = await open();
        const addr = build.symbolmap['_draw_char'];
        const [r] = dc.setBreakpoints([bp(7, 'draw_char')]);
        assert_1.default.strictEqual(r.pc, addr);
        dc.continue();
        const first = dc.run(600);
        assert_1.default.strictEqual(first.reason, 'breakpoint');
        assert_1.default.deepStrictEqual(first.breakpoints, [7]);
        assert_1.default.strictEqual(t.getPC(), addr);
        assert_1.default.ok(!dc.running);
        dc.continue();
        const second = dc.run(600);
        assert_1.default.strictEqual(second.reason, 'breakpoint');
        assert_1.default.ok(second.at.frame > first.at.frame || second.at.step > first.at.step, 'did not move');
    });
    (0, mocha_1.it)('skips a breakpoint whose condition is false', async function () {
        const { dc } = await open();
        dc.setBreakpoints([bp(1, 'draw_char', 'A == 999')]);
        dc.continue();
        assert_1.default.strictEqual(dc.run(60), null);
        assert_1.default.ok(dc.running);
        assert_1.default.strictEqual(dc.pause().reason, 'pause');
        assert_1.default.ok(!dc.running);
    });
    (0, mocha_1.it)('reports where it stopped in the source', async function () {
        var _a;
        const { dc } = await openAt('draw_string');
        const loc = dc.location();
        assert_1.default.strictEqual((_a = loc.source) === null || _a === void 0 ? void 0 : _a.path, 'game2.c');
        assert_1.default.ok(loc.source.line >= 164 && loc.source.line <= 171, `line ${loc.source.line}`);
        assert_1.default.deepStrictEqual(loc.symbol, { name: '_draw_string', offset: 0 });
    });
    (0, mocha_1.it)('steps over a call instruction to the one after it', async function () {
        const { t, dc } = await openAt('draw_string');
        t.runUntil(() => { const d = t.disassemble(t.getPC()); return !!d && /^CALL \$/.test(d.line); });
        const pc = t.getPC();
        const size = t.disassemble(pc).nbytes;
        const depth = sp(t);
        const before = t.now();
        dc.stepOver('instruction');
        assert_1.default.strictEqual(dc.runToStop().reason, 'step');
        assert_1.default.strictEqual(t.getPC(), pc + size);
        assert_1.default.strictEqual(sp(t), depth);
        assert_1.default.ok(t.now().frame > before.frame || t.now().step - before.step > 1, 'the call did not run');
    });
    (0, mocha_1.it)('steps over source lines without going into the calls on them', async function () {
        const { t, dc } = await openAt('draw_string');
        const depth = sp(t);
        let line = dc.location().source.line;
        for (let i = 0; i < 6; i++) {
            assert_1.default.strictEqual(dc.stepOver(), undefined);
            assert_1.default.strictEqual(dc.runToStop().reason, 'step');
            const loc = dc.location();
            if (sp(t) > depth)
                break; // returned to the caller
            assert_1.default.strictEqual(loc.symbol.name, '_draw_string', `went into ${loc.symbol.name}`);
            assert_1.default.notStrictEqual(loc.source.line, line);
            line = loc.source.line;
        }
    });
    (0, mocha_1.it)('steps out to the caller', async function () {
        const { t, dc } = await openAt('draw_char');
        const depth = sp(t);
        const ret = t.read(depth) | (t.read(depth + 1) << 8);
        dc.stepOut();
        assert_1.default.strictEqual(dc.runToStop().reason, 'step');
        assert_1.default.strictEqual(t.getPC(), ret);
        assert_1.default.strictEqual(sp(t), depth + 2);
        assert_1.default.strictEqual(dc.location().symbol.name, '_draw_string');
    });
    (0, mocha_1.it)('steps back to the start of the line it stepped over', async function () {
        const { t, dc } = await openAt('draw_string');
        dc.stepOver();
        dc.runToStop();
        const pc = t.getPC();
        const state = (0, statehash_1.hashState)(t.machine.saveState());
        const line = dc.location().source.line;
        dc.stepOver();
        dc.runToStop();
        assert_1.default.notStrictEqual(dc.location().source.line, line);
        assert_1.default.strictEqual(dc.stepBack().reason, 'step');
        assert_1.default.strictEqual(t.getPC(), pc);
        assert_1.default.strictEqual((0, statehash_1.hashState)(t.machine.saveState()), state);
    });
    (0, mocha_1.it)('steps back one instruction', async function () {
        const { t, dc } = await openAt('draw_string');
        const pc = t.getPC();
        dc.stepInstruction();
        dc.runToStop();
        assert_1.default.notStrictEqual(t.getPC(), pc);
        assert_1.default.strictEqual(dc.stepBack('instruction').reason, 'step');
        assert_1.default.strictEqual(t.getPC(), pc);
    });
    (0, mocha_1.it)('runs backwards to the last breakpoint hit, then to the start', async function () {
        const { t, dc } = await open();
        dc.setBreakpoints([bp(1, 'draw_char')]);
        dc.continue();
        const first = dc.run(600);
        dc.continue();
        const second = dc.run(600);
        dc.continue();
        dc.run(600);
        let back = dc.reverseContinue();
        assert_1.default.strictEqual(back.reason, 'breakpoint');
        assert_1.default.ok((0, timeline_1.timestampsEqual)(back.at, second.at));
        back = dc.reverseContinue();
        assert_1.default.ok((0, timeline_1.timestampsEqual)(back.at, first.at));
        back = dc.reverseContinue();
        assert_1.default.strictEqual(back.reason, 'entry');
        assert_1.default.ok((0, timeline_1.timestampsEqual)(t.now(), t.history.first()));
    });
    (0, mocha_1.it)('drives the run-script commands, with source lines in the output', async function () {
        const { t, dc } = await open();
        let out = '';
        const script = new runscript_1.RunScript(t, (s) => { out += s; }, dc);
        script.addSymbols(build.symbolmap);
        script.run('break draw_string; over 2');
        assert_1.default.match(out, /^\[\d+:\d+\] PC=\$[0-9A-F]{4} \(game2\.c:167\)$/m);
        script.run('break draw_char');
        const depth = sp(t);
        const ret = t.read(depth) | (t.read(depth + 1) << 8);
        script.run('out');
        assert_1.default.strictEqual(t.getPC(), ret);
    });
});
//# sourceMappingURL=testdebugcontroller.js.map