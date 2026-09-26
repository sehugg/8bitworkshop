"use strict";
// The IDE's breakpoint store, shared by the editor gutter markers and the
// Breakpoints window. It persists to localStorage, scoped by platform + main
// file. Breakpoint types and resolution are in src/common/breakpoints.ts.
Object.defineProperty(exports, "__esModule", { value: true });
exports.bpStore = void 0;
exports.canUseBreakpoints = canUseBreakpoints;
exports.resolveBreakpoint = resolveBreakpoint;
exports.resolveBreakpoints = resolveBreakpoints;
const ui_1 = require("./ui");
const breakpoints_1 = require("../common/breakpoints");
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
function ideContext() {
    return {
        symbols: ui_1.platform && ui_1.platform.debugSymbols && ui_1.platform.debugSymbols.symbolmap,
        getListingForFile: (path) => ui_1.current_project && ui_1.current_project.getListingForFile(path),
        platform: ui_1.platform,
    };
}
// Can this platform actually stop at a breakpoint?
function canUseBreakpoints() {
    return (0, breakpoints_1.canUseBreakpoints)(ui_1.platform);
}
function resolveBreakpoint(bp) {
    return (0, breakpoints_1.resolveBreakpoint)(bp, ideContext());
}
function resolveBreakpoints() {
    let ctx = ideContext();
    return exports.bpStore.getAll().map(bp => (0, breakpoints_1.resolveBreakpoint)(bp, ctx));
}
//# sourceMappingURL=breakpoints.js.map