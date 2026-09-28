"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs = __importStar(require("fs"));
const mocha_1 = require("mocha");
const emu_1 = require("../../src/common/emu");
const probe_1 = require("../../src/common/probe");
const statehash_1 = require("../../src/common/statehash");
const timeline_1 = require("../../src/common/timeline");
const emutarget_1 = require("../../src/tools/emutarget");
// EmuCore is the one driver behind the CLI's run scripts and the extension's
// emulator. It runs the machine through the timeline, so stepping, running and
// rewinding all agree on where the machine is.
async function open(platform, rom) {
    const t = await (0, emutarget_1.loadPlatform)(platform);
    await t.start();
    await t.loadROM(new Uint8Array(fs.readFileSync(rom)));
    return t;
}
function stateOf(t) {
    return (0, statehash_1.hashState)(t.machine.saveState());
}
const TARGETS = [
    { platform: 'mw8080bw', rom: 'test/roms/mw8080bw/game2.c.rom' }, // Z80: steps are instructions
    { platform: 'apple2', rom: 'test/roms/apple2/cosmic.c.rom' }, // 6502: steps are clocks
];
for (const { platform, rom } of TARGETS) {
    (0, mocha_1.describe)(`EmuCore on ${platform}`, function () {
        this.timeout(60000);
        (0, mocha_1.it)('finishes the frame it stepped into, the same as running straight through', async function () {
            const straight = await open(platform, rom);
            for (let i = 0; i < 20; i++)
                straight.advanceFrame();
            const stepped = await open(platform, rom);
            for (let i = 0; i < 10; i++)
                stepped.advanceFrame();
            for (let i = 0; i < 100; i++)
                stepped.stepInsn();
            for (let i = 0; i < 10; i++)
                stepped.advanceFrame();
            assert_1.default.strictEqual(stepped.frameCount, 20);
            assert_1.default.strictEqual(stateOf(stepped), stateOf(straight));
        });
        (0, mocha_1.it)('steps back to the instruction before', async function () {
            const t = await open(platform, rom);
            for (let i = 0; i < 5; i++)
                t.advanceFrame();
            t.stepInsn();
            const pcs = [];
            const states = [];
            for (let i = 0; i < 5; i++) {
                pcs.push(t.getPC());
                states.push(stateOf(t));
                t.stepInsn();
            }
            for (let i = 4; i >= 0; i--) {
                assert_1.default.ok(t.stepBack(), `no step back at ${i}`);
                assert_1.default.strictEqual(t.getPC(), pcs[i]);
                assert_1.default.strictEqual(stateOf(t), states[i]);
            }
            assert_1.default.ok(t.isInPast());
        });
    });
}
(0, mocha_1.describe)('EmuCore with a probe', function () {
    this.timeout(60000);
    function executes(rec) {
        let n = 0;
        for (let i = 0; i < rec.idx; i++)
            if ((rec.buf[i] & 0xff000000) === probe_1.ProbeFlags.EXECUTE)
                n++;
        return n;
    }
    async function probed() {
        const t = await open('mw8080bw', 'test/roms/mw8080bw/game2.c.rom');
        for (let i = 0; i < 3; i++)
            t.advanceFrame();
        t.stepInsn(50);
        const rec = new probe_1.ProbeRecorder(t.machine, 0x10000);
        rec.singleFrame = false;
        assert_1.default.ok(t.connectProbe(rec));
        return { t, rec };
    }
    (0, mocha_1.it)('logs each stepped instruction once, though stepping replays the frame', async function () {
        const { t, rec } = await probed();
        for (let i = 0; i < 10; i++)
            t.stepInsn();
        assert_1.default.strictEqual(executes(rec), 10);
    });
    (0, mocha_1.it)('keeps the probe connected after a search that uses its own', async function () {
        const { t, rec } = await probed();
        const search = new probe_1.ProbeRecorder(t.machine, 0x10000);
        t.history.findLast({ test: () => false, probe: search });
        t.seek(t.history.last());
        const before = executes(rec);
        t.stepInsn(5);
        assert_1.default.strictEqual(executes(rec), before + 5);
    });
});
(0, mocha_1.describe)('EmuCore key input', function () {
    this.timeout(60000);
    (0, mocha_1.it)('replays keys, including one pressed while stopped mid-frame', async function () {
        const t = await open('apple2', 'test/roms/apple2/cosmic.c.rom');
        const keys = [];
        const deliver = t.deliverKey.bind(t);
        t.deliverKey = (key, code, flags) => { keys.push(flags); deliver(key, code, flags); };
        for (let i = 0; i < 2; i++)
            t.advanceFrame();
        t.setKeyInput(39, 39, emu_1.KeyFlags.KeyDown); // frame 2
        for (let i = 0; i < 3; i++)
            t.advanceFrame();
        t.stepInsn();
        t.setKeyInput(39, 39, emu_1.KeyFlags.KeyUp); // stopped mid-frame: waits for frame 6
        for (let i = 0; i < 4; i++)
            t.advanceFrame();
        const present = stateOf(t);
        assert_1.default.deepStrictEqual(keys, [emu_1.KeyFlags.KeyDown, emu_1.KeyFlags.KeyUp]);
        // run forward through the past a frame at a time; no checkpoint since
        // frame 0, so both keys are replayed
        t.seek((0, timeline_1.timestamp)(1, 0));
        let replayed = 0;
        while (t.isInPast()) {
            t.advanceFrame();
            replayed++;
        }
        assert_1.default.strictEqual(replayed, 8);
        assert_1.default.deepStrictEqual(keys, [emu_1.KeyFlags.KeyDown, emu_1.KeyFlags.KeyUp, emu_1.KeyFlags.KeyDown, emu_1.KeyFlags.KeyUp]);
        assert_1.default.strictEqual(stateOf(t), present);
    });
    (0, mocha_1.it)('diverges without the key, so the key test means something', async function () {
        const withKey = await open('apple2', 'test/roms/apple2/cosmic.c.rom');
        const without = await open('apple2', 'test/roms/apple2/cosmic.c.rom');
        withKey.setKeyInput(39, 39, emu_1.KeyFlags.KeyDown);
        for (let i = 0; i < 5; i++) {
            withKey.advanceFrame();
            without.advanceFrame();
        }
        assert_1.default.notStrictEqual(stateOf(withKey), stateOf(without));
    });
    (0, mocha_1.it)('drops the recorded future when a key is pressed in the past', async function () {
        const t = await open('apple2', 'test/roms/apple2/cosmic.c.rom');
        for (let i = 0; i < 10; i++)
            t.advanceFrame();
        t.seek((0, timeline_1.timestamp)(4, 0));
        t.setKeyInput(39, 39, emu_1.KeyFlags.KeyDown);
        assert_1.default.ok(!t.isInPast());
        assert_1.default.ok((0, timeline_1.timestampsEqual)(t.history.last(), (0, timeline_1.timestamp)(4, 0)));
        t.advanceFrame();
        assert_1.default.strictEqual(t.frameCount, 5);
    });
});
//# sourceMappingURL=testemucore.js.map