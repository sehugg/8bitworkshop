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
var re_msvc = /(.*?)[(](\d+)[)]\s*:\s*(\w+)\s*(\d+):\s*(.*)/;
var msvc_errors;

function match_msvc(s) {
  var matches = re_msvc.exec(s);
  console.log(s, matches);
  if (matches) {
    errline = parseInt(matches[1]);
    msvc_errors.push({
      line:errline,
      msg:matches[2]
    });
  }
}

function parseListing(code, lineMatch) {
  var lines = [];
  for (var line of code.split(/\r?\n/)) {
    var linem = lineMatch.exec(line);
    if (linem && linem[1]) {
      var linenum = parseInt(linem[1]);
      var filename = linem[2];
      var offset = parseInt(linem[3], 16);
      var insns = linem[4];
      var restline = linem[5];
      if (insns) {
        lines.push({
          line:linenum,
          offset:offset,
          insns:insns,
          iscode:restline[0] != '.'
        });
      }
    }
  }
  return lines;
}

function parseDASMListing(code, unresolved) {
  var errorMatch = /main.a [(](\d+)[)]: error: (.+)/;
  //        4  08ee		       a9 00	   start      lda	#01workermain.js:23:5
  var lineMatch = /\s*(\d+)\s+(\S+)\s+([0-9a-f]+)\s+([0-9a-f][0-9a-f ]+)\s+(.+)/;
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
        if (linenum == -DASM_PREAMBLE_LINES) { // start of macro?
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
    var errm = errorMatch.exec(line);
    if (errm) {
      errors.push({
        line:parseInt(errm[1]),
        msg:errm[2]
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
  Module.callMain([DASM_MAIN_FILENAME, "-v3", "-la.lst"]);
  var aout = FS.readFile("a.out");
  var alst = FS.readFile("a.lst", {'encoding':'utf8'});
  var listing = parseDASMListing(alst, unresolved);
  return {
    exitstatus:Module.EXITSTATUS,
    output:aout.slice(2),
    listing:listing,
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
    return {listing:{errors:errors}};
  }
  var aout = FS.readFile("a.out");
  var alst = FS.readFile("a.rpt", {'encoding':'utf8'});
  var asym = FS.readFile("a.sym", {'encoding':'utf8'});
  var listing = parseDASMListing(alst, {});
  return {
    exitstatus:Module.EXITSTATUS,
    output:aout,
    listing:listing,
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
    return {listing:{errors:errors}};
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
  if (!platform)
    platform = 'apple2'; // TODO
  var objout, lstout;
  {
    var CA65 = ca65({
      noInitialRun:true,
      //logReadFiles:true,
      print:print_fn,
      printErr:print_fn,
      //locateFile: function(s) { return "" + s; },
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
      //locateFile: function(s) { return "" + s; },
    });
    var FS = LD65['FS'];
    setupFS(FS);
    FS.writeFile("main.o", objout, {encoding:'binary'});
    LD65.callMain(['--cfg-path', '/share/cfg', '--lib-path', '/share/lib',
      '--start-addr', '0x6000', // TODO
      '-t', platform, '-o', 'main', '-m', 'main.map', 'main.o', platform+'.lib']);
    var aout = FS.readFile("main", {encoding:'binary'});
    var mapout = FS.readFile("main.map", {encoding:'utf8'});
    return {
      exitstatus:LD65.EXITSTATUS,
      output:aout.slice(4),
      listing:parseCA65Listing(lstout, mapout),
      intermediate:{listing:lstout, map:mapout},
    };
  }
}

function compileCC65(code, platform) {
  load("cc65");
  if (!platform)
    platform = 'apple2'; // TODO
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
    //locateFile: function(s) { return "" + s; },
  });
  var FS = CC65['FS'];
  setupFS(FS);
  FS.writeFile("main.c", code, {encoding:'utf8'});
  CC65.callMain(['-v', '-T', '-g', /*'-Cl',*/ '-Oirs', '-I', '/share/include', '-t', platform, "main.c"]);
  try {
    var asmout = FS.readFile("main.s", {encoding:'utf8'});
    return assemblelinkCA65(asmout, platform, errors);
  } catch(e) {
    return {listing:{errors:errors}};
  }
}

function assembleZ80ASM(code, platform) {
  load("z80asm");
  if (!platform)
    platform = 'apple2'; // TODO
  var Module = z80asm({
    noInitialRun:true,
    //logReadFiles:true,
    print:print_fn,
    printErr:print_fn,
    TOTAL_MEMORY:64*1024*1024,
    //locateFile: function(s) { return "" + s; },
  });
  var FS = Module['FS'];
  //setupFS(FS);
  // changes for dialect
  code = code.replace(".optsdcc -mz80","");
  code = code.replace(/\tXREF /gi,"\tEXTERN ");
  code = code.replace(/\tXDEF /gi,"\tPUBLIC ");
  FS.writeFile("main.asm", code);
  try {
    Module.callMain(["-b", "-s", "-l", "-m", "main.asm"]);
    try {
      var aerr = FS.readFile("main.err", {'encoding':'utf8'}); // TODO
      if (aerr.length) {
        return {listing:{errors:extractErrors(aerr.split("\n"), /.+? line (\d+): (.+)/)}};
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
    var listing = parseDASMListing(alst, {}); // TODO
    return {
      exitstatus:Module.EXITSTATUS,
      output:aout,
      listing:{
        errors:[],
        lines:parseListing(alst, /(\d+)(\s+)([0-9A-F]+)\s+([0-9A-F][0-9A-F ]*[0-9A-F])\s+([A-Z_.].+)/i)
      },
      intermediate:{listing:alst, mapfile:amap},
    };
  } catch (e) {
    throw (e);
  }
}

function compileSDCC(code, platform) {
  load("sdcc");
  var SDCC = sdcc({
    noInitialRun:true,
    noFSInit:true,
    //logReadFiles:true,
    print:print_fn,
    printErr:match_msvc,
    //locateFile: function(s) { return "" + s; },
  });
  var FS = SDCC['FS'];
  setupStdin(FS, code);
  setupFS(FS);
  //FS.writeFile("main.c", code, {encoding:'utf8'});
  msvc_errors = [];
  SDCC.callMain(['--vc', '--c1mode', '--std-sdcc99', '--fomit-frame-pointer',
    '-mz80', '--asm=z80asm', '-o', 'test.asm']);
  try {
    var asmout = FS.readFile("test.asm", {encoding:'utf8'});
    return assembleZ80ASM(asmout, platform, msvc_errors);
  } catch(e) {
    return {listing:{errors:msvc_errors}};
  }
}

var tools = {
  'dasm': assembleDASM,
  'plasm': compilePLASMA,
  'cc65': compileCC65,
  'ca65': assemblelinkCA65,
  'z80asm': assembleZ80ASM,
  'sdcc': compileSDCC,
}

onmessage = function(e) {
  var code = e.data.code;
  var platform = e.data.platform;
  var toolfn = tools[e.data.tool];
  if (!toolfn) throw "no tool named " + e.data.tool;
  var result = toolfn(code, platform);
  if (result) {
    postMessage(result);
  }
}
