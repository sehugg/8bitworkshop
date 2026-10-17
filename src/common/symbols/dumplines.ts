import type { AddrSymbolMap, SymbolMap } from "../baseplatform";
import type { Segment } from "../workertypes";

/** One line of a memory-browser dump: `l` bytes at `a`, labeled `s`. */
export interface DumpLine {
  a: number;
  l: number;
  s: string;
}

/**
 * Splits memory into dump lines labeled by symbol.
 *
 * A symbol with a known size labels exactly its bytes. A symbol without one
 * labels up to the next symbol, or up to the end of its segment, so it does
 * not spill across a segment boundary. Rows after the label's range are left
 * unlabeled. Lines after the first in a range start on a 16-byte boundary.
 */
export function computeDumpLines(addr2symbol: AddrSymbolMap, symbolsizes?: SymbolMap, segments?: Segment[],
  ignore?: (sym: string) => boolean, maxLines = 0x10000): DumpLine[] {
  const lines: DumpLine[] = [];
  let ofs = 0;
  let sym: string;
  let symaddr = 0;
  const endOfSegment = (addr: number) => {
    let end = Infinity;
    for (const seg of segments || [])
      if (addr >= seg.start && addr < seg.start + seg.size)
        end = Math.min(end, seg.start + seg.size);
    return end;
  };
  for (const _nextofs of Object.keys(addr2symbol)) {
    const nextofs = parseInt(_nextofs);
    const nextsym = addr2symbol[nextofs];
    if (sym) {
      const label = ignore?.(sym) ? '' : sym;
      const size = symbolsizes?.[sym];
      // a segment boundary only ends an unsized symbol; a size is authoritative
      let symend = size != null ? symaddr + size : endOfSegment(symaddr);
      symend = Math.min(symend, nextofs);
      while (ofs < nextofs && lines.length < maxLines) {
        // don't label the gap before the first symbol
        const inLabel = ofs >= symaddr && ofs < symend;
        let ofs2 = (ofs + 16) & 0xffff0;
        if (inLabel) ofs2 = Math.min(ofs2, symend);
        else if (ofs < symaddr) ofs2 = Math.min(ofs2, symaddr);
        if (ofs2 > nextofs) ofs2 = nextofs;
        lines.push({ a: ofs, l: ofs2 - ofs, s: inLabel ? label : '' });
        ofs = ofs2;
      }
    }
    sym = nextsym;
    symaddr = nextofs;
  }
  return lines;
}
