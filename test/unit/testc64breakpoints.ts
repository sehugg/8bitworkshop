import assert from "assert";
import * as fs from "fs";
import { describe, it, before } from "mocha";
import { EmuTarget, loadPlatform } from "../../src/tools/emutarget";

// The C64 loader starts the program as soon as the ROM is loaded, so code that
// only runs at startup (cc65's init, main()) is gone a few frames later. A
// breakpoint there only ever fires if it is armed before the machine is
// resumed -- which is why ui.ts's setCompileOutput() re-arms the breakpoint
// store after loadROM() instead of just calling _resume(). Arming afterwards
// (the old behavior) silently misses every startup-only breakpoint, which
// looked like "breakpoints don't work on the C64".

const ROM_PATH = 'test/roms/c64/climber.c.rom';

// PCs the CPU passes through, at instruction boundaries, over `frames` frames
function tracePCs(target: EmuTarget, frames: number): Set<number> {
    const seen = new Set<number>();
    const m = target.machine;
    for (let i = 0; i < frames; i++) {
        m.advanceFrame(() => { if (m.cpu.isStable()) seen.add(m.cpu.getPC()); return false; });
    }
    return seen;
}

describe('C64 breakpoints', function () {
    this.timeout(60000);

    let target: EmuTarget;
    let platform: any;
    let rom: Uint8Array;
    let startupPC: number; // an address the program executes only at startup

    before(async function () {
        target = await loadPlatform('c64');
        platform = target.platform;
        await target.start();
        rom = new Uint8Array(fs.readFileSync(ROM_PATH));
        platform.loadROM('ROM', rom);
        // find program code that runs during startup but not in the main loop
        const early = tracePCs(target, 4);
        const late = tracePCs(target, 24);
        const startupOnly = [...early]
            .filter(pc => !late.has(pc) && pc >= 0x0810 && pc < 0x8000)
            .sort((a, b) => a - b);
        assert.ok(startupOnly.length > 0, "no startup-only code found in " + ROM_PATH);
        startupPC = startupOnly[0];
    });

    // run frames until a breakpoint fires, and return the state it stopped in
    function runUntilHit(maxFrames: number): any {
        let hit = null;
        platform.setupDebug((state) => { hit = state; });
        for (let i = 0; i < maxFrames && !hit; i++) platform.nextFrame(true);
        return hit;
    }

    it('hits a startup breakpoint armed at ROM load time', function () {
        platform.clearDebug();
        platform.loadROM('ROM', rom);
        platform.runEvalAtPC(new Map([[startupPC, null]]));
        const hit = runUntilHit(30);
        assert.ok(hit, "breakpoint at $" + startupPC.toString(16) + " never fired");
        assert.strictEqual(hit.c.PC, startupPC);
    });

    it('misses a startup breakpoint armed after the program has run', function () {
        platform.clearDebug();
        platform.loadROM('ROM', rom);
        platform.setupDebug(() => { });
        for (let i = 0; i < 30; i++) platform.nextFrame(true); // startup code goes by
        platform.runEvalAtPC(new Map([[startupPC, null]]));
        assert.strictEqual(runUntilHit(30), null);
    });

    it('hits a main-loop breakpoint armed while the program is running', function () {
        platform.clearDebug();
        platform.loadROM('ROM', rom);
        platform.setupDebug(() => { });
        for (let i = 0; i < 10; i++) platform.nextFrame(true);
        const loopPC = [...tracePCs(target, 2)]
            .filter(pc => pc >= 0x0810 && pc < 0x8000).sort((a, b) => a - b)[0];
        platform.runEvalAtPC(new Map([[loopPC, null]]));
        const hit = runUntilHit(30);
        assert.ok(hit, "breakpoint at $" + loopPC.toString(16) + " never fired");
        assert.strictEqual(hit.c.PC, loopPC);
    });
});
