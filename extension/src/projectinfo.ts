
// projectinfo - file and path helpers with no side effects, safe to load in
// the extension host (unlike buildcore, whose worker imports set globals).

import * as fs from 'fs';
import * as path from 'path';
import { TOOL_META } from "../../src/common/toolmeta";

var sourceExtensions: Set<string>;

/** True if some tool consumes files with this name's extension. */
export function isSourceFile(fn: string): boolean {
  if (!sourceExtensions) {
    sourceExtensions = new Set(['.asm', '.a', '.inc', '.h', '.s', '.c', '.bas']);
    for (var id in TOOL_META)
      for (var ext of TOOL_META[id].extensions || [])
        sourceExtensions.add(ext.toLowerCase());
  }
  return sourceExtensions.has(path.extname(fn).toLowerCase());
}

/** The asset root: a directory with src/worker, searched upward from `start`. */
export function findRootDir(start: string): string | null {
  var dir = path.resolve(start);
  for (var i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(dir, 'src', 'worker', 'wasm'))) return dir;
    var parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
