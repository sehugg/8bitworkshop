"use strict";

var loaded = {}
function load(modulename) {
  if (!loaded[modulename]) {
    importScripts(modulename+".js");
    loaded[modulename] = 1;
  }
}
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

// load filesystems for CC65 and others asynchronously
var fsMeta, fsBlob;
{
  var xhr = new XMLHttpRequest();
  xhr.responseType = 'blob';
  xhr.open("GET", "fs65.data", false);  // synchronous request
  xhr.send(null);
  fsBlob = xhr.response;
  xhr = new XMLHttpRequest();
  xhr.responseType = 'json';
  xhr.open("GET", "fs65.js.metadata", false);  // synchronous request
  xhr.send(null);
  fsMeta = xhr.response;
  console.log("Loaded filesystem", fsMeta.files.length, 'files', fsBlob.size, 'bytes');
}

// mount the filesystem at /share
function setupFS(FS) {
  FS.mkdir('/share');
  FS.mount(FS.filesystems['WORKERFS'], {
    packages: [{ metadata: fsMeta, blob: fsBlob }]
  }, '/share');
}

function extractErrors(strings, regex) {
  var errors = [];
  for (var i=0; i<strings.length; i++) {
    var m = regex.exec(strings[i]);
    if (m) {
      errors.push({
        line: m[1],
        msg: m[2]
      });
    }
  }
  return errors;
}

// main worker start

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
      msg:matches[4]
    });
  }
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

function assemblelinkCA65(code, platform, warnings) {
  load("ca65");
  load("ld65");
  var objout, lstout;
  {
    var CA65 = ca65({
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:print_fn,
    });
    var FS = CA65['FS'];
    setupFS(FS);
    FS.writeFile("main.s", code, {encoding:'utf8'});
    CA65.callMain(['-v', '-g', '-I', '/share/asminc', '-l', 'main.lst', "main.s"]);
    objout = FS.readFile("main.o", {encoding:'binary'});
    lstout = FS.readFile("main.lst", {encoding:'utf8'});
  }{
    var LD65 = ld65({
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:print_fn,
    });
    var FS = LD65['FS'];
    setupFS(FS);
    FS.writeFile("main.o", objout, {encoding:'binary'});
    LD65.callMain(['--cfg-path', '/share/cfg', '--lib-path', '/share/lib',
      '--start-addr', '0x6000', // TODO
      '-t', platform, '-o', 'main', '-m', 'main.map', 'main.o', platform+'.lib']);
    var aout = FS.readFile("main", {encoding:'binary'});
    var mapout = FS.readFile("main.map", {encoding:'utf8'});
    var listing = parseCA65Listing(lstout, mapout);
    return {
      output:aout.slice(4),
      lines:listing.lines,
      errors:listing.errors,
      intermediate:{listing:lstout, map:mapout},
    };
  }
}

function compileCC65(code, platform) {
  load("cc65");
  // stderr
  var re_err1 = /.*?(\d+).*?: (.+)/;
  var errors = [];
  var errline = 0;
  function match_fn(s) {
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
  setupFS(FS);
  FS.writeFile("main.c", code, {encoding:'utf8'});
  CC65.callMain(['-v', '-T', '-g', /*'-Cl',*/ '-Oirs', '-I', '/share/include', '-t', platform, "main.c"]);
  try {
    var asmout = FS.readFile("main.s", {encoding:'utf8'});
    return assemblelinkCA65(asmout, platform, errors);
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
    TOTAL_MEMORY:64*1024*1024,
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
        return {errors:extractErrors(aerr.split("\n"), /.+? line (\d+): (.+)/)};
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

var PLATFORM_PARAMS = {
  'mw8080bw': {
    code_start: 0x0,
    code_size: 0x2000,
    data_start: 0x2000,
    data_size: 0x400,
  },
};

function hexToArray(s, ofs) {
  var buf = new ArrayBuffer(s.length/2);
  var arr = new Uint8Array(buf);
  for (var i=0; i<arr.length; i++) {
    arr[i] = parseInt(s.slice(i*2+ofs,i*2+ofs+2), 16);
  }
  return arr;
}

function parseIHX(ihx, code_start, code_size) {
  var output = new Uint8Array(new ArrayBuffer(code_size));
  for (var s of ihx.split("\n")) {
    if (s[0] == ':') {
      var arr = hexToArray(s, 1);
      var count = arr[0];
      var address = (arr[1]<<8) + arr[2] - code_start;
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
  load("sdasz80");
  load("sdldz80");
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
      noInitialRun:true,
      //logReadFiles:true,
      print:match_asm_fn,
      printErr:match_asm_fn,
    });
    var FS = ASZ80['FS'];
    FS.writeFile("main.asm", code, {encoding:'utf8'});
    ASZ80.callMain(['-plosgffwy', 'main.asm']);
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
    var LDZ80 = sdldz80({
      noInitialRun:true,
      //logReadFiles:true,
      print:match_aslink_fn,
      printErr:match_aslink_fn,
    });
    var FS = LDZ80['FS'];
    FS.writeFile("main.rel", objout, {encoding:'utf8'});
    //FS.writeFile("main.lst", lstout, {encoding:'utf8'});
    LDZ80.callMain(['-mjwx', '-i', 'main.ihx', '-y',
      '-b', '_CODE=0x'+params.code_start.toString(16),
      '-b', '_DATA=0x'+params.data_start.toString(16),
      //'-k', '/usr/share/sdcc/lib/z80',
      //'-l', 'z80',
      'main.rel']);
    var hexout = FS.readFile("main.ihx", {encoding:'utf8'});
    var mapout = FS.readFile("main.noi", {encoding:'utf8'});
    //var dbgout = FS.readFile("main.cdb", {encoding:'utf8'});
    //   0000 21 02 00      [10]   52 	ld	hl, #2
    // TODO: offset by start address?
    var asmlines = parseListing(lstout, /^\s*([0-9A-F]+)\s+([0-9A-F][0-9A-F r]*[0-9A-F])\s+\[([0-9 ]+)\]\s+(\d+) (.*)/i, 4, 1, 2, 5, 3);
    var srclines = parseSourceLines(lstout, /^\s+\d+ ;<stdin>:(\d+):/i, /^\s*([0-9A-F]{4})/i);
    // parse symbol map
    var symbolmap = {};
    for (var s of mapout.split("\n")) {
      var toks = s.split(" ");
      if (s[0] == 'DEF') {
        symbolmap[s[1]] = s[2];
      }
    }
    return {
      output:parseIHX(hexout, params.code_start, params.code_size),
      lines:asmlines,
      srclines:srclines,
      errors:msvc_errors, // TODO?
      symbolmap:symbolmap,
      intermediate:{listing:lstout},
    };
  }
}

function compileSDCC(code, platform) {
  var preproc = preprocessMCPP(code, platform);
  if (preproc.errors) return preproc;
  else code = preproc.code;

  load("sdcc");
  var params = PLATFORM_PARAMS[platform];
  if (!params) throw Error("Platform not supported: " + platform);
  var SDCC = sdcc({
    noInitialRun:true,
    noFSInit:true,
    print:print_fn,
    printErr:match_msvc,
  });
  var FS = SDCC['FS'];
  setupStdin(FS, code);
  setupFS(FS);
  //FS.writeFile("main.c", code, {encoding:'utf8'});
  msvc_errors = [];
  SDCC.callMain(['--vc', '--std-sdcc99', '-mz80', '-Wall',
    '--c1mode', // '--debug',
    //'-S', 'main.c',
    //'--asm=z80asm',
    '--fomit-frame-pointer', '--opt-code-speed',
    '-o', 'main.asm']);
  if (msvc_errors.length) {
    return {errors:msvc_errors};
  }
  var asmout = FS.readFile("main.asm", {encoding:'utf8'});
  var warnings = msvc_errors;
  var result = assemblelinkSDASZ80(asmout, platform, true);
  result.asmlines = result.lines;
  result.lines = result.srclines;
  result.srclines = null;
  result.errors = result.errors.concat(warnings);
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
  var MCPP = mcpp({
    noInitialRun:true,
    noFSInit:true,
    print:print_fn,
    printErr:print_fn,
  });
  var FS = MCPP['FS'];
  FS.writeFile("main.c", code, {encoding:'utf8'});
  msvc_errors = [];
  try {
    MCPP.callMain([
      "-D", "__8BITWORKSHOP__",
      "-D", platform.toUpperCase(),
      "-W", "31",
      "main.c", "main.i"]);
      var iout = FS.readFile("main.i", {encoding:'utf8'});
  } catch (e) {
    msvc_errors.push({line:1, msg:e+""});
  }
  if (msvc_errors.length) {
    return {errors:msvc_errors};
  }
  return {code:iout};
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
}

onmessage = function(e) {
  var code = e.data.code;
  var platform = e.data.platform;
  var toolfn = TOOLS[e.data.tool];
  if (!toolfn) throw "no tool named " + e.data.tool;
  var result = toolfn(code, platform);
  if (result) {
    postMessage(result);
  }
}
