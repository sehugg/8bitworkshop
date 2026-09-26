"use strict";
// Breakpoints and how they resolve to an address, shared by every host (the
// IDE, the CLI, the VS Code debug adapter). Two kinds:
//   - 'source'  -- file + line, resolved to a PC via the build listing
//   - 'address' -- a target that's a symbol, $hex or decimal address
// Both support an optional condition expression (see breakcond.ts).
// The IDE's store (persistence, gutter markers) is in src/ide/breakpoints.ts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.canUseBreakpoints = canUseBreakpoints;
exports.resolveBreakpoint = resolveBreakpoint;
const breakcond_1 = require("./breakcond");
const symbolfile_1 = require("./symbols/symbolfile");
function makeCondContext(ctx) {
    let platform = ctx.platform;
    let cpuFields = new Set();
    try {
        let c = platform && platform.getCPUState && platform.getCPUState();
        if (c)
            cpuFields = new Set(Object.keys(c));
    }
    catch (e) {
    }
    // platform accessors reachable with the '#' sigil; the value is read live
    // at eval time so it reflects the current raster position, etc.
    let hw = null;
    if (platform) {
        if (platform.getRasterScanline) {
            hw = hw || {};
            hw['scanline'] = () => platform.getRasterScanline();
        }
        if (platform.getRasterLineClock) {
            hw = hw || {};
            hw['lineclock'] = () => platform.getRasterLineClock();
        }
    }
    return {
        cpuFields,
        symbol: (name) => (0, symbolfile_1.lookupSymbol)(ctx.symbols, name),
        readMem: platform && platform.readAddress ? (a) => platform.readAddress(a) : undefined,
        readVRAM: platform && platform.readVRAMAddress ? (a) => platform.readVRAMAddress(a) : undefined,
        hw,
    };
}
// Can this platform actually stop at a breakpoint?
function canUseBreakpoints(platform) {
    return !!(platform && (platform.runEval || platform.runToPC || platform.runEvalAtPC));
}
function resolveBreakpoint(bp, ctx) {
    try {
        let pc;
        if (bp.type == 'source') {
            let lst = ctx.getListingForFile && ctx.getListingForFile(bp.file);
            let sf = lst && (lst.sourcefile || lst.assemblyfile);
            if (!sf)
                return { bp, error: "no debug info (build first?)" };
            pc = sf.line2offset.get(bp.line);
            if (!(pc >= 0))
                return { bp, error: "line has no code" };
        }
        else {
            let r = (0, breakcond_1.parseTarget)(bp.target, (name) => (0, symbolfile_1.lookupSymbol)(ctx.symbols, name));
            if (r.error)
                return { bp, error: r.error };
            pc = r.pc;
        }
        let condFn = undefined;
        if (bp.condition && bp.condition.trim()) {
            condFn = (0, breakcond_1.compileCondition)(bp.condition, makeCondContext(ctx));
        }
        return { bp, pc, condFn };
    }
    catch (e) {
        return { bp, error: String(e.message || e) };
    }
}
//# sourceMappingURL=breakpoints.js.map