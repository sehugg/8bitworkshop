// Run-script interpreter: a small command language for driving a headless
// emulator. One command per line, separated by newlines or ';'; '#' or '//'
// starts a comment.
//
// Everything here talks to an EmuTarget, so the same script works against a
// Platform (--platform) or a bare Machine (--machine). Commands that need a
// capability the target lacks report that instead of failing silently.

import { KeyFlags } from '../common/emu';
import { ProbeFlags, ProbeRecorder } from '../common/probe';
import { hex } from '../common/util';
import { hexdump, write } from './cliformat';
import { DEFAULT_MAX_FRAMES, EmuTarget } from './emutarget';

export const RUN_SCRIPT_HELP = [
  'Execution:',
  '  run N | wait N              - advance N frames (default 1)',
  '  break ADDR [MAXFRAMES]      - stop when PC==ADDR (alias: runto)',
  '  step [N]                    - execute N instructions (default 1)',
  '  trace [MAXLINES] ADDR       - run until PC==ADDR, then log every',
  '                                instruction until the routine returns',
  '  hist [MAXLINES]             - last N instructions from the trace buffer',
  'Inspection & input:',
  '  key KEY                     - press key (down, 3 frames, up)',
  '  keydown KEY / keyup KEY     - raw key down/up events',
  '  mem START [LEN]             - hexdump memory (default 16 bytes)',
  '  screen [START] [COLS] [ROWS]- decode screen RAM to text (default $0400 40x25)',
  '  pc [N]                      - print PC + disassembly of N instructions',
  '  info                        - platform/machine debug info',
  '  reset                       - reset the emulator',
  '  echo TEXT                   - print message',
  '(ADDR: number or symbol name; KEY: char, ENTER/SPACE/arrows/F1.., $hex;',
  ' prefixes SHIFT+, CTRL+)',
].join('\n');

const KEY_NAMES: { [name: string]: number } = {
  'ENTER': 13, 'RETURN': 13, 'CR': 13,
  'SPACE': 32, 'ESC': 27, 'TAB': 9, 'BACKSPACE': 8, 'BS': 8,
  'DELETE': 46, 'DEL': 46, 'INSERT': 45,
  'LEFT': 37, 'UP': 38, 'RIGHT': 39, 'DOWN': 40,
  'HOME': 36, 'END': 35, 'PAGEUP': 33, 'PAGEDOWN': 34,
  'F1': 112, 'F2': 113, 'F3': 114, 'F4': 115, 'F5': 116, 'F6': 117,
  'F7': 118, 'F8': 119, 'F9': 120, 'F10': 121, 'F11': 122, 'F12': 123,
};

export function parseNum(s: string): number {
  s = s.trim();
  if (s.startsWith('$')) return parseInt(s.substring(1), 16);
  if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16);
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  throw new Error(`bad number '${s}'`);
}

function parseKeyValue(tok: string): { key: number; flags: number } {
  let flags = 0;
  let t = tok.toUpperCase();
  for (; ;) {
    if (t.startsWith('SHIFT+')) { flags |= KeyFlags.Shift; t = t.substring(6); }
    else if (t.startsWith('CTRL+')) { flags |= KeyFlags.Ctrl; t = t.substring(5); }
    else break;
  }
  if (KEY_NAMES[t] != null) return { key: KEY_NAMES[t], flags };
  if (t.length == 1) return { key: t.charCodeAt(0), flags };
  if (/^0X[0-9A-F]+$/.test(t)) return { key: parseInt(t, 16), flags };
  if (/^\d+$/.test(t)) return { key: parseInt(t, 10), flags };
  throw new Error(`unknown key '${tok}'`);
}

// C64-style screen code -> ASCII (also close enough for VIC-20 et al)
function screenCodeToChar(code: number): string {
  code &= 0xff;
  if (code >= 0x40) code &= 0x3f; // reverse-video / graphics variants
  if (code < 0x20) return '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[£]^_'[code];
  return String.fromCharCode(code); // $20-$3F identical to ASCII
}

/**
 * Registers as "A=$12 X=$34 SP=$ff". CpuState carries whatever fields the CPU
 * happens to save, including internals, so pick the set that matches.
 */
const REG_SETS: { when: string[], show: string[], flags?: string }[] = [
  { when: ['A', 'X', 'Y'], show: ['A', 'X', 'Y', 'SP'], flags: 'NVDIZC' },   // 6502
  { when: ['AF', 'HL'], show: ['AF', 'BC', 'DE', 'HL', 'IX', 'IY', 'SP'] },  // Z80 / SM83
  { when: ['A', 'B', 'DP'], show: ['A', 'B', 'X', 'Y', 'U', 'S', 'DP', 'CC'] }, // 6809
];

export function formatRegs(state: any): string {
  if (!state) return '';
  const set = REG_SETS.find((s) => s.when.every((f) => state[f] != null));
  const names = set ? set.show : Object.keys(state).filter((k) => /^[A-Z]/.test(k) && k !== 'PC').slice(0, 6);
  const parts: string[] = [];
  for (const name of names) {
    const value = state[name];
    if (typeof value === 'number') parts.push(`${name}=$${hex(value, value > 0xff ? 4 : 2)}`);
  }
  if (set?.flags) {
    // set flags uppercase, clear flags lowercase
    const flags = [...set.flags].map((f) => (state[f] ? f : f.toLowerCase())).join('');
    parts.push(flags);
  }
  return parts.join(' ');
}

// Trace buffer size; the most recent half is kept once it fills up.
const PROBE_BUFFER_SIZE = 0x400000;

export class RunScript {
  symbols: { [name: string]: number } = {};
  private addr2symbol: { [addr: number]: string } = {};
  private probe: ProbeRecorder | null = null;

  constructor(readonly target: EmuTarget, private out = write) { }

  addSymbols(symbols: { [name: string]: number }) {
    Object.assign(this.symbols, symbols);
    for (const [name, addr] of Object.entries(this.symbols)) this.addr2symbol[addr] = name;
  }

  /** Start recording executed instructions, for the 'hist' command. */
  startTracing(): boolean {
    if (!this.target.machine) return false;
    const rec = new ProbeRecorder(this.target.machine as any, PROBE_BUFFER_SIZE);
    rec.singleFrame = false; // accumulate across frames
    if (!this.target.connectProbe(rec)) return false;
    this.probe = rec;
    return true;
  }

  run(script: string) {
    for (let line of script.split(/\r?\n|;/)) {
      line = line.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;
      const tokens = line.split(/\s+/);
      const cmd = tokens[0].toLowerCase();
      const handler = COMMANDS[cmd];
      if (!handler) {
        throw new Error(`unknown command '${cmd}'\nCommands:\n${RUN_SCRIPT_HELP}`);
      }
      try {
        handler.call(this, tokens, line);
      } catch (e: any) {
        throw new Error(`script error on '${line}': ${e.message}`);
      }
    }
  }

  //// helpers used by the commands

  private log(msg: string) { this.out(`[frame ${this.target.frameCount}] ${msg}\n`); }

  private addr(tok: string): number {
    try { return parseNum(tok); }
    catch (e) {
      const v = this.symbols[tok] ?? this.symbols[tok.replace(/^\./, '')];
      if (v == null) throw new Error(`unknown address or symbol '${tok}'`);
      return v;
    }
  }

  private advance(n: number) {
    // Keep the trace buffer from overflowing: drop the oldest half.
    for (let i = 0; i < n; i++) {
      const p = this.probe;
      if (p && p.idx >= p.buf.length - 0x1000) {
        const half = p.buf.length >> 1;
        p.buf.copyWithin(0, p.idx - half, p.idx);
        p.idx = half;
      }
      this.target.advanceFrame();
    }
  }

  /** One disassembly line: "$ADDR  bytes  mnemonic" plus optional registers. */
  private disasmLine(addr: number, withRegs: boolean): string {
    const d = this.target.disassemble(addr);
    let bytes = '';
    if (d) for (let b = 0; b < d.nbytes; b++) bytes += hex(this.target.read(addr + b)) + ' ';
    const label = this.addr2symbol[addr] ? `${this.addr2symbol[addr]}:\n` : '';
    let line = `${label}  $${hex(addr, 4)}  ${bytes.padEnd(12)} ${(d ? d.line : '???').padEnd(20)}`;
    if (withRegs) line += ' ' + formatRegs(this.target.getCPUState());
    return line.replace(/\s+$/, '');
  }

  private disasmBlock(addr: number, count: number) {
    for (let i = 0; i < count; i++) {
      const d = this.target.disassemble(addr);
      if (!d) { this.out(`  $${hex(addr, 4)}  (no disassembler for this target)\n`); return; }
      this.out(this.disasmLine(addr, false) + '\n');
      addr += d.nbytes;
    }
  }

  private requireStep() {
    if (!this.target.supportsStep) {
      throw new Error(`'${this.target.id}' does not support instruction stepping`);
    }
  }

  //// commands

  cmdRun(tokens: string[]) {
    const n = tokens[1] ? parseNum(tokens[1]) : 1;
    this.advance(n);
    this.log(`ran ${n} frame${n == 1 ? '' : 's'}`);
  }

  cmdStep(tokens: string[]) {
    this.requireStep();
    this.target.settle();
    const n = tokens[1] ? parseNum(tokens[1]) : 1;
    for (let i = 0; i < n; i++) {
      this.out(this.disasmLine(this.target.getPC(), true) + '\n');
      this.target.stepInsn();
    }
    this.log(`PC=$${hex(this.target.getPC(), 4)}`);
  }

  cmdBreak(tokens: string[]) {
    if (!tokens[1]) throw new Error('break requires an address');
    const addr = this.addr(tokens[1]);
    const maxFrames = tokens[2] ? parseNum(tokens[2]) : DEFAULT_MAX_FRAMES;
    const start = this.target.frameCount;
    const hit = this.target.runToPC(new Set([addr]), maxFrames);
    const pc = this.target.getPC();
    const where = pc != null ? '$' + hex(pc, 4) : '?';
    this.log(`break $${hex(addr, 4)}: ${hit ? 'HIT' : 'MISSED'} (pc=${where} after ${this.target.frameCount - start} frames)`);
    if (!hit && !this.target.supportsTrap) {
      this.out(`  (note: '${this.target.id}' only checks the PC at frame boundaries)\n`);
    }
  }

  cmdTrace(tokens: string[]) {
    this.requireStep();
    let i = 1;
    let maxLines = 5000;
    if (tokens.length > 2 && /^\d+$/.test(tokens[1])) maxLines = parseNum(tokens[i++]);
    if (!tokens[i]) throw new Error('trace requires an address (trace [MAXLINES] ADDR)');
    const targets = new Set<number>();
    for (; i < tokens.length; i++) targets.add(this.addr(tokens[i]));

    const start = this.target.frameCount;
    if (!this.target.runToPC(targets)) {
      this.log(`trace: address not reached within ${this.target.frameCount - start} frames`);
      return;
    }
    const entrySP = (this.target.getCPUState() as any)?.SP ?? 0;
    this.log(`--- trace ON at $${hex(this.target.getPC(), 4)} ---`);
    let lines = 0;
    let done = 'ran out of frames';
    while (this.target.frameCount - start < DEFAULT_MAX_FRAMES) {
      this.out(this.disasmLine(this.target.getPC(), true) + '\n');
      if (++lines >= maxLines) { done = `line cap (${maxLines}) reached`; break; }
      this.target.stepInsn();
      // the routine returned once the stack has popped back past entry level
      const sp = (this.target.getCPUState() as any)?.SP;
      if (sp != null && sp > entrySP) { done = `returned after ${lines} instructions`; break; }
    }
    this.log(`--- trace OFF: ${done} ---`);
  }

  cmdHist(tokens: string[]) {
    const p = this.probe;
    if (!p) throw new Error(`'${this.target.id}' has no trace buffer (needs Probeable)`);
    if (p.idx === 0) { this.out('(no trace buffer data)\n'); return; }
    const maxlines = tokens[1] ? parseNum(tokens[1]) : 20;
    // scan backwards for the start of the last `maxlines` events
    let start = p.idx, count = 0;
    while (start > 0 && count < maxlines) {
      start--;
      const op = p.buf[start] & 0xff000000;
      if (op === ProbeFlags.EXECUTE || op === ProbeFlags.INTERRUPT) count++;
    }
    let shown = 0;
    for (let i = start; i < p.idx && shown < maxlines; i++) {
      const w = p.buf[i];
      const op = w & 0xff000000;
      if (op === ProbeFlags.EXECUTE) { this.out(this.disasmLine(w & 0xffffff, false) + '\n'); shown++; }
      else if (op === ProbeFlags.INTERRUPT) { this.out('  --- INTERRUPT ---\n'); shown++; }
    }
    this.out(`(${shown} instructions shown, ${p.idx} events recorded)\n`);
  }

  cmdKey(tokens: string[]) {
    if (!tokens[1]) throw new Error('key requires a key name');
    const { key, flags } = parseKeyValue(tokens[1]);
    this.target.setKeyInput(key, key, flags | KeyFlags.KeyDown);
    this.advance(3);
    this.target.setKeyInput(key, key, flags | KeyFlags.KeyUp);
    this.advance(1);
    this.log(`pressed ${tokens[1]} ($${hex(key, 2)})`);
  }

  cmdKeyDown(tokens: string[]) { this.keyEvent(tokens, KeyFlags.KeyDown, 'keydown'); }
  cmdKeyUp(tokens: string[]) { this.keyEvent(tokens, KeyFlags.KeyUp, 'keyup'); }

  private keyEvent(tokens: string[], flag: number, name: string) {
    if (!tokens[1]) throw new Error(`${name} requires a key name`);
    const { key, flags } = parseKeyValue(tokens[1]);
    this.target.setKeyInput(key, key, flags | flag);
    this.log(`${name} ${tokens[1]} ($${hex(key, 2)})`);
  }

  cmdMem(tokens: string[]) {
    if (!tokens[1]) throw new Error('mem requires START [LEN]');
    const start = this.addr(tokens[1]);
    const len = tokens[2] ? parseNum(tokens[2]) : 16;
    this.log(`mem $${hex(start, 4)}+$${hex(len, 4)}:`);
    hexdump((a) => this.target.read(a), start, start + len - 1, this.out);
  }

  cmdScreen(tokens: string[]) {
    const start = tokens[1] ? this.addr(tokens[1]) : 0x400;
    const cols = tokens[2] ? parseNum(tokens[2]) : 40;
    const rows = tokens[3] ? parseNum(tokens[3]) : 25;
    this.log(`screen at $${hex(start, 4)} (${cols}x${rows}):`);
    for (let y = 0; y < rows; y++) {
      let line = '';
      for (let x = 0; x < cols; x++) line += screenCodeToChar(this.target.read(start + y * cols + x));
      this.out(`|${line.replace(/\s+$/, '')}|\n`);
    }
  }

  cmdPC(tokens: string[]) {
    this.target.settle();
    const pc = this.target.getPC();
    if (pc == null) throw new Error(`'${this.target.id}' does not report a PC`);
    this.log(`PC=$${hex(pc, 4)}`);
    this.disasmBlock(pc, tokens[1] ? parseNum(tokens[1]) : 8);
  }

  cmdInfo() {
    this.target.settle();
    const sections = this.target.getDebugInfo();
    if (!sections.length) this.out(`(no debug info for '${this.target.id}')\n`);
    for (const { category, text } of sections) {
      this.out(`[${category}]\n${text}${text.endsWith('\n') ? '' : '\n'}`);
    }
    const pc = this.target.getPC();
    if (pc != null && this.target.disassemble(pc)) {
      this.out('[Disassembly]\n');
      this.disasmBlock(pc, 16);
    }
  }

  cmdReset() { this.target.reset(); this.log('reset'); }
  cmdEcho(tokens: string[], line: string) { this.out(line.substring(tokens[0].length).trim() + '\n'); }
}

type Command = (this: RunScript, tokens: string[], line: string) => void;

const COMMANDS: { [name: string]: Command } = {
  'run': RunScript.prototype.cmdRun,
  'wait': RunScript.prototype.cmdRun,
  'frames': RunScript.prototype.cmdRun,
  'step': RunScript.prototype.cmdStep,
  'break': RunScript.prototype.cmdBreak,
  'runto': RunScript.prototype.cmdBreak,
  'trace': RunScript.prototype.cmdTrace,
  'hist': RunScript.prototype.cmdHist,
  'key': RunScript.prototype.cmdKey,
  'press': RunScript.prototype.cmdKey,
  'keydown': RunScript.prototype.cmdKeyDown,
  'keyup': RunScript.prototype.cmdKeyUp,
  'mem': RunScript.prototype.cmdMem,
  'screen': RunScript.prototype.cmdScreen,
  'pc': RunScript.prototype.cmdPC,
  'info': RunScript.prototype.cmdInfo,
  'reset': RunScript.prototype.cmdReset,
  'echo': RunScript.prototype.cmdEcho,
};

/** Parse a cc65/ca65 or VICE label file into a symbol map. */
export function parseSymbolFile(text: string): { [name: string]: number } {
  const symbols: { [name: string]: number } = {};
  for (const line of text.split(/\r?\n/)) {
    const m1 = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*\$?([0-9A-Fa-f]+)\s*;/);            // ca65/cc65 list
    const m2 = line.match(/^\s*(?:al|add_label)\s+([0-9A-Fa-f]+)\s+\.?([A-Za-z_][\w]*)/); // VICE
    if (m1) symbols[m1[1]] = parseInt(m1[2], 16);
    else if (m2) symbols[m2[2]] = parseInt(m2[1], 16);
  }
  return symbols;
}
