// Unified breakpoint store, shared by the editor gutter markers and the
// Breakpoints window. Two kinds of breakpoints:
//   - 'source'  -- file + line, resolved to a PC via the build listing
//                  (these render as gutter markers in the editor)
//   - 'address' -- a target that's a symbol, $hex or decimal address
// Both support an optional condition expression (see breakcond.ts).
// The store persists to localStorage, scoped by platform + main file.

import { current_project, platform } from "./ui";
import { CondFn, CondContext, compileCondition, parseTarget } from "./breakcond";

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

const STORAGE_KEY = '8bitworkshop.breakpoints.v1';

class BreakpointStore {
    breakpoints: Breakpoint[] = [];
    nextId: number = 1;
    listeners: (() => void)[] = [];
    contextFn: () => string = () => '';

    setContextFn(fn: () => string) {
        this.contextFn = fn;
    }

    subscribe(fn: () => void) {
        this.listeners.push(fn);
    }

    private notify() {
        for (let fn of this.listeners.slice()) fn();
    }

    private changed() {
        this.save();
        this.notify();
    }

    getAll(): Breakpoint[] {
        return this.breakpoints;
    }

    getEnabled(): Breakpoint[] {
        return this.breakpoints.filter(bp => bp.enabled);
    }

    getSourceBreakpointsForFile(path: string): Breakpoint[] {
        return this.breakpoints.filter(bp => bp.type == 'source' && bp.file == path);
    }

    addSourceBreakpoint(file: string, line: number): Breakpoint {
        let bp: Breakpoint = { id: this.nextId++, type: 'source', file, line, enabled: true };
        this.breakpoints.push(bp);
        this.changed();
        return bp;
    }

    // add an address breakpoint; if one already targets the same address,
    // enable it and update its condition instead
    addAddressBreakpoint(target: string, condition?: string): Breakpoint {
        let norm = (target || '').trim().toLowerCase();
        let existing = this.breakpoints.find(bp => bp.type == 'address' && (bp.target || '').trim().toLowerCase() == norm);
        if (existing) {
            this.update(existing.id, { enabled: true, condition: condition });
            return existing;
        }
        let bp: Breakpoint = { id: this.nextId++, type: 'address', target: target.trim(), enabled: true, condition: condition };
        this.breakpoints.push(bp);
        this.changed();
        return bp;
    }

    remove(id: number) {
        this.breakpoints = this.breakpoints.filter(bp => bp.id != id);
        this.changed();
    }

    setEnabled(id: number, enabled: boolean) {
        let bp = this.breakpoints.find(bp => bp.id == id);
        if (bp && bp.enabled != enabled) {
            bp.enabled = enabled;
            this.changed();
        }
    }

    update(id: number, patch: Partial<Breakpoint>) {
        let bp = this.breakpoints.find(bp => bp.id == id);
        if (bp) {
            Object.assign(bp, patch);
            this.changed();
        }
    }

    // toggle a gutter breakpoint; used by clicking the editor status gutter
    toggleSourceLine(file: string, line: number) {
        let existing = this.breakpoints.find(bp => bp.type == 'source' && bp.file == file && bp.line == line);
        if (existing) {
            this.remove(existing.id);
        } else {
            this.addSourceBreakpoint(file, line);
        }
    }

    load() {
        if (typeof localStorage === 'undefined') return;
        try {
            let blob = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            let bps = blob[this.contextFn()];
            this.breakpoints = Array.isArray(bps) ? bps : [];
            this.nextId = 1;
            for (let bp of this.breakpoints) this.nextId = Math.max(this.nextId, bp.id + 1);
        } catch (e) {
            this.breakpoints = [];
        }
    }

    save() {
        if (typeof localStorage === 'undefined') return;
        try {
            let blob = {};
            let old = localStorage.getItem(STORAGE_KEY);
            if (old) blob = JSON.parse(old);
            blob[this.contextFn()] = this.breakpoints;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
        } catch (e) {
            console.log("breakpoints: save failed", e);
        }
    }
}

export const bpStore = new BreakpointStore();

function makeSymbolLookup(): (name: string) => number | undefined {
    return (name: string): number | undefined => {
        let sm = platform && platform.debugSymbols && platform.debugSymbols.symbolmap;
        if (!sm) return undefined;
        // C symbols often get a leading underscore from the compiler
        return (name in sm) ? sm[name] : sm['_' + name];
    };
}

function makeCondContext(): CondContext {
    let cpuFields = new Set<string>();
    try {
        let c = platform && platform.getCPUState && platform.getCPUState();
        if (c) cpuFields = new Set(Object.keys(c));
    } catch (e) {
    }
    return {
        cpuFields,
        symbol: makeSymbolLookup(),
        readMem: platform && platform.readAddress ? (a) => platform.readAddress(a) : undefined,
    };
}

export function resolveBreakpoint(bp: Breakpoint): ResolvedBreakpoint {
    try {
        let pc: number;
        if (bp.type == 'source') {
            let lst = current_project.getListingForFile(bp.file);
            let sf = lst && (lst.sourcefile || lst.assemblyfile);
            if (!sf) return { bp, error: "no debug info (build first?)" };
            pc = sf.line2offset.get(bp.line);
            if (!(pc >= 0)) return { bp, error: "line has no code" };
        } else {
            let r = parseTarget(bp.target, makeSymbolLookup());
            if (r.error) return { bp, error: r.error };
            pc = r.pc;
        }
        let condFn: CondFn = undefined;
        if (bp.condition && bp.condition.trim()) {
            condFn = compileCondition(bp.condition, makeCondContext());
        }
        return { bp, pc, condFn };
    } catch (e) {
        return { bp, error: String(e.message || e) };
    }
}

export function resolveBreakpoints(): ResolvedBreakpoint[] {
    return bpStore.getAll().map(bp => resolveBreakpoint(bp));
}
