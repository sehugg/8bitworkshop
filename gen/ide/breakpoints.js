"use strict";
// Unified breakpoint store, shared by the editor gutter markers and the
// Breakpoints window. Two kinds of breakpoints:
//   - 'source'  -- file + line, resolved to a PC via the build listing
//                  (these render as gutter markers in the editor)
//   - 'address' -- a target that's a symbol, $hex or decimal address
// Both support an optional condition expression (see breakcond.ts).
// The store persists to localStorage, scoped by platform + main file.
Object.defineProperty(exports, "__esModule", { value: true });
exports.bpStore = void 0;
exports.resolveBreakpoint = resolveBreakpoint;
exports.resolveBreakpoints = resolveBreakpoints;
const ui_1 = require("./ui");
const breakcond_1 = require("./breakcond");
const STORAGE_KEY = '8bitworkshop.breakpoints.v1';
class BreakpointStore {
    constructor() {
        this.breakpoints = [];
        this.nextId = 1;
        this.listeners = [];
        this.contextFn = () => '';
    }
    setContextFn(fn) {
        this.contextFn = fn;
    }
    subscribe(fn) {
        this.listeners.push(fn);
    }
    notify() {
        for (let fn of this.listeners.slice())
            fn();
    }
    changed() {
        this.save();
        this.notify();
    }
    getAll() {
        return this.breakpoints;
    }
    getEnabled() {
        return this.breakpoints.filter(bp => bp.enabled);
    }
    getSourceBreakpointsForFile(path) {
        return this.breakpoints.filter(bp => bp.type == 'source' && bp.file == path);
    }
    addSourceBreakpoint(file, line) {
        let bp = { id: this.nextId++, type: 'source', file, line, enabled: true };
        this.breakpoints.push(bp);
        this.changed();
        return bp;
    }
    // add an address breakpoint; if one already targets the same address,
    // enable it and update its condition instead
    addAddressBreakpoint(target, condition) {
        let norm = (target || '').trim().toLowerCase();
        let existing = this.breakpoints.find(bp => bp.type == 'address' && (bp.target || '').trim().toLowerCase() == norm);
        if (existing) {
            this.update(existing.id, { enabled: true, condition: condition });
            return existing;
        }
        let bp = { id: this.nextId++, type: 'address', target: target.trim(), enabled: true, condition: condition };
        this.breakpoints.push(bp);
        this.changed();
        return bp;
    }
    remove(id) {
        this.breakpoints = this.breakpoints.filter(bp => bp.id != id);
        this.changed();
    }
    setEnabled(id, enabled) {
        let bp = this.breakpoints.find(bp => bp.id == id);
        if (bp && bp.enabled != enabled) {
            bp.enabled = enabled;
            this.changed();
        }
    }
    update(id, patch) {
        let bp = this.breakpoints.find(bp => bp.id == id);
        if (bp) {
            Object.assign(bp, patch);
            this.changed();
        }
    }
    // toggle a gutter breakpoint; used by clicking the editor status gutter
    toggleSourceLine(file, line) {
        let existing = this.breakpoints.find(bp => bp.type == 'source' && bp.file == file && bp.line == line);
        if (existing) {
            this.remove(existing.id);
        }
        else {
            this.addSourceBreakpoint(file, line);
        }
    }
    load() {
        if (typeof localStorage === 'undefined')
            return;
        try {
            let blob = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            let bps = blob[this.contextFn()];
            this.breakpoints = Array.isArray(bps) ? bps : [];
            this.nextId = 1;
            for (let bp of this.breakpoints)
                this.nextId = Math.max(this.nextId, bp.id + 1);
        }
        catch (e) {
            this.breakpoints = [];
        }
    }
    save() {
        if (typeof localStorage === 'undefined')
            return;
        try {
            let blob = {};
            let old = localStorage.getItem(STORAGE_KEY);
            if (old)
                blob = JSON.parse(old);
            blob[this.contextFn()] = this.breakpoints;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
        }
        catch (e) {
            console.log("breakpoints: save failed", e);
        }
    }
}
exports.bpStore = new BreakpointStore();
function makeSymbolLookup() {
    return (name) => {
        let sm = ui_1.platform && ui_1.platform.debugSymbols && ui_1.platform.debugSymbols.symbolmap;
        if (!sm)
            return undefined;
        // C symbols often get a leading underscore from the compiler
        return (name in sm) ? sm[name] : sm['_' + name];
    };
}
function makeCondContext() {
    let cpuFields = new Set();
    try {
        let c = ui_1.platform && ui_1.platform.getCPUState && ui_1.platform.getCPUState();
        if (c)
            cpuFields = new Set(Object.keys(c));
    }
    catch (e) {
    }
    return {
        cpuFields,
        symbol: makeSymbolLookup(),
        readMem: ui_1.platform && ui_1.platform.readAddress ? (a) => ui_1.platform.readAddress(a) : undefined,
    };
}
function resolveBreakpoint(bp) {
    try {
        let pc;
        if (bp.type == 'source') {
            let lst = ui_1.current_project.getListingForFile(bp.file);
            let sf = lst && (lst.sourcefile || lst.assemblyfile);
            if (!sf)
                return { bp, error: "no debug info (build first?)" };
            pc = sf.line2offset.get(bp.line);
            if (!(pc >= 0))
                return { bp, error: "line has no code" };
        }
        else {
            let r = (0, breakcond_1.parseTarget)(bp.target, makeSymbolLookup());
            if (r.error)
                return { bp, error: r.error };
            pc = r.pc;
        }
        let condFn = undefined;
        if (bp.condition && bp.condition.trim()) {
            condFn = (0, breakcond_1.compileCondition)(bp.condition, makeCondContext());
        }
        return { bp, pc, condFn };
    }
    catch (e) {
        return { bp, error: String(e.message || e) };
    }
}
function resolveBreakpoints() {
    return exports.bpStore.getAll().map(bp => resolveBreakpoint(bp));
}
//# sourceMappingURL=breakpoints.js.map