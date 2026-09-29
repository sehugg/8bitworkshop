// The call graph behind the IDE's Call Stack window, built from probe events
// (see probe.ts). A call is a call instruction (or an interrupt) after which
// the stack pointer went down; a return is a return instruction after which
// it went up. Conditional calls and returns that aren't taken leave SP alone,
// so they don't count, and neither do pushes and pops of data.
//
// Where the instruction can't be told (no disassembler), it falls back to
// guessing from how far SP moved and how far the PC jumped.

import { ProbeFlags } from "./probe";

export interface CallGraphNode {
  $$SP: number;
  $$PC: number;
  count: number;
  startLine: number;
  endLine: number;
  calls: { [name: string]: CallGraphNode };
}

export type InsnKind = 'call' | 'return' | 'other' | 'unknown';

export class CallGraphBuilder {
  graph: CallGraphNode | null = null;
  /** the root first, the routine running now last */
  stack: CallGraphNode[] = [];
  private lastsp = -1;
  private lastpc = 0;
  /** SP as the last instruction started */
  private spAtLastExec = -1;
  private interrupted = false;
  // for the fallback guess
  private jsr = false;
  private rts = false;

  /**
   * `classify` says what the instruction at an address is; `name` names a
   * routine by its address (a symbol, or hex).
   */
  constructor(private classify: (pc: number) => InsnKind, private name: (pc: number) => string) { }

  /** Forget everything. */
  clear() {
    this.graph = null;
    this.reset();
  }

  /** Forget where it is, but keep the graph. */
  reset() {
    this.stack = [];
    this.lastsp = -1;
    this.lastpc = 0;
    this.spAtLastExec = -1;
    this.interrupted = false;
    this.jsr = false;
    this.rts = false;
  }

  private newNode(pc: number, sp: number): CallGraphNode {
    return { $$SP: sp, $$PC: pc, count: 0, startLine: null, endLine: null, calls: {} };
  }

  private enter(pc: number, row: number) {
    const top = this.stack[this.stack.length - 1];
    const sym = this.name(pc);
    let child = top.calls[sym];
    if (child == null) child = top.calls[sym] = this.newNode(pc, this.lastsp);
    else if (child.$$PC == null) child.$$PC = pc;
    this.stack.push(child);
    child.count++;
    child.startLine = row;
  }

  private leave(row: number) {
    if (this.stack.length > 1) {
      this.stack.pop().endLine = row;
    } else {
      // it returned from where it was when we started: into a caller we
      // didn't see call, which becomes the new root
      const old = this.stack[0];
      this.graph = this.newNode(null, this.lastsp);
      this.graph.calls[this.name(this.lastpc)] = old;
      this.stack = [this.graph];
    }
  }

  /** One probe event. */
  event(op: number, addr: number, row: number) {
    switch (op) {
      case ProbeFlags.INTERRUPT:
        this.interrupted = true;
        break;
      case ProbeFlags.SP_POP:
      case ProbeFlags.SP_PUSH:
        if (this.stack.length) {
          const top = this.stack[this.stack.length - 1];
          const delta = this.lastsp - addr;
          if ((delta == 2 || delta == 3) && addr < top.$$SP) this.jsr = true;
          if ((delta == -2 || delta == -3) && this.stack.length > 1 && addr > top.$$SP) this.rts = true;
        }
        this.lastsp = addr;
        break;
      case ProbeFlags.EXECUTE: {
        if (!this.stack.length) {
          this.graph ??= this.newNode(null, this.lastsp);
          this.stack = [this.graph];
        }
        const kind = this.spAtLastExec >= 0 ? this.classify(this.lastpc) : 'unknown';
        if (kind === 'unknown' && !this.interrupted) {
          this.guess(addr, row);
        } else {
          const pushed = this.lastsp < this.spAtLastExec;
          const popped = this.lastsp > this.spAtLastExec;
          if ((kind === 'call' || this.interrupted) && pushed) this.enter(addr, row);
          else if (kind === 'return' && popped) this.leave(row);
          this.jsr = this.rts = false;
        }
        this.interrupted = false;
        this.lastpc = addr;
        this.spAtLastExec = this.lastsp;
        break;
      }
    }
  }

  /** The old guess: SP moved by an address's worth, and the PC jumped. */
  private guess(addr: number, row: number) {
    if (Math.abs(addr - this.lastpc) >= 4) {
      if (this.jsr) this.enter(addr, row);
      if (this.rts) this.leave(row);
      this.jsr = this.rts = false;
    }
  }
}
