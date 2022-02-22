
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

export class SourceFile {
  lines: SourceLine[];
  text: string;
  offset2loc: Map<number,SourceLine>; //{[offset:number]:number};
  line2offset: Map<number,number>; //{[line:number]:number};
  
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
        if (!this.offset2loc[info.offset])
          this.offset2loc[info.offset] = info;
        if (!this.line2offset[info.line])
          this.line2offset[info.line] = info.offset;
      }
    }
  }
  // TODO: smarter about looking for source lines between two addresses
  findLineForOffset(PC:number, lookbehind:number) {
    if (this.offset2loc) {
      for (var i=0; i<=lookbehind; i++) {
        var loc = this.offset2loc[PC];
        if (loc) {
          return loc;
        }
        PC--;
      }
    }
    return null;
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

export type Segment = {name:string, start:number, size:number, last?:number, type?:string};

export type WorkerResult = WorkerErrorResult | WorkerOutputResult<any> | WorkerUnchangedResult;

export interface WorkerUnchangedResult {
  unchanged: true;
}

export interface WorkerErrorResult {
  errors: WorkerError[]
  listings?: CodeListingMap
}

export interface WorkerOutputResult<T> {
  output: T
  listings?: CodeListingMap
  symbolmap?: {[sym:string]:number}
  params?: {}
  segments?: Segment[]
  debuginfo?: {} // optional info
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
