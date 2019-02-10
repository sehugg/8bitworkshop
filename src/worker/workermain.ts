"use strict";

import { WorkerResult, WorkerFileUpdate, WorkerBuildStep, WorkerMessage, WorkerError, Dependency } from "../workertypes";

const emglobal : any = this['window'] || this['global'] || this;
declare var WebAssembly;
declare function importScripts(path:string);
declare function postMessage(msg);

var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';

// WebAssembly module cache
// TODO: leaks memory even when disabled...
var _WASM_module_cache = {};
var CACHE_WASM_MODULES = true;
function getWASMModule(module_id:string) {
  var module = _WASM_module_cache[module_id];
  if (!module) {
    starttime();
    module = new WebAssembly.Module(wasmBlob[module_id]);
    if (CACHE_WASM_MODULES) {
      _WASM_module_cache[module_id] = module;
      delete wasmBlob[module_id];
    }
    endtime("module creation " + module_id);
  }
  return module;
}
// function for use with instantiateWasm
function moduleInstFn(module_id:string) {
  return function(imports,ri) {
    var mod = getWASMModule(module_id);
    var inst = new WebAssembly.Instance(mod, imports);
    ri(inst);
    return inst.exports;
  }
}

var PLATFORM_PARAMS = {
  'vcs': {
    code_start: 0x1000,
    code_size: 0xf000,
    data_start: 0x80,
    data_size: 0x80,
  },
  'mw8080bw': {
    code_start: 0x0,
    rom_size: 0x2000,
    data_start: 0x2000,
    data_size: 0x400,
    stack_end: 0x2400,
  },
  'vicdual': {
    code_start: 0x0,
    rom_size: 0x4020,
    data_start: 0xe400,
    data_size: 0x400,
    stack_end: 0xe800,
  },
  'galaxian': {
    code_start: 0x0,
    rom_size: 0x4000,
    data_start: 0x4000,
    data_size: 0x400,
    stack_end: 0x4800,
  },
  'galaxian-scramble': {
    code_start: 0x0,
    rom_size: 0x5020,
    data_start: 0x4000,
    data_size: 0x400,
    stack_end: 0x4800,
  },
  'williams-z80': {
    code_start: 0x0,
    rom_size: 0x9800,
    data_start: 0x9800,
    data_size: 0x2800,
    stack_end: 0xc000,
  },
  'vector-z80color': {
    code_start: 0x0,
    rom_size: 0x8000,
    data_start: 0xe000,
    data_size: 0x2000,
    stack_end: 0x0,
  },
  'sound_williams-z80': {
    code_start: 0x0,
    rom_size: 0x4000,
    data_start: 0x4000,
    data_size: 0x400,
    stack_end: 0x8000,
  },
  'base_z80': {
    code_start: 0x0,
    rom_size: 0x8000,
    data_start: 0x8000,
    data_size: 0x8000,
    stack_end: 0x0,
  },
  'coleco': {
    rom_start: 0x8000,
    code_start: 0x8100,
    rom_size: 0x8000,
    data_start: 0x7000,
    data_size: 0x400,
    stack_end: 0x8000,
    extra_preproc_args: ['-I', '/share/include/coleco'],
    extra_link_args: ['-k', '/share/lib/coleco', '-l', 'libcv', '-l', 'libcvu', 'crt0.rel'],
  },
  'sms-sg1000-libcv': {
    rom_start: 0x0000,
    code_start: 0x0100,
    rom_size: 0xc000,
    data_start: 0xc000,
    data_size: 0x400,
    stack_end: 0xe000,
    extra_preproc_args: ['-I', '.', '-D', 'CV_SMS'],
    extra_link_args: ['-k', '.', '-l', 'libcv-sms', '-l', 'libcvu-sms', 'crt0-sms.rel'],
    extra_link_files: ['libcv-sms.lib', 'libcvu-sms.lib', 'crt0-sms.rel', 'crt0-sms.lst'],
    extra_compile_files: ['cv.h','cv_graphics.h','cv_input.h','cv_sound.h','cv_support.h','cvu.h','cvu_c.h','cvu_compression.h','cvu_f.h','cvu_graphics.h','cvu_input.h','cvu_sound.h'],
  },
  'nes': { //TODO
    define: '__NES__',
    cfgfile: 'neslib.cfg',
    libargs: ['crt0.o', 'nes.lib',
      '-D', 'NES_MAPPER=2', // UxROM
      '-D', 'NES_PRG_BANKS=2', // 2 PRG banks
      '-D', 'NES_CHR_BANKS=0', // TODO: >0 doesn't seem to work
      '-D', 'NES_MIRRORING=0', // horizontal mirroring
      ],
    extra_link_files: ['crt0.o'],
  },
  'nes-conio': {
    cfgfile: 'nes.cfg',
    define: '__NES__',
    libargs: ['nes.lib'],
  },
  'nes-lib': {
    define: '__NES__',
    cfgfile: 'neslib.cfg',
    libargs: ['neslib.lib', 'nes.lib'],
  },
  'apple2': {
    define: '__APPLE2__',
    cfgfile: 'apple2-hgr.cfg',
    libargs: ['apple2.lib'],
    __CODE_RUN__: 16384,
    code_start: 0x803,
  },
  'apple2-e': {
    define: '__APPLE2__',
    cfgfile: 'apple2.cfg',
    libargs: ['apple2.lib'],
  },
  'atari8-800': {
    define: '__ATARI__',
    cfgfile: 'atari-cart.cfg',
    libargs: ['atari.lib'],
  },
  'atari8-5200': {
    define: '__ATARI5200__',
    cfgfile: 'atari5200.cfg',
    libargs: ['atari5200.lib',
      '-D', '__CARTFLAGS__=255'],
  },
  'c64': {
    define: '__C64__',
    cfgfile: 'c64.cfg',
    libargs: ['c64.lib'],
  },
  'verilog': {
  },
  'astrocade': {
    code_start: 0x2000,
      rom_size: 0x2000,
    data_start: 0x4e10,
     data_size: 0x1f0,
     stack_end: 0x5000,
  },
  'astrocade-arcade': {
    code_start: 0x0000,
      rom_size: 0x4000,
    data_start: 0x7de0,
     data_size: 0x220,
     stack_end: 0x8000,
  },
  'astrocade-bios': {
    code_start: 0x0000,
      rom_size: 0x2000,
    data_start: 0x4fce,
     data_size: 50,
     stack_end: 0x4fce,
  },
};

PLATFORM_PARAMS['coleco.mame'] = PLATFORM_PARAMS['coleco'];
PLATFORM_PARAMS['sms-sms-libcv'] = PLATFORM_PARAMS['sms-sg1000-libcv'];

var _t1;
function starttime() { _t1 = new Date(); }
function endtime(msg) { var _t2 = new Date(); console.log(msg, _t2.getTime() - _t1.getTime(), "ms"); }

/// working file store and build steps

type FileData = string | Uint8Array;

type FileEntry = {
  path: string
  encoding: string
  data: FileData
  ts: number
};

type BuildOptions = {
  mainFilePath : string,
  processFn?: (FileData) => FileData
};

// TODO
interface BuildStep extends WorkerBuildStep {
  files? : string[]
  args? : string[]
  nextstep? : BuildStep
  linkstep? : BuildStep
  params?
  result?
  code?
  generated?
  prefix?
  maxts?
};

var buildsteps : BuildStep[] = [];
var buildstartseq : number = 0;
var workfs : {[path:string]:FileEntry} = {};
var workerseq : number = 0;

function compareData(a:FileData, b:FileData) : boolean {
  if (a.length != b.length) return false;
  if (typeof a === 'string' && typeof b === 'string')
    return a==b;
  else {
    for (var i=0; i<a.length; i++) {
      //if (a[i] != b[i]) console.log('differ at byte',i,a[i],b[i]);
      if (a[i] != b[i]) return false;
    }
    return true;
  }
}

function putWorkFile(path:string, data:FileData) {
  var encoding = (typeof data === 'string') ? 'utf8' : 'binary';
  var entry = workfs[path];
  if (!entry || !compareData(entry.data, data) || entry.encoding != encoding) {
    workfs[path] = entry = {path:path, data:data, encoding:encoding, ts:++workerseq};
    console.log('+++', entry.path, entry.encoding, entry.data.length, entry.ts);
  }
  return entry;
}

// returns true if file changed during this build step
function wasChanged(entry:FileEntry) : boolean {
  return entry.ts > buildstartseq;
}

function getWorkFileAsString(path:string) : string {
  return workfs[path] && workfs[path].data as string; // TODO
}

function populateEntry(fs, path:string, entry:FileEntry, options:BuildOptions) {
  var data = entry.data;
  if (options && options.processFn)
    data = options.processFn(data);
  fs.writeFile(path, data, {encoding:entry.encoding});
  fs.utime(path, entry.ts, entry.ts);
  console.log("<<<", path, entry.data.length);
}

// can call multiple times (from populateFiles)
function gatherFiles(step:BuildStep, options?:BuildOptions) {
  var maxts = 0;
  if (step.files) {
    for (var i=0; i<step.files.length; i++) {
      var path = step.files[i];
      var entry = workfs[path];
      if (!entry) {
        throw new Error("No entry for path '" + path + "'");
      } else {
        maxts = Math.max(maxts, entry.ts);
      }
    }
  }
  else if (step.code) {
    var path = step.path ? step.path : options.mainFilePath; // TODO: what if options null
    if (!path) throw "need path or mainFilePath";
    var code = step.code;
    var entry = putWorkFile(path, code);
    step.path = path;
    step.files = [path];
    maxts = entry.ts;
  }
  else if (step.path) {
    var path = step.path;
    var entry = workfs[path];
    maxts = entry.ts;
    step.files = [path];
  }
  if (step.path && !step.prefix) {
    step.prefix = step.path.split(/[./]/)[0]; // TODO
  }
  step.maxts = maxts;
  return maxts;
}

function populateFiles(step:BuildStep, fs, options?:BuildOptions) {
  gatherFiles(step, options);
  if (!step.files) throw "call gatherFiles() first";
  for (var i=0; i<step.files.length; i++) {
    var path = step.files[i];
    populateEntry(fs, path, workfs[path], options);
  }
}

function populateExtraFiles(step:BuildStep, fs, extrafiles) {
  // TODO: cache extra files
  if (extrafiles) {
    for (var i=0; i<extrafiles.length; i++) {
      var xfn = extrafiles[i];
      var xpath = "lib/" + step.platform + "/" + xfn;
      var xhr = new XMLHttpRequest();
      xhr.responseType = 'arraybuffer';
      xhr.open("GET", xpath, false);  // synchronous request
      xhr.send(null);
      if (xhr.response && xhr.status == 200) {
        var data = new Uint8Array(xhr.response);
        fs.writeFile(xfn, data, {encoding:'binary'});
        console.log(":::",xfn,data.length);
      } else {
        throw Error("Could not load extra file " + xpath);
      }
    }
  }
}

function staleFiles(step:BuildStep, targets:string[]) {
  if (!step.maxts) throw "call populateFiles() first";
  // see if any target files are more recent than inputs
  for (var i=0; i<targets.length; i++) {
    var entry = workfs[targets[i]];
    if (!entry || step.maxts > entry.ts)
      return true;
  }
  console.log("unchanged", step.maxts, targets);
  return false;
}

function anyTargetChanged(step:BuildStep, targets:string[]) {
  if (!step.maxts) throw "call populateFiles() first";
  // see if any target files are more recent than inputs
  for (var i=0; i<targets.length; i++) {
    var entry = workfs[targets[i]];
    if (!entry || entry.ts > step.maxts)
      return true;
  }
  console.log("unchanged", step.maxts, targets);
  return false;
}

function execMain(step:BuildStep, mod, args:string[]) {
  starttime();
  mod.callMain(args);
  endtime(step.tool);
}

/// asm.js / WASM / filesystem loading

var fsMeta = {};
var fsBlob = {};
var wasmBlob = {};

const PSRC = "../../src/";
const PWORKER = PSRC+"worker/";

// load filesystems for CC65 and others asynchronously
function loadFilesystem(name:string) {
  var xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.open("GET", PWORKER+"fs/fs"+name+".data", false);  // synchronous request
  xhr.send(null);
  fsBlob[name] = xhr.response;
  xhr = new XMLHttpRequest();
  xhr.responseType = 'json';
  xhr.open("GET", PWORKER+"fs/fs"+name+".js.metadata", false);  // synchronous request
  xhr.send(null);
  fsMeta[name] = xhr.response;
  console.log("Loaded "+name+" filesystem", fsMeta[name].files.length, 'files', fsBlob[name].size, 'bytes');
}

var loaded = {}
function load(modulename:string, debug?:boolean) {
  if (!loaded[modulename]) {
    importScripts(PWORKER+'asmjs/'+modulename+(debug?"."+debug+".js":".js"));
    loaded[modulename] = 1;
  }
}
function loadGen(modulename:string) {
  if (!loaded[modulename]) {
    importScripts('../../gen/'+modulename+".js");
    loaded[modulename] = 1;
  }
}
function loadWASM(modulename:string, debug?:boolean) {
  if (!loaded[modulename]) {
    importScripts(PWORKER+"wasm/" + modulename+(debug?"."+debug+".js":".js"));
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.open("GET", PWORKER+"wasm/"+modulename+".wasm", false);  // synchronous request
    xhr.send(null);
    if (xhr.response) {
      wasmBlob[modulename] = new Uint8Array(xhr.response);
      console.log("Loaded " + modulename + ".wasm");
      loaded[modulename] = 1;
    } else {
      throw Error("Could not load WASM file " + modulename + ".wasm");
    }
  }
}
function loadNative(modulename:string) {
  // detect WASM
  if (CACHE_WASM_MODULES && typeof WebAssembly === 'object') {
    loadWASM(modulename);
  } else {
    load(modulename);
  }
}

// mount the filesystem at /share
function setupFS(FS, name:string) {
  var WORKERFS = FS.filesystems['WORKERFS']
  FS.mkdir('/share');
  FS.mount(WORKERFS, {
    packages: [{ metadata: fsMeta[name], blob: fsBlob[name] }]
  }, '/share');
  // fix for slow Blob operations by caching typed arrays
  // https://github.com/kripken/emscripten/blob/incoming/src/library_workerfs.js
  var reader = WORKERFS.reader;
  var blobcache = {};
  WORKERFS.stream_ops.read = function (stream, buffer, offset, length, position) {
    if (position >= stream.node.size) return 0;
    var contents = blobcache[stream.path];
    if (!contents) {
      var ab = reader.readAsArrayBuffer(stream.node.contents);
      contents = blobcache[stream.path] = new Uint8Array(ab);
    }
    if (position + length > contents.length)
      length = contents.length - position;
    for (var i=0; i<length; i++) {
      buffer[offset+i] = contents[position+i];
    }
    return length;
  };
}

var print_fn = function(s:string) {
  console.log(s);
  //console.log(new Error().stack);
}

// test.c(6) : warning 85: in function main unreferenced local variable : 'x'
// main.a (4): error: Unknown Mnemonic 'xxx'.
// at 2: warning 190: ISO C forbids an empty source file
var re_msvc  = /[/]*([^( ]+)\s*[(](\d+)[)]\s*:\s*(.+?):\s*(.*)/;
var re_msvc2 = /\s*(at)\s+(\d+)\s*(:)\s*(.*)/;

function msvcErrorMatcher(errors:WorkerError[]) {
  return function(s:string) {
    var matches = re_msvc.exec(s) || re_msvc2.exec(s);
    if (matches) {
      var errline = parseInt(matches[2]);
      errors.push({
        line:errline,
        path:matches[1],
        //type:matches[3],
        msg:matches[4]
      });
    } else {
      console.log(s);
    }
  }
}

function makeErrorMatcher(errors:WorkerError[], regex, iline:number, imsg:number, mainpath:string, ifilename?:number) {
  return function(s) {
    var matches = regex.exec(s);
    if (matches) {
      errors.push({
        line:parseInt(matches[iline]) || 1,
        msg:matches[imsg],
        path:ifilename ? matches[ifilename] : mainpath
      });
    } else {
      console.log("??? "+s);
    }
  }
}

function extractErrors(regex, strings:string[], path:string) {
  var errors = [];
  var matcher = makeErrorMatcher(errors, regex, 1, 2, path);
  for (var i=0; i<strings.length; i++) {
    matcher(strings[i]);
  }
  return errors;
}

// TODO: "of" doesn't work in MSIE

var re_crlf = /\r?\n/;

function parseListing(code:string, lineMatch, iline:number, ioffset:number, iinsns:number) {
  var lines = [];
  for (var line of code.split(re_crlf)) {
    var linem = lineMatch.exec(line);
    if (linem && linem[1]) {
      var linenum = parseInt(linem[iline]);
      var offset = parseInt(linem[ioffset], 16);
      var insns = linem[iinsns];
      if (insns) {
        lines.push({
          line:linenum,
          offset:offset,
          insns:insns,
        });
      }
    }
  }
  return lines;
}

function parseSourceLines(code:string, lineMatch, offsetMatch) {
  var lines = [];
  var lastlinenum = 0;
  for (var line of code.split(re_crlf)) {
    var linem = lineMatch.exec(line);
    if (linem && linem[1]) {
      lastlinenum = parseInt(linem[1]);
    } else if (lastlinenum) {
      var linem = offsetMatch.exec(line);
      if (linem && linem[1]) {
        var offset = parseInt(linem[1], 16);
        lines.push({
          line:lastlinenum,
          offset:offset,
        });
        lastlinenum = 0;
      }
    }
  }
  return lines;
}

function parseDASMListing(code:string, unresolved:{}, mainFilename:string) {
  //        4  08ee		       a9 00	   start      lda	#01workermain.js:23:5
  var lineMatch = /\s*(\d+)\s+(\S+)\s+([0-9a-f]+)\s+([?0-9a-f][?0-9a-f ]+)?\s+(.+)?/i;
  var equMatch = /\bequ\b/i;
  var macroMatch = /\bMAC\s+(.+)?/i;
  var errors = [];
  var lines = [];
  var macrolines = [];
  var lastline = 0;
  var macros = {};
  for (var line of code.split(re_crlf)) {
    var linem = lineMatch.exec(line);
    if (linem && linem[1]) {
      var linenum = parseInt(linem[1]);
      var filename = linem[2];
      var offset = parseInt(linem[3], 16);
      var insns = linem[4];
      var restline = linem[5];
      if (insns && insns.startsWith('?')) insns = null;
      // inside of main file?
      if (filename == mainFilename) {
        // look for MAC statement
        var macmatch = macroMatch.exec(restline);
        if (macmatch) {
          macros[macmatch[1]] = {line:parseInt(linem[1]), file:linem[2].toLowerCase()};
        }
        else if (insns && !restline.match(equMatch)) {
          lines.push({
            line:linenum,
            offset:offset,
            insns:insns,
            iscode:restline[0] != '.'
          });
        }
        lastline = linenum;
      } else {
        // inside of macro or include file
        if (insns && linem[3] && lastline>0) {
          lines.push({
            line:lastline+1,
            offset:offset,
            insns:null
          });
        }
        // inside of macro?
        var mac = macros[filename.toLowerCase()];
        if (insns && mac) {
          macrolines.push({
            filename:mac.file,
            line:mac.line+linenum,
            offset:offset,
            insns:insns
          });
        }
      }
      // TODO: better symbol test (word boundaries)
      // TODO: ignore IFCONST and IFNCONST usage
      for (var key in unresolved) {
        var pos = restline ? restline.indexOf(key) : line.indexOf(key);
        if (pos >= 0) {
          errors.push({
            path:filename,
            line:linenum,
            msg:"Unresolved symbol '" + key + "'"
          });
        }
      }
    }
    var errm = re_msvc.exec(line);
    if (errm) {
      errors.push({
        path:errm[1],
        line:parseInt(errm[2]),
        msg:errm[4]
      })
    }
  }
  // TODO: use macrolines
  // TODO: return {text:code, asmlines:lines, macrolines:macrolines, errors:errors};
  return {lines:lines, macrolines:macrolines, errors:errors};
}

function assembleDASM(step:BuildStep) {
  load("dasm");
  var re_usl = /(\w+)\s+0000\s+[?][?][?][?]/;
  var unresolved = {};
  var errors = [];
  var errorMatcher = msvcErrorMatcher(errors);
  function match_fn(s) {
    var matches = re_usl.exec(s);
    if (matches) {
      var key = matches[1];
      if (key != 'NO_ILLEGAL_OPCODES') { // TODO
        unresolved[matches[1]] = 0;
      }
    } else if (s.startsWith("Warning:")) {
      errors.push({line:0, msg:s.substr(9)});
    } else {
      errorMatcher(s);
    }
  }
  var Module = emglobal.DASM({
    noInitialRun:true,
    print:match_fn
  });
  var FS = Module['FS'];
  populateFiles(step, FS, {
    mainFilePath:'main.a'
  });
  var binpath = step.prefix+'.bin';
  var lstpath = step.prefix+'.lst';
  var sympath = step.prefix+'.sym';
  execMain(step, Module, [step.path, '-f3',
    "-l"+lstpath,
    "-o"+binpath,
    "-s"+sympath ]);
  var alst = FS.readFile(lstpath, {'encoding':'utf8'});
  // parse main listing, get errors
  var listing = parseDASMListing(alst, unresolved, step.path);
  errors = errors.concat(listing.errors);
  if (errors.length) {
    return {errors:errors};
  }
  var listings = {};
  listings[lstpath] = listing;
  // parse include files
  // TODO: kinda wasted effort
  for (var fn of step.files) {
    if (fn != step.path) {
      var lst = parseDASMListing(alst, unresolved, fn);
      listings[fn] = lst; // TODO: foo.asm.lst
    }
  }
  var aout, asym;
  aout = FS.readFile(binpath);
  try {
    asym = FS.readFile(sympath, {'encoding':'utf8'});
  } catch (e) {
    console.log(e);
    errors.push({line:0,msg:"No symbol table generated, maybe segment overflow?"});
    return {errors:errors}
  }
  putWorkFile(binpath, aout);
  putWorkFile(lstpath, alst);
  putWorkFile(sympath, asym);
  // return unchanged if no files changed
  // TODO: what if listing or symbols change?
  if (!anyTargetChanged(step, [binpath/*, lstpath, sympath*/]))
    return;
  var symbolmap = {};
  for (var s of asym.split("\n")) {
    var toks = s.split(/\s+/);
    if (toks && toks.length >= 2 && !toks[0].startsWith('-')) {
      symbolmap[toks[0]] = parseInt(toks[1], 16);
    }
  }
  // for bataribasic (TODO)
  if (step['bblines']) {
    let lst = listings[lstpath];
    lst.asmlines = lst.lines;
    lst.text = alst;
    lst.lines = [];
  }
  return {
    output:aout,
    listings:listings,
    errors:errors,
    symbolmap:symbolmap,
  };
}

function setupStdin(fs, code:string) {
  var i = 0;
  fs.init(
    function() { return i<code.length ? code.charCodeAt(i++) : null; }
  );
}

    /*
    000000r 1               .segment        "CODE"
    000000r 1               ; int main() { return mul2(2); }
    000000r 1                       .dbg    line, "main.c", 3
    000000r 1  A2 00                ldx     #$00
    */
function parseCA65Listing(code, symbols, params, dbg) {
  var segofs = 0;
  // .dbg	line, "main.c", 1
  var segLineMatch = /[.]segment\s+"(\w+)"/;
  //var dbgLineMatch = /^([0-9A-F]+)([r]?)\s+(\d+)\s+[.]dbg\s+line,\s+\S+,\s+(\d+)/;
  var dbgLineMatch = /^([0-9A-F]+)([r]?)\s+(\d+)\s+[.]dbg\s+line,\s+"(\w+[.]\w+)", (\d+)/;
  var insnLineMatch = /^([0-9A-F]+)([r]?)\s+(\d+)\s+([0-9A-F][0-9A-F ]*[0-9A-F])\s+/;
  var lines = [];
  var linenum = 0;
  for (var line of code.split(re_crlf)) {
    linenum++;
    var segm = segLineMatch.exec(line);
    if (segm) {
      var segname = segm[1];
      var segsym = '__'+segname+'_RUN__';
      segofs = parseInt(symbols[segsym] || params[segsym]) || 0;
    }
    if (dbg) {
      var linem = dbgLineMatch.exec(line);
      if (linem && linem[1]) {
        var offset = parseInt(linem[1], 16);
        lines.push({
          // TODO: sourcefile
          line:parseInt(linem[5]),
          offset:offset + segofs,
          insns:null
        });
      }
    } else {
      var linem = insnLineMatch.exec(line);
      if (linem && linem[1]) {
        var offset = parseInt(linem[1], 16);
        var insns = linem[4].trim();
        if (insns.length) {
          lines.push({
            line:linenum,
            offset:offset + segofs,
            insns:insns
          });
        }
      }
    }
  }
  return lines;
}

function assembleCA65(step:BuildStep) {
  loadNative("ca65");
  var errors = [];
  gatherFiles(step, {mainFilePath:"main.s"});
  var objpath = step.prefix+".o";
  var lstpath = step.prefix+".lst";
  if (staleFiles(step, [objpath, lstpath])) {
    var objout, lstout;
    var CA65 = emglobal.ca65({
      instantiateWasm: moduleInstFn('ca65'),
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:msvcErrorMatcher(errors),
    });
    var FS = CA65['FS'];
    setupFS(FS, '65-'+step.platform.split('-')[0]);
    populateFiles(step, FS);
    execMain(step, CA65, ['-v', '-g', '-I', '/share/asminc', '-o', objpath, '-l', lstpath, step.path]);
    if (errors.length)
      return {errors:errors};
    objout = FS.readFile(objpath, {encoding:'binary'});
    lstout = FS.readFile(lstpath, {encoding:'utf8'});
    putWorkFile(objpath, objout);
    putWorkFile(lstpath, lstout);
  }
  return {
    linktool:"ld65",
    files:[objpath, lstpath],
    args:[objpath]
  };
}

function linkLD65(step:BuildStep) {
  loadNative("ld65");
  var params = step.params;
  var platform = step.platform;
  gatherFiles(step);
  var binpath = "main";
  if (staleFiles(step, [binpath])) {
    var errors = [];
    var errmsg = '';
    var LD65 = emglobal.ld65({
      instantiateWasm: moduleInstFn('ld65'),
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:function(s) { errmsg += s + '\n'; }
    });
    var FS = LD65['FS'];
    var cfgfile = '/' + platform + '.cfg';
    setupFS(FS, '65-'+platform.split('-')[0]);
    populateFiles(step, FS);
    populateExtraFiles(step, FS, params.extra_link_files);
    var libargs = params.libargs;
    var args = ['--cfg-path', '/share/cfg',
      '--lib-path', '/share/lib',
      '--lib-path', '/share/target/apple2/drv', // TODO
      '-D', '__EXEHDR__=0', // TODO
      '-C', params.cfgfile,
      '-Ln', 'main.vice',
      //'--dbgfile', 'main.dbg',
      '-o', 'main', '-m', 'main.map'].concat(step.args, libargs);
    //console.log(args);
    execMain(step, LD65, args);
    if (errmsg.length)
      errors.push({line:0, msg:errmsg});
    if (errors.length)
      return {errors:errors};
    var aout = FS.readFile("main", {encoding:'binary'});
    var mapout = FS.readFile("main.map", {encoding:'utf8'});
    var viceout = FS.readFile("main.vice", {encoding:'utf8'});
    //var dbgout = FS.readFile("main.dbg", {encoding:'utf8'});
    putWorkFile("main", aout);
    putWorkFile("main.map", mapout);
    putWorkFile("main.vice", viceout);
    // return unchanged if no files changed
    if (!anyTargetChanged(step, ["main", "main.map", "main.vice"]))
      return;
    // parse symbol map (TODO: omit segments, constants)
    var symbolmap = {};
    for (var s of viceout.split("\n")) {
      var toks = s.split(" ");
      if (toks[0] == 'al') {
        symbolmap[toks[2].substr(1)] = parseInt(toks[1], 16);
      }
    }
    // TODO: "of" in IE?
    var listings = {};
    for (var fn of step.files) {
      if (fn.endsWith('.lst')) {
        var lstout = FS.readFile(fn, {encoding:'utf8'});
        var asmlines = parseCA65Listing(lstout, symbolmap, params, false);
        var srclines = parseCA65Listing(lstout, symbolmap, params, true);
        putWorkFile(fn, lstout);
        listings[fn] = {
          asmlines:srclines.length ? asmlines : null,
          lines:srclines.length ? srclines : asmlines,
          text:lstout
        };
      }
    }
    return {
      output:aout, //.slice(0),
      listings:listings,
      errors:errors,
      symbolmap:symbolmap,
    };
  }
}

function compileCC65(step:BuildStep) {
  load("cc65");
  var params = step.params;
  // stderr
  var re_err1 = /.*?[(](\d+)[)].*?: (.+)/;
  var errors = [];
  var errline = 0;
  function match_fn(s) {
    console.log(s);
    var matches = re_err1.exec(s);
    if (matches) {
      errline = parseInt(matches[1]);
      errors.push({
        line:errline,
        msg:matches[2]
      });
    }
  }
  gatherFiles(step, {mainFilePath:"main.c"});
  var destpath = step.prefix + '.s';
  if (staleFiles(step, [destpath])) {
    var CC65 = emglobal.cc65({
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:match_fn,
    });
    var FS = CC65['FS'];
    setupFS(FS, '65-'+step.platform.split('-')[0]);
    populateFiles(step, FS);
    execMain(step, CC65, ['-T', '-g',
      '-Oirs',
      '-Cl', // static locals
      '-I', '/share/include',
      '-D' + params.define,
      step.path]);
    if (errors.length)
      return {errors:errors};
    var asmout = FS.readFile(destpath, {encoding:'utf8'});
    putWorkFile(destpath, asmout);
  }
  return {
    nexttool:"ca65",
    path:destpath,
    args:[destpath],
    files:[destpath],
  };
}

function hexToArray(s, ofs) {
  var buf = new ArrayBuffer(s.length/2);
  var arr = new Uint8Array(buf);
  for (var i=0; i<arr.length; i++) {
    arr[i] = parseInt(s.slice(i*2+ofs,i*2+ofs+2), 16);
  }
  return arr;
}

function parseIHX(ihx, rom_start, rom_size) {
  var output = new Uint8Array(new ArrayBuffer(rom_size));
  for (var s of ihx.split("\n")) {
    if (s[0] == ':') {
      var arr = hexToArray(s, 1);
      var count = arr[0];
      var address = (arr[1]<<8) + arr[2] - rom_start;
      var rectype = arr[3];
      if (rectype == 0) {
        for (var i=0; i<count; i++) {
          var b = arr[4+i];
          output[i+address] = b;
        }
      } else if (rectype == 1) {
        return output;
      } else {
        console.log(s); // unknown record type
      }
    }
  }
  return output;
}

function assembleSDASZ80(step:BuildStep) {
  loadNative("sdasz80");
  var objout, lstout, symout;
  var errors = [];
  gatherFiles(step, {mainFilePath:"main.asm"});
  var objpath = step.prefix + ".rel";
  var lstpath = step.prefix + ".lst";
  if (staleFiles(step, [objpath, lstpath])) {
    //?ASxxxx-Error-<o> in line 1 of main.asm null
    //              <o> .org in REL area or directive / mnemonic error
    // ?ASxxxx-Error-<q> in line 1627 of cosmic.asm
    //    <q> missing or improper operators, terminators, or delimiters
    var match_asm_re1 = / in line (\d+) of (\S+)/; // TODO
    var match_asm_re2 = / <\w> (.+)/; // TODO
    var errline = 0;
    var errpath = step.path;
    var match_asm_fn = (s:string) => {
      var m = match_asm_re1.exec(s);
      if (m) {
        errline = parseInt(m[1]);
        errpath = m[2];
      } else {
        m = match_asm_re2.exec(s);
        if (m) {
          errors.push({
            line:errline,
            path:errpath,
            msg:m[1]
          });
        }
      }
    }
    var ASZ80 = emglobal.sdasz80({
      instantiateWasm: moduleInstFn('sdasz80'),
      noInitialRun:true,
      //logReadFiles:true,
      print:match_asm_fn,
      printErr:match_asm_fn,
    });
    var FS = ASZ80['FS'];
    populateFiles(step, FS);
    execMain(step, ASZ80, ['-plosgffwy', step.path]);
    if (errors.length) {
      return {errors:errors};
    }
    objout = FS.readFile(objpath, {encoding:'utf8'});
    lstout = FS.readFile(lstpath, {encoding:'utf8'});
    putWorkFile(objpath, objout);
    putWorkFile(lstpath, lstout);
  }
  return {
    linktool:"sdldz80",
    files:[objpath, lstpath],
    args:[objpath]
  };
  //symout = FS.readFile("main.sym", {encoding:'utf8'});
}

function linkSDLDZ80(step:BuildStep)
{
  loadNative("sdldz80");
  var errors = [];
  gatherFiles(step);
  var binpath = "main.ihx";
  if (staleFiles(step, [binpath])) {
    //?ASlink-Warning-Undefined Global '__divsint' referenced by module 'main'
    var match_aslink_re = /\?ASlink-(\w+)-(.+)/;
    var match_aslink_fn = (s:string) => {
      var matches = match_aslink_re.exec(s);
      if (matches) {
        errors.push({
          line:0,
          msg:matches[2]
        });
      }
    }
    var params = step.params;
    var LDZ80 = emglobal.sdldz80({
      instantiateWasm: moduleInstFn('sdldz80'),
      noInitialRun:true,
      //logReadFiles:true,
      print:match_aslink_fn,
      printErr:match_aslink_fn,
    });
    var FS = LDZ80['FS'];
    setupFS(FS, 'sdcc');
    populateFiles(step, FS);
    populateExtraFiles(step, FS, params.extra_link_files);
    // TODO: coleco hack so that -u flag works
    if (step.platform.startsWith("coleco")) {
      FS.writeFile('crt0.rel', FS.readFile('/share/lib/coleco/crt0.rel', {encoding:'utf8'}));
      FS.writeFile('crt0.lst', '\n'); // TODO: needed so -u flag works
    }
    var args = ['-mjwxyu',
      '-i', 'main.ihx', // TODO: main?
      '-b', '_CODE=0x'+params.code_start.toString(16),
      '-b', '_DATA=0x'+params.data_start.toString(16),
      '-k', '/share/lib/z80',
      '-l', 'z80'];
    if (params.extra_link_args)
      args.push.apply(args, params.extra_link_args);
    args.push.apply(args, step.args);
    //console.log(args);
    execMain(step, LDZ80, args);
    var hexout = FS.readFile("main.ihx", {encoding:'utf8'});
    var mapout = FS.readFile("main.noi", {encoding:'utf8'});
    //console.log(mapout);
    putWorkFile("main.ihx", hexout);
    putWorkFile("main.noi", mapout);
    // return unchanged if no files changed
    if (!anyTargetChanged(step, ["main.ihx", "main.noi"]))
      return;

    var listings = {};
    for (var fn of step.files) {
      if (fn.endsWith('.lst')) {
        var rstout = FS.readFile(fn.replace('.lst','.rst'), {encoding:'utf8'});
        //   0000 21 02 00      [10]   52 	ld	hl, #2
        var asmlines = parseListing(rstout, /^\s*([0-9A-F]+)\s+([0-9A-F][0-9A-F r]*[0-9A-F])\s+\[([0-9 ]+)\]\s+(\d+) (.*)/i, 4, 1, 2);
        var srclines = parseSourceLines(rstout, /^\s+\d+ ;<stdin>:(\d+):/i, /^\s*([0-9A-F]{4})/i);
        putWorkFile(fn, rstout);
        // TODO: you have to get rid of all source lines to get asm listing
        listings[fn] = {
          asmlines:srclines.length ? asmlines : null,
          lines:srclines.length ? srclines : asmlines,
          text:rstout
        };
      }
    }
    // parse symbol map
    var symbolmap = {};
    for (var s of mapout.split("\n")) {
      var toks = s.split(" ");
      if (toks[0] == 'DEF' && !toks[1].startsWith("A$main$")) {
        symbolmap[toks[1]] = parseInt(toks[2], 16);
      }
    }
    return {
      output:parseIHX(hexout, params.rom_start!==undefined?params.rom_start:params.code_start, params.rom_size),
      listings:listings,
      errors:errors,
      symbolmap:symbolmap,
    };
  }
}

var sdcc;
function compileSDCC(step:BuildStep) {

  gatherFiles(step, {
    mainFilePath:"main.c" // not used
  });
  var outpath = step.prefix + ".asm";
  if (staleFiles(step, [outpath])) {
    var errors = [];
    var params = step.params;
    loadNative('sdcc');
    var SDCC = sdcc({
      instantiateWasm: moduleInstFn('sdcc'),
      noInitialRun:true,
      noFSInit:true,
      print:print_fn,
      printErr:msvcErrorMatcher(errors),
      //TOTAL_MEMORY:256*1024*1024,
    });
    var FS = SDCC['FS'];
    populateFiles(step, FS);
    // load source file and preprocess
    var code = getWorkFileAsString(step.path);
    var preproc = preprocessMCPP(step);
    if (preproc.errors) return preproc;
    else code = preproc.code;
    // pipe file to stdin
    setupStdin(FS, code);
    setupFS(FS, 'sdcc');
    var args = ['--vc', '--std-sdcc99', '-mz80', //'-Wall',
      '--c1mode',
      //'--debug',
      //'-S', 'main.c',
      //'--asm=sdasz80',
      //'--reserve-regs-iy',
      '--less-pedantic',
      ///'--fomit-frame-pointer',
      //'--opt-code-speed',
      '--oldralloc',
      //'--max-allocs-per-node', '1000',
      //'--cyclomatic',
      //'--nooverlay',
      //'--nogcse',
      //'--nolabelopt',
      //'--noinvariant',
      //'--noinduction',
      //'--nojtbound',
      //'--noloopreverse',
      '--no-peep',
      '--nolospre',
      '-o', outpath];
    if (params.extra_compile_args) {
      args.push.apply(args, params.extra_compile_args);
    }
    execMain(step, SDCC, args);
    // TODO: preprocessor errors w/ correct file
    if (errors.length /* && nwarnings < msvc_errors.length*/) {
      return {errors:errors};
    }
    // massage the asm output
    var asmout = FS.readFile(outpath, {encoding:'utf8'});
    asmout = " .area _HOME\n .area _CODE\n .area _INITIALIZER\n .area _DATA\n .area _INITIALIZED\n .area _BSEG\n .area _BSS\n .area _HEAP\n" + asmout;
    putWorkFile(outpath, asmout);
  }
  return {
    nexttool:"sdasz80",
    path:outpath,
    args:[outpath],
    files:[outpath],
  };
}

function makeCPPSafe(s:string) : string {
  return s.replace(/[^A-Za-z0-9_]/g,'_');
}

function preprocessMCPP(step:BuildStep) {
  load("mcpp");
  var platform = step.platform;
  var params = PLATFORM_PARAMS[platform];
  if (!params) throw Error("Platform not supported: " + platform);
  // <stdin>:2: error: Can't open include file "foo.h"
  var errors = [];
  var match_fn = makeErrorMatcher(errors, /<stdin>:(\d+): (.+)/, 1, 2, step.path);
  var MCPP = emglobal.mcpp({
    noInitialRun:true,
    noFSInit:true,
    print:print_fn,
    printErr:match_fn,
  });
  var FS = MCPP['FS'];
  setupFS(FS, 'sdcc'); // TODO: toolname
  populateFiles(step, FS);
  populateExtraFiles(step, FS, params.extra_compile_files);
  // TODO: make configurable by other compilers
  var args = [
    "-D", "__8BITWORKSHOP__",
    "-D", "__SDCC_z80",
    "-D", makeCPPSafe(platform.toUpperCase()),
    "-I", "/share/include",
    "-Q",
    step.path, "main.i"];
  if (step.mainfile) {
    args.unshift.apply(args, ["-D", "__MAIN__"]);
  }
  if (params.extra_preproc_args) {
    args.push.apply(args, params.extra_preproc_args);
  }
  MCPP.callMain(args);
  if (errors.length)
    return {errors:errors};
  var iout = FS.readFile("main.i", {encoding:'utf8'});
  iout = iout.replace(/^#line /gm,'\n# ');
  try {
    var errout = FS.readFile("mcpp.err", {encoding:'utf8'});
    if (errout.length) {
      // //main.c:2: error: Can't open include file "stdiosd.h"
      var errors = extractErrors(/[^:]+:(\d+): (.+)/, errout.split("\n"), step.path);
      if (errors.length == 0) {
        errors = [{line:0, msg:errout}];
      }
      return {errors: errors};
    }
  } catch (e) {
    //
  }
  return {code:iout};
}

// TODO: must be a better way to do all this

function detectModuleName(code:string) {
  var m = /^\s*module\s+(\w+_top)\b/m.exec(code)
       || /^\s*module\s+(top)\b/m.exec(code)
       || /^\s*module\s+(\w+)\b/m.exec(code);
  return m ? m[1] : null;
}

function detectTopModuleName(code:string) {
  var topmod = detectModuleName(code) || "top";
  var m = /^\s*module\s+(\w+?_top)/m.exec(code);
  if (m && m[1]) topmod = m[1];
  return topmod;
}

// cached stuff (TODO)
var jsasm_module_top;
var jsasm_module_output;
var jsasm_module_key;

function compileJSASM(asmcode:string, platform, options, is_inline) {
  loadGen("worker/assembler");
  var asm = new emglobal.exports.Assembler();
  var includes = [];
  asm.loadJSON = (filename:string) => {
    var jsontext = getWorkFileAsString(filename);
    if (!jsontext) throw "could not load " + filename;
    return JSON.parse(jsontext);
  };
  asm.loadInclude = function(filename) {
    if (!filename.startsWith('"') || !filename.endsWith('"'))
      return 'Expected filename in "double quotes"';
    filename = filename.substr(1, filename.length-2);
    includes.push(filename);
  };
  var loaded_module = false;
  asm.loadModule = function(top_module) {
    // compile last file in list
    loaded_module = true;
    var key = top_module + '/' + includes;
    if (jsasm_module_key != key) {
      jsasm_module_key = key;
      jsasm_module_output = null;
    }
    jsasm_module_top = top_module;
    var main_filename = includes[includes.length-1];
    // TODO: take out .asm dependency
    var voutput = compileVerilator({platform:platform, files:includes, path:main_filename, tool:'verilator'});
    if (voutput)
      jsasm_module_output = voutput;
  }
  var result = asm.assembleFile(asmcode);
  if (loaded_module && jsasm_module_output) {
    // errors? return them
    if (jsasm_module_output.errors && jsasm_module_output.errors.length)
      return jsasm_module_output;
    // return program ROM array
    var asmout = result.output;
    // TODO: unify
    result.output = jsasm_module_output.output;
    result.output.program_rom = asmout;
    // cpu_platform__DOT__program_rom
    result.output.program_rom_variable = jsasm_module_top + "__DOT__program_rom";
    result.listings = {};
    result.listings[options.path] = {lines:result.lines};
  }
  return result;
}

function compileJSASMStep(step:BuildStep) {
  gatherFiles(step);
  var code = getWorkFileAsString(step.path);
  var platform = step.platform || 'verilog';
  return compileJSASM(code, platform, step, false);
}

function compileInlineASM(code:string, platform, options, errors, asmlines) {
  code = code.replace(/__asm\b([\s\S]+?)\b__endasm\b/g, function(s,asmcode,index) {
    var firstline = code.substr(0,index).match(/\n/g).length;
    var asmout = compileJSASM(asmcode, platform, options, true);
    if (asmout.errors && asmout.errors.length) {
      for (var i=0; i<asmout.errors.length; i++) {
        asmout.errors[i].line += firstline;
        errors.push(asmout.errors[i]);
      }
      return "";
    } else if (asmout.output) {
      let s = "";
      var out = asmout.output;
      for (var i=0; i<out.length; i++) {
        if (i>0) s += ",";
        s += 0|out[i];
      }
      if (asmlines) {
        var al = asmout.lines;
        for (var i=0; i<al.length; i++) {
          al[i].line += firstline;
          asmlines.push(al[i]);
        }
      }
      return s;
    }
  });
  return code;
}

function compileVerilator(step:BuildStep) {
  loadNative("verilator_bin");
  loadGen("worker/verilator2js");
  var platform = step.platform || 'verilog';
  var errors = [];
  var asmlines = [];
  gatherFiles(step);
  // compile verilog if files are stale
  var outjs = "main.js";
  if (staleFiles(step, [outjs])) {
    var match_fn = makeErrorMatcher(errors, /%(.+?): (.+?):(\d+)?[:]?\s*(.+)/i, 3, 4, step.path, 2);
    var verilator_mod = emglobal.verilator_bin({
      instantiateWasm: moduleInstFn('verilator_bin'),
      noInitialRun:true,
      print:print_fn,
      printErr:match_fn,
      TOTAL_MEMORY:256*1024*1024,
    });
    var code = getWorkFileAsString(step.path);
    var topmod = detectTopModuleName(code);
    var FS = verilator_mod['FS'];
    populateFiles(step, FS, {
      mainFilePath:step.path,
      processFn:(code) => {
        return compileInlineASM(code, platform, step, errors, asmlines);
      }
    });
    starttime();
    try {
      var args = ["--cc", "-O3", "-DEXT_INLINE_ASM", "-DTOPMOD__"+topmod,
        "-Wall", "-Wno-DECLFILENAME", "-Wno-UNUSED", '--report-unoptflat',
        "--x-assign", "fast", "--noassert", "--pins-bv", "33",
        "--top-module", topmod, step.path]
      verilator_mod.callMain(args);
    } catch (e) {
      console.log(e);
      errors.push({line:0,msg:"Compiler internal error: " + e});
    }
    endtime("compile");
    // remove boring errors
    errors = errors.filter(function(e) { return !/Exiting due to \d+/.exec(e.msg); }, errors);
    errors = errors.filter(function(e) { return !/Use ["][/][*]/.exec(e.msg); }, errors);
    if (errors.length) {
      return {errors:errors};
    }
    try {
      var h_file = FS.readFile("obj_dir/V"+topmod+".h", {encoding:'utf8'});
      var cpp_file = FS.readFile("obj_dir/V"+topmod+".cpp", {encoding:'utf8'});
      var rtn = translateVerilatorOutputToJS(h_file, cpp_file);
      putWorkFile(outjs, rtn.output.code);
      if (!anyTargetChanged(step, [outjs]))
        return;
    } catch(e) {
      console.log(e);
      errors.push({line:0,msg:""+e});
      return {errors:errors};
    }
    //rtn.intermediate = {listing:h_file + cpp_file}; // TODO
    var listings = {};
    // TODO: what if found in non-top-module?
    if (asmlines.length)
      listings[step.path] = {lines:asmlines};
    return {
      output: rtn.output,
      errors: errors,
      listings: listings,
    };
  }
}

// TODO: test
function compileYosys(step:BuildStep) {
  loadNative("yosys");
  var code = step.code;
  var errors = [];
  var match_fn = makeErrorMatcher(errors, /ERROR: (.+?) in line (.+?[.]v):(\d+)[: ]+(.+)/i, 3, 4, step.path);
  starttime();
  var yosys_mod = emglobal.yosys({
    instantiateWasm: moduleInstFn('yosys'),
    noInitialRun:true,
    print:print_fn,
    printErr:match_fn,
  });
  endtime("create module");
  var topmod = detectTopModuleName(code);
  var FS = yosys_mod['FS'];
  FS.writeFile(topmod+".v", code);
  starttime();
  try {
    yosys_mod.callMain(["-q", "-o", topmod+".json", "-S", topmod+".v"]);
  } catch (e) {
    console.log(e);
    endtime("compile");
    return {errors:errors};
  }
  endtime("compile");
  //TODO: filename in errors
  if (errors.length) return {errors:errors};
  try {
    var json_file = FS.readFile(topmod+".json", {encoding:'utf8'});
    var json = JSON.parse(json_file);
    console.log(json);
    return {yosys_json:json, errors:errors}; // TODO
  } catch(e) {
    console.log(e);
    return {errors:errors};
  }
}

function assembleZMAC(step:BuildStep) {
  loadNative("zmac");
  var hexout, lstout, binout;
  var errors = [];
  var params = step.params;
  gatherFiles(step, {mainFilePath:"main.asm"});
  var lstpath = step.prefix + ".lst";
  var binpath = step.prefix + ".cim";
  if (staleFiles(step, [binpath, lstpath])) {
  /*
error1.asm(4) : 'l18d4' Undeclared
       JP      L18D4

error1.asm(11): warning: 'foobar' treated as label (instruction typo?)
	Add a colon or move to first column to stop this warning.
1 errors (see listing if no diagnostics appeared here)
  */
    var ZMAC = emglobal.zmac({
      instantiateWasm: moduleInstFn('zmac'),
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:makeErrorMatcher(errors, /([^( ]+)\s*[(](\d+)[)]\s*:\s*(.+)/, 2, 3, step.path),
    });
    var FS = ZMAC['FS'];
    populateFiles(step, FS);
    // TODO: don't know why CIM (hexary) doesn't work
    execMain(step, ZMAC, ['-z', '-c', '--oo', 'lst,cim', step.path]);
    if (errors.length) {
      return {errors:errors};
    }
    lstout = FS.readFile("zout/"+lstpath, {encoding:'utf8'});
    binout = FS.readFile("zout/"+binpath, {encoding:'binary'});
    putWorkFile(binpath, binout);
    putWorkFile(lstpath, lstout);
    if (!anyTargetChanged(step, [binpath, lstpath]))
      return;
    //  230: 1739+7+x   017A  1600      L017A: LD      D,00h
    var lines = parseListing(lstout, /\s*(\d+):\s*([0-9a-f]+)\s+([0-9a-f]+)\s+(.+)/i, 1, 2, 3);
    var listings = {};
    listings[lstpath] = {lines:lines};
    // parse symbol table
    var symbolmap = {};
    var sympos = lstout.indexOf('Symbol Table:');
    if (sympos > 0) {
      var symout = lstout.slice(sympos+14);
      symout.split('\n').forEach(function(l) {
        var m = l.match(/(\S+)\s+([= ]*)([0-9a-f]+)/i);
        if (m) {
          symbolmap[m[1]] = parseInt(m[3],16);
        }
      });
    }
    return {
      output:binout,
      listings:listings,
      errors:errors,
      symbolmap:symbolmap
    };
  }
}

function preprocessBatariBasic(code:string) : string {
  load("bbpreprocess");
  var bbout = "";
  function addbbout_fn(s) {
    bbout += s;
    bbout += "\n";
  }
  var BBPRE = emglobal.preprocess({
    noInitialRun:true,
    //logReadFiles:true,
    print:addbbout_fn,
    printErr:print_fn,
    noFSInit:true,
  });
  var FS = BBPRE['FS'];
  setupStdin(FS, code);
  BBPRE.callMain([]);
  console.log("preprocess " + code.length + " -> " + bbout.length + " bytes");
  return bbout;
}

function compileBatariBasic(step:BuildStep) {
  load("bb2600basic");
  var params = step.params;
  // stdout
  var asmout = "";
  function addasmout_fn(s) {
    asmout += s;
    asmout += "\n";
  }
  // stderr
  var re_err1 = /[(](\d+)[)]:?\s*(.+)/;
  var errors = [];
  var errline = 0;
  function match_fn(s) {
    console.log(s);
    var matches = re_err1.exec(s);
    if (matches) {
      errline = parseInt(matches[1]);
      errors.push({
        line:errline,
        msg:matches[2]
      });
    }
  }
  gatherFiles(step, {mainFilePath:"main.bas"});
  var destpath = step.prefix + '.asm';
  if (staleFiles(step, [destpath])) {
    var BB = emglobal.bb2600basic({
      noInitialRun:true,
      //logReadFiles:true,
      print:addasmout_fn,
      printErr:match_fn,
      noFSInit:true,
      TOTAL_MEMORY:64*1024*1024,
    });
    var FS = BB['FS'];
    populateFiles(step, FS);
    // preprocess, pipe file to stdin
    var code = getWorkFileAsString(step.path);
    code = preprocessBatariBasic(code);
    setupStdin(FS, code);
    setupFS(FS, '2600basic');
    execMain(step, BB, ["-i", "/share", step.path]);
    if (errors.length)
      return {errors:errors};
    // build final assembly output from include file list
    var includesout = FS.readFile("includes.bB", {encoding:'utf8'});
    var redefsout = FS.readFile("2600basic_variable_redefs.h", {encoding:'utf8'});
    var includes = includesout.trim().split("\n");
    var combinedasm = "";
    var splitasm = asmout.split("bB.asm file is split here");
    for (var incfile of includes) {
      var inctext;
      if (incfile=="bB.asm")
        inctext = splitasm[0];
      else if (incfile=="bB2.asm")
        inctext = splitasm[1];
      else
        inctext = FS.readFile("/share/includes/"+incfile, {encoding:'utf8'});
      console.log(incfile, inctext.length);
      combinedasm += "\n\n;;;" + incfile + "\n\n";
      combinedasm += inctext;
    }
    // TODO: ; bB.asm file is split here
    putWorkFile(destpath, combinedasm);
    putWorkFile("2600basic.h", FS.readFile("/share/includes/2600basic.h"));
    putWorkFile("2600basic_variable_redefs.h", redefsout);
  }
  return {
    nexttool:"dasm",
    path:destpath,
    args:[destpath],
    files:[destpath, "2600basic.h", "2600basic_variable_redefs.h"],
    bblines:true,
  };
}

function setupRequireFunction() {
  var exports = {};
  exports['jsdom'] = {
    JSDOM: function(a,b) {
      this.window = {};
    }
  };
  emglobal['require'] = (modname:string) => {
    console.log('require',modname);
    return exports[modname];
  }
}

function translateShowdown(step:BuildStep) {
  setupRequireFunction();
  load("showdown.min");
  var showdown = emglobal['showdown'];
  var converter = new showdown.Converter({
    tables:'true',
    smoothLivePreview:'true',
    requireSpaceBeforeHeadingText:'true',
    emoji:'true',
  });
  var code = getWorkFileAsString(step.path);
  var html = converter.makeHtml(code);
  delete emglobal['require'];
  return {
    output:html
  };
}

////////////////////////////

var TOOLS = {
  'dasm': assembleDASM,

  //'acme': assembleACME,
  //'plasm': compilePLASMA,
  'cc65': compileCC65,
  'ca65': assembleCA65,
  'ld65': linkLD65,
  //'z80asm': assembleZ80ASM,
  //'sccz80': compileSCCZ80,
  'sdasz80': assembleSDASZ80,
  'sdldz80': linkSDLDZ80,
  'sdcc': compileSDCC,
  //'xasm6809': assembleXASM6809,
  //'naken': assembleNAKEN,
  'verilator': compileVerilator,
  'yosys': compileYosys,
  //'caspr': compileCASPR,
  'jsasm': compileJSASMStep,
  'zmac': assembleZMAC,
  'bataribasic': compileBatariBasic,
  'markdown': translateShowdown,
}

var TOOL_PRELOADFS = {
  'cc65-apple2': '65-apple2',
  'ca65-apple2': '65-apple2',
  'cc65-c64': '65-c64',
  'ca65-c64': '65-c64',
  'cc65-nes': '65-nes',
  'ca65-nes': '65-nes',
  'cc65-atari8': '65-atari8',
  'ca65-atari8': '65-atari8',
  'sdasz80': 'sdcc',
  'sdcc': 'sdcc',
  'sccz80': 'sccz80',
  'bataribasic': '2600basic',
}

function applyDefaultErrorPath(errors:WorkerError[], path:string) {
  if (!path) return;
  for (var i=0; i<errors.length; i++) {
    var err = errors[i];
    if (!err.path && err.line) err.path = path;
  }
}

function executeBuildSteps() {
  buildstartseq = workerseq;
  while (buildsteps.length) {
    var step = buildsteps.shift(); // get top of array
    var platform = step.platform;
    var toolfn = TOOLS[step.tool];
    if (!toolfn) throw "no tool named " + step.tool;
    step.params = PLATFORM_PARAMS[platform];
    console.log(step.platform + " " + step.tool);
    try {
      step.result = toolfn(step);
    } catch (e) {
      console.log("EXCEPTION", e.stack);
      return {errors:[{line:0, msg:e+""}]}; // TODO: catch errors already generated?
    }
    if (step.result) {
      step.result.params = step.params;
      // errors? return them
      if (step.result.errors && step.result.errors.length) {
        applyDefaultErrorPath(step.result.errors, step.path);
        return step.result;
      }
      // if we got some output, return it immediately
      if (step.result.output) {
        return step.result;
      }
      // combine files with a link tool?
      if (step.result.linktool) {
        var linkstep = {
          tool:step.result.linktool,
          platform:platform,
          files:step.result.files,
          args:step.result.args
        };
        step.generated = linkstep.files;
        // find previous link step to combine
        for (var i=0; i<buildsteps.length; i++) {
          var ls = buildsteps[i];
          if (ls.tool == linkstep.tool && ls.platform == linkstep.platform && ls.files && ls.args) {
            ls.files = ls.files.concat(linkstep.files);
            ls.args = ls.args.concat(linkstep.args);
            linkstep = null;
            break;
          }
        }
        if (linkstep) buildsteps.push(linkstep);
      }
      // process with another tool?
      if (step.result.nexttool) {
        var asmstep = step.result;
        asmstep.tool = step.result.nexttool;
        asmstep.platform = platform;
        buildsteps.push(asmstep); // TODO: unshift changes order
        step.generated = asmstep.files;
      }
    }
  }
}

function handleMessage(data : WorkerMessage) : WorkerResult {
  // preload file system
  if (data.preload) {
    var fs = TOOL_PRELOADFS[data.preload];
    if (!fs && data.platform)
      fs = TOOL_PRELOADFS[data.preload+'-'+data.platform.split('-')[0]];
    if (fs && !fsMeta[fs])
      loadFilesystem(fs);
    return;
  }
  // clear filesystem? (TODO: buildkey)
  if (data.reset) {
    workfs = {};
    return;
  }
  buildsteps = [];
  // file updates
  if (data.updates) {
    for (var i=0; i<data.updates.length; i++) {
      var u = data.updates[i];
      putWorkFile(u.path, u.data);
    }
  }
  // build steps
  if (data.buildsteps) {
    buildsteps.push.apply(buildsteps, data.buildsteps);
  }
  // single-file
  if (data.code) {
    buildsteps.push(data);
  }
  // execute build steps
  if (buildsteps.length) {
    var result = executeBuildSteps();
    return result ? result : {unchanged:true};
  }
  // TODO: cache results
  // message not recognized
  console.log("Unknown message",data);
}

if (ENVIRONMENT_IS_WORKER) {
  onmessage = function(e) {
    var result = handleMessage(e.data);
    if (result) {
      postMessage(result);
    }
  }
}
