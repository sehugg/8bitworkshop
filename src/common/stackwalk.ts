// A call stack from the machine's stack memory, for when all we have is a
// stopped machine: no frame pointers, no debug info about frames, and often
// hand-written assembly. It scans up from the stack pointer for return
// addresses. A value counts as one only if the instruction just before it is
// a call; and one whose call goes to the routine the frame below is in (a
// little before the PC) wins over one that doesn't, which skips most pushed
// data that happens to look like an address.
//
// Interrupts push a return address with no call before it, so a handler's
// frame goes straight to the chain of calls it interrupted, leaving out the
// routine it interrupted.

import type { DisasmLine } from "./baseplatform";

export interface StackWalkTarget {
  /** as in emucore's DISASSEMBLERS */
  arch: string;
  sp: number;
  read(addr: number): number;
  disassemble(addr: number): DisasmLine | null;
  /**
   * True if the program's code is at this address (it has a source line or
   * a symbol). A call that can't be matched to the frame below must be in
   * code to count.
   */
  isCode?(addr: number): boolean;
}

export interface CallFrame {
  /** where this frame is: the PC, or for callers, the call instruction */
  pc: number;
  /** callers: the stack address the return address was found at */
  slot?: number;
  /** callers: false if its call doesn't go to the routine the frame below is in */
  matched?: boolean;
}

interface StackConvention {
  /** the first and last stack addresses to look at */
  range(sp: number): [number, number];
  bigEndian: boolean;
  /** what the CPU pushes, less the return address (6502: one less) */
  pushedOffset: number;
}

// bytes to scan above SP where the stack has no fixed end
const MAX_SCAN = 0x400;
// a call's target is a routine's start, at most this far before the PC in it
const MAX_ROUTINE_BYTES = 0x1000;
// how much further to look for a matching return address, once we have a
// value that's only preceded by a call
const LOOKAHEAD = 32;
// longest call instruction, in bytes
const MAX_CALL_BYTES = 4;
// as debugcontroller's isCallInsn, for disassemblers that don't set iscall
const CALL_INSN = /^(JSR|JSL|CALL|BSR|LBSR|RST)\b/i;

const WORD_STACK: StackConvention = {
  range: sp => [sp & 0xffff, Math.min((sp & 0xffff) + MAX_SCAN, 0xfffe)],
  bigEndian: false,
  pushedOffset: 0,
};

const CONVENTIONS: { [arch: string]: StackConvention } = {
  // page 1; SP points below the last byte pushed; JSR pushes its last byte
  '6502': { range: sp => [0x100 + ((sp + 1) & 0xff), 0x1fe], bigEndian: false, pushedOffset: -1 },
  'z80': WORD_STACK,
  'sm83': WORD_STACK,
  'gbz80': WORD_STACK,
};

/** True if this CPU's stack can be walked. */
export function canWalkStack(arch: string): boolean {
  return !!CONVENTIONS[arch];
}

/** The address a call instruction goes to, if it names one. */
function callTarget(d: DisasmLine): number | null {
  const rst = /^RST\s+\$?([0-9A-F]+)H?\b/i.exec(d.line.trim());
  if (rst) return parseInt(rst[1], 16);
  const abs = /\$([0-9A-F]{3,4})\b/i.exec(d.line);
  return abs ? parseInt(abs[1], 16) : null;
}

/**
 * Frames from the innermost (the PC) out, up to `maxFrames`. Callers are
 * only as good as the heuristic: see the top of this file.
 */
export function walkStack(t: StackWalkTarget, pc: number, maxFrames = 64): CallFrame[] {
  const frames: CallFrame[] = [{ pc }];
  const conv = CONVENTIONS[t.arch];
  if (!conv) return frames;
  const [first, last] = conv.range(t.sp);
  const word = (a: number) => {
    const lo = t.read(a) & 0xff, hi = t.read(a + 1) & 0xff;
    return conv.bigEndian ? (lo << 8) | hi : (hi << 8) | lo;
  };
  /** The call before a return address, if there is one. */
  const callBefore = (ret: number): { pc: number, target: number | null } | null => {
    for (let n = 1; n <= MAX_CALL_BYTES; n++) {
      const d = t.disassemble((ret - n) & 0xffff);
      if (d && d.nbytes === n && (d.iscall || CALL_INSN.test(d.line.trim()))) return { pc: (ret - n) & 0xffff, target: callTarget(d) };
    }
    return null;
  };
  let cur = pc;
  let slot = first;
  while (frames.length < maxFrames && slot <= last) {
    let weak: CallFrame | null = null;
    let found: CallFrame | null = null;
    for (let a = slot; a <= last && (!weak || a <= weak.slot + LOOKAHEAD); a++) {
      const call = callBefore((word(a) - conv.pushedOffset) & 0xffff);
      if (!call) continue;
      const matched = call.target != null && cur >= call.target && cur - call.target <= MAX_ROUTINE_BYTES;
      const frame = { pc: call.pc, slot: a, matched };
      if (matched) { found = frame; break; }
      // an indirect call (or a RST to a trampoline) can't be checked
      if (!weak && (!t.isCode || t.isCode(call.pc))) weak = frame;
    }
    found = found || weak;
    if (!found) break;
    frames.push(found);
    cur = found.pc;
    slot = found.slot + 2;
  }
  return frames;
}
