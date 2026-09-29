// The Debug Adapter Protocol side of the debugger: translates DAP requests
// into DebugService calls. The service may be in this process (`8bws dap`,
// tests) or behind an RPC (the VS Code extension's emulator worker); either
// way it is reached through a DebugBackend, whose calls are all async.
//
// The machine has one thread. Its call stack is the PC, then the calls a
// scan of the stack finds (src/common/stackwalk.ts).
// Where the build has no source line for the PC (a library, a ROM), the frame
// shows a disassembly of the routine around it instead, so VS Code still has
// something to open and focus. Breakpoints set in it are address breakpoints.
// Its scopes are the CPU's registers, the platform's debug tree (browsed a
// level at a time, by path), and the build's symbols with the byte at each.

import {
  Breakpoint as DapBreakpoint, CapabilitiesEvent, InitializedEvent, InvalidatedEvent, LoggingDebugSession,
  MemoryEvent, OutputEvent, Scope, Source, StackFrame, StoppedEvent, TerminatedEvent, Thread,
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import type { Breakpoint } from '../common/breakpoints';
import type { StopEvent } from '../common/debugcontroller';
import { hex } from '../common/util';
import type { CallStackFrame, DebugCapabilities, DebugService, DisasmResult } from './debugservice';

/** launch.json's arguments for a `8bitworkshop` debug session. */
export interface LaunchArgs extends DebugProtocol.LaunchRequestArguments {
  /** the source file or ROM to run */
  program?: string;
  /** the same, as the extension's launch configurations call it */
  mainFile?: string;
  platform?: string;
  stopOnEntry?: boolean;
  /** run-script commands to run once loaded, as with `8bws run -e` */
  script?: string;
}

export interface LaunchResult {
  capabilities: DebugCapabilities;
  /** the directory the build's project paths are relative to */
  root: string;
}

type Async<T> = { [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<R> : never };

/** A DebugService, wherever it runs, plus loading a program into it. */
export type DebugBackend = Async<Pick<DebugService,
  'setBreakpoints' | 'continue' | 'step' | 'pause' | 'stepBack' | 'reverseContinue' | 'location' | 'callStack' |
  'registers' | 'readMemory' | 'writeMemory' | 'disassemble' | 'evaluate' | 'debugTree' | 'symbols'>> & {
    /** Build or load the program, and leave it stopped at its start. */
    launch(args: LaunchArgs): Promise<LaunchResult>;
    terminate(): Promise<void>;
    /** every stop, from any command */
    onStop(fn: (e: StopEvent) => void): void;
    onOutput?(fn: (text: string) => void): void;
  };

const THREAD_ID = 1;
const REGISTERS_REF = 1;
const SYMBOLS_REF = 2;
// debug tree nodes get references from here up, anew at each stop
const FIRST_TREE_REF = 100;
// a routine's listing starts at its symbol if the PC is at most this far in
const MAX_ROUTINE_BYTES = 0x800;
// instructions to list: at most, and past the PC when no symbol ends it
const MAX_LISTING = 1024;
const LISTING_AFTER_PC = 64;
// instructions before the PC when there's no symbol to start from
const LISTING_BEFORE_PC = 16;

/** A disassembly shown as a source, with the address of each line. */
interface Listing {
  name: string;
  text: string;
  /** line (0-based) -> address, for the lines that are instructions */
  lineAddrs: (number | null)[];
}

export class EmuDebugSession extends LoggingDebugSession {
  private root = '';
  private stopOnEntry = false;
  private sourceBps = new Map<string, Breakpoint[]>();
  private functionBps: Breakpoint[] = [];
  private instructionBps: Breakpoint[] = [];
  private nextBpId = 1;
  private launched: Promise<void>;
  private resolveLaunched: () => void;
  private hasTree = false;
  /** debug tree paths, by variablesReference; valid until the next stop */
  private treeRefs: string[][] = [];
  private treeRefByPath = new Map<string, number>();
  /** disassembly listings by sourceReference, and each one's reference by its text */
  private listings: Listing[] = [];
  private listingRefs = new Map<string, number>();
  private clientMemoryEvents = false;
  private clientInvalidatedEvents = false;

  constructor(private backend: DebugBackend) {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);
    this.launched = new Promise(resolve => this.resolveLaunched = resolve);
    backend.onStop(e => this.stopped(e));
    backend.onOutput?.(text => this.sendEvent(new OutputEvent(text, 'console')));
  }

  protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
    this.clientMemoryEvents = !!args.supportsMemoryEvent;
    this.clientInvalidatedEvents = !!args.supportsInvalidatedEvent;
    response.body = {
      supportsConfigurationDoneRequest: true,
      supportsConditionalBreakpoints: true,
      supportsFunctionBreakpoints: true,
      supportsInstructionBreakpoints: true,
      supportsSteppingGranularity: true,
      supportsReadMemoryRequest: true,
      supportsDisassembleRequest: true,
      supportsEvaluateForHovers: true,
      supportsTerminateRequest: true,
      // until launch says whether this platform can
      supportsStepBack: false,
      supportsWriteMemoryRequest: false,
    };
    this.sendResponse(response);
  }

  protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchArgs) {
    await this.run(response, async () => {
      const r = await this.backend.launch(args);
      this.root = r.root;
      this.stopOnEntry = !!args.stopOnEntry;
      this.hasTree = r.capabilities.tree;
      if (r.capabilities.rewind || r.capabilities.write) {
        this.sendEvent(new CapabilitiesEvent({ supportsStepBack: r.capabilities.rewind, supportsWriteMemoryRequest: r.capabilities.write }));
      }
      if (!r.capabilities.step) {
        this.sendEvent(new OutputEvent(`This platform stops only between frames: stepping and breakpoints are frame by frame.\n`, 'console'));
      }
      this.resolveLaunched();
      // breakpoints come next, then configurationDone
      this.sendEvent(new InitializedEvent());
    });
  }

  protected async configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse) {
    await this.run(response, async () => {
      await this.launched;
      if (this.stopOnEntry) this.stopped({ ...(await this.backend.location()), reason: 'entry' });
      else await this.backend.continue();
    });
  }

  //// breakpoints: the backend holds one list, so each request sends them all

  protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments) {
    await this.run(response, async () => {
      const listing = args.source.sourceReference ? this.listings[args.source.sourceReference - 1] : null;
      if (listing) {
        const key = `listing:${args.source.sourceReference}`;
        const lines = (args.breakpoints || []).map(b => ({ b, addr: listing.lineAddrs[b.line - 1] }));
        const bps = lines.filter(l => l.addr != null).map(({ b, addr }) => this.newBreakpoint({ type: 'address', target: '$' + hex(addr, 4), condition: b.condition }));
        this.sourceBps.set(key, bps);
        const results = await this.sendBreakpoints(bps);
        // report each on its own line of the listing
        let i = 0;
        response.body = {
          breakpoints: lines.map(({ b, addr }) => {
            if (addr == null) return new DapBreakpoint(false, b.line);
            const r = results[i++];
            r.line = b.line;
            return r;
          }),
        };
        return;
      }
      const file = this.toProjectPath(args.source.path || args.source.name);
      const bps = (args.breakpoints || []).map(b => this.newBreakpoint({ type: 'source', file, line: b.line, condition: b.condition }));
      this.sourceBps.set(file, bps);
      response.body = { breakpoints: await this.sendBreakpoints(bps) };
    });
  }

  protected async setFunctionBreakPointsRequest(response: DebugProtocol.SetFunctionBreakpointsResponse, args: DebugProtocol.SetFunctionBreakpointsArguments) {
    await this.run(response, async () => {
      this.functionBps = args.breakpoints.map(b => this.newBreakpoint({ type: 'address', target: b.name, condition: b.condition }));
      response.body = { breakpoints: await this.sendBreakpoints(this.functionBps) };
    });
  }

  protected async setInstructionBreakpointsRequest(response: DebugProtocol.SetInstructionBreakpointsResponse, args: DebugProtocol.SetInstructionBreakpointsArguments) {
    await this.run(response, async () => {
      this.instructionBps = args.breakpoints.map(b => this.newBreakpoint({
        type: 'address', target: '$' + hex(parseAddress(b.instructionReference) + (b.offset || 0), 4), condition: b.condition,
      }));
      response.body = { breakpoints: await this.sendBreakpoints(this.instructionBps) };
    });
  }

  private newBreakpoint(bp: Omit<Breakpoint, 'id' | 'enabled'>): Breakpoint {
    return { id: this.nextBpId++, enabled: true, ...bp };
  }

  /** Send every breakpoint; report on the ones in `mine`. */
  private async sendBreakpoints(mine: Breakpoint[]): Promise<DebugProtocol.Breakpoint[]> {
    await this.launched;
    const all = [...[...this.sourceBps.values()].flat(), ...this.functionBps, ...this.instructionBps];
    const results = await this.backend.setBreakpoints(all);
    const byId = new Map(results.map(r => [r.id, r]));
    return mine.map(bp => {
      const r = byId.get(bp.id);
      const out: DebugProtocol.Breakpoint = new DapBreakpoint(!!r?.verified, r?.line ?? bp.line);
      out.id = bp.id;
      if (r?.message) out.message = r.message;
      if (r?.pc != null) out.instructionReference = addressRef(r.pc);
      return out;
    });
  }

  //// running

  protected async continueRequest(response: DebugProtocol.ContinueResponse) {
    await this.run(response, () => this.backend.continue());
  }

  protected async nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments) {
    await this.run(response, () => this.backend.step('over', granularity(args.granularity)));
  }

  protected async stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments) {
    await this.run(response, () => this.backend.step('in', granularity(args.granularity)));
  }

  protected async stepOutRequest(response: DebugProtocol.StepOutResponse) {
    await this.run(response, () => this.backend.step('out'));
  }

  protected async stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments) {
    await this.run(response, () => this.backend.stepBack(granularity(args.granularity)));
  }

  protected async reverseContinueRequest(response: DebugProtocol.ReverseContinueResponse) {
    await this.run(response, () => this.backend.reverseContinue());
  }

  protected async pauseRequest(response: DebugProtocol.PauseResponse) {
    await this.run(response, () => this.backend.pause());
  }

  private stopped(e: StopEvent) {
    this.treeRefs = [];
    this.treeRefByPath.clear();
    const reason = e.reason === 'halt' ? 'pause' : e.reason;
    const ev = new StoppedEvent(reason, THREAD_ID, e.reason === 'exception' ? e.message : undefined) as DebugProtocol.StoppedEvent;
    ev.body.allThreadsStopped = true;
    if (e.reason === 'halt') ev.body.description = `Program ended${e.message ? ': ' + e.message : ''}`;
    else if (e.message) ev.body.description = e.message;
    if (e.breakpoints) ev.body.hitBreakpointIds = e.breakpoints;
    this.sendEvent(ev);
    // anything showing memory reads it again
    if (this.clientMemoryEvents) this.sendEvent(new MemoryEvent(addressRef(0), 0, 0x10000));
  }

  //// where it is

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = { threads: [new Thread(THREAD_ID, 'CPU')] };
    this.sendResponse(response);
  }

  protected async stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments) {
    await this.run(response, async () => {
      const all = await this.backend.callStack();
      const start = args.startFrame || 0;
      const want = all.slice(start, args.levels ? start + args.levels : undefined);
      const stackFrames = await Promise.all(want.map((f, i) => this.stackFrame(start + i, f)));
      response.body = { stackFrames, totalFrames: all.length };
    });
  }

  private async stackFrame(id: number, f: CallStackFrame): Promise<DebugProtocol.StackFrame> {
    const name = (f.symbol ? f.symbol.name + (f.symbol.offset ? `+${f.symbol.offset}` : '') : '$' + hex(f.pc, 4))
      + (f.unsure ? ' ?' : '');
    let frame: DebugProtocol.StackFrame;
    if (f.source) {
      frame = new StackFrame(id, name, this.toSource(f.source.path), f.source.line, 1);
    } else {
      const listing = await this.listingAt(f.pc, f.symbol);
      const line = listing ? listing.lines.lineAddrs.indexOf(f.pc) + 1 : 0;
      frame = listing && line > 0
        ? new StackFrame(id, name, new Source(listing.lines.name, undefined, listing.ref, 'disassembly'), line, 1)
        : new StackFrame(id, name);
    }
    frame.instructionPointerReference = addressRef(f.pc);
    // a guess from the stack: show it, but don't make it look certain
    if (f.unsure) frame.presentationHint = 'subtle';
    return frame;
  }

  /** The disassembly listing for a PC with no source line. */
  private async listingAt(pc: number, symbol?: { name: string, offset: number }): Promise<{ ref: number, lines: Listing } | null> {
    const find = (lines: DisasmResult[]) => lines.findIndex(d => d.addr === pc);
    let lines: DisasmResult[] = [];
    let at = -1;
    if (symbol && symbol.offset <= MAX_ROUTINE_BYTES) {
      lines = await this.backend.disassemble(pc - symbol.offset, 0, MAX_LISTING);
      at = find(lines);
    }
    if (at < 0) {
      symbol = undefined;
      lines = await this.backend.disassemble(pc, -LISTING_BEFORE_PC, LISTING_BEFORE_PC + LISTING_AFTER_PC);
      at = find(lines);
    }
    if (at < 0) {
      lines = await this.backend.disassemble(pc, 0, LISTING_AFTER_PC);
      at = find(lines);
    }
    if (at < 0) return null;
    // stop at the next routine, or a way past the PC
    let end = lines.findIndex((d, i) => i > at && d.symbol);
    if (end < 0) end = Math.min(lines.length, at + LISTING_AFTER_PC);
    lines = lines.slice(0, end);

    const text: string[] = [];
    const lineAddrs: (number | null)[] = [];
    for (const d of lines) {
      if (d.symbol) {
        text.push(`${d.symbol}:`);
        lineAddrs.push(null);
      }
      text.push(`  $${hex(d.addr, 4)}  ${d.bytes.padEnd(12)}${d.text}`);
      lineAddrs.push(d.addr);
    }
    const listing: Listing = {
      name: `${symbol ? symbol.name : '$' + hex(lines[0].addr, 4)} (disassembly)`,
      text: text.join('\n') + '\n',
      lineAddrs,
    };
    // the same text keeps the same reference, so VS Code keeps the same editor
    let ref = this.listingRefs.get(listing.text);
    if (ref == null) {
      ref = this.listings.push(listing);
      this.listingRefs.set(listing.text, ref);
    }
    return { ref, lines: this.listings[ref - 1] };
  }

  protected sourceRequest(response: DebugProtocol.SourceResponse, args: DebugProtocol.SourceArguments): void {
    const listing = this.listings[(args.source?.sourceReference ?? args.sourceReference) - 1];
    if (!listing) {
      this.sendErrorResponse(response, { id: 2, format: 'no such listing', showUser: false });
      return;
    }
    response.body = { content: listing.text, mimeType: 'text/plain' };
    this.sendResponse(response);
  }

  protected scopesRequest(response: DebugProtocol.ScopesResponse): void {
    const scopes = [new Scope('Registers', REGISTERS_REF, false)];
    if (this.hasTree) scopes.push(new Scope('Machine', this.treeRef([]), true));
    scopes.push(new Scope('Symbols', SYMBOLS_REF, true));
    response.body = { scopes };
    this.sendResponse(response);
  }

  protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments) {
    await this.run(response, async () => {
      response.body = { variables: await this.variables(args.variablesReference) };
    });
  }

  private async variables(ref: number): Promise<DebugProtocol.Variable[]> {
    if (ref === REGISTERS_REF) {
      const regs = await this.backend.registers();
      return regs.map(r => ({ name: r.name, value: r.text, variablesReference: 0, memoryReference: addressRef(r.value) }));
    }
    if (ref === SYMBOLS_REF) {
      const syms = await this.backend.symbols();
      return syms.map(s => ({
        name: s.name, value: `$${hex(s.addr, 4)}: $${hex(s.value, 2)}`, variablesReference: 0, memoryReference: addressRef(s.addr),
      }));
    }
    const path = this.treeRefs[ref - FIRST_TREE_REF];
    if (!path) return [];
    const entries = await this.backend.debugTree(path);
    return entries.map(e => ({
      name: e.name, value: e.value, variablesReference: e.expandable ? this.treeRef([...path, e.name]) : 0,
    }));
  }

  /** A reference for a debug tree path, until the next stop. */
  private treeRef(path: string[]): number {
    const key = path.join('\0');
    let ref = this.treeRefByPath.get(key);
    if (ref == null) {
      ref = FIRST_TREE_REF + this.treeRefs.push(path) - 1;
      this.treeRefByPath.set(key, ref);
    }
    return ref;
  }

  protected async readMemoryRequest(response: DebugProtocol.ReadMemoryResponse, args: DebugProtocol.ReadMemoryArguments) {
    await this.run(response, async () => {
      const addr = parseAddress(args.memoryReference) + (args.offset || 0);
      const bytes = await this.backend.readMemory(addr, Math.min(args.count, 0x10000));
      response.body = { address: addressRef(addr), data: Buffer.from(bytes).toString('base64') };
    });
  }

  protected async writeMemoryRequest(response: DebugProtocol.WriteMemoryResponse, args: DebugProtocol.WriteMemoryArguments) {
    await this.run(response, async () => {
      const addr = parseAddress(args.memoryReference) + (args.offset || 0);
      const bytes = [...Buffer.from(args.data, 'base64')];
      response.body = { bytesWritten: await this.backend.writeMemory(addr, bytes) };
      // the symbols and the machine may show what changed
      if (this.clientInvalidatedEvents) this.sendEvent(new InvalidatedEvent(['variables']));
    });
  }

  protected async disassembleRequest(response: DebugProtocol.DisassembleResponse, args: DebugProtocol.DisassembleArguments) {
    await this.run(response, async () => {
      const addr = parseAddress(args.memoryReference) + (args.offset || 0);
      const lines = await this.backend.disassemble(addr, args.instructionOffset || 0, args.instructionCount);
      response.body = {
        instructions: lines.map(d => {
          const insn: DebugProtocol.DisassembledInstruction = {
            address: addressRef(d.addr), instructionBytes: d.bytes, instruction: d.text,
          };
          if (d.symbol) insn.symbol = d.symbol;
          if (d.source) { insn.location = this.toSource(d.source.path); insn.line = d.source.line; }
          return insn;
        }),
      };
    });
  }

  /** The Debug Console runs run-script commands; watches and hovers are expressions. */
  protected async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments) {
    await this.run(response, async () => {
      const r = await this.backend.evaluate(args.expression, args.context || 'repl');
      response.body = { result: r.result, variablesReference: 0 };
      if (r.value != null) response.body.memoryReference = addressRef(r.value);
      if (r.moved) this.stopped({ ...(await this.backend.location()), reason: 'goto' });
    });
  }

  protected async terminateRequest(response: DebugProtocol.TerminateResponse) {
    await this.run(response, async () => {
      await this.backend.terminate();
      this.sendEvent(new TerminatedEvent());
    });
  }

  protected async disconnectRequest(response: DebugProtocol.DisconnectResponse) {
    await this.run(response, () => this.backend.terminate());
  }

  //// helpers

  /** Answer the request, or report what went wrong with it. */
  private async run(response: DebugProtocol.Response, body: () => Promise<unknown>) {
    try {
      await body();
      this.sendResponse(response);
    } catch (e) {
      this.sendErrorResponse(response, { id: 1, format: String(e?.message || e), showUser: false });
    }
  }

  private toProjectPath(p: string): string {
    if (!this.root || !path.isAbsolute(p)) return p;
    return path.relative(this.root, p).split(path.sep).join('/');
  }

  private toSource(projectPath: string): Source {
    const abs = this.root ? path.resolve(this.root, projectPath) : projectPath;
    return new Source(path.basename(projectPath), abs);
  }
}

function granularity(g?: DebugProtocol.SteppingGranularity): 'line' | 'instruction' {
  return g === 'instruction' ? 'instruction' : 'line';
}

function addressRef(addr: number): string {
  return '0x' + hex(addr, 4);
}

function parseAddress(ref: string): number {
  const n = ref.startsWith('$') ? parseInt(ref.slice(1), 16) : Number(ref);
  if (isNaN(n)) throw new Error(`not an address: ${ref}`);
  return n;
}
