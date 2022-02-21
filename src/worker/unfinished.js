"use strict";

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
    execMain(step, Module, ["-b", "-s", "-l", "-m", "-g", "--origin=" + origin.toString(16), step.path]);
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
    // TODO; multiple listing files
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
  // TODO
  return {
    errors:errors,
    output:parseMIF(miffile),
    intermediate:{listing:miffile},
    lines:[]};
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
  // TODO
  return {
    output:aout,
    errors:errors,
    lines:asmlines,
    intermediate:{listing:alst},
  };
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

