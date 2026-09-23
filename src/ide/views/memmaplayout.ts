import { Segment } from "../../common/workertypes";

// Layout for the Memory Map view: native, linker and variable columns
// aligned on a shared address axis.

export type MemMapColumnId = 'native' | 'linker' | 'vars';

export interface MemMapBlock {
  name: string;
  start: number;
  end: number;        // exclusive
  type?: string;      // rom, ram, io, unmapped, free, var
  lane: number;       // sub-column for overlapping blocks
  approx?: boolean;   // size is estimated
  hidden?: MemMapBlock[]; // overlapping blocks that did not fit in a lane
}

export interface MemMapColumn {
  id: MemMapColumnId;
  title: string;
  lanes: number;
  blocks: MemMapBlock[];
}

export interface MemMapLayout {
  bounds: number[];   // sorted row boundaries; row i spans bounds[i]..bounds[i+1]
  columns: MemMapColumn[];
}

export interface MemMapOptions {
  minVarSize?: number;
  maxVars?: number;
  maxLanes?: number;
}

function segEnd(seg: Segment) {
  return seg.start + Math.max(1, seg.size || 0);
}

// Assign each block the first lane free at its start address.
// Blocks that need more than maxLanes are folded into the block they overlap.
function assignLanes(blocks: MemMapBlock[], maxLanes: number): MemMapBlock[] {
  blocks.sort((a, b) => a.start - b.start || b.end - a.end);
  const laneEnds: number[] = [];
  const laneBlocks: MemMapBlock[] = [];
  const shown: MemMapBlock[] = [];
  for (const b of blocks) {
    let lane = laneEnds.findIndex(e => e <= b.start);
    if (lane < 0 && laneEnds.length < maxLanes) lane = laneEnds.length;
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

function makeColumn(id: MemMapColumnId, title: string, blocks: MemMapBlock[], maxLanes: number): MemMapColumn {
  blocks = assignLanes(blocks, maxLanes);
  const lanes = Math.max(1, ...blocks.map(b => b.lane + 1));
  return { id, title, lanes, blocks };
}

// Fill the gaps between blocks (from 'from' up to the last end).
function fillGaps(blocks: MemMapBlock[], from: number, name: string, type: string): MemMapBlock[] {
  const sorted = blocks.slice().sort((a, b) => a.start - b.start);
  const gaps: MemMapBlock[] = [];
  let cur = from;
  for (const b of sorted) {
    if (b.start > cur) gaps.push({ name, start: cur, end: b.start, type, lane: 0 });
    cur = Math.max(cur, b.end);
  }
  return blocks.concat(gaps);
}

function toBlock(seg: Segment): MemMapBlock {
  return { name: seg.name, start: seg.start, end: segEnd(seg), type: seg.type, lane: 0 };
}

function isHiddenSymbol(name: string) {
  return name.startsWith('__') || /^[sl]__/.test(name) || name.startsWith('.');
}

// Find variables in RAM segments. Sizes come from symbolsizes when the
// toolchain reports them; otherwise they are estimated from the gap to the
// next symbol, clamped to the smallest RAM segment that contains the symbol.
// Without a size, the last symbol in a native-only segment is skipped,
// since its extent is unknown.
export function findLargeVariables(symbolmap: { [sym: string]: number }, segments: Segment[], opts?: MemMapOptions,
  symbolsizes?: { [sym: string]: number }): MemMapBlock[] {
  const minSize = opts?.minVarSize ?? 16;
  const maxVars = opts?.maxVars ?? 64;
  const ramsegs = segments.filter(s => s.type == 'ram' && s.size > 0);
  if (!symbolmap || !ramsegs.length) return [];
  const sizeof = (name: string) => symbolsizes?.[name];
  const byaddr = new Map<number, string>();
  for (const [name, addr] of Object.entries(symbolmap)) {
    if (typeof addr !== 'number' || isHiddenSymbol(name)) continue;
    // prefer a symbol with a known nonzero size (e.g. not a zero-size marker)
    const prev = byaddr.get(addr);
    if (prev == null || (!sizeof(prev) && sizeof(name))) byaddr.set(addr, name);
  }
  const addrs = Array.from(byaddr.keys()).sort((a, b) => a - b);
  const vars: MemMapBlock[] = [];
  for (let i = 0; i < addrs.length; i++) {
    const addr = addrs[i];
    let seg: Segment = null;
    for (const s of ramsegs) {
      if (addr >= s.start && addr < s.start + s.size && (!seg || s.size < seg.size)) seg = s;
    }
    if (!seg) continue;
    const name = byaddr.get(addr);
    const size = sizeof(name);
    if (size != null) {
      if (size >= minSize)
        vars.push({ name, start: addr, end: addr + size, type: 'var', lane: 0 });
      continue;
    }
    const segend = seg.start + seg.size;
    const next = i + 1 < addrs.length ? addrs[i + 1] : Infinity;
    if (next >= segend && seg.source != 'linker') continue;
    const end = Math.min(next, segend);
    if (end - addr >= minSize)
      vars.push({ name, start: addr, end, type: 'var', lane: 0, approx: true });
  }
  // keep the largest ones
  vars.sort((a, b) => (b.end - b.start) - (a.end - a.start));
  return vars.slice(0, maxVars);
}

export function computeMemoryMapLayout(segments: Segment[], symbolmap?: { [sym: string]: number }, opts?: MemMapOptions,
  symbolsizes?: { [sym: string]: number }): MemMapLayout {
  segments = segments || [];
  const maxLanes = opts?.maxLanes ?? 2;
  const columns: MemMapColumn[] = [];
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
    columns.push(makeColumn('vars', 'Variables', vars, maxLanes));
  }
  const bset = new Set<number>();
  for (const col of columns)
    for (const b of col.blocks) { bset.add(b.start); bset.add(b.end); }
  const bounds = Array.from(bset).sort((a, b) => a - b);
  return { bounds, columns };
}
