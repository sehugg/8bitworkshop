"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs_1 = __importDefault(require("fs"));
const mocha_1 = require("mocha");
const nodemock_1 = require("../../src/tools/nodemock");
(0, nodemock_1.mockGlobals)();
(0, nodemock_1.mockAudio)();
// imported after the globals are mocked -- the machine pulls in the Javatari
// core, which reaches for window/navigator/document at run time
const vcs_1 = require("../../src/machine/vcs");
const emu_1 = require("../../src/common/emu");
const statehash_1 = require("../../src/common/statehash");
const devices_1 = require("../../src/common/devices");
const history_1 = require("../../src/common/history");
const timeline_1 = require("../../src/common/timeline");
// The VCS machine runs the Javatari TIA frame loop with a trap before every
// CPU clock, so a step is one clock. This pins the same guarantees
// testtimelinemachine.ts pins for the BasicScanline machines: exact replay
// from a snapshot, exact sub-frame seeking, and a KIL that parks where it
// happened.
const ROM = './test/roms/vcs/brickgame.rom';
/** Counts what the machine hands the probe, so a run can be checked for shape. */
class CountingProbe extends devices_1.NullProbe {
    constructor() {
        super(...arguments);
        this.frames = 0;
        this.scanlines = 0;
        this.clocks = 0;
        this.executes = 0;
        this.waits = 0;
        this.ioWrites = 0;
        this.pcs = new Set();
    }
    logNewFrame() { this.frames++; }
    logNewScanline() { this.scanlines++; }
    logClocks(n) { this.clocks += n || 0; }
    logExecute(pc) { this.executes++; this.pcs.add(pc); }
    logWait() { this.waits++; }
    logIOWrite() { this.ioWrites++; }
}
function newCore() {
    const m = new vcs_1.JavatariMachine();
    m.connectVideo(new Uint32Array(m.getVideoParams().width * m.getVideoParams().height));
    m.loadROM(new Uint8Array(fs_1.default.readFileSync(ROM)));
    m.reset();
    return { m, core: new timeline_1.MachineCore(m, 'clock') };
}
(0, mocha_1.describe)('JavatariMachine (VCS)', function () {
    this.timeout(60000);
    (0, mocha_1.it)('detects the cartridge format and runs a frame', function () {
        const { m, core } = newCore();
        assert_1.default.strictEqual(m.getCartridgeFormat(), '4K');
        const r = core.runUntil((0, timeline_1.timestamp)(1, 0));
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(1, 0)), (0, timeline_1.formatTimestamp)(r.at));
        assert_1.default.ok((0, timeline_1.timestampsEqual)(core.now(), (0, timeline_1.timestamp)(1, 0)));
    });
    (0, mocha_1.it)('replays to the identical state from a snapshot 20 frames back', function () {
        const { m, core } = newCore();
        core.runUntil((0, timeline_1.timestamp)(20, 0), () => false);
        const snap = core.snapshot();
        core.runUntil((0, timeline_1.timestamp)(40, 0), () => false);
        const expected = (0, statehash_1.hashState)(m.saveState());
        const pc = m.cpu.getPC();
        core.restore(snap, (0, timeline_1.timestamp)(20, 0));
        const r = core.runUntil((0, timeline_1.timestamp)(40, 0), () => false);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(40, 0)), (0, timeline_1.formatTimestamp)(r.at));
        assert_1.default.strictEqual(m.cpu.getPC(), pc);
        assert_1.default.strictEqual((0, statehash_1.hashState)(m.saveState()), expected);
    });
    (0, mocha_1.it)('reaches a sub-frame position identically forwards and backwards', function () {
        // where the machine should be at 12:250, reached only by running forward
        const fwd = newCore();
        fwd.core.runUntil((0, timeline_1.timestamp)(12, 250), () => false);
        const expected = (0, statehash_1.hashState)(fwd.m.saveState());
        // now overshoot, rewind to the frame boundary, and come back
        const { m, core } = newCore();
        core.runUntil((0, timeline_1.timestamp)(12, 0), () => false);
        const snap = core.snapshot();
        core.runUntil((0, timeline_1.timestamp)(12, 900), () => false);
        assert_1.default.notStrictEqual((0, statehash_1.hashState)(m.saveState()), expected);
        core.restore(snap, (0, timeline_1.timestamp)(12, 0));
        core.runUntil((0, timeline_1.timestamp)(12, 250), () => false);
        assert_1.default.strictEqual((0, statehash_1.hashState)(m.saveState()), expected);
    });
    (0, mocha_1.it)('traps on a condition several frames ahead and reports where', function () {
        const { m, core } = newCore();
        core.runUntil((0, timeline_1.timestamp)(5, 0), () => false);
        const snap5 = core.snapshot();
        // find some PC the ROM reaches later, whatever it is
        const seen = new Set();
        core.runUntil((0, timeline_1.timestamp)(6, 0), () => { seen.add(m.cpu.getPC()); return false; });
        core.restore(snap5, (0, timeline_1.timestamp)(5, 0));
        const targetPC = [...seen][Math.floor(seen.size / 2)];
        const r = core.runUntil((0, timeline_1.timestamp)(30, 0), () => m.cpu.getPC() === targetPC);
        assert_1.default.strictEqual(r.trapped, true);
        assert_1.default.strictEqual(m.cpu.getPC(), targetPC);
        // the same search from the same snapshot must land on the same instant
        const hit = r.at;
        const expected = (0, statehash_1.hashState)(m.saveState());
        core.restore(snap5, (0, timeline_1.timestamp)(5, 0));
        const r2 = core.runUntil((0, timeline_1.timestamp)(30, 0), () => m.cpu.getPC() === targetPC);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r2.at, hit), `${(0, timeline_1.formatTimestamp)(r2.at)} != ${(0, timeline_1.formatTimestamp)(hit)}`);
        assert_1.default.strictEqual((0, statehash_1.hashState)(m.saveState()), expected);
    });
    (0, mocha_1.it)('runs a hundred frames in a sane amount of time', function () {
        const { core } = newCore();
        const t0 = Date.now();
        core.runUntil((0, timeline_1.timestamp)(100, 0), () => false);
        const ms = Date.now() - t0;
        // the smoke test measured about 1ms per frame; this is a wide bound so a
        // slow CI machine passes but a pathological slowdown fails
        assert_1.default.ok(ms < 5000, `100 frames took ${ms}ms`);
    });
    (0, mocha_1.it)('leaves the machine alone when asked what memory holds', function () {
        // read() drives the real bus, so it latches the open-bus register the way
        // the hardware does; readConst() is what the disassembler and the debugger
        // use, and it must not move the machine or a replay stops matching
        const { m, core } = newCore();
        core.runUntil((0, timeline_1.timestamp)(5, 0), () => false);
        const before = (0, statehash_1.hashState)(m.saveState());
        m.readConst(0x80);
        m.readConst(0xfffc);
        m.readConst(0x0280);
        m.readConst(0x00);
        assert_1.default.strictEqual((0, statehash_1.hashState)(m.saveState()), before);
        m.read(0x80);
        assert_1.default.notStrictEqual((0, statehash_1.hashState)(m.saveState()), before, 'read() should latch the bus');
    });
    (0, mocha_1.it)('logs through the probe without perturbing the run', function () {
        const plain = newCore();
        plain.core.runUntil((0, timeline_1.timestamp)(3, 0), () => false);
        const expected = (0, statehash_1.hashState)(plain.m.saveState());
        const { m, core } = newCore();
        const probe = new CountingProbe();
        m.connectProbe(probe);
        assert_1.default.strictEqual(m.probing, true);
        core.runUntil((0, timeline_1.timestamp)(3, 0), () => false);
        // probing must not change what the machine does, or a recorded run and the
        // replay of it would not agree
        assert_1.default.strictEqual((0, statehash_1.hashState)(m.saveState()), expected);
        assert_1.default.strictEqual(probe.frames, 3);
        assert_1.default.ok(probe.scanlines > 700, `only ${probe.scanlines} scanlines`);
        assert_1.default.ok(probe.executes > 1000, `only ${probe.executes} instructions`);
        // 76 CPU clocks a line, a little over 260 lines a frame
        assert_1.default.ok(probe.clocks > 50000, `only ${probe.clocks} clocks`);
        assert_1.default.ok(probe.waits > 0, 'no WSYNC wait was logged');
        assert_1.default.ok(probe.ioWrites > 0, 'no TIA writes were logged');
        // the PCs a probe sees are the ones the CPU is really at
        assert_1.default.ok([...probe.pcs].every(pc => pc >= 0 && pc < 0x10000));
        // and the bus is un-wrapped again once the probe is dropped
        m.connectProbe(null);
        assert_1.default.strictEqual(m.probing, false);
        m.connectProbe(probe);
        assert_1.default.strictEqual(m.probing, true);
    });
    (0, mocha_1.it)('delivers keys to the joysticks and the console switches', function () {
        const { m, core } = newCore();
        const idle = (0, statehash_1.hashState)(m.saveState());
        // joystick 1 is the arrows
        m.setKeyInput(emu_1.Keys.UP.c, 0, emu_1.KeyFlags.KeyDown);
        assert_1.default.notStrictEqual((0, statehash_1.hashState)(m.saveState()), idle, 'the stick did not move');
        m.setKeyInput(emu_1.Keys.UP.c, 0, emu_1.KeyFlags.KeyUp);
        assert_1.default.strictEqual((0, statehash_1.hashState)(m.saveState()), idle, 'the stick did not come back');
        // a key the machine has no use for must not touch it
        m.setKeyInput(emu_1.Keys.VK_F7.c, 0, emu_1.KeyFlags.KeyDown);
        assert_1.default.strictEqual((0, statehash_1.hashState)(m.saveState()), idle);
        // the difficulty switches live in the PIA port the program reads
        m.setKeyInput(emu_1.Keys.VK_F4.c, 0, emu_1.KeyFlags.KeyDown);
        assert_1.default.notStrictEqual((0, statehash_1.hashState)(m.saveState()), idle);
        core.runUntil((0, timeline_1.timestamp)(1, 0), () => false);
    });
});
(0, mocha_1.describe)('History on a VCS machine', function () {
    this.timeout(60000);
    (0, mocha_1.it)('replays a recorded run back to the same present', function () {
        const { m, core } = newCore();
        const hist = new history_1.History(core, { checkpointInterval: 5 });
        for (var i = 0; i < 40; i++)
            hist.recordFrame();
        const present = (0, statehash_1.hashState)(m.saveState());
        hist.seek((0, timeline_1.timestamp)(3, 200));
        assert_1.default.notStrictEqual((0, statehash_1.hashState)(m.saveState()), present);
        hist.seek(hist.last());
        assert_1.default.strictEqual((0, statehash_1.hashState)(m.saveState()), present);
    });
    (0, mocha_1.it)('steps back to an instruction inside a frame', function () {
        const { m, core } = newCore();
        const hist = new history_1.History(core, { checkpointInterval: 4 });
        for (var i = 0; i < 6; i++)
            hist.recordFrame();
        const present = hist.last();
        // the last stable instruction before the frame-4 boundary
        const hit = hist.findLast(() => m.cpu.isStable(), hist.first(), (0, timeline_1.timestamp)(4, 0));
        assert_1.default.ok(hit, 'no stable instruction found');
        assert_1.default.ok((0, timeline_1.timestampsEqual)(core.now(), hit), (0, timeline_1.formatTimestamp)(core.now()));
        assert_1.default.ok(m.cpu.isStable());
        const hitState = (0, statehash_1.hashState)(m.saveState());
        const hitPC = m.cpu.getPC();
        // seek away and back: the instruction must come back exactly
        hist.seek(hist.first());
        hist.seek(hit);
        assert_1.default.strictEqual((0, statehash_1.hashState)(m.saveState()), hitState);
        assert_1.default.strictEqual(m.cpu.getPC(), hitPC);
        // and carrying on to the present must match the original present
        hist.seek(present);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(core.now(), present), (0, timeline_1.formatTimestamp)(core.now()));
    });
});
// A 6502 that counts $80 up to 5 (a handful of frames at 1 MHz), then executes
// KIL, which the machine raises as EmuHalt from the onHalt hook.
(0, mocha_1.describe)('JavatariMachine on a 6502 that halts', function () {
    this.timeout(60000);
    const KIL_ADDR = 0xf008;
    function newRom() {
        const rom = new Uint8Array(0x1000);
        rom.set([
            0xe6, 0x80, // f000 loop: inc $80
            0xa5, 0x80, // f002       lda $80
            0xc9, 5, // f004       cmp #5
            0xd0, 0xf8, // f006       bne loop
            0x02, // f008       kil
        ]);
        rom[0xffc] = 0x00;
        rom[0xffd] = 0xf0; // reset vector -> $f000
        const m = new vcs_1.JavatariMachine();
        m.connectVideo(new Uint32Array(m.getVideoParams().width * m.getVideoParams().height));
        m.loadROM(rom);
        m.reset();
        return { m, core: new timeline_1.MachineCore(m, 'clock') };
    }
    (0, mocha_1.it)('parks on the KIL instruction, whether metered or not', function () {
        const a = newRom();
        const ra = a.core.runUntil((0, timeline_1.timestamp)(100, 0));
        assert_1.default.ok(ra.halt instanceof emu_1.EmuHalt, 'expected a halt');
        assert_1.default.strictEqual(a.m.cpu.getPC(), KIL_ADDR);
        assert_1.default.strictEqual(a.m.readConst(0x80), 5);
        const b = newRom();
        const rb = b.core.runUntil((0, timeline_1.timestamp)(100, 0), () => false);
        assert_1.default.ok(rb.halt instanceof emu_1.EmuHalt);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(ra.at, rb.at), `${(0, timeline_1.formatTimestamp)(ra.at)} != ${(0, timeline_1.formatTimestamp)(rb.at)}`);
        assert_1.default.strictEqual((0, statehash_1.hashState)(a.m.saveState()), (0, statehash_1.hashState)(b.m.saveState()));
    });
    (0, mocha_1.it)('records to the halt and rewinds to the step before it', function () {
        const { m, core } = newRom();
        const hist = new history_1.History(core, { checkpointInterval: 4 });
        var r;
        for (var i = 0; i < 100 && !(r === null || r === void 0 ? void 0 : r.halt); i++)
            r = hist.recordFrame();
        assert_1.default.ok(r.halt instanceof emu_1.EmuHalt, 'expected a halt');
        const haltAt = hist.last();
        assert_1.default.strictEqual(m.cpu.getPC(), KIL_ADDR);
        // the 6502 steps by clocks, so the previous instruction is the last stable
        // step before now: the bne that fell through to the KIL
        const prev = hist.findLast(() => m.cpu.isStable(), hist.first(), hist.now());
        assert_1.default.ok(prev, 'no previous instruction');
        assert_1.default.strictEqual(m.cpu.getPC(), 0xf006);
        // and forward to the present again, without halting
        assert_1.default.strictEqual(hist.seek(haltAt).halt, undefined);
        assert_1.default.strictEqual(m.cpu.getPC(), KIL_ADDR);
    });
});
//# sourceMappingURL=testvcs.js.map