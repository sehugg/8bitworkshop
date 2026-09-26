// The IDE's breakpoint store, shared by the editor gutter markers and the
// Breakpoints window. It persists to localStorage, scoped by platform + main
// file. Breakpoint types and resolution are in src/common/breakpoints.ts.

import { current_project, platform } from "./ui";
import {
    Breakpoint, BreakpointContext, ResolvedBreakpoint,
    canUseBreakpoints as platformCanUseBreakpoints, resolveBreakpoint as resolveIn,
} from "../common/breakpoints";

export type { Breakpoint, ResolvedBreakpoint };

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

function ideContext(): BreakpointContext {
    return {
        symbols: platform && platform.debugSymbols && platform.debugSymbols.symbolmap,
        getListingForFile: (path) => current_project && current_project.getListingForFile(path),
        platform,
    };
}

// Can this platform actually stop at a breakpoint?
export function canUseBreakpoints(): boolean {
    return platformCanUseBreakpoints(platform);
}

export function resolveBreakpoint(bp: Breakpoint): ResolvedBreakpoint {
    return resolveIn(bp, ideContext());
}

export function resolveBreakpoints(): ResolvedBreakpoint[] {
    let ctx = ideContext();
    return bpStore.getAll().map(bp => resolveIn(bp, ctx));
}
