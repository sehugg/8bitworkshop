// The debugger as a service: everything a debug adapter asks of the machine,
// with plain-data arguments and results so it can sit behind an RPC. The
// VS Code emulator worker and `8bws dap` each host one.
//
// Every stop, whatever caused it, goes out through `onStop`. Forward commands
// (continue, step) only set a goal; the host's loop calls advance() to work
// toward it, a few frames at a time, so it can still take a pause request.

import { Breakpoint, makeCondContext } from '../common/breakpoints';
import { compileExpression } from '../common/breakcond';
import { TreeEntry, treeChildren } from '../common/debugtree';
import { buildDebugContext, DebugController, DebugLocation, StepGranularity, StopEvent } from '../common/debugcontroller';
import { lookupSymbol } from '../common/symbols/symbolfile';
import { Granularity, Timestamp } from '../common/timeline';
import { hex } from '../common/util';
import type { CodeListingMap } from '../common/workertypes';
import type { EmuTarget } from './emutarget';
import { RUN_SCRIPT_HELP, RunScript } from './runscript';

export type StepKind = 'in' | 'over' | 'out';

export interface DebugCapabilities {
  /** can stop between instructions */
  step: boolean;
  /** can go backwards */
  rewind: boolean;
  /** what a step is: a clock, an instruction, or a whole frame */
  granularity: Granularity | 'frame';
  /** can write memory */
  write: boolean;
  /** has a debug tree (getDebugTree) */
  tree: boolean;
}

export interface BreakpointResult {
  id: number;
  verified: boolean;
  pc?: number;
  /** the source line it ended up on */
  line?: number;
  message?: string;
}

export interface RegisterValue {
  name: string;
  value: number;
  text: string;
}

export interface SymbolValue {
  name: string;
  addr: number;
  /** the byte there */
  value: number;
}

export interface DisasmResult {
  addr: number;
  bytes: string;
  text: string;
  symbol?: string;
  source?: { path: string, line: number };
}

export interface EvalResult {
  result: string;
  /** a number the result can be shown as memory from */
  value?: number;
  /** the command moved the machine, so views need refreshing */
  moved?: boolean;
}

export interface TimelineInfo {
  first: number;
  last: number;
  now: Timestamp;
  past: boolean;
}

export interface BuildInfo {
  listings?: CodeListingMap;
  symbols?: { [name: string]: number };
  mainPath: string;
  paths?: string[];
}

// how far before an address to start disassembling, per instruction wanted
const MAX_INSN_BYTES = 4;

export class DebugService {
  readonly debug: DebugController;
  private script: RunScript;
  private scriptOut = '';

  constructor(readonly target: EmuTarget, private onStop: (e: StopEvent) => void) {
    this.debug = new DebugController(target);
    this.script = new RunScript(target, s => { this.scriptOut += s; }, this.debug);
  }

  /** A new build: its listings and symbols. */
  setBuild(build: BuildInfo) {
    this.script.setDebugContext(buildDebugContext(build));
  }

  capabilities(): DebugCapabilities {
    const t = this.target;
    return {
      step: t.supportsStep,
      rewind: t.supportsRewind,
      granularity: t.history ? t.history.core.granularity : (t.supportsStep ? 'insn' : 'frame'),
      write: t.supportsWrite,
      tree: !!t.platform.getDebugTree,
    };
  }

  setBreakpoints(bps: Breakpoint[]): BreakpointResult[] {
    return this.debug.setBreakpoints(bps).map(r => {
      const res: BreakpointResult = { id: r.bp.id, verified: !r.error && r.pc >= 0 };
      if (r.error) res.message = r.error;
      if (r.pc >= 0) {
        res.pc = r.pc;
        const src = this.debug.sourceAt(r.pc);
        if (src) res.line = src.line;
      }
      return res;
    });
  }

  get running(): boolean { return this.debug.running; }

  continue() { this.debug.continue(); }

  step(kind: StepKind, granularity: StepGranularity = 'line') {
    if (kind === 'in') this.debug.stepIn(granularity);
    else if (kind === 'over') this.debug.stepOver(granularity);
    else this.debug.stepOut();
  }

  pause() { this.onStop(this.debug.pause()); }

  /** Work toward the goal for up to `frames` frames. */
  advance(frames: number): StopEvent | null {
    const stop = this.debug.run(frames);
    if (stop) this.onStop(stop);
    return stop;
  }

  stepBack(granularity: StepGranularity = 'line') {
    const stop = this.debug.stepBack(granularity);
    if (stop) return this.onStop(stop);
    // nothing further back: say where it still is
    const { at, pc } = this.debug.location();
    this.onStop({ reason: 'entry', at, pc, message: 'start of recording' });
  }

  reverseContinue() { this.onStop(this.debug.reverseContinue()); }

  seekFrame(frame: number) { this.onStop(this.debug.seekFrame(frame)); }

  location(): DebugLocation { return this.debug.location(); }

  timeline(): TimelineInfo | null {
    const h = this.target.history;
    if (!h) return null;
    return { first: h.first().frame, last: h.last().frame, now: h.now(), past: h.isInPast() };
  }

  registers(): RegisterValue[] {
    const state: any = this.target.getCPUState();
    if (!state) return [];
    const regs: RegisterValue[] = [];
    for (const [name, value] of Object.entries(state)) {
      if (typeof value !== 'number') continue;
      const wide = /^(E?PC|SP|[A-Z]{2}|IX|IY)$/.test(name) || value > 0xff;
      regs.push({ name, value, text: '$' + hex(value, wide ? 4 : 2) });
    }
    return regs;
  }

  readMemory(addr: number, count: number): number[] {
    const bytes: number[] = [];
    for (let i = 0; i < count; i++) bytes.push(this.target.read((addr + i) & 0xffff) & 0xff);
    return bytes;
  }

  /** Write bytes; returns how many. */
  writeMemory(addr: number, bytes: number[]): number {
    bytes.forEach((b, i) => this.target.write((addr + i) & 0xffff, b & 0xff));
    return bytes.length;
  }

  /** The debug tree's entries under `path` (names from earlier calls). */
  debugTree(path: string[]): TreeEntry[] {
    const tree = this.target.getDebugTree();
    if (!tree) throw new Error('this platform has no debug tree');
    return treeChildren(tree, path);
  }

  /** The build's symbols, by name, with the byte at each. */
  symbols(): SymbolValue[] {
    const syms = this.debug.context.symbols || {};
    return Object.keys(syms)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
      .map(name => ({ name, addr: syms[name], value: this.target.read(syms[name] & 0xffff) & 0xff }));
  }

  /**
   * `count` instructions starting `insnOffset` instructions from `addr`
   * (which may be negative). Instructions vary in length, so going back
   * tries each start that disassembles into `addr` and keeps the one that
   * lands on it.
   */
  disassemble(addr: number, insnOffset: number, count: number): DisasmResult[] {
    let start = addr;
    if (insnOffset < 0) start = this.alignBack(addr, -insnOffset);
    else for (let i = 0; i < insnOffset; i++) start += this.insnSize(start);
    const out: DisasmResult[] = [];
    let a = start;
    for (let i = 0; i < count; i++) {
      const d = this.target.disassemble(a & 0xffff);
      const n = d ? d.nbytes : 1;
      let bytes = '';
      for (let b = 0; b < n; b++) bytes += hex(this.target.read((a + b) & 0xffff), 2) + ' ';
      const line: DisasmResult = { addr: a & 0xffff, bytes: bytes.trim(), text: d ? d.line : '???' };
      const sym = this.debug.symbolAt(a & 0xffff);
      if (sym && sym.offset === 0) line.symbol = sym.name;
      const src = this.debug.sourceAt(a & 0xffff);
      if (src) line.source = { path: src.path, line: src.line };
      out.push(line);
      a += n;
    }
    return out;
  }

  private insnSize(addr: number): number {
    const d = this.target.disassemble(addr & 0xffff);
    return d ? d.nbytes : 1;
  }

  private alignBack(addr: number, n: number): number {
    for (let start = addr - n * MAX_INSN_BYTES; start < addr; start++) {
      let a = start, count = 0;
      while (a < addr) { a += this.insnSize(a); count++; }
      if (a === addr && count >= n) {
        // skip the extra instructions at the front
        for (let i = 0; i < count - n; i++) start += this.insnSize(start);
        return start;
      }
    }
    return addr - n;
  }

  /**
   * `repl`: a run-script command line (`mem $200 16`, `back 3`, `help`).
   * Anything else: an expression, as in a breakpoint condition (`[score]`,
   * `A`, `#mem16[ptr]`), or a symbol.
   */
  evaluate(expr: string, context: string): EvalResult {
    expr = expr.trim();
    if (context === 'repl') return this.runScript(expr);
    const ctx = makeCondContext(this.debug.context);
    let value: number;
    const sym = lookupSymbol(this.debug.context.symbols, expr);
    if (sym != null) value = sym;
    else value = compileExpression(expr, ctx)(this.target.getCPUState());
    if (typeof value !== 'number' || isNaN(value)) throw new Error(`'${expr}' has no value`);
    return { result: `$${hex(value, value > 0xff ? 4 : 2)} (${value})`, value };
  }

  private runScript(line: string): EvalResult {
    if (line === 'help' || line === '?') return { result: RUN_SCRIPT_HELP };
    const before = this.target.now();
    this.scriptOut = '';
    this.script.run(line);
    const after = this.target.now();
    const moved = before.frame !== after.frame || before.step !== after.step;
    return { result: this.scriptOut.replace(/\n$/, ''), moved };
  }
}
