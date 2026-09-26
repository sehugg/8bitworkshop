// Breakpoints and how they resolve to an address, shared by every host (the
// IDE, the CLI, the VS Code debug adapter). Two kinds:
//   - 'source'  -- file + line, resolved to a PC via the build listing
//   - 'address' -- a target that's a symbol, $hex or decimal address
// Both support an optional condition expression (see breakcond.ts).
// The IDE's store (persistence, gutter markers) is in src/ide/breakpoints.ts.

import type { Platform, SymbolMap } from "./baseplatform";
import type { CodeListing } from "./workertypes";
import { CondFn, CondContext, compileCondition, parseTarget } from "./breakcond";
import { lookupSymbol } from "./symbols/symbolfile";

export interface Breakpoint {
    id: number;
    type: 'source' | 'address';
    file?: string;      // source: project path
    line?: number;      // source: 1-based line number
    target?: string;    // address: symbol, $hex or decimal
    enabled: boolean;
    condition?: string;
}

export interface ResolvedBreakpoint {
    bp: Breakpoint;
    pc?: number;        // resolved address (undefined if not resolvable now)
    condFn?: CondFn;
    error?: string;     // why the breakpoint can't resolve right now
}

// What resolving a breakpoint needs from the host.
export interface BreakpointContext {
    /** name -> address, from the build or a label file */
    symbols?: SymbolMap;
    /** the build's listing for a source file, for source breakpoints */
    getListingForFile?(path: string): CodeListing | undefined;
    /** CPU fields, memory and raster position, for conditions */
    platform?: Platform;
}

function makeCondContext(ctx: BreakpointContext): CondContext {
    let platform = ctx.platform;
    let cpuFields = new Set<string>();
    try {
        let c = platform && platform.getCPUState && platform.getCPUState();
        if (c) cpuFields = new Set(Object.keys(c));
    } catch (e) {
    }
    // platform accessors reachable with the '#' sigil; the value is read live
    // at eval time so it reflects the current raster position, etc.
    let hw: { [name: string]: () => number | undefined } = null;
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
        symbol: (name) => lookupSymbol(ctx.symbols, name),
        readMem: platform && platform.readAddress ? (a) => platform.readAddress(a) : undefined,
        readVRAM: platform && platform.readVRAMAddress ? (a) => platform.readVRAMAddress(a) : undefined,
        hw,
    };
}

// Can this platform actually stop at a breakpoint?
export function canUseBreakpoints(platform: Platform): boolean {
    return !!(platform && (platform.runEval || platform.runToPC || platform.runEvalAtPC));
}

export function resolveBreakpoint(bp: Breakpoint, ctx: BreakpointContext): ResolvedBreakpoint {
    try {
        let pc: number;
        if (bp.type == 'source') {
            let lst = ctx.getListingForFile && ctx.getListingForFile(bp.file);
            let sf = lst && (lst.sourcefile || lst.assemblyfile);
            if (!sf) return { bp, error: "no debug info (build first?)" };
            pc = sf.line2offset.get(bp.line);
            if (!(pc >= 0)) return { bp, error: "line has no code" };
        } else {
            let r = parseTarget(bp.target, (name) => lookupSymbol(ctx.symbols, name));
            if (r.error) return { bp, error: r.error };
            pc = r.pc;
        }
        let condFn: CondFn = undefined;
        if (bp.condition && bp.condition.trim()) {
            condFn = compileCondition(bp.condition, makeCondContext(ctx));
        }
        return { bp, pc, condFn };
    } catch (e) {
        return { bp, error: String(e.message || e) };
    }
}
