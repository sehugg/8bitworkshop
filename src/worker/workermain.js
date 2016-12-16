// set up require.js for worker
importScripts("../../dasm.js");

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

MAIN_FILENAME = "main.a";
PREAMBLE = "\tprocessor 6502\n";
PREAMBLE_LINES = 1;

function parseListing(code, unresolved) {
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
      var linenum = parseInt(linem[1]) - PREAMBLE_LINES;
      var filename = linem[2];
      var offset = parseInt(linem[3], 16);
      var insns = linem[4];
      var restline = linem[5];
      // inside of main file?
      if (filename == MAIN_FILENAME) {
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
        if (linenum == -PREAMBLE_LINES) { // start of macro?
          lines.push({
            line:lastline+1,
            offset:offset,
            insns:null
          });
        }
      }
      // TODO: check filename too
      // TODO: better symbol test (word boundaries)
      for (key in unresolved) {
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

function assemble(code) {
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
  FS.writeFile(MAIN_FILENAME, PREAMBLE + code);

  Module.callMain([MAIN_FILENAME, "-v3", "-la.lst"]);

  var aout = FS.readFile("a.out");
  //console.log(aout);
  var alst = FS.readFile("a.lst", {'encoding':'utf8'});
  //console.log(alst);
  var listing = parseListing(alst, unresolved);
  return {exitstatus:Module.EXITSTATUS, output:aout, listing:listing};
}

//assemblepgm("\tprocessor 6502\n\torg $800\n\tlda #0");

onmessage = function(e) {
  var code = e.data.code;
  var result = assemble(code);
  //console.log("RESULT", result);
  postMessage(result);
}
