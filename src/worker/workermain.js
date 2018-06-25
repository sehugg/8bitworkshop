"use strict";

var PLATFORM_PARAMS = {
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
    extra_link_args: ['-k', '/share/lib/coleco',
      '-l', 'libcv', '-l', 'libcvu', 'crt0.rel', //'/share/lib/coleco/crt0.rel',
      //'-l', 'comp.lib', '-l', 'cvlib.lib', '-l', 'getput.lib', '/share/lib/coleco/crtcv.rel',
      'main.rel'],
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
    code_offset: 0x803, // TODO: parse segment list
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
    code_offset: 0xa000, // TODO
  },
  'atari8-5200': {
    define: '__ATARI5200__',
    cfgfile: 'atari5200.cfg',
    libargs: ['atari5200.lib'],
    code_offset: 0x4000, // TODO
  },
  'c64': {
    define: '__C64__',
    cfgfile: 'c64.cfg',
    libargs: ['c64.lib'],
    code_offset: 0x4000, // TODO
  },
  'verilog': {
  },
};

// shim out window and document objects for security
// https://github.com/mbostock/d3/issues/1053
var noop = function() { return new Function(); };
var window = noop();
window.CSSStyleDeclaration = noop();
window.CSSStyleDeclaration.setProperty = noop();
window.Element = noop();
window.Element.setAttribute = noop();
window.Element.setAttributeNS = noop();
window.navigator = noop();
var document = noop();
document.documentElement = noop();
document.documentElement.style = noop();

var _t1, _t2;
function starttime() { _t1 = new Date(); }
function endtime(msg) { _t2 = new Date(); console.log(msg, _t2.getTime() - _t1.getTime(), "ms"); }

/// working file store and build steps

var buildsteps = [];
var workfs = {};
var workerseq = 1;

function compareData(a,b) {
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

function putWorkFile(path, data) {
  var encoding = (typeof data === 'string') ? 'utf8' : 'binary';
  var entry = workfs[path];
  if (!entry || !compareData(entry.data, data) || entry.encoding != encoding) {
    workfs[path] = entry = {path:path, data:data, encoding:encoding, ts:workerseq++};
    console.log('+++', entry.path, entry.encoding, entry.data.length, entry.ts);
  }
  return entry;
}

function populateEntry(fs, path, entry) {
  fs.writeFile(path, entry.data, {encoding:entry.encoding});
  fs.utime(path, entry.ts, entry.ts);
  console.log("<<<", path);
}

// can call multiple times (from populateFiles)
function gatherFiles(step, options) {
  var maxts = 0;
  if (step.files) {
    for (var i=0; i<step.files.length; i++) {
      var path = step.files[i];
      var entry = workfs[path];
      maxts = Math.max(maxts, entry.ts);
    }
  }
  else if (step.code && options.mainFilePath) {
    var path = options.mainFilePath;
    var code = step.code;
    if (options.transform) code = options.transform(code);
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

function populateFiles(step, fs, options) {
  gatherFiles(step, options);
  if (!step.files) throw "call gatherFiles() first";
  for (var i=0; i<step.files.length; i++) {
    var path = step.files[i];
    populateEntry(fs, path, workfs[path]);
  }
}

function staleFiles(step, targets) {
  if (!step.maxts) throw "call populateFiles() first";
  for (var i=0; i<targets.length; i++) {
    var entry = workfs[targets[i]];
    if (!entry || step.maxts > entry.ts)
      return true;
  }
  console.log("unchanged", step.maxts, targets);
  return false;
}

function execMain(step, mod, args) {
  starttime();
  mod.callMain(args);
  endtime(step.tool);
}

/// asm.js / WASM / filesystem loading

var fsMeta = {};
var fsBlob = {};
var wasmBlob = {};

// load filesystems for CC65 and others asynchronously
function loadFilesystem(name) {
  var xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.open("GET", "fs/fs"+name+".data", false);  // synchronous request
  xhr.send(null);
  fsBlob[name] = xhr.response;
  xhr = new XMLHttpRequest();
  xhr.responseType = 'json';
  xhr.open("GET", "fs/fs"+name+".js.metadata", false);  // synchronous request
  xhr.send(null);
  fsMeta[name] = xhr.response;
  console.log("Loaded "+name+" filesystem", fsMeta[name].files.length, 'files', fsBlob[name].size, 'bytes');
}

var loaded = {}
function load(modulename, debug) {
  if (!loaded[modulename]) {
    importScripts('asmjs/'+modulename+(debug?"."+debug+".js":".js"));
    loaded[modulename] = 1;
  }
}
function loadWASM(modulename, debug) {
  if (!loaded[modulename]) {
    importScripts("wasm/" + modulename+(debug?"."+debug+".js":".js"));
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'arraybuffer';
    xhr.open("GET", "wasm/"+modulename+".wasm", false);  // synchronous request
    xhr.send(null);
    if (xhr.response) {
      wasmBlob[modulename] = xhr.response; //new Uint8Array(xhr.response);
      console.log("Loaded " + modulename + ".wasm");
      loaded[modulename] = 1;
    } else {
      throw Error("Could not load WASM file " + modulename + ".wasm");
    }
  }
}
function loadNative(modulename, debug) {
  // detect WASM
  if (typeof WebAssembly === 'object') {
    loadWASM(modulename);
  } else {
    load(modulename);
  }
}

// mount the filesystem at /share
function setupFS(FS, name) {
  FS.mkdir('/share');
  FS.mount(FS.filesystems['WORKERFS'], {
    packages: [{ metadata: fsMeta[name], blob: fsBlob[name] }]
  }, '/share');
}

var DASM_PREAMBLE = "\tprocessor 6502\n";
var DASM_PREAMBLE_LINES = 1;

var print_fn = function(s) {
  console.log(s);
  //console.log(new Error().stack);
}

// test.c(6) : warning 85: in function main unreferenced local variable : 'x'
// main.a (4): error: Unknown Mnemonic 'xxx'.
// at 2: warning 190: ISO C forbids an empty source file
var re_msvc  = /([^(]+)\s*[(](\d+)[)]\s*:\s*(.+?):\s*(.*)/;
var re_msvc2 = /\s*(at)\s+(\d+)\s*(:)\s*(.*)/;

function msvcErrorMatcher(errors) {
  return function(s) {
    var matches = re_msvc.exec(s) || re_msvc2.exec(s);
    if (matches) {
      var errline = parseInt(matches[2]);
      errors.push({
        line:errline,
        file:matches[1],
        type:matches[3],
        msg:matches[4]
      });
    } else {
      console.log(s);
    }
  }
}

function makeErrorMatcher(errors, regex, iline, imsg) {
  return function(s) {
    var matches = regex.exec(s);
    if (matches) {
      errors.push({
        line:parseInt(matches[iline]) || 1,
        msg:matches[imsg]
      });
    } else {
      console.log(s);
    }
  }
}

function extractErrors(regex, strings) {
  var errors = [];
  var matcher = makeErrorMatcher(errors, regex, 1, 2);
  for (var i=0; i<strings.length; i++) {
    matcher(strings[i]);
  }
  return errors;
}

function parseListing(code, lineMatch, iline, ioffset, iinsns, origin) {
  var lines = [];
  origin |= 0;
  for (var line of code.split(/\r?\n/)) {
    var linem = lineMatch.exec(line);
    if (linem && linem[1]) {
      var linenum = parseInt(linem[iline]);
      var offset = parseInt(linem[ioffset], 16);
      var insns = linem[iinsns];
      if (insns) {
        lines.push({
          line:linenum,
          offset:offset + origin,
          insns:insns,
        });
      }
    }
  }
  return lines;
}

function parseSourceLines(code, lineMatch, offsetMatch, origin) {
  var lines = [];
  var lastlinenum = 0;
  origin |= 0;
  for (var line of code.split(/\r?\n/)) {
    var linem = lineMatch.exec(line);
    if (linem && linem[1]) {
      lastlinenum = parseInt(linem[1]);
    } else if (lastlinenum) {
      var linem = offsetMatch.exec(line);
      if (linem && linem[1]) {
        var offset = parseInt(linem[1], 16);
        lines.push({
          line:lastlinenum,
          offset:offset + origin,
        });
        lastlinenum = 0;
      }
    }
  }
  return lines;
}

function parseDASMListing(code, unresolved, mainFilename) {
  //        4  08ee		       a9 00	   start      lda	#01workermain.js:23:5
  var lineMatch = /\s*(\d+)\s+(\S+)\s+([0-9a-f]+)\s+([0-9a-f][0-9a-f ]+)?\s+(.+)?/;
  var equMatch = /\bequ\b/;
  var errors = [];
  var lines = [];
  var lastline = 0;
  for (var line of code.split(/\r?\n/)) {
    var linem = lineMatch.exec(line);
    if (linem && linem[1]) {
      var linenum = parseInt(linem[1]) - DASM_PREAMBLE_LINES;
      var filename = linem[2];
      var offset = parseInt(linem[3], 16);
      var insns = linem[4];
      var restline = linem[5];
      // inside of main file?
      if (filename == mainFilename) {
        if (insns && !restline.match(equMatch)) {
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
      }
      // TODO: check filename too
      // TODO: better symbol test (word boundaries)
      for (var key in unresolved) {
        var pos = restline ? restline.indexOf(key) : line.indexOf(key);
        if (pos >= 0) {
          errors.push({
            line:linenum,
            msg:"Unresolved symbol '" + key + "'"
          });
        }
      }
    }
    var errm = re_msvc.exec(line);
    if (errm) {
      errors.push({
        line:parseInt(errm[2]),
        msg:errm[4]
      })
    }
  }
  return {lines:lines, errors:errors};
}

function assembleDASM(step) {
  load("dasm");
  var re_usl = /(\w+)\s+0000\s+[?][?][?][?]/;
  var unresolved = {};
  function match_fn(s) {
    var matches = re_usl.exec(s);
    if (matches) {
      unresolved[matches[1]] = 0;
    }
  }
  var Module = DASM({
    noInitialRun:true,
    print:match_fn
  });
  var FS = Module['FS'];
  var srcfn = 'main.a';
  populateFiles(step, FS, {
    mainFilePath:srcfn,
    transform:function(code) { return DASM_PREAMBLE + code; }
  });
  execMain(step, Module, [step.path, "-l"+step.prefix+".lst", "-o"+step.prefix+".bin"/*, "-v3", "-sa.sym"*/]);
  var aout = FS.readFile(step.prefix+".bin");
  var alst = FS.readFile(step.prefix+".lst", {'encoding':'utf8'});
  putWorkFile(step.prefix+".bin", aout);
  putWorkFile(step.prefix+".lst", alst);
  //var asym = FS.readFile("a.sym", {'encoding':'utf8'});
  var listing = parseDASMListing(alst, unresolved, srcfn);
  return {
    output:aout.slice(2),
    lines:listing.lines,
    errors:listing.errors,
    intermediate:{listing:alst},
  };
}

// TODO: not quite done
function assembleACME(code) {
  load("acme");
  // stderr
  var re_err2 = /(Error|Warning) - File (.+?), line (\d+) ([^:]+) (.*)/;
  var errors = [];
  var errline = 0;
  function match_fn(s) {
    var matches = re_err2.exec(s);
    if (matches) {
      errors.push({
        line:1, // TODO: parseInt(matches[3]),
        msg:matches[0] // TODO: matches[5]
      });
    }
  }
  var Module = ACME({
    noInitialRun:true,
    print:match_fn,
    printErr:match_fn
  });
  var FS = Module['FS'];
  FS.writeFile("main.a", code);
  // TODO: --msvc
  Module.callMain(["-o", "a.out", "-r", "a.rpt", "-l", "a.sym", "--setpc", "24576", "main.a"]);
  if (errors.length) {
    return {errors:errors};
  }
  var aout = FS.readFile("a.out");
  var alst = FS.readFile("a.rpt", {'encoding':'utf8'});
  var asym = FS.readFile("a.sym", {'encoding':'utf8'});
  var listing = parseDASMListing(alst, {}); // TODO
  return {
    output:aout,
    lines:listing.lines,
    errors:listing.errors,
    intermediate:{listing:alst, symbols:asym},
  };
}

function setupStdin(fs, code) {
  var i = 0;
  fs.init(
    function() { return i<code.length ? code.charCodeAt(i++) : null; }
  );
}

function compilePLASMA(code) {
  load("plasm");
  // stdout
  var outstr = "";
  function out_fn(s) { outstr += s; outstr += "\n"; }
  // stderr
  var re_err1 = /\s*(\d+):.*/;
  var re_err2 = /Error: (.*)/;
  var errors = [];
  var errline = 0;
  function match_fn(s) {
    var matches = re_err1.exec(s);
    if (matches) {
      errline = parseInt(matches[1]);
    }
    matches = re_err2.exec(s);
    if (matches) {
      errors.push({
        line:errline,
        msg:matches[1]
      });
    }
  }
  var Module = PLASM({
    noInitialRun:true,
    noFSInit:true,
    print:out_fn,
    printErr:match_fn,
  });
  var FS = Module['FS'];
  var output = [];
  setupStdin(FS, code);
  //FS.writeFile("main.pla", code);
  Module.callMain(["-A"]);
  // TODO: have to make dummy 4-byte header so start ends up @ $803
  outstr = "\tnop\n\tnop\n\tnop\n\tnop\n" + outstr;
  // set code base and INTERP address
  outstr = "* = $7FF\n" + outstr;
  outstr = "INTERP = $e044\n" + outstr; // TODO
  if (errors.length) {
    return {errors:errors};
  }
  console.log(outstr);
  return assembleACME(outstr);
}

    /*
    000000r 1               .segment        "CODE"
    000000r 1               ; int main() { return mul2(2); }
    000000r 1                       .dbg    line, "main.c", 3
    000000r 1  A2 00                ldx     #$00
    */
function parseCA65Listing(code, symbols, dbg) {
  var segofs = 0;
  // .dbg	line, "main.c", 1
  var segLineMatch = /[.]segment\s+"(\w+)"/;
  //var dbgLineMatch = /^([0-9A-F]+)([r]?)\s+(\d+)\s+[.]dbg\s+line,\s+\S+,\s+(\d+)/;
  var dbgLineMatch = /^([0-9A-F]+)([r]?)\s+(\d+)\s+[.]dbg\s+line,\s+"(\w+[.]c)", (\d+)/;
  var insnLineMatch = /^([0-9A-F]+)([r]?)\s+(\d+)\s+([0-9A-F][0-9A-F ]*[0-9A-F])\s+/;
  var lines = [];
  var linenum = 0;
  for (var line of code.split(/\r?\n/)) {
    linenum++;
    var segm = segLineMatch.exec(line);
    if (segm) {
      var segname = segm[1];
      var segsym = '__'+segname+'_RUN__';
      // TODO: doesn't work on apple2, needs __MAIN_START__?
      segofs = parseInt(symbols[segsym])|0;
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

function assembleCA65(step) {
  loadNative("ca65");
  var errors = [];
  gatherFiles(step, {mainFilePath:"main.s"});
  var objpath = step.prefix+".o";
  var lstpath = step.prefix+".lst";
  if (staleFiles(step, [objpath, lstpath])) {
    var objout, lstout;
    var CA65 = ca65({
      wasmBinary: wasmBlob['ca65'],
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:msvcErrorMatcher(errors),
    });
    var FS = CA65['FS'];
    setupFS(FS, '65-'+step.platform.split('-')[0]);
    populateFiles(step, FS);
    execMain(step, CA65, ['-v', '-g', '-I', '/share/asminc', '-l', step.prefix+'.lst', step.prefix+".s"]);
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

function linkLD65(step) {
  loadNative("ld65");
  var params = step.params;
  var platform = step.platform;
  gatherFiles(step);
  var binpath = "main";
  if (staleFiles(step, [binpath])) {
    var errors = [];
    var LD65 = ld65({
      wasmBinary: wasmBlob['ld65'],
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:makeErrorMatcher(errors, /[(](\d+)[)]: (.+)/, 1, 2),
    });
    var FS = LD65['FS'];
    var cfgfile = '/' + platform + '.cfg';
    setupFS(FS, '65-'+platform.split('-')[0]);
    populateFiles(step, FS);
    var libargs = params.libargs;
    var args = ['--cfg-path', '/share/cfg',
      '--lib-path', '/share/lib',
      '--lib-path', '/share/target/apple2/drv', // TODO
      '-D', '__EXEHDR__=0', // TODO
      '-C', params.cfgfile,
      '-Ln', 'main.vice',
      //'--dbgfile', 'main.dbg',
      '-o', 'main', '-m', 'main.map'].concat(step.args, libargs);
    execMain(step, LD65, args);
    if (errors.length)
      return {errors:errors};
    var aout = FS.readFile("main", {encoding:'binary'});
    var mapout = FS.readFile("main.map", {encoding:'utf8'});
    var viceout = FS.readFile("main.vice", {encoding:'utf8'});
    // parse symbol map (TODO: omit segments, constants)
    var symbolmap = {};
    for (var s of viceout.split("\n")) {
      var toks = s.split(" ");
      if (toks[0] == 'al') {
        symbolmap[toks[2].substr(1)] = parseInt(toks[1], 16);
      }
    }
    // TODO: multiple listing files
    var lstout = FS.readFile("main.lst", {encoding:'utf8'});
    var asmlines = parseCA65Listing(lstout, symbolmap, false);
    var srclines = parseCA65Listing(lstout, symbolmap, true);
    putWorkFile("main", aout);
    putWorkFile("main.lst", lstout);
    putWorkFile("main.map", mapout);
    putWorkFile("main.vice", viceout);
    return {
      output:aout, //.slice(0),
      asmlines:srclines.length?asmlines:null,
      lines:srclines.length?srclines:asmlines,
      errors:errors,
      symbolmap:symbolmap,
      intermediate:{listing:lstout, map:mapout, symbols:viceout},
    };
  }
}

function compileCC65(step) {
  load("cc65");
  var params = step.params;
  // stderr
  var re_err1 = /.*?(\d+).*?: (.+)/;
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
    var CC65 = cc65({
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:match_fn,
    });
    var FS = CC65['FS'];
    setupFS(FS, '65-'+step.platform.split('-')[0]);
    populateFiles(step, FS);
    execMain(step, CC65, ['-T', '-g', /*'-Cl',*/
      '-Oirs',
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
    args:[destpath]
  };
}

function assembleZ80ASM(step) {
  load("z80asm");
  var Module = z80asm({
    noInitialRun:true,
    //logReadFiles:true,
    print:print_fn,
    printErr:function() {},
    TOTAL_MEMORY:256*1024*1024,
  });
  var FS = Module['FS'];
  //setupFS(FS);
  // changes for dialect
  populateFiles(step, FS, {
    mainFilePath:"main.asm",
    transform:function(code) {
      code = code.replace(".optsdcc -mz80","");
      code = code.replace(/^(\w+)\s*=/gim,"DEFC $1 =");
      code = code.replace(/\tXREF /gi,"\tEXTERN ");
      code = code.replace(/\tXDEF /gi,"\tPUBLIC ");
      return code;
    }
  });
  try {
    execMain(step, Module, ["-b", "-s", "-l", "-m", "-g", "--origin=" + origin.toString(16), step.prefix+".asm"]);
    try {
      var aerr = FS.readFile(step.prefix+".err", {'encoding':'utf8'}); // TODO
      if (aerr.length) {
        return {errors:extractErrors(/.+? line (\d+): (.+)/, aerr.split("\n"))};
      }
      // Warning at file 'test.asm' line 9: 'XREF' is deprecated, use 'EXTERN' instead
    } catch (e) {
    }
/*
77    0000              ;test.c:5: return 0;
78    0000  21 00 00    	ld	hl,$0000
*/
    var alst = FS.readFile(step.prefix+".lst", {'encoding':'utf8'}); // TODO
/*
_main                           = 0000, G: test
l_main00101                     = 0003, L: test
*/
    var amap = FS.readFile(step.prefix+".map", {'encoding':'utf8'}); // TODO
    var aout = FS.readFile(step.prefix+".bin", {'encoding':'binary'});
    var asmlines = parseListing(alst, /^(\d+)\s+([0-9A-F]+)\s+([0-9A-F][0-9A-F ]*[0-9A-F])\s+/i, 1, 2, 3);
    var srclines = parseListing(alst, /^(\d+)\s+([0-9A-F]+)\s+;[(]null[)]:(\d+)/i, 3, 2, 1);
    return {
      output:aout,
      errors:[],
      lines:asmlines,
      srclines:srclines,
      intermediate:{listing:alst, mapfile:amap},
    };
  } catch (e) {
    throw (e);
  }
}

function compileSCCZ80(code, platform) {
  var preproc = preprocessMCPP(code, platform, 'sccz80');
  if (preproc.errors) return preproc;
  else code = preproc.code;

  var params = PLATFORM_PARAMS[platform];
  if (!params) throw Error("Platform not supported: " + platform);
  var errors = [];
  var errorMatcher = makeErrorMatcher(errors, /sccz80:[^ ]+ L:(\d+) (.+)/, 1, 2);

  load('sccz80');
  //sccz80:hello.c L:1 Error:Can't open include file
  var SCCZ80 = sccz80({
    wasmBinary: wasmBlob['sccz80'],
    noInitialRun:true,
    //noFSInit:true,
    print:errorMatcher,
    printErr:errorMatcher,
    TOTAL_MEMORY:256*1024*1024,
  });
  var FS = SCCZ80['FS'];
  //setupStdin(FS, code);
  setupFS(FS, 'sccz80');
  code = code.replace('__asm', '#asm').replace('__endasm', '#endasm;');
  FS.writeFile("main.i", code, {encoding:'utf8'});
  var args = ['-ext=asm', '-opt-code-speed', '-mz80', '-standard-escape-chars', 'main.i', '-o', 'main.asm'];
  if (params.extra_compile_args) {
    args.push.apply(args, params.extra_compile_args);
  }
  starttime();
  SCCZ80.callMain(args);
  endtime("compile");
  // TODO: preprocessor errors w/ correct file
  if (errors.length /* && nwarnings < msvc_errors.length*/) {
    return {errors:errors};
  }
  try {
    var asmout = FS.readFile("main.asm", {encoding:'utf8'});
    //asmout = " .area _HOME\n .area _CODE\n .area _INITIALIZER\n .area _DATA\n .area _INITIALIZED\n .area _BSEG\n .area _BSS\n .area _HEAP\n" + asmout;
    //asmout = asmout.replace(".area _INITIALIZER",".area _CODE");
    asmout = asmout.replace('INCLUDE "', ';;;INCLUDE "')
  } catch (e) {
    errors.push({line:1, msg:e+""});
    return {errors:errors};
  }
  var warnings = errors;
  try {
    var result = assembleZ80ASM(asmout, platform, true);
  } catch (e) {
    errors.push({line:1, msg:e+""});
    return {errors:errors};
  }
  result.asmlines = result.lines;
  result.lines = result.srclines;
  result.srclines = null;
  return result;
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
      }
    }
  }
}

function assembleSDASZ80(step) {
  loadNative("sdasz80");
  var objout, lstout, symout;
  var errors = [];
  gatherFiles(step, {mainFilePath:"main.asm"});
  var objpath = step.prefix + ".rel";
  var lstpath = step.prefix + ".lst";
  if (staleFiles(step, [objpath, lstpath])) {
    //?ASxxxx-Error-<o> in line 1 of main.asm null
    //              <o> .org in REL area or directive / mnemonic error
    var match_asm_re = / <\w> (.+)/; // TODO
    function match_asm_fn(s) {
      var matches = match_asm_re.exec(s);
      if (matches) {
        var errline = parseInt(matches[2]);
        errors.push({
          line:1, // TODO: errline,
          msg:matches[1]
        });
      }
    }
    var ASZ80 = sdasz80({
      wasmBinary: wasmBlob['sdasz80'],
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

function linkSDLDZ80(step)
{
  loadNative("sdldz80");
  var errors = [];
  gatherFiles(step);
  var binpath = "main.ihx";
  if (staleFiles(step, [binpath])) {
    //?ASlink-Warning-Undefined Global '__divsint' referenced by module 'main'
    var match_aslink_re = /\?ASlink-(\w+)-(.+)/;
    function match_aslink_fn(s) {
      var matches = match_aslink_re.exec(s);
      if (matches) {
        errors.push({
          line:1,
          msg:matches[2]
        });
      }
    }
    var params = step.params;
    var updateListing = true;
    var LDZ80 = sdldz80({
      wasmBinary: wasmBlob['sdldz80'],
      noInitialRun:true,
      //logReadFiles:true,
      print:match_aslink_fn,
      printErr:match_aslink_fn,
    });
    var FS = LDZ80['FS'];
    setupFS(FS, 'sdcc');
    populateFiles(step, FS);
    // TODO: coleco hack so that -u flag works
    if (step.platform == "coleco") {
      FS.writeFile('crt0.rel', FS.readFile('/share/lib/coleco/crt0.rel', {encoding:'utf8'}));
      FS.writeFile('crt0.lst', '\n'); // TODO: needed so -u flag works
    }
    var args = ['-mjwxy'+(updateListing?'u':''),
      '-i', 'main.ihx', // TODO: main?
      '-b', '_CODE=0x'+params.code_start.toString(16),
      '-b', '_DATA=0x'+params.data_start.toString(16),
      '-k', '/share/lib/z80',
      '-l', 'z80'];
    if (params.extra_link_args)
      args.push.apply(args, params.extra_link_args);
    args.push.apply(args, step.args);
    execMain(step, LDZ80, args);
    var hexout = FS.readFile("main.ihx", {encoding:'utf8'});
    var mapout = FS.readFile("main.noi", {encoding:'utf8'});
    var rstout;
    if (updateListing)
      rstout = FS.readFile("main.rst", {encoding:'utf8'}); // TODO: could be different filename
    else
      rstout = FS.readFile("main.lst", {encoding:'utf8'}); // TODO: could be different filename
    //var dbgout = FS.readFile("main.cdb", {encoding:'utf8'});
    //   0000 21 02 00      [10]   52 	ld	hl, #2
    // TODO: use -u flag to find code_offset
    var asmlines = parseListing(rstout, /^\s*([0-9A-F]+)\s+([0-9A-F][0-9A-F r]*[0-9A-F])\s+\[([0-9 ]+)\]\s+(\d+) (.*)/i, 4, 1, 2);
    var srclines = parseSourceLines(rstout, /^\s+\d+ ;<stdin>:(\d+):/i, /^\s*([0-9A-F]{4})/i);
    // parse symbol map
    var symbolmap = {};
    for (var s of mapout.split("\n")) {
      var toks = s.split(" ");
      if (toks[0] == 'DEF' && !toks[1].startsWith("A$main$")) {
        symbolmap[toks[1]] = parseInt(toks[2], 16);
      }
    }
    putWorkFile("main.ihx", hexout);
    return {
      output:parseIHX(hexout, params.rom_start?params.rom_start:params.code_start, params.rom_size),
      asmlines:srclines.length?asmlines:null,
      lines:srclines.length?srclines:asmlines,
      errors:errors, // TODO?
      symbolmap:symbolmap,
      intermediate:{listing:rstout},
    };
  }
}

var sdcc;
function compileSDCC(step) {
  
  gatherFiles(step, {
    mainFilePath:"main.c" // not used
  });
  var outpath = step.prefix + ".asm";
  if (staleFiles(step, [outpath])) {
    var errors = [];
    var params = step.params;
    loadNative('sdcc');
    var SDCC = sdcc({
      wasmBinary: wasmBlob['sdcc'],
      noInitialRun:true,
      noFSInit:true,
      print:print_fn,
      printErr:msvcErrorMatcher(errors),
      TOTAL_MEMORY:256*1024*1024,
    });
    var FS = SDCC['FS'];
    populateFiles(step, FS);
    // load source file and preprocess
    var code = workfs[step.path].data; // TODO
    var preproc = preprocessMCPP(code, step.platform);
    if (preproc.errors) return preproc;
    else code = preproc.code;
    // pipe file to stdin
    setupStdin(FS, code);
    setupFS(FS, 'sdcc');
    var args = ['--vc', '--std-sdcc99', '-mz80', //'-Wall',
      '--c1mode', // '--debug',
      //'-S', 'main.c',
      //'--asm=sdasz80',
      //'--reserve-regs-iy',
      '--less-pedantic',
      ///'--fomit-frame-pointer',
      '--opt-code-speed',
      //'--oldralloc', // TODO: does this make it fater?
      //'--cyclomatic',
      //'--nooverlay','--nogcse','--nolabelopt','--noinvariant','--noinduction','--nojtbound','--noloopreverse','--no-peep','--nolospre',
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
    args:[outpath]
  };
}

function assembleXASM6809(code, platform) {
  load("xasm6809");
  var origin = 0; // TODO: configurable
  var alst = "";
  var lasterror = null;
  var errors = [];
  function match_fn(s) {
    alst += s;
    alst += "\n";
    if (lasterror) {
      var line = parseInt(s.slice(0,5));
      errors.push({
        line:line,
        msg:lasterror
      });
      lasterror = null;
    }
    else if (s.startsWith("***** ")) {
      lasterror = s.slice(6);
    }
  }
  var Module = xasm6809({
    noInitialRun:true,
    //logReadFiles:true,
    print:match_fn,
    printErr:print_fn
  });
  var FS = Module['FS'];
  //setupFS(FS);
  FS.writeFile("main.asm", code);
  Module.callMain(["-c", "-l", "-s", "-y", "-o=main.bin", "main.asm"]);
  if (errors.length)
    return {errors:errors};
  var aout = FS.readFile("main.bin", {encoding:'binary'});
  // 00001    0000 [ 2] 1048                asld
  var asmlines = parseListing(alst, /^\s*([0-9A-F]+)\s+([0-9A-F]+)\s+\[([0-9 ]+)\]\s+(\d+) (.*)/i, 1, 2, 4);
  return {
      output:aout,
      errors:errors,
      lines:asmlines,
      intermediate:{listing:alst},
  };
}

function preprocessMCPP(code, platform, toolname) {
  load("mcpp");
  var params = PLATFORM_PARAMS[platform];
  if (!params) throw Error("Platform not supported: " + platform);
  // <stdin>:2: error: Can't open include file "foo.h"
  var errors = [];
  var match_fn = makeErrorMatcher(errors, /<stdin>:(\d+): (.+)/, 1, 2);
  var MCPP = mcpp({
    noInitialRun:true,
    noFSInit:true,
    print:print_fn,
    printErr:match_fn,
  });
  var FS = MCPP['FS'];
  setupFS(FS, 'sdcc'); // TODO: toolname
  FS.writeFile("main.c", code, {encoding:'utf8'});
  // TODO: make configurable by other compilers
  var args = [
    "-D", "__8BITWORKSHOP__",
    "-D", platform.toUpperCase().replace('-','_'),
    "-D", "__SDCC_z80",
    "-I", "/share/include",
    "-Q",
    "main.c", "main.i"];
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
      var errors = extractErrors(/[^:]+:(\d+): (.+)/, errout.split("\n"));
      if (errors.length == 0) {
        errors = [{line:1, msg:errout}];
      }
      return {errors: errors};
    }
  } catch (e) {
    //
  }
  return {code:iout};
}

function assembleNAKEN(code, platform) {
  load("naken_asm");
  var errors = [];
  var match_fn = makeErrorMatcher(errors, /Error: (.+) at (.+):(\d+)/, 3, 1);
  var Module = naken_asm({
    noInitialRun:true,
    //logReadFiles:true,
    print:match_fn,
    printErr:print_fn
  });
  var FS = Module['FS'];
  //setupFS(FS);
  FS.writeFile("main.asm", code);
  Module.callMain(["-l", "-b", "main.asm"]);
  if (errors.length)
    return {errors:errors};
  var aout = FS.readFile("out.bin", {encoding:'binary'});
  var alst = FS.readFile("out.lst", {encoding:'utf8'});
  //console.log(alst);
  // 0x0000: 77        ld (hl),a                                cycles: 4
  var asmlines = parseListing(alst, /^0x([0-9a-f]+):\s+([0-9a-f]+)\s+(.+)cycles: (\d+)/i, 0, 1, 2);
  return {
    output:aout,
    errors:errors,
    lines:asmlines,
    intermediate:{listing:alst},
  };
}

function detectModuleName(code) {
  var m = /\bmodule\s+(\w+_top)\b/.exec(code)
       || /\bmodule\s+(top)\b/.exec(code)
       || /\bmodule\s+(\w+)\b/.exec(code);
  return m ? m[1] : null;
}

function detectTopModuleName(code) {
  var topmod = detectModuleName(code) || "top";
  var m = /\bmodule\s+(\w+?_top)/.exec(code);
  if (m && m[1]) topmod = m[1];
  m = /\bmodule\s+(\w+?_top)/.exec(code);
  if (m && m[1]) topmod = m[1];
  return topmod;
}

function writeDependencies(depends, FS, errors, callback) {
  if (depends) {
    for (var i=0; i<depends.length; i++) {
      var d = depends[i];
      var text;
      if (d.text) {
        text = d.text;
      } else {
        // load from network (hopefully cached)
        // TODO: get from indexeddb?
        var path = '../../presets/' + d.prefix + '/' + d.filename;
        var xhr = new XMLHttpRequest();
        xhr.open("GET", path, false);  // synchronous request
        xhr.send(null);
        if (xhr.response) {
          text = xhr.response;
        } else {
          console.log("Could not load " + path);
        }
      }
      if (callback)
        text = callback(d, text);
      if (text && FS)
        FS.writeFile(d.filename, text, {encoding:'utf8'});
    }
  }
}

function parseMIF(s) {
  var lines = s.split('\n');
  var words = [];
  for (var i=0; i<lines.length; i++) {
    var l = lines[i];
    var toks = l.split(/[;\s+]+/);
    if (toks.length == 5 && toks[2] == ":") {
      var addr = parseInt(toks[1], 16);
      var value = parseInt(toks[3], 16);
      words[addr] = value;
    }
  }
  return words;
}

function compileCASPR(code, platform, options) {
  loadNative("caspr");
  var errors = [];
  var match_fn = makeErrorMatcher(errors, /(ERROR|FATAL) - (.+)/, 2, 2);
  var caspr_mod = caspr({
    wasmBinary:wasmBlob['caspr'],
    noInitialRun:true,
    print:print_fn,
    printErr:match_fn,
  });
  var FS = caspr_mod['FS'];
  FS.writeFile("main.asm", code);
  var arch = code.match(/^[.]arch\s+(\w+)/m);
  var deps = [{prefix:'verilog',filename:arch[1]+'.cfg'}]; // TODO: parse file for ".arch femto8"
  writeDependencies(deps, FS, errors);
  starttime();
  caspr_mod.callMain(["main.asm"]);
  endtime("compile");
  var miffile = FS.readFile("main.mif", {encoding:'utf8'});
  return {
    errors:errors,
    output:parseMIF(miffile),
    intermediate:{listing:miffile},
    lines:[]};
}

var jsasm_module_top;
var jsasm_module_output;
var jsasm_module_key;

function compileJSASM(asmcode, platform, options, is_inline) {
  load("assembler");
  var asm = new Assembler();
  var includes = [];
  asm.loadJSON = function(filename) {
    // TODO: what if it comes from dependencies?
    var path = '../../presets/' + platform + '/' + filename;
    var xhr = new XMLHttpRequest();
    xhr.responseType = 'json';
    xhr.open("GET", path, false);  // synchronous request
    xhr.send(null);
    return xhr.response;
  };
  asm.loadInclude = function(filename) {
    if (!filename.startsWith('"') || !filename.endsWith('"'))
      return 'Expected filename in "double quotes"';
    filename = filename.substr(1, filename.length-2);
    includes.push(filename);
  };
  var loaded_module = false;
  asm.loadModule = function(top_module) {
    // TODO: cache module
    // compile last file in list
    loaded_module = true;
    var key = top_module + '/' + includes;
    if (key != jsasm_module_key) {
      jsasm_module_key = key;
      jsasm_module_top = top_module;
      var main_filename = includes[includes.length-1];
      var code = '`include "' + main_filename + '"\n';
      code += "/* module " + top_module + " */\n";
      var voutput = compileVerilator(code, platform, options);
      if (voutput.errors.length)
        return voutput.errors[0].msg;
      jsasm_module_output = voutput;
    }
  }
  var result = asm.assembleFile(asmcode);
  if (loaded_module && jsasm_module_output) {
    var asmout = result.output;
    result.output = jsasm_module_output.output;
    result.output.program_rom = asmout;
    // cpu_platform__DOT__program_rom
    result.output.program_rom_variable = jsasm_module_top + "__DOT__program_rom";
  }
  return result;
}

function compileInlineASM(code, platform, options, errors, asmlines) {
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
      var s = "";
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

function compileVerilator(step) {
  loadNative("verilator_bin");
  load("../verilator2js");
  var code = step.code;
  var platform = step.platform || 'verilog';
  var options = step.options || {};
  // TODO: make work with files
  var errors = [];
  var asmlines = [];
  code = compileInlineASM(code, platform, options, errors, asmlines);
  var match_fn = makeErrorMatcher(errors, /%(.+?): (.+?:)?(\d+)?[:]?\s*(.+)/i, 3, 4);
  var verilator_mod = verilator_bin({
    wasmBinary:wasmBlob['verilator_bin'],
    noInitialRun:true,
    print:print_fn,
    printErr:match_fn,
  });
  var topmod = detectTopModuleName(code);
  var FS = verilator_mod['FS'];
  FS.writeFile(topmod+".v", code);
  writeDependencies(options.dependencies, FS, errors, function(d, code) {
    return compileInlineASM(code, platform, options, errors, null);
  });
  starttime();
  try {
    verilator_mod.callMain(["--cc", "-O3", "-DEXT_INLINE_ASM", "-DTOPMOD__"+topmod,
      "-Wall", "-Wno-DECLFILENAME", "-Wno-UNUSED", '--report-unoptflat',
      "--x-assign", "fast", "--noassert", "--pins-bv", "33",
      "--top-module", topmod, topmod+".v"]);
  } catch (e) {
    errors.push({line:0,msg:"Compiler internal error: " + e});
  }
  endtime("compile");
  if (errors.length) {
    return {errors:errors};
  }
  try {
    var h_file = FS.readFile("obj_dir/V"+topmod+".h", {encoding:'utf8'});
    var cpp_file = FS.readFile("obj_dir/V"+topmod+".cpp", {encoding:'utf8'});
    var rtn = translateVerilatorOutputToJS(h_file, cpp_file);
    rtn.errors = errors;
    rtn.lines = [];// TODO
    rtn.intermediate = {listing:h_file + cpp_file};
    rtn.lines = asmlines;
    return rtn;
  } catch(e) {
    console.log(e);
    return {errors:errors};
  }
}

function compileYosys(code, platform, options) {
  loadNative("yosys");
  var errors = [];
  var match_fn = makeErrorMatcher(errors, /ERROR: (.+?) in line (.+?[.]v):(\d+)[: ]+(.+)/i, 3, 4);
  starttime();
  var yosys_mod = yosys({
    wasmBinary:wasmBlob['yosys'],
    noInitialRun:true,
    print:print_fn,
    printErr:match_fn,
  });
  endtime("create module");
  var topmod = detectTopModuleName(code);
  var FS = yosys_mod['FS'];
  FS.writeFile(topmod+".v", code);
  writeDependencies(options.dependencies, FS, errors);
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
    return {yosys_json:json, errors:errors};
  } catch(e) {
    console.log(e);
    return {errors:errors};
  }
}

var TOOLS = {
  'dasm': assembleDASM,
  'acme': assembleACME,
  'plasm': compilePLASMA,
  'cc65': compileCC65,
  'ca65': assembleCA65,
  'ld65': linkLD65,
  'z80asm': assembleZ80ASM,
  'sdasz80': assembleSDASZ80,
  'sdldz80': linkSDLDZ80,
  'sdcc': compileSDCC,
  //'xasm6809': assembleXASM6809,
  //'naken': assembleNAKEN,
  'verilator': compileVerilator,
  'yosys': compileYosys,
  //'caspr': compileCASPR,
  'jsasm': compileJSASM,
  'sccz80': compileSCCZ80,
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
}

function executeBuildSteps() {
  while (buildsteps.length) {
    var step = buildsteps.shift(); // get top of array
    var code = step.code;
    var platform = step.platform;
    var toolfn = TOOLS[step.tool];
    if (!toolfn) throw "no tool named " + step.tool;
    step.params = PLATFORM_PARAMS[platform];
    console.log(step.platform + " " + step.tool);
    try {
      step.result = toolfn(step);
    } catch (e) {
      console.log("EXCEPTION", e.stack);
      return {errors:[{line:1, msg:e+""}]}; // TODO: catch errors already generated?
    }
    if (step.result) {
      // errors? return them
      if (step.result.errors) {
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
          if (ls.tool == linkstep.tool && ls.platform == linkstep.platform && ls.files) {
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
        var asmstep = {
          tool:step.result.nexttool,
          platform:platform,
          files:[step.result.path],
          path:step.result.path,
          args:step.result.args
        };
        buildsteps.push(asmstep);
        step.generated = asmstep.files;
      }
    }
  }
}

function handleMessage(data) {
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
  // (code,platform,tool,dependencies)
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

var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function';
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';

if (ENVIRONMENT_IS_WORKER) {
  onmessage = function(e) {
    var result = handleMessage(e.data);
    if (result) {
      postMessage(result);
    }
  }
}
