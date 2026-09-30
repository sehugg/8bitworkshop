"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallProfiler = void 0;
exports.totalClocks = totalClocks;
const callgraph_1 = require("./callgraph");
const devices_1 = require("./devices");
const probe_1 = require("./probe");
function newNode(name, calls = 0) {
    return { name, calls, self: 0, children: new Map() };
}
function totalClocks(n) {
    let t = n.self;
    for (const c of n.children.values())
        t += totalClocks(c);
    return t;
}
/** Merge b into a (the same routine reached by different paths). */
function mergeInto(a, b) {
    a.calls += b.calls;
    a.self += b.self;
    for (const [name, c] of b.children) {
        let d = a.children.get(name);
        if (!d)
            a.children.set(name, d = newNode(name));
        mergeInto(d, c);
    }
}
/**
 * Probe that feeds a CallGraphBuilder (the IDE's Call Graph window uses the
 * same one) and prints its call tree with clocks for the CLI.
 */
class CallProfiler extends devices_1.NullProbe {
    constructor(classify, name) {
        super();
        this.name = name;
        this.sp = -1;
        this.frames = 0;
        this.clocks = 0;
        this.builder = new callgraph_1.CallGraphBuilder(classify, name);
    }
    logNewFrame() { this.frames++; }
    logInterrupt(type) { this.builder.event(probe_1.ProbeFlags.INTERRUPT, type !== null && type !== void 0 ? type : 0, 0); }
    logExecute(address, SP) {
        // same events the ProbeRecorder logs: a stack move, then the execute
        if (SP !== this.sp) {
            this.builder.event(SP < this.sp ? probe_1.ProbeFlags.SP_PUSH : probe_1.ProbeFlags.SP_POP, SP, 0);
            this.sp = SP;
        }
        this.builder.event(probe_1.ProbeFlags.EXECUTE, address, 0);
    }
    logClocks(n) {
        this.clocks += n;
        this.builder.clocks(n);
    }
    toTree(name, n) {
        const out = newNode(name, n.count);
        out.self = n.self;
        for (const [cname, c] of Object.entries(n.calls)) {
            const t = this.toTree(cname, c);
            const prev = out.children.get(cname);
            if (prev)
                mergeInto(prev, t);
            else
                out.children.set(cname, t);
        }
        return out;
    }
    /** Tree rooted at the routine `name`, merging every call site; the whole tree if null. */
    subtree(name) {
        if (!this.builder.graph)
            return null;
        const root = this.toTree('(entry)', this.builder.graph);
        if (name == null)
            return root;
        const out = newNode(name);
        let found = false;
        const walk = (n) => {
            for (const c of n.children.values()) {
                if (c.name === name) {
                    found = true;
                    mergeInto(out, c);
                } // callees are inside c
                else
                    walk(c);
            }
        };
        walk(root);
        return found ? out : null;
    }
    /** Text report: indented call tree, then a flat list by self clocks. */
    report(start, maxDepth = 8, minPct = 0.5) {
        const startName = start == null ? null : this.name(start);
        const top = this.subtree(startName);
        if (!top)
            return `(${startName !== null && startName !== void 0 ? startName : 'nothing'} was never called)\n`;
        const base = totalClocks(top) || 1;
        const lines = [];
        lines.push(`${'total'.padStart(10)} ${'self'.padStart(10)} ${'%'.padStart(6)} ${'calls'.padStart(7)}  routine`);
        const row = (t, self, calls, depth, label) => lines.push(`${String(t).padStart(10)} ${self.padStart(10)} ${(100 * t / base).toFixed(1).padStart(6)} ` +
            `${calls.padStart(7)}  ${'  '.repeat(depth)}${label}`);
        const walk = (n, depth) => {
            const t = totalClocks(n);
            row(t, String(n.self), depth == 0 && !startName ? '' : String(n.calls), depth, n.name);
            if (depth >= maxDepth)
                return;
            const kids = [...n.children.values()].map(c => ({ c, t: totalClocks(c) })).sort((a, b) => b.t - a.t);
            let hidden = 0;
            for (const { c, t } of kids) {
                if (100 * t / base < minPct)
                    hidden += t;
                else
                    walk(c, depth + 1);
            }
            if (hidden)
                row(hidden, '', '', depth + 1, `(other, below ${minPct}%)`);
        };
        walk(top, 0);
        // flat profile: self clocks per routine across the whole subtree
        const flat = new Map();
        const collect = (n) => {
            const f = flat.get(n.name) || { self: 0, calls: 0 };
            f.self += n.self;
            f.calls += n.calls;
            flat.set(n.name, f);
            n.children.forEach(collect);
        };
        collect(top);
        lines.push('', 'By self clocks:');
        [...flat].sort((a, b) => b[1].self - a[1].self).slice(0, 10).forEach(([name, f]) => {
            lines.push(`${String(f.self).padStart(10)} ${(100 * f.self / base).toFixed(1).padStart(6)}% ${String(f.calls).padStart(7)} calls  ${name}`);
        });
        const fr = Math.max(this.frames, 1);
        lines.push(`(${this.frames} frames, ${this.clocks} clocks total, ${Math.round(base / fr)} clocks/frame in the tree)`);
        return lines.join('\n') + '\n';
    }
}
exports.CallProfiler = CallProfiler;
//# sourceMappingURL=callprofile.js.map