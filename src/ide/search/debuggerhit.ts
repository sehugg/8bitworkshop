/**
 * DebuggerHit - resolves search queries with no source hits as runtime
 * symbols / hex addresses, and builds synthetic search hits that jump to
 * them in the Disassembly (code segments) or Memory Browser (everything else).
 *
 * Kept free of DOM / ui.ts dependencies so it can be unit tested.
 */

import { SymbolRecord } from "../../common/searchtypes";
import { Segment } from "../../common/workertypes";
import { SearchHit } from "./types";

export type SymbolMap = { [sym: string]: number };

export interface DebuggerTarget {
  addr: number;
  isSymbol: boolean;  // resolved from the symbol map (vs. raw hex input)
}

/**
 * Resolve a needle as a runtime symbol (exact match first, then
 * case-insensitive) or a hex address ("$1234", "0x1234", "1234" -- bare
 * digits are parsed as hex, like the listings).
 * Returns null if it's neither.
 */
export function resolveDebuggerTarget(needle: string, symbolmap?: SymbolMap): DebuggerTarget | null {
  needle = needle.trim();
  if (!needle) return null;
  if (symbolmap) {
    if (needle in symbolmap) return { addr: symbolmap[needle], isSymbol: true };
    const ls = needle.toLowerCase();
    for (var sym in symbolmap) {
      if (sym.toLowerCase() === ls) return { addr: symbolmap[sym], isSymbol: true };
    }
  }
  if (/^(0x|\$)[0-9a-f]+$/i.test(needle)) return { addr: parseInt(needle.replace(/^(0x|\$)/i, ''), 16), isSymbol: false };
  if (/^[0-9a-f]+$/i.test(needle)) return { addr: parseInt(needle, 16), isSymbol: false };
  return null;
}

/** Find the segment containing an address, if the memory map has one. */
export function findSegmentAt(addr: number, segments?: Segment[]): Segment | null {
  for (const seg of segments || []) {
    const end = seg.last != null ? seg.last : seg.start + seg.size - 1;
    if (addr >= seg.start && addr <= end) return seg;
  }
  return null;
}

/**
 * Build the synthetic search hit for a resolved symbol/address.
 * 'rom' segments are treated as code (open in the Disassembler, kind=label);
 * anything else as data (open in the Memory Browser, kind=var).
 */
export function makeDebuggerHit(needle: string, target: DebuggerTarget, segments?: Segment[]): SearchHit {
  const seg = findSegmentAt(target.addr, segments);
  const isCode = seg?.type === 'rom';
  const rec: SymbolRecord = {
    id: 'debugger:' + needle.toLowerCase(),
    name: needle,
    kind: isCode ? 'label' : 'var',
    brief: isCode ? 'open in Disassembly' : 'open in Memory Browser',
    source: 'debugger',
    file: '',
    addr: target.addr,
  };
  return { record: rec, score: 500 };
}

/**
 * Whether to offer the debugger hit alongside regular search results:
 * exact symbol matches are always offered (below source hits);
 * raw hex addresses are only offered when there are no other hits
 * (a query like "add" is valid hex and shouldn't add noise).
 */
export function shouldOfferDebuggerHit(target: DebuggerTarget, hasOtherHits: boolean): boolean {
  return target.isSymbol || !hasOtherHits;
}
