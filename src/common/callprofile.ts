
import { CallGraphBuilder, CallGraphNode, InsnKind } from "./callgraph";
import { NullProbe } from "./devices";
import { ProbeFlags } from "./probe";

/** A call tree with clocks, merged by routine name. */
export interface ProfileNode {
  name: string;
  calls: number;
  self: number;         // clocks in this routine, not counting callees
  children: Map<string, ProfileNode>;
}

function newNode(name: string, calls = 0): ProfileNode {
  return { name, calls, self: 0, children: new Map() };
}

export function totalClocks(n: ProfileNode): number {
  let t = n.self;
  for (const c of n.children.values()) t += totalClocks(c);
  return t;
}

/** Merge b into a (the same routine reached by different paths). */
function mergeInto(a: ProfileNode, b: ProfileNode) {
  a.calls += b.calls;
  a.self += b.self;
  for (const [name, c] of b.children) {
    let d = a.children.get(name);
    if (!d) a.children.set(name, d = newNode(name));
    mergeInto(d, c);
  }
}

/**
 * Probe that charges clocks to the routine on top of a CallGraphBuilder's
 * stack, which is the same call detection the IDE's Call Stack window uses.
 * A call or return instruction's own clocks land in the frame it started in.
 */
export class CallProfiler extends NullProbe {
  readonly builder: CallGraphBuilder;
  private self = new Map<CallGraphNode, number>();
  private sp = -1;
  frames = 0;
  clocks = 0;

  constructor(classify: (pc: number) => InsnKind, private name: (pc: number) => string) {
    super();
    this.builder = new CallGraphBuilder(classify, name);
  }

  logNewFrame() { this.frames++; }
  logInterrupt(type?: number) { this.builder.event(ProbeFlags.INTERRUPT, type ?? 0, 0); }
  logExecute(address?: number, SP?: number) {
    // same events the ProbeRecorder logs: a stack move, then the execute
    if (SP !== this.sp) {
      this.builder.event(SP! < this.sp ? ProbeFlags.SP_PUSH : ProbeFlags.SP_POP, SP!, 0);
      this.sp = SP!;
    }
    this.builder.event(ProbeFlags.EXECUTE, address!, 0);
  }
  logClocks(n?: number) {
    this.clocks += n!;
    const stack = this.builder.stack;
    if (n! > 0 && stack.length) {
      const top = stack[stack.length - 1];
      this.self.set(top, (this.self.get(top) || 0) + n!);
    }
  }

  private toTree(name: string, n: CallGraphNode): ProfileNode {
    const out = newNode(name, n.count);
    out.self = this.self.get(n) || 0;
    for (const [cname, c] of Object.entries(n.calls)) {
      const t = this.toTree(cname, c);
      const prev = out.children.get(cname);
      if (prev) mergeInto(prev, t); else out.children.set(cname, t);
    }
    return out;
  }

  /** Tree rooted at the routine `name`, merging every call site; the whole tree if null. */
  subtree(name: string | null): ProfileNode | null {
    if (!this.builder.graph) return null;
    const root = this.toTree('(entry)', this.builder.graph);
    if (name == null) return root;
    const out = newNode(name);
    let found = false;
    const walk = (n: ProfileNode) => {
      for (const c of n.children.values()) {
        if (c.name === name) { found = true; mergeInto(out, c); } // callees are inside c
        else walk(c);
      }
    };
    walk(root);
    return found ? out : null;
  }

  /** Text report: indented call tree, then a flat list by self clocks. */
  report(start: number | null, maxDepth = 8, minPct = 0.5): string {
    const startName = start == null ? null : this.name(start);
    const top = this.subtree(startName);
    if (!top) return `(${startName ?? 'nothing'} was never called)\n`;
    const base = totalClocks(top) || 1;
    const lines: string[] = [];
    lines.push(`${'total'.padStart(10)} ${'self'.padStart(10)} ${'%'.padStart(6)} ${'calls'.padStart(7)}  routine`);
    const row = (t: number, self: string, calls: string, depth: number, label: string) =>
      lines.push(`${String(t).padStart(10)} ${self.padStart(10)} ${(100 * t / base).toFixed(1).padStart(6)} ` +
        `${calls.padStart(7)}  ${'  '.repeat(depth)}${label}`);
    const walk = (n: ProfileNode, depth: number) => {
      const t = totalClocks(n);
      row(t, String(n.self), depth == 0 && !startName ? '' : String(n.calls), depth, n.name);
      if (depth >= maxDepth) return;
      const kids = [...n.children.values()].map(c => ({ c, t: totalClocks(c) })).sort((a, b) => b.t - a.t);
      let hidden = 0;
      for (const { c, t } of kids) {
        if (100 * t / base < minPct) hidden += t; else walk(c, depth + 1);
      }
      if (hidden) row(hidden, '', '', depth + 1, `(other, below ${minPct}%)`);
    };
    walk(top, 0);

    // flat profile: self clocks per routine across the whole subtree
    const flat = new Map<string, { self: number, calls: number }>();
    const collect = (n: ProfileNode) => {
      const f = flat.get(n.name) || { self: 0, calls: 0 };
      f.self += n.self; f.calls += n.calls;
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
