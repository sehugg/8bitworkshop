import assert from "assert";
import * as fs from "fs";
import { describe, it } from "mocha";
import { EmuTarget, loadPlatform } from "../../src/tools/emutarget";

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
function tracePCs(target: EmuTarget): number[] {
    const seen = new Set<number>();
    const m = target.machine;
    m.advanceFrame(() => { if (m.cpu.isStable()) seen.add(m.cpu.getPC()); return false; });
    const all = [...seen].sort((a, b) => a - b);
    const step = Math.max(1, Math.ceil(all.length / MAX_TARGETS));
    return all.filter((_, i) => i % step === 0);
}

for (const [id, romPath] of Object.entries(ROMS)) {
    describe(`IDE breakpoints: ${id}`, function () {
        this.timeout(120000);

        async function setup() {
            const target = await loadPlatform(id);
            await target.start();
            const platform: any = target.platform;
            platform.loadROM('ROM', new Uint8Array(fs.readFileSync(romPath)));
            for (let i = 0; i < 20; i++) target.machine.advanceFrame(null);
            // every breakpoint starts from here, so each address is one the
            // next frame is known to run
            const start = platform.saveState();
            const pcs = tracePCs(target);
            assert.ok(pcs.length > 0, "no code found");
            return { platform, pcs, start };
        }

        // arm one address, run the traced frame, and return the state it stopped in
        function stopAt(platform: any, start: any, pc: number, arm: (pc: number) => void): any {
            let hit = null;
            platform.clearDebug();
            platform.loadState(start);
            platform.setupDebug((state) => { hit = state; });
            arm(pc);
            for (let i = 0; i < 2 && !hit; i++) platform.nextFrame(true);
            return hit;
        }

        function checkAll(platform: any, start: any, pcs: number[], arm: (pc: number) => void) {
            const missed = [], wrong = [];
            for (const pc of pcs) {
                const hit = stopAt(platform, start, pc, arm);
                if (!hit) missed.push(pc.toString(16));
                else if (hit.c.PC !== pc || platform.getPC() !== pc)
                    wrong.push(`${pc.toString(16)}->${hit.c.PC.toString(16)}/${platform.getPC().toString(16)}`);
            }
            platform.clearDebug();
            assert.deepStrictEqual(missed, [], `never fired (of ${pcs.length})`);
            assert.deepStrictEqual(wrong, [], "stopped at the wrong PC");
        }

        it('runToPC stops at every instruction a frame runs', async function () {
            const { platform, pcs, start } = await setup();
            checkAll(platform, start, pcs, (pc) => platform.runToPC([pc]));
        });

        it('runEvalAtPC stops at every instruction a frame runs', async function () {
            const { platform, pcs, start } = await setup();
            checkAll(platform, start, pcs, (pc) => platform.runEvalAtPC(new Map([[pc, null]])));
        });

        it('saveState and loadState round-trip the PC', async function () {
            const { platform } = await setup();
            const s = platform.saveState();
            const pc = s.c.PC;
            platform.nextFrame(true);
            platform.loadState(s);
            assert.strictEqual(s.c.PC, pc, "loadState changed the state it was given");
            assert.strictEqual(platform.saveState().c.PC, pc);
        });
    });
}
