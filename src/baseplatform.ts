
export interface OpcodeMetadata {
  minCycles: number;
  // TODO
}

export interface Platform {
  start() : void;
  reset() : void;
  isRunning() : boolean;
  getToolForFilename(s:string) : string;
  getDefaultExtension() : string;
  getPresets() : Preset[];
  pause() : void;
  resume() : void;
  loadROM(title:string, rom:Uint8Array);
  
  inspect?(ident:string) : void;
  disassemble?(addr:number, readfn:(addr:number)=>number) : any; // TODO
  readAddress?(addr:number) : number;
  setFrameRate?(fps:number) : void;
  getFrameRate?() : number;
  cpuStateToLongString?(state) : string;
  ramStateToLongString?(state) : string;
  getRasterPosition() : {x:number, y:number};
  setupDebug?(debugfn : (state)=>void) : void;
  clearDebug?() : void;
  step?() : void;
  runToVsync?() : void;
  runToPC?(pc:number) : void;
  runUntilReturn?() : void;
  stepBack?() : void;
  //TODO runEval?(evalfn : (cpustate) => boolean) : void;
  runEval?(evalfn : Function) : void;
  
  getOpcodeMetadata?(opcode:number, offset:number) : OpcodeMetadata; //TODO
  saveState?() : any; // TODO
  getDebugCallback?() : any; // TODO
  getSP?() : number;
}

export interface Preset {
  id : string;
  name : string;
  chapter? : number;
  title? : string;
}

