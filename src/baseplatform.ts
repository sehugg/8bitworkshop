
export interface OpcodeMetadata {
  minCycles: number;
  maxCycles: number;
  insnLength: number;
}

interface CpuState {
  PC:number, T?:number, o?:number/*opcode*/,
  /*
  A:number, X:number, Y:number, SP:number, R:boolean, 
  N,V,D,Z,C:boolean*/
};
interface EmuState {c:CpuState};
type DisasmLine = {line:string, nbytes:number};

export interface Platform {
  start() : void;
  reset() : void;
  isRunning() : boolean;
  getToolForFilename(s:string) : string;
  getDefaultExtension() : string;
  getPresets() : Preset[];
  pause() : void;
  resume() : void;
  loadROM(title:string, rom:any); // TODO: Uint8Array
  
  inspect?(ident:string) : void;
  disassemble?(addr:number, readfn:(addr:number)=>number) : DisasmLine;
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
  runEval?(evalfunc/* : DebugEvalCondition*/) : void;
  
  getOpcodeMetadata?(opcode:number, offset:number) : OpcodeMetadata; //TODO
  loadState?(state : EmuState) : void;
  saveState?() : EmuState;
  getDebugCallback?() : any; // TODO
  getSP?() : number;
}

export interface Preset {
  id : string;
  name : string;
  chapter? : number;
  title? : string;
}

export interface MemoryBus {
  read : (address:number) => number;
  write : (address:number, value:number) => void;
}

type DebugCondition = () => boolean;
type DebugEvalCondition = (c:CpuState) => boolean;
type BreakpointCallback = (EmuState) => void;

/////

abstract class BaseDebugPlatform {
  onBreakpointHit : BreakpointCallback;
  debugCondition : DebugCondition;
  debugSavedState : EmuState = null;
  debugBreakState : EmuState = null;
  debugTargetClock : number = 0;
  debugClock : number = 0;

  abstract getCPUState() : CpuState;
  abstract saveState() : EmuState;
  abstract loadState?(state : EmuState) : void;
  abstract pause() : void;
  abstract resume() : void;
  abstract readAddress?(addr:number) : number;

  getDebugCallback() : DebugCondition {
    return this.debugCondition;
  }
  setupDebug(callback : BreakpointCallback) {
    this.onBreakpointHit = callback;
  }
  clearDebug() {
    this.debugSavedState = null;
    this.debugBreakState = null;
    this.debugTargetClock = 0;
    this.debugClock = 0;
    this.onBreakpointHit = null;
    this.debugCondition = null;
  }
  setDebugCondition(debugCond : DebugCondition) {
    if (this.debugSavedState) {
      this.loadState(this.debugSavedState);
    } else {
      this.debugSavedState = this.saveState();
    }
    this.debugClock = 0;
    this.debugCondition = debugCond;
    this.debugBreakState = null;
    this.resume();
  }
}

////// 6502

function getToolForFilename_6502(fn:string) : string {
  if (fn.endsWith(".pla")) return "plasm";
  if (fn.endsWith(".c")) return "cc65";
  if (fn.endsWith(".s")) return "ca65";
  if (fn.endsWith(".acme")) return "acme";
  return "dasm"; // .a
}

export abstract class Base6502Platform extends BaseDebugPlatform {

  newCPU(membus : MemoryBus) {
    var cpu = new jt.M6502();
    cpu.connectBus(membus);
    return cpu;
  }

  getOpcodeMetadata(opcode, offset) {
    return Javatari.getOpcodeMetadata(opcode, offset); // TODO
  }

  getOriginPC() : number {
    return (this.readAddress(0xfffc) | (this.readAddress(0xfffd) << 8)) & 0xffff;
  }

  restartDebugState() {
    if (this.debugCondition && !this.debugBreakState) {
      this.debugSavedState = this.saveState();
      this.debugTargetClock -= this.debugClock;
      this.debugClock = 0;
    }
  }
  breakpointHit(targetClock : number) {
    this.debugTargetClock = targetClock;
    this.debugBreakState = this.saveState();
    this.debugBreakState.c.PC = (this.debugBreakState.c.PC-1) & 0xffff;
    console.log("Breakpoint at clk", this.debugClock, "PC", this.debugBreakState.c.PC.toString(16));
    this.pause();
    if (this.onBreakpointHit) {
      this.onBreakpointHit(this.debugBreakState);
    }
  }
  // TODO: lower bound of clock value
  step() {
    var previousPC = -1;
    this.setDebugCondition( () => {
      if (this.debugClock++ > this.debugTargetClock) {
        var thisState = this.getCPUState();
        if (previousPC < 0) {
          previousPC = thisState.PC;
        } else {
          if (thisState.PC != previousPC && thisState.T == 0) {
            //console.log(previousPC.toString(16), thisPC.toString(16));
            this.breakpointHit(this.debugClock-1);
            return true;
          }
        }
      }
      return false;
    });
  }
  stepBack() {
    var prevState;
    var prevClock;
    this.setDebugCondition( () => {
      if (this.debugClock++ >= this.debugTargetClock && prevState) {
        this.loadState(prevState);
        this.breakpointHit(prevClock-1);
        return true;
      } else if (this.debugClock > this.debugTargetClock-10 && this.debugClock < this.debugTargetClock) {
        if (this.getCPUState().T == 0) {
          prevState = this.saveState();
          prevClock = this.debugClock;
        }
      }
      return false;
    });
  }
  runEval(evalfunc : DebugEvalCondition) {
    this.setDebugCondition( () => {
      if (this.debugClock++ > this.debugTargetClock) {
        var cpuState = this.getCPUState();
        cpuState.PC = (cpuState.PC-1)&0xffff;
        if (evalfunc(cpuState)) {
          this.breakpointHit(this.debugClock-1);
          return true;
        } else {
          return false;
        }
      }
    });
  }
  runUntilReturn() {
    var depth = 1;
    this.runEval( (c:CpuState) => {
      if (depth <= 0 && c.T == 0)
        return true;
      if (c.o == 0x20)
        depth++;
      else if (c.o == 0x60 || c.o == 0x40)
        --depth;
      return false;
    });
  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    return disassemble6502(pc, read(pc), read(pc+1), read(pc+2));
  }
  cpuStateToLongString(c:CpuState) : string {
    return cpuStateToLongString_6502(c);
  }
  getToolForFilename = getToolForFilename_6502;
  getDefaultExtension() { return ".a"; };
}

function cpuStateToLongString_6502(c) : string {
  function decodeFlags(c) {
    var s = "";
    s += c.N ? " N" : " -";
    s += c.V ? " V" : " -";
    s += c.D ? " D" : " -";
    s += c.Z ? " Z" : " -";
    s += c.C ? " C" : " -";
  //  s += c.I ? " I" : " -";
    return s;
  }
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c) + "\n"
       + " A " + hex(c.A)    + "     " + (c.R ? "" : "BUSY") + "\n"
       + " X " + hex(c.X)    + "\n"
       + " Y " + hex(c.Y)    + "     " + "SP " + hex(c.SP) + "\n";
}

////// Z80

function cpuStateToLongString_Z80(c) {
  function decodeFlags(flags) {
    var flagspec = "SZ-H-VNC";
    var s = "";
    for (var i=0; i<8; i++)
      s += (flags & (128>>i)) ? flagspec.slice(i,i+1) : "-";
    return s; // TODO
  }
  return "PC " + hex(c.PC,4) + "  " + decodeFlags(c.AF) + "\n"
       + "SP " + hex(c.SP,4) + "  IR " + hex(c.IR,4) + "\n"
       + "IX " + hex(c.IX,4) + "  IY " + hex(c.IY,4) + "\n"
       + "AF " + hex(c.AF,4) + "  BC " + hex(c.BC,4) + "\n"
       + "DE " + hex(c.DE,4) + "  HL " + hex(c.HL,4) + "\n"
       ;
}

function BusProbe(bus : MemoryBus) {
  var active = false;
  var callback;
  this.activate = function(_callback) {
    active = true;
    callback = _callback;
  }
  this.deactivate = function() {
    active = false;
    callback = null;
  }
  this.read = function(a) {
    if (active) {
      callback(a);
    }
    return bus.read(a);
  }
  this.write = function(a,v) {
    if (active) {
      callback(a,v);
    }
    bus.write(a,v);
  }
}

export abstract class BaseZ80Platform extends BaseDebugPlatform {

  _cpu;
  probe;

  newCPU(membus, iobus) {
    this.probe = new BusProbe(membus);
    this._cpu = Z80_fast({
     display: {},
     memory: this.probe,
     ioBus: iobus
   });
   return this._cpu;
  }

  getProbe() { return this.probe; }
  getPC() { return this._cpu.getPC(); }
  getSP() { return this._cpu.getSP(); }

  // TODO: refactor other parts into here
  runCPU(cpu, cycles) {
    this._cpu = cpu; // TODO?
    if (this.wasBreakpointHit())
      return 0;
    var debugCond = this.getDebugCallback();
    var targetTstates = cpu.getTstates() + cycles;
    if (debugCond) { // || trace) {
      while (cpu.getTstates() < targetTstates) {
        //_trace(); // TODO
        if (debugCond && debugCond()) {
          debugCond = null;
          break;
        }
        cpu.runFrame(cpu.getTstates() + 1);
      }
    } else {
      cpu.runFrame(targetTstates);
    }
    return cpu.getTstates() - targetTstates;
  }
  restartDebugState() {
    if (this.debugCondition && !this.debugBreakState) {
      this.debugSavedState = this.saveState();
      if (this.debugTargetClock > 0)
        this.debugTargetClock -= this.debugSavedState.c.T;
      this.debugSavedState.c.T = 0;
      this.loadState(this.debugSavedState);
    }
  }
  breakpointHit(targetClock : number) {
    this.debugTargetClock = targetClock;
    this.debugBreakState = this.saveState();
    //this.debugBreakState.c.PC = (this.debugBreakState.c.PC-1) & 0xffff;
    console.log("Breakpoint at clk", this.debugBreakState.c.T, "PC", this.debugBreakState.c.PC.toString(16));
    this.pause();
    if (this.onBreakpointHit) {
      this.onBreakpointHit(this.debugBreakState);
    }
  }
  wasBreakpointHit() : boolean {
    return this.debugBreakState != null;
  }
  // TODO: lower bound of clock value
  step() {
    this.setDebugCondition( () => {
      var cpuState = this.getCPUState();
      if (cpuState.T > this.debugTargetClock) {
        this.breakpointHit(cpuState.T);
        return true;
      }
      return false;
    });
  }
  stepBack() {
    var prevState;
    var prevClock;
    this.setDebugCondition( () => {
      var cpuState = this.getCPUState();
      var debugClock = cpuState.T;
      if (debugClock >= this.debugTargetClock && prevState) {
        this.loadState(prevState);
        this.breakpointHit(prevClock);
        return true;
      } else if (debugClock > this.debugTargetClock-20 && debugClock < this.debugTargetClock) {
        prevState = this.saveState();
        prevClock = debugClock;
      }
      return false;
    });
  }
  runEval(evalfunc : DebugEvalCondition) {
    this.setDebugCondition( () => {
      var cpuState = this.getCPUState();
      if (cpuState.T > this.debugTargetClock) {
        if (evalfunc(cpuState)) {
          this.breakpointHit(cpuState.T);
          return true;
        }
      }
      return false;
    });
  }
  runUntilReturn() {
    var depth = 1;
    this.runEval( (c) => {
      if (depth <= 0)
        return true;
      var op = this.readAddress(c.PC);
      if (op == 0xcd) // CALL
        depth++;
      else if (op == 0xc0 || op == 0xc8 || op == 0xc9 || op == 0xd0) // RET (TODO?)
        --depth;
      return false;
    });
  }
  cpuStateToLongString(c) {
    return cpuStateToLongString_Z80(c);
  }
  getToolForFilename = getToolForFilename_z80;
  getDefaultExtension() { return ".c"; };
  // TODO
  //this.getOpcodeMetadata = function() { }
}

function getToolForFilename_z80(fn) {
  if (fn.endsWith(".c")) return "sdcc";
  if (fn.endsWith(".s")) return "sdasz80";
  if (fn.endsWith(".ns")) return "naken";
  if (fn.endsWith(".scc")) return "sccz80";
  return "z80asm";
}

/// MAME SUPPORT

declare var FS, ENV, Module; // mame emscripten

// TODO: make class
export function BaseMAMEPlatform() {

  var self = this;

  var loaded = false;
  var preinitted = false;
  var romfn;
  var romdata;
  var video;
  var preload_files;
  var running = false;
  var console_vars : {[varname:string]:string[]} = {};
  var console_varname;
  var initluavars = false;
  var luadebugscript;
  var js_lua_string;

  this.luareset = function() {
    console_vars = {};
  }

  // http://docs.mamedev.org/techspecs/luaengine.html
  this.luacall = function(s) {
    console_varname = null;
    //Module.ccall('_Z13js_lua_stringPKc', 'void', ['string'], [s+""]);
    if (!js_lua_string) js_lua_string = Module.cwrap('_Z13js_lua_stringPKc', 'void', ['string']);
    js_lua_string(s || "");
  }

  this.pause = function() {
    if (loaded && running) {
      this.luacall('emu.pause()');
      running = false;
    }
  }

  this.resume = function() {
    if (loaded && !running) { // TODO
      this.luacall('emu.unpause()');
      running = true;
    }
  }

  this.reset = function() {
    this.luacall('manager:machine():soft_reset()');
    running = true;
    initluavars = false;
  }

  this.isRunning = function() {
    return running;
  }

  function bufferConsoleOutput(s) {
    if (!s) return;
    if (s.startsWith(">>>")) {
      console_varname = s.length > 3 ? s.slice(3) : null;
      if (console_varname) console_vars[console_varname] = [];
    } else if (console_varname) {
      console_vars[console_varname].push(s);
      if (console_varname == 'debug_stopped') {
        var debugSaveState = self.preserveState();
        self.pause();
        if (onBreakpointHit) {
          onBreakpointHit(debugSaveState);
        }
      }
    } else {
      console.log(s);
    }
  }

  this.startModule = function(mainElement, opts) {
    romfn = opts.romfn;
    if (opts.romdata) romdata = opts.romdata;
    if (!romdata) romdata = new RAM(opts.romsize).mem;
    // create canvas
    video = new RasterVideo(mainElement, opts.width, opts.height);
    video.create();
    $(video.canvas).attr('id','canvas');
    // load asm.js module
    console.log("loading", opts.jsfile);
    var modargs = [opts.driver,
      '-debug',
      '-debugger', 'none',
      '-verbose', '-window', '-nokeepaspect',
      '-resolution', video.canvas.width+'x'+video.canvas.height
    ];
    if (romfn) modargs.push('-cart', romfn);
    window['JSMESS'] = {};
    window['Module'] = {
      arguments: modargs,
      screenIsReadOnly: true,
      print: bufferConsoleOutput,
      canvas:video.canvas,
      doNotCaptureKeyboard:true,
      keyboardListeningElement:video.canvas,
      preInit: function () {
        console.log("loading FS");
        ENV.SDL_EMSCRIPTEN_KEYBOARD_ELEMENT = 'canvas';
        if (opts.cfgfile) {
          FS.mkdir('/cfg');
          FS.writeFile('/cfg/' + opts.cfgfile, opts.cfgdata, {encoding:'utf8'});
        }
        if (opts.biosfile) {
          FS.mkdir('/roms');
          FS.mkdir('/roms/' + opts.driver);
          FS.writeFile('/roms/' + opts.biosfile, opts.biosdata, {encoding:'binary'});
        }
        FS.mkdir('/emulator');
        if (romfn)
          FS.writeFile(romfn, romdata, {encoding:'binary'});
        //FS.writeFile('/debug.ini', 'debugger none\n', {encoding:'utf8'});
        if (opts.preInit) {
          opts.preInit(self);
        }
        preinitted = true;
      },
      preRun: [
        function() {
          $(video.canvas).click(function(e) {
            video.canvas.focus();
          });
          loaded = true;
          console.log("about to run...");
        }
      ]
    };
    // preload files
    // TODO: ensure loaded
    var fetch_cfg, fetch_lua;
    var fetch_bios = $.Deferred();
    var fetch_wasm = $.Deferred();
    // fetch config file
    if (opts.cfgfile) {
      fetch_cfg = $.get('mame/cfg/' + opts.cfgfile, function(data) {
        opts.cfgdata = data;
        console.log("loaded " + opts.cfgfile);
      }, 'text');
    }
    // fetch BIOS file
    if (opts.biosfile) {
      var oReq1 = new XMLHttpRequest();
      oReq1.open("GET", 'mame/roms/' + opts.biosfile, true);
      oReq1.responseType = "arraybuffer";
      oReq1.onload = function(oEvent) {
        opts.biosdata = new Uint8Array(oReq1.response);
        console.log("loaded " + opts.biosfile); // + " (" + oEvent.total + " bytes)");
        fetch_bios.resolve();
      };
      oReq1.send();
    } else {
      fetch_bios.resolve();
    }
    // load debugger Lua script
    fetch_lua = $.get('mame/debugger.lua', function(data) {
      luadebugscript = data;
      console.log("loaded debugger.lua");
    }, 'text');
    // load WASM
    {
      var oReq2 = new XMLHttpRequest();
      oReq2.open("GET", 'mame/' + opts.jsfile.replace('.js','.wasm'), true);
      oReq2.responseType = "arraybuffer";
      oReq2.onload = function(oEvent) {
        console.log("loaded WASM file");
        window['Module'].wasmBinary = new Uint8Array(oReq2.response);
        fetch_wasm.resolve();
      };
      oReq2.send();
    }
    // start loading script
    $.when(fetch_lua, fetch_cfg, fetch_bios, fetch_wasm).done(function() {
      var script = document.createElement('script');
      script.src = 'mame/' + opts.jsfile;
      document.getElementsByTagName('head')[0].appendChild(script);
      console.log("created script element");
    });
  }

  this.loadROMFile = function(data) {
    romdata = data;
    if (preinitted && romfn) {
      FS.writeFile(romfn, data, {encoding:'binary'});
    }
  }

  this.loadRegion = function(region, data) {
    if (loaded) {
      //self.luacall('cart=manager:machine().images["cart"]\nprint(cart:filename())\ncart:load("' + romfn + '")\n');
      var s = 'rgn = manager:machine():memory().regions["' + region + '"]\n';
      //s += 'print(rgn.size)\n';
      for (var i=0; i<data.length; i+=4) {
        var v = data[i] + (data[i+1]<<8) + (data[i+2]<<16) + (data[i+3]<<24);
        s += 'rgn:write_u32(' + i + ',' + v + ')\n'; // TODO: endian?
      }
      self.luacall(s);
      self.reset();
    }
  }

  this.preserveState = function() {
    var state = {c:{}};
    for (var k in console_vars) {
      if (k.startsWith("cpu_")) {
        var v = parseInt(console_vars[k][0]);
        state.c[k.slice(4)] = v;
      }
    }
    // TODO: memory?
    return state;
  }

  this.saveState = function() {
    this.luareset();
    this.luacall('mamedbg.printstate()');
    return self.preserveState();
  }

  this.initlua = function() {
    if (!initluavars) {
      self.luacall(luadebugscript);
      self.luacall('mamedbg.init()')
      initluavars = true;
    }
  }

  this.readAddress = function(a) {
    self.initlua();
    self.luacall('print(">>>v"); print(mem:read_u8(' + a + '))');
    return parseInt(console_vars.v[0]);
  }

  // DEBUGGING SUPPORT

  var onBreakpointHit;

  this.clearDebug = function() {
    onBreakpointHit = null;
  }
  this.getDebugCallback = function() {
    return onBreakpointHit;// TODO?
  }
  this.setupDebug = function(callback) {
    self.initlua();
    self.luareset();
    onBreakpointHit = callback;
  }
  this.runToPC = function(pc) {
    self.luacall('mamedbg.runTo(' + pc + ')');
    self.resume();
  }
  this.runToVsync = function() {
    self.luacall('mamedbg.runToVsync()');
    self.resume();
  }
  this.runUntilReturn = function() {
    self.luacall('mamedbg.runUntilReturn()');
    self.resume();
  }
  this.step = function() {
    self.luacall('mamedbg.step()');
    self.resume();
  }
  // TODO: other than z80
  this.cpuStateToLongString = function(c) {
    if (c.HL)
      return cpuStateToLongString_Z80(c);
    else
      return null; // TODO
  }
}
