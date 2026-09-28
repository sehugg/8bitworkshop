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
// imported after the globals are mocked -- the machine pulls in the audio
// classes that live on globalThis
const mw8080bw_1 = require("../../src/machine/mw8080bw");
const galaxian_1 = require("../../src/machine/galaxian");
const devel_1 = require("../../src/machine/devel");
const emu_1 = require("../../src/common/emu");
const statehash_1 = require("../../src/common/statehash");
const devices_1 = require("../../src/common/devices");
const history_1 = require("../../src/common/history");
const timeline_1 = require("../../src/common/timeline");
// MachineCore against a real machine: a Z80 BasicScanlineMachine running a
// real ROM. The fake machine in testtimeline.ts pins the semantics; this pins
// that they survive contact with an emulator whose advanceFrame() restarts the
// scanline loop and whose state is typed arrays.
function newCore() {
    const m = new mw8080bw_1.Midway8080();
    m.connectVideo(new Uint32Array(m.canvasWidth * m.numVisibleScanlines));
    m.loadROM(new Uint8Array(fs_1.default.readFileSync('./test/roms/mw8080bw/game2.c.rom')));
    m.reset();
    return { m, core: new timeline_1.MachineCore(m) };
}
// cheap order-sensitive checksum over the whole machine state
function hashState(m) {
    const s = m.saveState();
    let h = 0x811c9dc5;
    const mix = (v) => { h = Math.imul(h ^ (v & 0xff), 0x01000193) >>> 0; };
    for (const k of Object.keys(s).sort()) {
        const v = s[k];
        if (v instanceof Uint8Array)
            for (let i = 0; i < v.length; i++)
                mix(v[i]);
        else
            for (const kk of Object.keys(v).sort()) {
                mix(kk.charCodeAt(0));
                mix(v[kk]);
                mix(v[kk] >> 8);
            }
    }
    return h;
}
(0, mocha_1.describe)('MachineCore on a real machine', function () {
    (0, mocha_1.it)('replays to the identical state from a snapshot 20 frames back', function () {
        const { m, core } = newCore();
        const snap0 = core.snapshot();
        core.runUntil((0, timeline_1.timestamp)(20, 500), () => false);
        const expected = hashState(m);
        const pc = m.cpu.getPC();
        core.restore(snap0, (0, timeline_1.timestamp)(0, 0));
        const r = core.runUntil((0, timeline_1.timestamp)(20, 500), () => false);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r.at, (0, timeline_1.timestamp)(20, 500)), (0, timeline_1.formatTimestamp)(r.at));
        assert_1.default.strictEqual(m.cpu.getPC(), pc);
        assert_1.default.strictEqual(hashState(m), expected);
    });
    (0, mocha_1.it)('reaches a sub-frame position identically forwards and backwards', function () {
        // where the machine should be at 12:250, reached only by running forward
        const fwd = newCore();
        fwd.core.runUntil((0, timeline_1.timestamp)(12, 250), () => false);
        const expected = hashState(fwd.m);
        // now overshoot and come back to it
        const { m, core } = newCore();
        const snap0 = core.snapshot();
        core.runUntil((0, timeline_1.timestamp)(12, 900), () => false);
        assert_1.default.notStrictEqual(hashState(m), expected);
        core.restore(snap0, (0, timeline_1.timestamp)(0, 0));
        core.runUntil((0, timeline_1.timestamp)(12, 250), () => false);
        assert_1.default.strictEqual(hashState(m), expected);
    });
    (0, mocha_1.it)('traps on a condition several frames ahead and reports where', function () {
        const { m, core } = newCore();
        core.runUntil((0, timeline_1.timestamp)(5, 0));
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
        const expected = hashState(m);
        core.restore(snap5, (0, timeline_1.timestamp)(5, 0));
        const r2 = core.runUntil((0, timeline_1.timestamp)(30, 0), () => m.cpu.getPC() === targetPC);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(r2.at, hit), `${(0, timeline_1.formatTimestamp)(r2.at)} != ${(0, timeline_1.formatTimestamp)(hit)}`);
        assert_1.default.strictEqual(hashState(m), expected);
    });
    (0, mocha_1.it)('keeps counting frames past a trap instead of resetting', function () {
        const { m, core } = newCore();
        core.runUntil((0, timeline_1.timestamp)(3, 100), () => false);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(core.now(), (0, timeline_1.timestamp)(3, 100)));
        core.runUntil((0, timeline_1.timestamp)(7, 20), () => false);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(core.now(), (0, timeline_1.timestamp)(7, 20)));
    });
});
// A watchpoint: a probe that latches a write to one address. Params are
// optional because NullProbe declares these with none.
class WatchProbe extends devices_1.NullProbe {
    constructor(addr) {
        super();
        this.addr = addr;
        this.hit = false;
    }
    logWrite(a, v) { if (a === this.addr)
        this.hit = true; }
    // clearing on test means each write is reported once; handing the probe to
    // the search lets History attach it only while the search runs
    asCondition() {
        return {
            probe: this,
            test: () => { const h = this.hit; this.hit = false; return h; },
            reset: () => { this.hit = false; },
        };
    }
}
(0, mocha_1.describe)('History on a real machine', function () {
    (0, mocha_1.it)('replays a recorded run back to the same present', function () {
        const { m, core } = newCore();
        const hist = new history_1.History(core, { checkpointInterval: 5 });
        for (var i = 0; i < 40; i++)
            hist.recordFrame();
        const present = hashState(m);
        hist.seek((0, timeline_1.timestamp)(3, 200));
        assert_1.default.notStrictEqual(hashState(m), present);
        hist.seek(hist.last());
        assert_1.default.strictEqual(hashState(m), present);
    });
    (0, mocha_1.it)('finds when a memory location was last written, after the fact', function () {
        const WATCH = 0x200b; // written a couple of times early in the ROM
        const { m, core } = newCore();
        const hist = new history_1.History(core, { checkpointInterval: 5 });
        const probe = new WatchProbe(WATCH);
        // recorded with no probe attached at all -- the point is to ask afterwards
        for (var i = 0; i < 40; i++)
            hist.recordFrame();
        assert_1.default.strictEqual(m.probing, false, 'recording should not be probing');
        const hit = hist.findLast(probe.asCondition());
        assert_1.default.strictEqual(m.probing, false, 'probe should be detached after the search');
        assert_1.default.ok(hit, `no write to $${WATCH.toString(16)} found`);
        assert_1.default.ok((0, timeline_1.compareTimestamps)(hit, hist.first()) >= 0 && (0, timeline_1.compareTimestamps)(hit, hist.last()) < 0, `hit ${(0, timeline_1.formatTimestamp)(hit)} outside the recorded window`);
        // the multi-span walk backwards must agree with one linear scan
        const solo = newCore();
        const soloHist = new history_1.History(solo.core, { checkpointInterval: 100000 });
        const soloProbe = new WatchProbe(WATCH);
        for (var i = 0; i < 40; i++)
            soloHist.recordFrame();
        const soloHit = soloHist.findLast(soloProbe.asCondition());
        assert_1.default.ok((0, timeline_1.timestampsEqual)(hit, soloHit), `checkpointed search said ${(0, timeline_1.formatTimestamp)(hit)}, linear scan said ${(0, timeline_1.formatTimestamp)(soloHit)}`);
    });
});
// A trap stops the CPU loop, not the frame: galaxian's advanceFrame() still
// advances its graphics, decrements the watchdog and raises an NMI after the
// loop exits. A core stopped mid-frame must show the state at the stop, not
// the state after that tail ran.
(0, mocha_1.describe)('MachineCore break state', function () {
    function newGalaxian() {
        const m = new galaxian_1.GalaxianScrambleMachine();
        m.connectVideo(new Uint32Array(m.canvasWidth * m.numVisibleScanlines));
        m.loadROM(new Uint8Array(fs_1.default.readFileSync('./test/roms/galaxian-scramble/shoot2.c.rom')));
        m.reset();
        return { m, core: new timeline_1.MachineCore(m) };
    }
    (0, mocha_1.it)('shows the state at the trap, not after the frame tail', function () {
        const { m, core } = newGalaxian();
        core.runUntil((0, timeline_1.timestamp)(5, 0));
        var n = 0;
        var atTrap = null;
        const r = core.runUntil((0, timeline_1.timestamp)(6, 0), () => {
            if (n++ < 500)
                return false;
            atTrap = (0, statehash_1.hashState)(m.saveState());
            return true;
        });
        assert_1.default.ok(r.trapped);
        assert_1.default.strictEqual((0, statehash_1.hashState)(m.saveState()), atTrap);
    });
    (0, mocha_1.it)('shows the state at the target step when stopping at one', function () {
        // the trap is not consulted at the target step itself, so capture the
        // expected state from a second run that goes one step further
        const ref = newGalaxian();
        ref.core.runUntil((0, timeline_1.timestamp)(5, 0));
        var atStep = null;
        var n = 0;
        ref.core.runUntil((0, timeline_1.timestamp)(5, 501), () => {
            if (n++ === 500)
                atStep = (0, statehash_1.hashState)(ref.m.saveState());
            return false;
        });
        assert_1.default.notStrictEqual(atStep, null);
        const { m, core } = newGalaxian();
        core.runUntil((0, timeline_1.timestamp)(5, 0));
        core.runUntil((0, timeline_1.timestamp)(5, 500));
        assert_1.default.ok((0, timeline_1.timestampsEqual)(core.now(), (0, timeline_1.timestamp)(5, 500)), (0, timeline_1.formatTimestamp)(core.now()));
        assert_1.default.strictEqual((0, statehash_1.hashState)(m.saveState()), atStep);
    });
});
// A 6502 that counts $11 up to 100 (about 12 frames at 1 MHz), then executes
// KIL, which MOS6502 throws as EmuHalt from the middle of the instruction.
(0, mocha_1.describe)('MachineCore on a 6502 that halts', function () {
    const KIL_ADDR = 0x800c;
    function newDevel() {
        const rom = new Uint8Array(0x8000);
        rom.set([
            0xe6, 0x10, // 8000 loop: inc $10
            0xd0, 0xfc, // 8002       bne loop
            0xe6, 0x11, // 8004       inc $11
            0xa5, 0x11, // 8006       lda $11
            0xc9, 100, // 8008       cmp #100
            0xd0, 0xf4, // 800a       bne loop
            0x02, // 800c       kil
        ]);
        rom[0x7ffc] = 0x00;
        rom[0x7ffd] = 0x80;
        const m = new devel_1.Devel6502();
        m.loadROM(rom);
        m.reset();
        return { m, core: new timeline_1.MachineCore(m) };
    }
    (0, mocha_1.it)('parks on the KIL instruction, whether metered or not', function () {
        const a = newDevel();
        const ra = a.core.runUntil((0, timeline_1.timestamp)(100, 0));
        assert_1.default.ok(ra.halt instanceof emu_1.EmuHalt, 'expected a halt');
        assert_1.default.ok(ra.at.frame > 5, (0, timeline_1.formatTimestamp)(ra.at));
        assert_1.default.strictEqual(a.m.cpu.getPC(), KIL_ADDR);
        assert_1.default.strictEqual(a.m.ram[0x11], 100);
        const b = newDevel();
        const rb = b.core.runUntil((0, timeline_1.timestamp)(100, 0), () => false);
        assert_1.default.ok(rb.halt instanceof emu_1.EmuHalt);
        assert_1.default.ok((0, timeline_1.timestampsEqual)(ra.at, rb.at), `${(0, timeline_1.formatTimestamp)(ra.at)} != ${(0, timeline_1.formatTimestamp)(rb.at)}`);
        assert_1.default.strictEqual((0, statehash_1.hashState)(a.m.saveState()), (0, statehash_1.hashState)(b.m.saveState()));
    });
    (0, mocha_1.it)('records to the halt and rewinds to the step before it', function () {
        const { m, core } = newDevel();
        const hist = new history_1.History(core, { checkpointInterval: 4 });
        var r;
        for (var i = 0; i < 100 && !(r === null || r === void 0 ? void 0 : r.halt); i++)
            r = hist.recordFrame();
        assert_1.default.ok(r.halt instanceof emu_1.EmuHalt, 'expected a halt');
        const haltAt = hist.last();
        assert_1.default.strictEqual(m.cpu.getPC(), KIL_ADDR);
        // a 6502 steps by clocks, so the previous instruction is the last stable
        // step before now: the bne that fell through to the KIL
        const prev = hist.findLast(() => m.cpu.isStable(), hist.first(), hist.now());
        assert_1.default.ok(prev, 'no previous instruction');
        assert_1.default.strictEqual(m.cpu.getPC(), 0x800a);
        // and forward to the present again, without halting
        assert_1.default.strictEqual(hist.seek(haltAt).halt, undefined);
        assert_1.default.strictEqual(m.cpu.getPC(), KIL_ADDR);
    });
});
//# sourceMappingURL=testtimelinemachine.js.map