"use strict";

// set up require.js for worker
importScripts("../../js/dasm.js");
importScripts("../../js/acme.js");
importScripts("../../js/plasm.js");

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
  function print_fn(s) {
    var matches = re_usl.exec(s);
    if (matches) {
      unresolved[matches[1]] = 0;
    }
  }
  var Module = DASM({
    noInitialRun:true,
    print:print_fn
  });
  var FS = Module['FS'];
  FS.writeFile(DASM_MAIN_FILENAME, DASM_PREAMBLE + code);
  Module.callMain([DASM_MAIN_FILENAME, "-v3", "-la.lst"]);
  var aout = FS.readFile("a.out");
  //console.log(aout);
  var alst = FS.readFile("a.lst", {'encoding':'utf8'});
  //console.log(alst);
  var listing = parseDASMListing(alst, unresolved);
  return {exitstatus:Module.EXITSTATUS, output:aout, listing:listing};
}

function assembleACME(code) {
  var re_usl = /(\w+)\s+0000\s+[?][?][?][?]/;
  var unresolved = {};
  function print_fn(s) {
    var matches = re_usl.exec(s);
    if (matches) {
      unresolved[matches[1]] = 0;
    }
  }
  var Module = ACME({
    noInitialRun:true,
    print:print_fn
  });
  var FS = Module['FS'];
  FS.writeFile("main.a", code);
  Module.callMain(["-o", "a.out", "-r", "a.rpt", "-l", "a.sym", "--setpc", "24576", "main.a"]);
  var aout = FS.readFile("a.out");
  var alst = FS.readFile("a.rpt", {'encoding':'utf8'});
  var asym = FS.readFile("a.sym", {'encoding':'utf8'});
  console.log("acme", code.length, "->", aout.length);
  console.log(alst);
  console.log(asym);
  var listing = parseDASMListing(alst, unresolved);
  return {exitstatus:Module.EXITSTATUS, output:aout, listing:listing};
}

function compilePLASMA(code) {
  function print_fn(s) { console.log(s); }
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
  console.log("plasm", code.length, "->", outstr.length);
  return assembleACME(outstr);
}

var tools = {
  'dasm': assembleDASM,
  'plasm': compilePLASMA,
}

onmessage = function(e) {
  var code = e.data.code;
  var toolfn = tools[e.data.tool];
  if (!toolfn) throw "no tool named " + e.data.tool;
  var result = toolfn(code);
  //console.log("RESULT", result);
  postMessage(result);
}
