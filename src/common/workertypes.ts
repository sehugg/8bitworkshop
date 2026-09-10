
export type FileData = string | Uint8Array;

export interface SourceLocation {
  line: number;
  label?: string;
  path?: string; // TODO: make mandatory?
  start?: number;
  end?: number;
  segment?:string;
  func?:string;
}

// actually it's a kind of SourceSnippet .. can have multiple per line
export interface SourceLine extends SourceLocation {
  offset:number;
  insns?:string;
  iscode?:boolean;
  cycles?:number;
}

// objects that have source code position info
export interface SourceLocated {
  $loc?: SourceLocation;
}
// statements also have the 'offset' (pc) field from SourceLine
export interface SourceLineLocated {
  $loc?: SourceLine;
}

export class SourceFile {
  lines: SourceLine[];
  text: string;
  offset2loc: Map<number,SourceLine>; //{[offset:number]:number};
  line2offset: Map<number,number>; //{[line:number]:number};
  sortedOffsets: number[];
  
  constructor(lines:SourceLine[], text:string) {
    lines = lines || [];
    this.lines = lines;
    this.text = text;
    this.offset2loc = new Map();
    this.line2offset = new Map();
    for (var info of lines) {
      if (info.offset >= 0) {
        // first line wins (is assigned to offset)
        // TODO: handle macros/includes w/ multiple offsets per line
        if (!this.offset2loc.has(info.offset))
          this.offset2loc.set(info.offset, info);
        if (!this.line2offset.has(info.line))
          this.line2offset.set(info.line, info.offset);
      }
    }
    this.sortedOffsets = Array.from(this.offset2loc.keys()).sort((a,b)=>a-b);
  }
  // returns the line whose offset is nearest to (but not greater than) PC,
  // provided it is within `lookbehind` bytes; null otherwise
  findLineForOffset(PC:number, lookbehind:number) : SourceLine {
    const offsets = this.sortedOffsets;
    // binary search for last offset <= PC
    var lo = 0, hi = offsets.length-1, ans = -1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (offsets[mid] <= PC) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (ans < 0) return null;
    var off = offsets[ans];
    if (PC - off > lookbehind) return null;
    return this.offset2loc.get(off);
  }
  lineCount():number { return this.lines.length; }
}

export interface Dependency {
  path:string
  filename:string
  link:boolean
  data:FileData // TODO: or binary?
}

export interface WorkerFileUpdate {
  path:string
  data:FileData
};
export interface WorkerBuildStep {
  path?:string
  files?:string[]
  platform:string
  tool:string
  mainfile?:boolean
};
export interface WorkerItemUpdate {
  key:string
  value:object
};

// TODO: split into different msg types
export interface WorkerMessage {
  preload?:string
  /** preload a filesystem package directly by name (e.g. '65-nes') */
  preload_fs?:string
  /** read a file from the preloaded filesystem package (path e.g. '/include/nes.h')
   *  requires preload_fs; result comes back as {output:Uint8Array} */
  readshared?:string
  /** list files under a directory of the preloaded filesystem package
   *  requires preload_fs; result comes back as {output:string[]} */
  listshared?:string
  /** echo tag for ad-hoc queries (queryWorker); copied to the response */
  qid?:number
  platform?:string
  tool?:string
  updates:WorkerFileUpdate[]
  buildsteps:WorkerBuildStep[]
  reset?:boolean
  code?:string
  setitems?:WorkerItemUpdate[]
}

export interface WorkerError extends SourceLocation {
  msg:string,
}

export interface CodeListing {
  lines:SourceLine[]
  asmlines?:SourceLine[]
  text?:string
  sourcefile?:SourceFile   // not returned by worker
  assemblyfile?:SourceFile  // not returned by worker
}

export type CodeListingMap = {[path:string]:CodeListing};

// TODO
export type VerilogOutput =
  {program_rom_variable:string, program_rom:Uint8Array, code:string, name:string, ports:any[], signals:any[]};

export type Segment = {
  name:string,
  start:number,
  size:number,
  last?:number,
  type?:string,
  source?:'native'|'linker'
};

export type WorkerResult = WorkerErrorResult | WorkerOutputResult<any> | WorkerUnchangedResult;

export interface WorkerUnchangedResult {
  unchanged: true;
}

export interface WorkerErrorResult {
  errors: WorkerError[]
  listings?: CodeListingMap
  uppercaseOnly?: boolean
}

export interface WorkerOutputResult<T> {
  output: T
  listings?: CodeListingMap
  symbolmap?: {[sym:string]:number}
  params?: {}
  segments?: Segment[]
  debuginfo?: {} // optional info
  uppercaseOnly?: boolean
  origin?: number
}

export function isUnchanged(result: WorkerResult) : result is WorkerUnchangedResult {
  return ('unchanged' in result);
}

export function isErrorResult(result: WorkerResult) : result is WorkerErrorResult {
  return ('errors' in result);
}

export function isOutputResult(result: WorkerResult) : result is WorkerOutputResult<any> {
  return ('output' in result);
}

export interface WorkingStore {
  getFileData(path:string) : FileData;
}
