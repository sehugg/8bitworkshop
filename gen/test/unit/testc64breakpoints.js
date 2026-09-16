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
// The C64 loader starts the program as soon as the ROM is loaded, so code that
// only runs at startup (cc65's init, main()) is gone a few frames later. A
// breakpoint there only ever fires if it is armed before the machine is
// resumed -- which is why ui.ts's setCompileOutput() re-arms the breakpoint
// store after loadROM() instead of just calling _resume(). Arming afterwards
// (the old behavior) silently misses every startup-only breakpoint, which
// looked like "breakpoints don't work on the C64".
const ROM_PATH = 'test/roms/c64/climber.c.rom';
// PCs the CPU passes through, at instruction boundaries, over `frames` frames
function tracePCs(target, frames) {
    const seen = new Set();
    const m = target.machine;
    for (let i = 0; i < frames; i++) {
        m.advanceFrame(() => { if (m.cpu.isStable())
            seen.add(m.cpu.getPC()); return false; });
    }
    return seen;
}
(0, mocha_1.describe)('C64 breakpoints', function () {
    this.timeout(60000);
    let target;
    let platform;
    let rom;
    let startupPC; // an address the program executes only at startup
    (0, mocha_1.before)(async function () {
        target = await (0, emutarget_1.loadPlatform)('c64');
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
        assert_1.default.ok(startupOnly.length > 0, "no startup-only code found in " + ROM_PATH);
        startupPC = startupOnly[0];
    });
    // run frames until a breakpoint fires, and return the state it stopped in
    function runUntilHit(maxFrames) {
        let hit = null;
        platform.setupDebug((state) => { hit = state; });
        for (let i = 0; i < maxFrames && !hit; i++)
            platform.nextFrame(true);
        return hit;
    }
    (0, mocha_1.it)('hits a startup breakpoint armed at ROM load time', function () {
        platform.clearDebug();
        platform.loadROM('ROM', rom);
        platform.runEvalAtPC(new Map([[startupPC, null]]));
        const hit = runUntilHit(30);
        assert_1.default.ok(hit, "breakpoint at $" + startupPC.toString(16) + " never fired");
        assert_1.default.strictEqual(hit.c.PC, startupPC);
    });
    (0, mocha_1.it)('misses a startup breakpoint armed after the program has run', function () {
        platform.clearDebug();
        platform.loadROM('ROM', rom);
        platform.setupDebug(() => { });
        for (let i = 0; i < 30; i++)
            platform.nextFrame(true); // startup code goes by
        platform.runEvalAtPC(new Map([[startupPC, null]]));
        assert_1.default.strictEqual(runUntilHit(30), null);
    });
    (0, mocha_1.it)('hits a main-loop breakpoint armed while the program is running', function () {
        platform.clearDebug();
        platform.loadROM('ROM', rom);
        platform.setupDebug(() => { });
        for (let i = 0; i < 10; i++)
            platform.nextFrame(true);
        const loopPC = [...tracePCs(target, 2)]
            .filter(pc => pc >= 0x0810 && pc < 0x8000).sort((a, b) => a - b)[0];
        platform.runEvalAtPC(new Map([[loopPC, null]]));
        const hit = runUntilHit(30);
        assert_1.default.ok(hit, "breakpoint at $" + loopPC.toString(16) + " never fired");
        assert_1.default.strictEqual(hit.c.PC, loopPC);
    });
});
//# sourceMappingURL=testc64breakpoints.js.map