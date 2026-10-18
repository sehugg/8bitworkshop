"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeDumpLines = computeDumpLines;
/**
 * Splits memory into dump lines labeled by symbol.
 *
 * A symbol with a known size labels exactly its bytes. A symbol without one
 * labels up to the next symbol, or up to the end of its segment, so it does
 * not spill across a segment boundary. Rows after the label's range are left
 * unlabeled. Lines after the first in a range start on a 16-byte boundary.
 */
function computeDumpLines(addr2symbol, symbolsizes, segments, ignore, maxLines = 0x10000) {
    const lines = [];
    let ofs = 0;
    let sym;
    let symaddr = 0;
    const endOfSegment = (addr) => {
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
            const label = (ignore === null || ignore === void 0 ? void 0 : ignore(sym)) ? '' : sym;
            const size = symbolsizes === null || symbolsizes === void 0 ? void 0 : symbolsizes[sym];
            // a segment boundary only ends an unsized symbol; a size is authoritative
            let symend = size != null ? symaddr + size : endOfSegment(symaddr);
            symend = Math.min(symend, nextofs);
            while (ofs < nextofs && lines.length < maxLines) {
                // don't label the gap before the first symbol
                const inLabel = ofs >= symaddr && ofs < symend;
                let ofs2 = (ofs + 16) & 0xffff0;
                if (inLabel)
                    ofs2 = Math.min(ofs2, symend);
                else if (ofs < symaddr)
                    ofs2 = Math.min(ofs2, symaddr);
                if (ofs2 > nextofs)
                    ofs2 = nextofs;
                lines.push({ a: ofs, l: ofs2 - ofs, s: inLabel ? label : '' });
                ofs = ofs2;
            }
        }
        sym = nextsym;
        symaddr = nextofs;
    }
    return lines;
}
//# sourceMappingURL=dumplines.js.map