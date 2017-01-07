
"use strict";
// set up require.js for worker
importScripts("dasm.js");
importScripts("acme.js");
importScripts("plasm.js");
importScripts("cc65.js");
importScripts("ca65.js");
importScripts("ld65.js");

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

function setupFS(FS) {
  FS.mkdir('/share');
  FS.mount(FS.filesystems['WORKERFS'], {
    packages: [{ metadata: fsMeta, blob: fsBlob }]
  }, '/share');
}

// shim out window and document objects
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

var DASM_MAIN_FILENAME = "main.a";
var DASM_PREAMBLE = "\tprocessor 6502\n";
var DASM_PREAMBLE_LINES = 1;

var print_fn = function(s) { console.log(s); }

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
  //console.log(aout);
  var alst = FS.readFile("a.lst", {'encoding':'utf8'});
  //console.log(alst);
  var listing = parseDASMListing(alst, unresolved);
  return {exitstatus:Module.EXITSTATUS, output:aout.slice(2), listing:listing};
}

// TODO: not quite done
function assembleACME(code) {
  var re_usl = /(\w+)\s+0000\s+[?][?][?][?]/; // TODO: modify for acme
  var unresolved = {};
  function match_fn(s) {
    var matches = re_usl.exec(s);
    if (matches) {
      unresolved[matches[1]] = 0;
    }
  }
  var Module = ACME({
    noInitialRun:true,
    print:match_fn
  });
  var FS = Module['FS'];
  FS.writeFile("main.a", code);
  Module.callMain(["-o", "a.out", "-r", "a.rpt", "-l", "a.sym", "--setpc", "24576", "main.a"]);
  var aout = FS.readFile("a.out");
  var alst = FS.readFile("a.rpt", {'encoding':'utf8'}); // TODO
  var asym = FS.readFile("a.sym", {'encoding':'utf8'}); // TODO
  console.log("acme", code.length, "->", aout.length);
  //console.log(aout);
  console.log(alst);
  console.log(asym);
  var listing = parseDASMListing(alst, unresolved);
  return {exitstatus:Module.EXITSTATUS, output:aout, listing:listing};
}

function compilePLASMA(code) {
  var outstr = "";
  function out_fn(s) { outstr += s; outstr += "\n"; }
  var Module = PLASM({
    noInitialRun:true,
    noFSInit:true,
    print:out_fn
  });
  var FS = Module['FS'];
  var i = 0;
  var output = [];
  FS.init(
    function() { return i<code.length ? code.charCodeAt(i++) : null; }
  );
  FS.writeFile("main.pla", code);
  Module.callMain(["-A"]);
  //console.log("plasm", code.length, "->", outstr.length);
  return assembleACME(outstr);
}

function parseCA65Listing(code, unresolved) {
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
        offset:offset + 0x6048, //TODO: use map file
        insns:null
      });
      //console.log(linem, lastlinenum, lines[lines.length-1]);
    }
  }
  return {lines:lines, errors:errors};
}

function assemblelinkCA65(code, platform) {
  if (!platform)
    platform = 'apple2'; // TODO
  var objout, lstout;
  {
    var CA65 = ca65({
      noInitialRun:true,
      logReadFiles:true,
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
      logReadFiles:true,
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
    // CODE                  00603E  00637C  00033F  00001
    console.log(lstout);
    console.log(mapout);
    return {exitstatus:LD65.EXITSTATUS, output:aout.slice(4), listing:parseCA65Listing(lstout)};
  }
}

function compileCC65(code, platform) {
  if (!platform)
    platform = 'apple2'; // TODO
  var CC65 = cc65({
    noInitialRun:true,
    logReadFiles:true,
    print:print_fn,
    printErr:print_fn,
    //locateFile: function(s) { return "" + s; },
  });
  var FS = CC65['FS'];
  setupFS(FS);
  FS.writeFile("main.c", code, {encoding:'utf8'});
  CC65.callMain(['-v', '-T', '-g', '-Oirs', '-I', '/share/include', '-t', platform, "main.c"]);
  var asmout = FS.readFile("main.s", {encoding:'utf8'});
  return assemblelinkCA65(asmout, platform);
}

var tools = {
  'dasm': assembleDASM,
  'plasm': compilePLASMA,
  'cc65': compileCC65,
  'ca65': assemblelinkCA65,
}

onmessage = function(e) {
  var code = e.data.code;
  var toolfn = tools[e.data.tool];
  if (!toolfn) throw "no tool named " + e.data.tool;
  var result = toolfn(code);
  //console.log("RESULT", result);
  if (result) {
    postMessage(result);
  }
}
