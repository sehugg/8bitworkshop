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
      '-l', 'libcv', '-l', 'libcvu', '/share/lib/coleco/crt0.rel',
      //'-l', 'comp.lib', '-l', 'cvlib.lib', '-l', 'getput.lib', '/share/lib/coleco/crtcv.rel',
      'main.rel'],
  },
  'nes-conio': {
    define: '__NES__',
    cfgfile: 'nes.cfg',
    libargs: ['nes.lib'],
  },
  'nes-lib': {
    define: '__NES__',
    cfgfile: 'neslib.cfg',
    libargs: ['neslib.lib', 'nes.lib'],
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

var fsMeta = {};
var fsBlob = {};
var wasmBlob = {};

// load filesystems for CC65 and others asynchronously
function loadFilesystem(name) {
  var xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.open("GET", "fs"+name+".data", false);  // synchronous request
  xhr.send(null);
  fsBlob[name] = xhr.response;
  xhr = new XMLHttpRequest();
  xhr.responseType = 'json';
  xhr.open("GET", "fs"+name+".js.metadata", false);  // synchronous request
  xhr.send(null);
  fsMeta[name] = xhr.response;
  console.log("Loaded "+name+" filesystem", fsMeta[name].files.length, 'files', fsBlob[name].size, 'bytes');
}

var loaded = {}
function load(modulename, debug) {
  if (!loaded[modulename]) {
    importScripts(modulename+(debug?"."+debug+".js":".js"));
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
      throw Error("Could not load WASM file");
    }
  }
}
function loadNative(modulename, debug) {
  // detect WASM
  if (typeof WebAssembly === 'object') {
    loadWASM(modulename);
    return wasmBlob['sdcc'];
  } else {
    load(modulename);
  }
}

var ATARI_CFG =
   "FEATURES {\nSTARTADDRESS: default = $9000;\n}\n"
+  "MEMORY {\n"
+  "     ZP:  file = \"\", start = $82, size = $7E, type = rw, define = yes;\n"
+  "    RAM:  file = \"\", start = $0200, size = $1e00, define = yes;\n"
+  "    ROM:  file = %O, start = $9000, size = $7000;\n"
+  "   ROMV:  file = %O, start = $FFFA, size = $0006, fill = yes;\n"
+  "}\n"
+  "SEGMENTS {\n"
+  "ZEROPAGE: load = ZP,  type = zp, define = yes;\n"
+  " STARTUP: load = ROM, type = ro, define = yes;\n"
+  "    ONCE: load = ROM, type = ro, define = yes;\n"
+  "    CODE: load = ROM, type = ro, define = yes;\n"
+  "    DATA: load = RAM, type = rw, define = yes, run = RAM;\n"
+  "    INIT: load = RAM, type = rw, define = yes;\n"
+  "     BSS: load = RAM, type = bss, define = yes;\n"
+  "    HEAP: load = RAM, type = bss, optional = yes;\n"
+  "  RODATA: load = ROM, type = ro;\n"
+  "}\n"
+  "FEATURES {\n"
+  "    CONDES:    segment = STARTUP,\n"
+  "               type    = constructor,\n"
+  "               label   = __CONSTRUCTOR_TABLE__,\n"
+  "               count   = __CONSTRUCTOR_COUNT__;\n"
+  "    CONDES:    segment = STARTUP,\n"
+  "               type    = destructor,\n"
+  "               label   = __DESTRUCTOR_TABLE__,\n"
+  "               count   = __DESTRUCTOR_COUNT__;\n"
+  "}\n"
+  "SYMBOLS {\n"
+  "    __STACKSIZE__:       type = weak,   value = $0400;\n"
+  "    __LC_LAST__:       type = weak,   value = $0400;\n"
+  "    __LC_START__:       type = weak,   value = $0400;\n"
+  "}\n"
;
/*
+  "MEMORY {\n"
+  "    ZP:   file = \"\", define = yes, start = $0082, size = $007E;\n"
+  "    MAIN: file = %O, define = yes, start = %S,    size = $BC20 - __STACKSIZE__ - __RESERVED_MEMORY__ - %S;\n"
+  "}\n"
+  "SEGMENTS {\n"
+  "    ZEROPAGE: load = ZP,   type = zp,                optional = yes;\n"
+  "    EXTZP:    load = ZP,   type = zp,                optional = yes;\n"
+  "    STARTUP:  load = MAIN, type = ro,  define = yes, optional = yes;\n"
+  "    LOWCODE:  load = MAIN, type = ro,  define = yes, optional = yes;\n"
+  "    ONCE:     load = MAIN, type = ro,                optional = yes;\n"
+  "    CODE:     load = MAIN, type = ro,  define = yes;\n"
+  "    RODATA:   load = MAIN, type = ro,                optional = yes;\n"
+  "    DATA:     load = MAIN, type = rw,                optional = yes;\n"
+  "    BSS:      load = MAIN, type = bss, define = yes, optional = yes;\n"
+  "    INIT:     load = MAIN, type = bss,               optional = yes;\n"
+  "}\n"
+  "FEATURES {\n"
+  "    CONDES: type    = constructor,\n"
+  "            label   = __CONSTRUCTOR_TABLE__,\n"
+  "            count   = __CONSTRUCTOR_COUNT__,\n"
+  "            segment = ONCE;\n"
+  "    CONDES: type    = destructor,\n"
+  "            label   = __DESTRUCTOR_TABLE__,\n"
+  "            count   = __DESTRUCTOR_COUNT__,\n"
+  "            segment = RODATA;\n"
+  "    CONDES: type    = interruptor,\n"
+  "            label   = __INTERRUPTOR_TABLE__,\n"
+  "            count   = __INTERRUPTOR_COUNT__,\n"
+  "            segment = RODATA,\n"
+  "            import  = __CALLIRQ__;\n"
+  "}\n";
*/

// mount the filesystem at /share
function setupFS(FS, name) {
  FS.mkdir('/share');
  FS.mount(FS.filesystems['WORKERFS'], {
    packages: [{ metadata: fsMeta[name], blob: fsBlob[name] }]
  }, '/share');
  FS.writeFile("/vector-ataricolor.cfg", ATARI_CFG);
}

var DASM_MAIN_FILENAME = "main.a";
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
var msvc_errors;

function match_msvc(s) {
  var matches = re_msvc.exec(s) || re_msvc2.exec(s);
  if (matches) {
    var errline = parseInt(matches[2]);
    msvc_errors.push({
      line:errline,
      file:matches[1],
      type:matches[3],
      msg:matches[4]
    });
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

function parseListing(code, lineMatch, iline, ioffset, iinsns) {
  var lines = [];
  for (var line of code.split(/\r?\n/)) {
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

function parseSourceLines(code, lineMatch, offsetMatch) {
  var lines = [];
  var lastlinenum = 0;
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
          offset:offset,
        });
        lastlinenum = 0;
      }
    }
  }
  return lines;
}

function parseDASMListing(code, unresolved) {
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
      if (filename == DASM_MAIN_FILENAME) {
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

function assembleDASM(code) {
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
  FS.writeFile(DASM_MAIN_FILENAME, DASM_PREAMBLE + code);
  Module.callMain([DASM_MAIN_FILENAME, "-la.lst"/*, "-v3", "-sa.sym"*/]);
  var aout = FS.readFile("a.out");
  var alst = FS.readFile("a.lst", {'encoding':'utf8'});
  //var asym = FS.readFile("a.sym", {'encoding':'utf8'});
  var listing = parseDASMListing(alst, unresolved);
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
  outstr = "INTERP = $e044\n" + outstr; // TODO
  if (errors.length) {
    return {errors:errors};
  }
  return assembleACME(outstr);
}

function parseCA65Listing(code, mapfile) {
  // CODE                  00603E  00637C  00033F  00001
  var mapMatch = /^CODE\s+([0-9A-F]+)/m.exec(mapfile);
  var codeofs = 0x6000;
  if (mapMatch) {
    var codeofs = parseInt(mapMatch[1], 16);
  }
  // .dbg	line, "main.c", 1
  var dbgLineMatch = /([0-9a-fA-F]+)([r]?)\s+(\d+)\s+[.]dbg\s+line,\s+\S+,\s+(\d+)/;
  var errors = [];
  var lines = [];
  var lastlinenum = 0;
  for (var line of code.split(/\r?\n/)) {
    var linem = dbgLineMatch.exec(line);
    if (linem && linem[1]) {
      var offset = parseInt(linem[1], 16);
      var linenum = parseInt(linem[4]);
      lines.push({
        line:linenum,
        offset:offset + codeofs,
        insns:null
      });
      //console.log(linem, lastlinenum, lines[lines.length-1]);
    }
  }
  return {lines:lines, errors:errors};
}

function assemblelinkCA65(code, platform) {
  var params = PLATFORM_PARAMS[platform];
  if (!params) throw Error("Platform not supported: " + platform);
  var errors = "";
  function error_fn(s) {
    errors += s + "\n";
  }
  loadNative("ca65");
  loadNative("ld65");
  var objout, lstout;
  {
    var CA65 = ca65({
      wasmBinary: wasmBlob['ca65'],
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:print_fn,
    });
    var FS = CA65['FS'];
    setupFS(FS, '65');
    FS.writeFile("main.s", code, {encoding:'utf8'});
    starttime();
    CA65.callMain(['-v', '-g', '-I', '/share/asminc', '-l', 'main.lst', "main.s"]);
    endtime("assemble");
    objout = FS.readFile("main.o", {encoding:'binary'});
    lstout = FS.readFile("main.lst", {encoding:'utf8'});
  }{
    var LD65 = ld65({
      wasmBinary: wasmBlob['ld65'],
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:error_fn,
    });
    var FS = LD65['FS'];
    var cfgfile = '/' + platform + '.cfg';
    setupFS(FS, '65');
    FS.writeFile("main.o", objout, {encoding:'binary'});
    var libargs = params.libargs;
    starttime();
    LD65.callMain(['--cfg-path', '/share/cfg', '--lib-path', '/share/lib',
      '-C', params.cfgfile,
      //'--dbgfile', 'main.dbg',
      '-o', 'main', '-m', 'main.map', 'main.o'].concat(libargs));
    endtime("link");
    if (errors.length) {
      return {errors:[{line:1,msg:errors}]};
    }
    var aout = FS.readFile("main", {encoding:'binary'});
    var mapout = FS.readFile("main.map", {encoding:'utf8'});
    var listing = parseCA65Listing(lstout, mapout);
    //console.log(lstout);
    //console.log(mapout);
    var srclines = parseSourceLines(lstout, /[.]dbg\s+line, "main[.]c", (\d+)/i, /^\s*([0-9A-F]+)r/i);
    return {
      output:aout.slice(0),
      lines:listing.lines,
      srclines:srclines,
      errors:listing.errors,
      intermediate:{listing:lstout, map:mapout},
    };
  }
}

function compileCC65(code, platform) {
  var params = PLATFORM_PARAMS[platform];
  if (!params) throw Error("Platform not supported: " + platform);
  load("cc65");
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
  var CC65 = cc65({
    noInitialRun:true,
    //logReadFiles:true,
    print:print_fn,
    printErr:match_fn,
  });
  var FS = CC65['FS'];
  setupFS(FS, '65');
  FS.writeFile("main.c", code, {encoding:'utf8'});
  starttime();
  CC65.callMain(['-T', '-g', /*'-Cl',*/
    '-Oirs',
    '-I', '/share/include',
    '-D' + params.define,
    "main.c"]);
  endtime("compile");
  try {
    var asmout = FS.readFile("main.s", {encoding:'utf8'});
    //console.log(asmout);
    var result = assemblelinkCA65(asmout, platform, errors);
    result.asmlines = result.lines;
    result.lines = result.srclines;
    result.srclines = null;
    return result;
  } catch(e) {
    return {errors:errors};
  }
}

function assembleZ80ASM(code, platform) {
  load("z80asm");
  var origin = 0; // TODO: configurable
  var Module = z80asm({
    noInitialRun:true,
    //logReadFiles:true,
    print:print_fn,
    printErr:print_fn,
    TOTAL_MEMORY:256*1024*1024,
  });
  var FS = Module['FS'];
  //setupFS(FS);
  // changes for dialect
  code = code.replace(".optsdcc -mz80","");
  code = code.replace(/^(\w+)\s*=/gim,"DEFC $1 =");
  code = code.replace(/\tXREF /gi,"\tEXTERN ");
  code = code.replace(/\tXDEF /gi,"\tPUBLIC ");
  FS.writeFile("main.asm", code);
  try {
    Module.callMain(["-b", "-s", "-l", "-m", "-g", "--origin=" + origin.toString(16), "main.asm"]);
    try {
      var aerr = FS.readFile("main.err", {'encoding':'utf8'}); // TODO
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
    var alst = FS.readFile("main.lst", {'encoding':'utf8'}); // TODO
/*
_main                           = 0000, G: test
l_main00101                     = 0003, L: test
*/
    var amap = FS.readFile("main.map", {'encoding':'utf8'}); // TODO
    var aout = FS.readFile("main.bin", {'encoding':'binary'});
    var asmlines = parseListing(alst, /^(\d+)\s+([0-9A-F]+)\s+([0-9A-F][0-9A-F ]*[0-9A-F])\s+/i, 1, 2, 3, 4);
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

function assemblelinkSDASZ80(code, platform) {
  loadNative("sdasz80");
  loadNative("sdldz80");
  var objout, lstout, symout;
  var params = PLATFORM_PARAMS[platform];
  if (!params) throw Error("Platform not supported: " + platform);
  {
    msvc_errors = [];
    //?ASxxxx-Error-<o> in line 1 of main.asm null
    //              <o> .org in REL area or directive / mnemonic error
    var match_asm_re = / <\w> (.+)/; // TODO
    function match_asm_fn(s) {
      var matches = match_asm_re.exec(s);
      if (matches) {
        var errline = parseInt(matches[2]);
        msvc_errors.push({
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
    FS.writeFile("main.asm", code, {encoding:'utf8'});
    starttime();
    ASZ80.callMain(['-plosgffwy', 'main.asm']);
    endtime("assemble");
    if (msvc_errors.length) {
      return {errors:msvc_errors};
    }
    objout = FS.readFile("main.rel", {encoding:'utf8'});
    lstout = FS.readFile("main.lst", {encoding:'utf8'});
    //symout = FS.readFile("main.sym", {encoding:'utf8'});
  }{
    //?ASlink-Warning-Undefined Global '__divsint' referenced by module 'main'
    var match_aslink_re = /\?ASlink-(\w+)-(.+)/;
    function match_aslink_fn(s) {
      var matches = match_aslink_re.exec(s);
      if (matches) {
        msvc_errors.push({
          line:1,
          msg:matches[2]
        });
      }
    }
    var updateListing = !params.extra_link_args;
    var LDZ80 = sdldz80({
      wasmBinary: wasmBlob['sdldz80'],
      noInitialRun:true,
      //logReadFiles:true,
      print:match_aslink_fn,
      printErr:match_aslink_fn,
    });
    var FS = LDZ80['FS'];
    setupFS(FS, 'sdcc');
    FS.writeFile("main.rel", objout, {encoding:'utf8'});
    if (updateListing) {
      FS.writeFile("main.lst", lstout, {encoding:'utf8'});
    }
    var args = ['-mjwxy'+(updateListing?'u':''),
      '-i', 'main.ihx',
      '-b', '_CODE=0x'+params.code_start.toString(16),
      '-b', '_DATA=0x'+params.data_start.toString(16),
      '-k', '/share/lib/z80',
      '-l', 'z80'];
    if (params.extra_link_args) {
      args.push.apply(args, params.extra_link_args);
    } else {
      args.push('main.rel');
    }
    starttime();
    LDZ80.callMain(args);
    endtime("link");
    var hexout = FS.readFile("main.ihx", {encoding:'utf8'});
    var mapout = FS.readFile("main.noi", {encoding:'utf8'});
    var rstout = updateListing ? FS.readFile("main.rst", {encoding:'utf8'}) : lstout;
    //var dbgout = FS.readFile("main.cdb", {encoding:'utf8'});
    //   0000 21 02 00      [10]   52 	ld	hl, #2
    // TODO: offset by start address?
    var asmlines = parseListing(lstout, /^\s*([0-9A-F]+)\s+([0-9A-F][0-9A-F r]*[0-9A-F])\s+\[([0-9 ]+)\]\s+(\d+) (.*)/i, 4, 1, 2, 5, 3);
    var srclines = parseSourceLines(lstout, /^\s+\d+ ;<stdin>:(\d+):/i, /^\s*([0-9A-F]{4})/i);
    // parse symbol map
    var symbolmap = {};
    for (var s of mapout.split("\n")) {
      var toks = s.split(" ");
      if (toks[0] == 'DEF' && !toks[1].startsWith("A$main$")) {
        symbolmap[toks[1]] = parseInt(toks[2], 16);
      }
    }
    return {
      output:parseIHX(hexout, params.rom_start?params.rom_start:params.code_start, params.rom_size),
      lines:asmlines,
      srclines:srclines,
      errors:msvc_errors, // TODO?
      symbolmap:symbolmap,
      intermediate:{listing:rstout},
    };
  }
}

var sdcc;
function compileSDCC(code, platform) {
  var preproc = preprocessMCPP(code, platform);
  if (preproc.errors) return preproc;
  else code = preproc.code;

  var params = PLATFORM_PARAMS[platform];
  if (!params) throw Error("Platform not supported: " + platform);

  loadNative('sdcc');
  var SDCC = sdcc({
    wasmBinary: wasmBlob['sdcc'],
    noInitialRun:true,
    noFSInit:true,
    print:print_fn,
    printErr:match_msvc, // console.log
    TOTAL_MEMORY:256*1024*1024,
  });
  var FS = SDCC['FS'];
  setupStdin(FS, code);
  setupFS(FS, 'sdcc');
  //FS.writeFile("main.c", code, {encoding:'utf8'});
  msvc_errors = [];
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
    '-o', 'main.asm'];
  if (params.extra_compile_args) {
    args.push.apply(args, params.extra_compile_args);
  }
  starttime();
  SDCC.callMain(args);
  endtime("compile");
  // TODO: preprocessor errors w/ correct file
  if (msvc_errors.length /* && nwarnings < msvc_errors.length*/) {
    return {errors:msvc_errors};
  }
  try {
    var asmout = FS.readFile("main.asm", {encoding:'utf8'});
    asmout = " .area _HOME\n .area _CODE\n .area _INITIALIZER\n .area _DATA\n .area _INITIALIZED\n .area _BSEG\n .area _BSS\n .area _HEAP\n" + asmout;
    //asmout = asmout.replace(".area _INITIALIZER",".area _CODE");
  } catch (e) {
    msvc_errors.push({line:1, msg:e+""});
    return {errors:msvc_errors};
  }
  var warnings = msvc_errors;
  try {
    var result = assemblelinkSDASZ80(asmout, platform, true);
  } catch (e) {
    msvc_errors.push({line:1, msg:e+""});
    return {errors:msvc_errors};
  }
  result.asmlines = result.lines;
  result.lines = result.srclines;
  result.srclines = null;
  return result;
}

function assembleXASM6809(code, platform) {
  load("xasm6809");
  var origin = 0; // TODO: configurable
  var alst = "";
  var lasterror = null;
  msvc_errors = [];
  function match_fn(s) {
    alst += s;
    alst += "\n";
    if (lasterror) {
      var line = parseInt(s.slice(0,5));
      msvc_errors.push({
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
  try {
    var aout = FS.readFile("main.bin", {encoding:'binary'});
    // 00001    0000 [ 2] 1048                asld
    var asmlines = parseListing(alst, /^\s*([0-9A-F]+)\s+([0-9A-F]+)\s+\[([0-9 ]+)\]\s+(\d+) (.*)/i, 1, 2, 4, 5, 3);
    return {
      output:aout,
      errors:msvc_errors,
      lines:asmlines,
      intermediate:{listing:alst},
    };
  } catch(e) {
    return {errors:msvc_errors}; // TODO
  }
}

function preprocessMCPP(code, platform) {
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
  setupFS(FS, 'sdcc');
  FS.writeFile("main.c", code, {encoding:'utf8'});
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
  try {
    var iout = FS.readFile("main.i", {encoding:'utf8'});
    iout = iout.replace(/^#line /gm,'\n# ');
  } catch (e) {
    errors.push({line:1, msg:e+""});
  }
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
  try {
    var aout = FS.readFile("out.bin", {encoding:'binary'});
    var alst = FS.readFile("out.lst", {encoding:'utf8'});
    //console.log(alst);
    // 0x0000: 77        ld (hl),a                                cycles: 4
    var asmlines = parseListing(alst, /^0x([0-9a-f]+):\s+([0-9a-f]+)\s+(.+)cycles: (\d+)/i, 0, 1, 2, 3);
    return {
      output:aout,
      errors:errors,
      lines:asmlines,
      intermediate:{listing:alst},
    };
  } catch(e) {
    return {errors:errors};
  }
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

function writeDependencies(depends, FS, errors) {
  if (depends) {
    for (var i=0; i<depends.length; i++) {
      var d = depends[i];
      if (d.text)
        FS.writeFile(d.filename, d.text, {encoding:'utf8'});
    }
  }
}

function compileVerilator(code, platform, options) {
  loadNative("verilator_bin");
  load("verilator2js");
  var errors = [];
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
  writeDependencies(options.dependencies, FS, errors);
  starttime();
  verilator_mod.callMain(["--cc", "-O3",
    "-Wall", "-Wno-DECLFILENAME", "-Wno-UNUSED",
    "--x-assign", "fast", "--noassert", "--pins-bv", "33",
    "--top-module", topmod, topmod+".v"]);
  endtime("compile");
  if (errors.length) return {errors:errors};
  try {
    var h_file = FS.readFile("obj_dir/V"+topmod+".h", {encoding:'utf8'});
    var cpp_file = FS.readFile("obj_dir/V"+topmod+".cpp", {encoding:'utf8'});
    var rtn = translateVerilatorOutputToJS(h_file, cpp_file);
    rtn.errors = errors;
    rtn.lines = [];// TODO
    rtn.intermediate = {listing:h_file + cpp_file};
    return rtn;
  } catch(e) {
    console.log(e);
    return {errors:errors};
  }
}

function compileYosys(code, platform, options) {
  loadNative("yosys");
  var errors = [];
  var match_fn = makeErrorMatcher(errors, /ERROR: (.+?) in line (.+?[.]v):(\d+) (.+)/i, 3, 4);
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
  yosys_mod.callMain(["-q", "-o", topmod+".json", "-S", topmod+".v"]);
  endtime("compile");
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
  'ca65': assemblelinkCA65,
  'z80asm': assembleZ80ASM,
  'sdasz80': assemblelinkSDASZ80,
  'sdcc': compileSDCC,
  'xasm6809': assembleXASM6809,
  'naken': assembleNAKEN,
  'verilator': compileVerilator,
  'yosys': compileYosys,
}

var TOOL_PRELOADFS = {
  'cc65': '65',
  'ca65': '65',
  'sdasz80': 'sdcc',
  'sdcc': 'sdcc',
}

onmessage = function(e) {
  // (preload)
  if (e.data.preload) {
    var fs = TOOL_PRELOADFS[e.data.preload];
    if (fs && !fsMeta[fs]) loadFilesystem(fs);
    return;
  }
  // (code,platform,tool)
  var code = e.data.code;
  var platform = e.data.platform;
  var toolfn = TOOLS[e.data.tool];
  if (!toolfn) throw "no tool named " + e.data.tool;
  var dependencies = e.data.dependencies;
  var result = toolfn(code, platform, e.data);
  result.params = PLATFORM_PARAMS[platform];
  if (result) {
    postMessage(result);
  }
}
