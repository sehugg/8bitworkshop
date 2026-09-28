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
const emutarget_1 = require("../../src/tools/emutarget");
// The IDE arms breakpoints with platform.runToPC() / runEvalAtPC() and runs
// frames with the platform, not through DebugController, so the CLI's tests
// never exercised it. On vcs.jt4 it compared the CPU state's PC, which the
// Javatari core saves one past the opcode, so almost no address could fire
// and the few that did stopped on the wrong instruction. See
// doc/notes/ide-breakpoints.md.
//
// Every instruction the program runs in a frame must be reachable, and the
// stop must report the address that was asked for.
const ROMS = {
    'vcs.jt4': 'test/roms/vcs/brickgame.rom',
    'apple2': 'test/roms/apple2/cosmic.c.rom',
    'c64': 'test/roms/c64/climber.c.rom',
    'gb': 'test/roms/gb/cpu_instrs.gb',
};
const MAX_TARGETS = 40;
// instruction addresses the CPU passes through during one frame, spread
// evenly over the sorted list
function tracePCs(target) {
    const seen = new Set();
    const m = target.machine;
    m.advanceFrame(() => { if (m.cpu.isStable())
        seen.add(m.cpu.getPC()); return false; });
    const all = [...seen].sort((a, b) => a - b);
    const step = Math.max(1, Math.ceil(all.length / MAX_TARGETS));
    return all.filter((_, i) => i % step === 0);
}
for (const [id, romPath] of Object.entries(ROMS)) {
    (0, mocha_1.describe)(`IDE breakpoints: ${id}`, function () {
        this.timeout(120000);
        async function setup() {
            const target = await (0, emutarget_1.loadPlatform)(id);
            await target.start();
            const platform = target.platform;
            platform.loadROM('ROM', new Uint8Array(fs.readFileSync(romPath)));
            for (let i = 0; i < 20; i++)
                target.machine.advanceFrame(null);
            // every breakpoint starts from here, so each address is one the
            // next frame is known to run
            const start = platform.saveState();
            const pcs = tracePCs(target);
            assert_1.default.ok(pcs.length > 0, "no code found");
            return { platform, pcs, start };
        }
        // arm one address, run the traced frame, and return the state it stopped in
        function stopAt(platform, start, pc, arm) {
            let hit = null;
            platform.clearDebug();
            platform.loadState(start);
            platform.setupDebug((state) => { hit = state; });
            arm(pc);
            for (let i = 0; i < 2 && !hit; i++)
                platform.nextFrame(true);
            return hit;
        }
        function checkAll(platform, start, pcs, arm) {
            const missed = [], wrong = [];
            for (const pc of pcs) {
                const hit = stopAt(platform, start, pc, arm);
                if (!hit)
                    missed.push(pc.toString(16));
                else if (hit.c.PC !== pc || platform.getPC() !== pc)
                    wrong.push(`${pc.toString(16)}->${hit.c.PC.toString(16)}/${platform.getPC().toString(16)}`);
            }
            platform.clearDebug();
            assert_1.default.deepStrictEqual(missed, [], `never fired (of ${pcs.length})`);
            assert_1.default.deepStrictEqual(wrong, [], "stopped at the wrong PC");
        }
        (0, mocha_1.it)('runToPC stops at every instruction a frame runs', async function () {
            const { platform, pcs, start } = await setup();
            checkAll(platform, start, pcs, (pc) => platform.runToPC([pc]));
        });
        (0, mocha_1.it)('runEvalAtPC stops at every instruction a frame runs', async function () {
            const { platform, pcs, start } = await setup();
            checkAll(platform, start, pcs, (pc) => platform.runEvalAtPC(new Map([[pc, null]])));
        });
        (0, mocha_1.it)('saveState and loadState round-trip the PC', async function () {
            const { platform } = await setup();
            const s = platform.saveState();
            const pc = s.c.PC;
            platform.nextFrame(true);
            platform.loadState(s);
            assert_1.default.strictEqual(s.c.PC, pc, "loadState changed the state it was given");
            assert_1.default.strictEqual(platform.saveState().c.PC, pc);
        });
    });
}
//# sourceMappingURL=testidebreakpoints.js.map