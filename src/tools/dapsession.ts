// The Debug Adapter Protocol side of the debugger: translates DAP requests
// into DebugService calls. The service may be in this process (`8bws dap`,
// tests) or behind an RPC (the VS Code extension's emulator worker); either
// way it is reached through a DebugBackend, whose calls are all async.
//
// The machine has one thread. Its call stack is one frame: where the PC is.

import {
  Breakpoint as DapBreakpoint, CapabilitiesEvent, InitializedEvent, LoggingDebugSession, OutputEvent,
  Scope, Source, StackFrame, StoppedEvent, TerminatedEvent, Thread,
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as path from 'path';
import type { Breakpoint } from '../common/breakpoints';
import type { StopEvent } from '../common/debugcontroller';
import { hex } from '../common/util';
import type { DebugCapabilities, DebugService } from './debugservice';

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
  'setBreakpoints' | 'continue' | 'step' | 'pause' | 'stepBack' | 'reverseContinue' | 'location' |
  'registers' | 'readMemory' | 'disassemble' | 'evaluate'>> & {
    /** Build or load the program, and leave it stopped at its start. */
    launch(args: LaunchArgs): Promise<LaunchResult>;
    terminate(): Promise<void>;
    /** every stop, from any command */
    onStop(fn: (e: StopEvent) => void): void;
    onOutput?(fn: (text: string) => void): void;
  };

const THREAD_ID = 1;
const REGISTERS_REF = 1;

export class EmuDebugSession extends LoggingDebugSession {
  private root = '';
  private stopOnEntry = false;
  private sourceBps = new Map<string, Breakpoint[]>();
  private functionBps: Breakpoint[] = [];
  private instructionBps: Breakpoint[] = [];
  private nextBpId = 1;
  private launched: Promise<void>;
  private resolveLaunched: () => void;

  constructor(private backend: DebugBackend) {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);
    this.launched = new Promise(resolve => this.resolveLaunched = resolve);
    backend.onStop(e => this.stopped(e));
    backend.onOutput?.(text => this.sendEvent(new OutputEvent(text, 'console')));
  }

  protected initializeRequest(response: DebugProtocol.InitializeResponse): void {
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
    };
    this.sendResponse(response);
  }

  protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchArgs) {
    await this.run(response, async () => {
      const r = await this.backend.launch(args);
      this.root = r.root;
      this.stopOnEntry = !!args.stopOnEntry;
      if (r.capabilities.rewind) this.sendEvent(new CapabilitiesEvent({ supportsStepBack: true }));
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
    const reason = e.reason === 'halt' ? 'pause' : e.reason;
    const ev = new StoppedEvent(reason, THREAD_ID, e.reason === 'exception' ? e.message : undefined) as DebugProtocol.StoppedEvent;
    ev.body.allThreadsStopped = true;
    if (e.reason === 'halt') ev.body.description = `Program ended${e.message ? ': ' + e.message : ''}`;
    else if (e.message) ev.body.description = e.message;
    if (e.breakpoints) ev.body.hitBreakpointIds = e.breakpoints;
    this.sendEvent(ev);
  }

  //// where it is

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = { threads: [new Thread(THREAD_ID, 'CPU')] };
    this.sendResponse(response);
  }

  protected async stackTraceRequest(response: DebugProtocol.StackTraceResponse) {
    await this.run(response, async () => {
      const loc = await this.backend.location();
      const pc = loc.pc ?? 0;
      const name = loc.symbol ? loc.symbol.name + (loc.symbol.offset ? `+${loc.symbol.offset}` : '') : '$' + hex(pc, 4);
      const frame: DebugProtocol.StackFrame = loc.source
        ? new StackFrame(0, name, this.toSource(loc.source.path), loc.source.line, 1)
        : new StackFrame(0, name);
      frame.instructionPointerReference = addressRef(pc);
      response.body = { stackFrames: [frame], totalFrames: 1 };
    });
  }

  protected scopesRequest(response: DebugProtocol.ScopesResponse): void {
    response.body = { scopes: [new Scope('Registers', REGISTERS_REF, false)] };
    this.sendResponse(response);
  }

  protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments) {
    await this.run(response, async () => {
      const regs = args.variablesReference === REGISTERS_REF ? await this.backend.registers() : [];
      response.body = {
        variables: regs.map(r => ({ name: r.name, value: r.text, variablesReference: 0, memoryReference: addressRef(r.value) })),
      };
    });
  }

  protected async readMemoryRequest(response: DebugProtocol.ReadMemoryResponse, args: DebugProtocol.ReadMemoryArguments) {
    await this.run(response, async () => {
      const addr = parseAddress(args.memoryReference) + (args.offset || 0);
      const bytes = await this.backend.readMemory(addr, Math.min(args.count, 0x10000));
      response.body = { address: addressRef(addr), data: Buffer.from(bytes).toString('base64') };
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
