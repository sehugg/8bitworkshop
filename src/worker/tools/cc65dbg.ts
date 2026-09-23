// Parser for the ld65 debug info file (--dbgfile).
// Each record is "<type>\t<key>=<value>,..." e.g.
//   seg   id=2,name="BSS",start=0x00032A,size=0x0136,...
//   span  id=2146,seg=2,start=32,size=48
//   line  id=3477,file=0,line=2273,span=2146
//   sym   id=313,name="_attackers",...,val=0x34A,seg=2,type=lab

type DbgRecord = { [key: string]: string };

function parseRecord(text: string): DbgRecord {
    const rec: DbgRecord = {};
    const re = /(\w+)=("[^"]*"|[^,]*)/g;
    let m;
    while (m = re.exec(text)) {
        rec[m[1]] = m[2].startsWith('"') ? m[2].slice(1, -1) : m[2];
    }
    return rec;
}

function num(s: string): number {
    return s == null ? NaN : Number(s); // handles 0x prefix
}

export interface CC65DbgSymbols {
    sizes: { [sym: string]: number };
    ignored: string[];  // labels defined in ignored segments
}

/**
 * Returns the size in bytes of each label in the debug file.
 * Uses the label's own size when ca65 records one (e.g. .proc scopes);
 * otherwise sums the consecutive line spans that follow the label, up to
 * the next label or a gap. Names defined more than once are omitted.
 * Labels in ignoreSegments (e.g. NES CHR data) are listed in 'ignored'.
 */
export function parseCC65DbgSizes(dbg: string, ignoreSegments?: string[]): CC65DbgSymbols {
    const segstart = new Map<string, number>();
    const ignoredsegs = new Set<string>();
    const ignored: string[] = [];
    const spans = new Map<string, { seg: string, start: number, size: number }>();
    const linespans = new Set<string>();
    const syms: DbgRecord[] = [];
    for (const line of dbg.split('\n')) {
        const tab = line.indexOf('\t');
        if (tab < 0) continue;
        const type = line.substring(0, tab);
        if (type != 'seg' && type != 'span' && type != 'line' && type != 'sym') continue;
        const rec = parseRecord(line.substring(tab + 1));
        switch (type) {
            case 'seg':
                segstart.set(rec.id, num(rec.start));
                if (ignoreSegments?.includes(rec.name)) ignoredsegs.add(rec.id);
                break;
            case 'span': spans.set(rec.id, { seg: rec.seg, start: num(rec.start), size: num(rec.size) }); break;
            case 'line': if (rec.span) rec.span.split('+').forEach(id => linespans.add(id)); break;
            case 'sym':
                if (rec.type != 'lab' || rec.seg == null || rec.val == null) break;
                if (ignoredsegs.has(rec.seg)) ignored.push(rec.name);
                else syms.push(rec);
                break;
        }
    }
    // span size by segment offset, from line spans only (scope spans cover whole ranges)
    const spanat = new Map<string, Map<number, number>>();
    for (const [id, span] of spans) {
        if (!linespans.has(id) || !(span.size > 0)) continue;
        let segmap = spanat.get(span.seg);
        if (!segmap) spanat.set(span.seg, segmap = new Map());
        segmap.set(span.start, Math.max(span.size, segmap.get(span.start) || 0));
    }
    // label offsets by segment, to stop at the next label
    const labelat = new Map<string, Set<number>>();
    for (const sym of syms) {
        const ofs = num(sym.val) - segstart.get(sym.seg);
        let set = labelat.get(sym.seg);
        if (!set) labelat.set(sym.seg, set = new Set());
        set.add(ofs);
    }
    const sizes: { [sym: string]: number } = {};
    const dups = new Set<string>();
    for (const sym of syms) {
        if (sym.name in sizes) { dups.add(sym.name); continue; }
        let size = num(sym.size);
        if (isNaN(size)) {
            const segmap = spanat.get(sym.seg);
            const labels = labelat.get(sym.seg);
            const ofs = num(sym.val) - segstart.get(sym.seg);
            let cur = ofs;
            let n: number;
            while (segmap && (n = segmap.get(cur)) > 0) {
                cur += n;
                if (labels.has(cur)) break;
            }
            size = cur - ofs;
        }
        sizes[sym.name] = size;
    }
    for (const name of dups) delete sizes[name];
    // unknown sizes (no spans) are left out
    for (const name in sizes) if (!(sizes[name] > 0)) delete sizes[name];
    return { sizes, ignored };
}
