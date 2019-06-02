
export type FileData = string | Uint8Array;

export interface SourceLine {
  offset:number;
  line:number;
  insns?:string;
  iscode?:boolean;
}

export class SourceFile {
  lines: SourceLine[];
  text: string;
  offset2line: Map<number,number>; //{[offset:number]:number};
  line2offset: Map<number,number>; //{[line:number]:number};
  
  constructor(lines:SourceLine[], text?:string) {
    lines = lines || [];
    this.lines = lines;
    this.text = text;
    this.offset2line = new Map();
    this.line2offset = new Map();
    for (var info of lines) {
      if (info.offset >= 0) {
        this.offset2line[info.offset] = info.line;
        this.line2offset[info.line] = info.offset;
      }
    }
  }
  findLineForOffset(PC:number, lookbehind:number):number {
    if (this.offset2line) {
      for (var i=0; i<=lookbehind; i++) {
        var line = this.offset2line[PC];
        if (line >= 0) {
          //console.log(this.lines.length, PC.toString(16), line);
          return line;
        }
        PC--;
      }
    }
    return null;
  }
  lineCount():number { return this.lines.length; }
}

export interface Dependency {
  path:string,
  filename:string,
  link:boolean,
  data:FileData // TODO: or binary?
}

export interface WorkerFileUpdate {
  path:string,
  data:FileData
};
export interface WorkerBuildStep {
  path?:string
  platform:string
  tool:string
  mainfile?:boolean
};

export interface WorkerMessage extends WorkerBuildStep {
  preload:string,
  reset:boolean,
  code:string,
  updates:WorkerFileUpdate[],
  buildsteps:WorkerBuildStep[]
}

export interface WorkerError {
  line:number,
  msg:string,
  path?:string
  //TODO
}

export interface CodeListing {
  lines:SourceLine[],
  asmlines:SourceLine[],
  text:string,
  sourcefile?:SourceFile,
  assemblyfile?:SourceFile
}

export type CodeListingMap = {[path:string]:CodeListing};

// TODO
export type VerilogOutput =
  {program_rom_variable:string, program_rom:Uint8Array, code:string, name:string, ports:any[], signals:any[]};

export type WorkerOutput = Uint8Array | VerilogOutput;

export type Segment = {name:string, start:number, size:number, last?:number, type?:string};

export interface WorkerResult {
  output:WorkerOutput,
  errors:WorkerError[],
  listings:CodeListingMap,
  symbolmap:{[sym:string]:number},
  params:{},
  segments?:Segment[],
  unchanged?:boolean,
}

