// A stable hash over an emulator state, for detecting divergence between a
// live run and a replay of it. Save states are a grab bag of plain objects,
// typed arrays, numbers and (on vcs) base64 strings, so the walk has to cope
// with all of them and, above all, be order-independent for object keys --
// two states that differ only in key insertion order are the same state.

function fnv(h: number, byte: number): number {
  return Math.imul(h ^ (byte & 0xff), 0x01000193) >>> 0;
}

const scratch = new DataView(new ArrayBuffer(8));

function hashNumber(h: number, v: number): number {
  scratch.setFloat64(0, v);
  for (var i = 0; i < 8; i++) h = fnv(h, scratch.getUint8(i));
  return h;
}

function hashString(h: number, s: string): number {
  for (var i = 0; i < s.length; i++) {
    h = fnv(h, s.charCodeAt(i));
    h = fnv(h, s.charCodeAt(i) >> 8);
  }
  return h;
}

function hashValue(h: number, v: any, path: Set<object>): number {
  if (v == null) return fnv(h, v === null ? 1 : 2);
  switch (typeof v) {
    case 'number': return hashNumber(fnv(h, 3), v);
    case 'boolean': return fnv(fnv(h, 4), v ? 1 : 0);
    case 'string': return hashString(fnv(h, 5), v);
    case 'function': return fnv(h, 6);           // not state
  }
  if (ArrayBuffer.isView(v)) {
    const bytes = new Uint8Array((v as any).buffer, (v as any).byteOffset, (v as any).byteLength);
    h = fnv(h, 7);
    h = hashNumber(h, bytes.length);
    for (var i = 0; i < bytes.length; i++) h = fnv(h, bytes[i]);
    return h;
  }
  // Emulator states are graphs, not trees -- jsnes's mapper points back at the
  // machine. Only cycles are collapsed, by tracking the current path; a shared
  // subtree reachable twice is hashed twice. Recording object *identity*
  // instead would make two states with identical contents hash differently
  // just because loadState() rebuilt an array that used to be shared, which is
  // divergence that isn't there. A depth cutoff is worse still: where it bites
  // depends on where the walk started.
  if (path.has(v)) return fnv(h, 10);
  path.add(v);
  if (Array.isArray(v)) {
    h = fnv(h, 8);
    h = hashNumber(h, v.length);
    for (var i = 0; i < v.length; i++) h = hashValue(h, v[i], path);
  } else {
    h = fnv(h, 9);
    for (const k of Object.keys(v).sort()) {
      h = hashString(h, k);
      h = hashValue(h, v[k], path);
    }
  }
  path.delete(v);
  return h;
}

/** FNV-1a over the whole state graph. Equal hashes mean equal states. */
export function hashState(state: any): number {
  return hashValue(0x811c9dc5, state, new Set());
}

/**
 * Rough bytes held by a state, for budgeting checkpoints. Typed arrays count
 * their byteLength; an object reachable twice (or through a cycle) counts
 * once, since it is held once. Views on the same buffer each count, which
 * overestimates, but states rarely share buffers that way.
 */
export function stateSize(state: any): number {
  const seen = new Set<object>();
  const walk = (v: any): number => {
    if (v == null) return 0;
    switch (typeof v) {
      case 'number': return 8;
      case 'boolean': return 4;
      case 'string': return 2 * v.length;
      case 'object': break;
      default: return 0;
    }
    if (seen.has(v)) return 0;
    seen.add(v);
    if (ArrayBuffer.isView(v)) return v.byteLength;
    if (v instanceof ArrayBuffer) return v.byteLength;
    var n = 0;
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) n += walk(v[i]);
    } else {
      for (const k of Object.keys(v)) n += walk(v[k]);
    }
    return n;
  };
  return walk(state);
}
