"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findLargeVariables = findLargeVariables;
exports.computeMemoryMapLayout = computeMemoryMapLayout;
function segEnd(seg) {
    return seg.start + Math.max(1, seg.size || 0);
}
// Assign each block the first lane free at its start address.
// Blocks that need more than maxLanes are folded into the block they overlap.
function assignLanes(blocks, maxLanes) {
    blocks.sort((a, b) => a.start - b.start || b.end - a.end);
    const laneEnds = [];
    const laneBlocks = [];
    const shown = [];
    for (const b of blocks) {
        let lane = laneEnds.findIndex(e => e <= b.start);
        if (lane < 0 && laneEnds.length < maxLanes)
            lane = laneEnds.length;
        if (lane < 0) {
            // fold into the overlapping block in the last lane
            const host = laneBlocks[maxLanes - 1];
            (host.hidden = host.hidden || []).push(b);
            continue;
        }
        laneEnds[lane] = b.end;
        laneBlocks[lane] = b;
        b.lane = lane;
        shown.push(b);
    }
    return shown;
}
function makeColumn(id, title, blocks, maxLanes) {
    blocks = assignLanes(blocks, maxLanes);
    const lanes = Math.max(1, ...blocks.map(b => b.lane + 1));
    return { id, title, lanes, blocks };
}
// Fill the gaps between blocks (from 'from' up to the last end).
function fillGaps(blocks, from, name, type) {
    const sorted = blocks.slice().sort((a, b) => a.start - b.start);
    const gaps = [];
    let cur = from;
    for (const b of sorted) {
        if (b.start > cur)
            gaps.push({ name, start: cur, end: b.start, type, lane: 0 });
        cur = Math.max(cur, b.end);
    }
    return blocks.concat(gaps);
}
function toBlock(seg) {
    return { name: seg.name, start: seg.start, end: segEnd(seg), type: seg.type, lane: 0 };
}
function isHiddenSymbol(name) {
    return name.startsWith('__') || /^[sl]__/.test(name) || name.startsWith('.');
}
// Find variables in RAM segments. Sizes come from symbolsizes when the
// toolchain reports them; otherwise they are estimated from the gap to the
// next symbol, clamped to the smallest RAM segment that contains the symbol.
// Without a size, the last symbol in a native-only segment is skipped,
// since its extent is unknown.
function findLargeVariables(symbolmap, segments, opts, symbolsizes) {
    var _a, _b;
    const minSize = (_a = opts === null || opts === void 0 ? void 0 : opts.minVarSize) !== null && _a !== void 0 ? _a : 128;
    const maxVars = (_b = opts === null || opts === void 0 ? void 0 : opts.maxVars) !== null && _b !== void 0 ? _b : 64;
    const ramsegs = segments.filter(s => s.type == 'ram' && s.size > 0);
    if (!symbolmap || !ramsegs.length)
        return [];
    const sizeof = (name) => symbolsizes === null || symbolsizes === void 0 ? void 0 : symbolsizes[name];
    const byaddr = new Map();
    for (const [name, addr] of Object.entries(symbolmap)) {
        if (typeof addr !== 'number' || isHiddenSymbol(name))
            continue;
        // prefer a symbol with a known nonzero size (e.g. not a zero-size marker)
        const prev = byaddr.get(addr);
        if (prev == null || (!sizeof(prev) && sizeof(name)))
            byaddr.set(addr, name);
    }
    const addrs = Array.from(byaddr.keys()).sort((a, b) => a - b);
    const vars = [];
    for (let i = 0; i < addrs.length; i++) {
        const addr = addrs[i];
        let seg = null;
        for (const s of ramsegs) {
            if (addr >= s.start && addr < s.start + s.size && (!seg || s.size < seg.size))
                seg = s;
        }
        if (!seg)
            continue;
        const name = byaddr.get(addr);
        const size = sizeof(name);
        if (size != null) {
            if (size >= minSize)
                vars.push({ name, start: addr, end: addr + size, type: 'var', lane: 0 });
            continue;
        }
        const segend = seg.start + seg.size;
        const next = i + 1 < addrs.length ? addrs[i + 1] : Infinity;
        if (next >= segend && seg.source != 'linker')
            continue;
        const end = Math.min(next, segend);
        if (end - addr >= minSize)
            vars.push({ name, start: addr, end, type: 'var', lane: 0, approx: true });
    }
    // keep the largest ones
    vars.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    return vars.slice(0, maxVars);
}
function computeMemoryMapLayout(segments, symbolmap, opts, symbolsizes) {
    var _a;
    segments = segments || [];
    const maxLanes = (_a = opts === null || opts === void 0 ? void 0 : opts.maxLanes) !== null && _a !== void 0 ? _a : 2;
    const columns = [];
    const native = segments.filter(s => s.source == 'native').map(toBlock);
    const linker = segments.filter(s => s.source != 'native').map(toBlock);
    if (native.length) {
        columns.push(makeColumn('native', 'System', fillGaps(native, 0, '', 'unmapped'), maxLanes));
    }
    if (linker.length) {
        const first = Math.min(...linker.map(b => b.start));
        columns.push(makeColumn('linker', 'Segments', fillGaps(linker, first, '', 'free'), maxLanes));
    }
    const vars = findLargeVariables(symbolmap, segments, opts, symbolsizes);
    if (vars.length) {
        columns.push(makeColumn('vars', 'Objects', vars, maxLanes));
    }
    const bset = new Set();
    for (const col of columns)
        for (const b of col.blocks) {
            bset.add(b.start);
            bset.add(b.end);
        }
    const bounds = Array.from(bset).sort((a, b) => a - b);
    return { bounds, columns };
}
//# sourceMappingURL=memmaplayout.js.map