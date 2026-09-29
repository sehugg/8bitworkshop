// A platform's debug tree (getDebugTree(), or saveState()), browsed one level
// at a time by path, for hosts that can't hold the objects themselves (the
// debug adapter, over an RPC). It follows the IDE's Debug Tree view
// (src/ide/views/treeviews.ts): `$$` properties are hidden, an object with a
// `$$` function is expanded by calling it, and big arrays and objects are
// split into chunks. The path is a list of the names this returns, so it
// finds the same node again as long as the tree keeps its shape.

import { hex } from "./util";

export interface TreeEntry {
  name: string;
  /** one line; empty for plain objects */
  value: string;
  /** has children: pass [...path, name] to get them */
  expandable: boolean;
}

const MAX_CHILDREN = 256;
const MAX_STRING_LEN = 100;
// typed array elements per row
const ROW_LEN = 16;
// typed array elements per chunk, at least (a chunk shows as rows)
const CHUNK_LEN = 256;

type TypedArray = Uint8Array | Uint16Array | Uint32Array | Int8Array | Int16Array | Int32Array
  | Uint8ClampedArray | Float32Array | Float64Array;

/** Part of a typed array, keeping its offset so rows can be named by it. */
class Slice {
  constructor(readonly arr: TypedArray, readonly start: number, readonly end: number) { }
}

/** A row of a typed array, already formatted. */
class Row {
  constructor(readonly text: string) { }
}

/** A lazy node: an object whose `$$` function makes its contents. */
function isLazy(obj: any): boolean {
  return obj != null && typeof obj === 'object' && typeof obj.$$ === 'function';
}

function isTypedArray(obj: any): obj is TypedArray {
  return ArrayBuffer.isView(obj) && !(obj instanceof DataView);
}

function hexWidth(arr: TypedArray): number {
  return arr instanceof Float32Array || arr instanceof Float64Array ? 0 : arr.BYTES_PER_ELEMENT * 2;
}

function formatElements(arr: TypedArray, start: number, end: number): string {
  const nd = hexWidth(arr);
  const out: string[] = [];
  for (let i = start; i < end; i++) out.push(nd ? hex(arr[i] >>> 0, nd) : String(arr[i]));
  return out.join(' ');
}

function formatValue(obj: any): string {
  if (obj == null) return String(obj);
  switch (typeof obj) {
    case 'number':
      return Number.isInteger(obj) ? `${obj} ($${hex(obj >>> 0, obj > 0xffff || obj < 0 ? 8 : obj > 0xff ? 4 : 2)})` : String(obj);
    case 'boolean':
    case 'bigint':
      return String(obj);
    case 'string':
      return obj.length < MAX_STRING_LEN ? obj : obj.substring(0, MAX_STRING_LEN) + '...';
    case 'function':
      return 'function';
  }
  if (obj instanceof Row) return obj.text;
  if (obj instanceof Slice) return '';
  if (isTypedArray(obj)) {
    return obj.length <= ROW_LEN ? formatElements(obj, 0, obj.length) : `${obj.constructor.name}(${obj.length})`;
  }
  if (Array.isArray(obj)) return `Array(${obj.length})`;
  if (obj instanceof Map) return `Map(${obj.size})`;
  return '';
}

function isExpandable(obj: any): boolean {
  if (obj == null || typeof obj !== 'object') return false;
  if (isTypedArray(obj)) return obj.length > ROW_LEN;
  return !(obj instanceof Row);
}

/** The children of a node, as [name, value] pairs. */
function children(obj: any): [string, any][] {
  if (isLazy(obj)) obj = obj.$$();
  if (obj == null || typeof obj !== 'object') return [];
  if (isTypedArray(obj)) obj = new Slice(obj, 0, obj.length);
  if (obj instanceof Slice) return sliceChildren(obj);
  if (Array.isArray(obj) && obj.length > MAX_CHILDREN) {
    const arr = obj;
    let len = MAX_CHILDREN;
    while (arr.length / len > MAX_CHILDREN) len *= 2;
    const out: [string, any][] = [];
    for (let ofs = 0; ofs < arr.length; ofs += len) out.push(['$' + hex(ofs), { $$: () => arr.slice(ofs, ofs + len) }]);
    return out;
  }
  let entries: [string, any][] = obj instanceof Map
    ? [...obj.entries()].map(([k, v]) => [String(k), v])
    : (Array.isArray(obj) ? [...obj.keys()].map(String) : Object.getOwnPropertyNames(obj))
      .filter(name => !name.startsWith('$$'))
      .map(name => [name, obj[name]]);
  if (entries.length > MAX_CHILDREN) {
    let len = 100;
    while (entries.length / len > 100) len *= 2;
    const groups: [string, any][] = [];
    for (let ofs = 0; ofs < entries.length; ofs += len) {
      groups.push([`[${ofs}...]`, Object.fromEntries(entries.slice(ofs, ofs + len))]);
    }
    entries = groups;
  }
  return entries;
}

/** Big slices split into chunks; small ones into rows of ROW_LEN elements. */
function sliceChildren(s: Slice): [string, any][] {
  const n = s.end - s.start;
  const out: [string, any][] = [];
  if (n > CHUNK_LEN) {
    let len = CHUNK_LEN;
    while (n / len > MAX_CHILDREN) len *= 2;
    for (let ofs = s.start; ofs < s.end; ofs += len) out.push(['$' + hex(ofs, 4), new Slice(s.arr, ofs, Math.min(ofs + len, s.end))]);
  } else {
    for (let ofs = s.start; ofs < s.end; ofs += ROW_LEN) {
      out.push(['$' + hex(ofs, 4), new Row(formatElements(s.arr, ofs, Math.min(ofs + ROW_LEN, s.end)))]);
    }
  }
  return out;
}

/**
 * The entries under `path` in `root`. Throws if the path no longer leads
 * anywhere (the tree changed shape since it was listed).
 */
export function treeChildren(root: any, path: string[]): TreeEntry[] {
  let node = root;
  for (const name of path) {
    const next = children(node).find(([n]) => n === name);
    if (!next) throw new Error(`no '${name}' in the debug tree at /${path.join('/')}`);
    node = next[1];
  }
  return children(node).map(([name, value]) => ({
    name,
    value: formatValue(value),
    expandable: isExpandable(value),
  }));
}
