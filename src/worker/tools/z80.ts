
import { CodeListingMap } from "../../common/workertypes";
import { anyTargetChanged, BuildStep, BuildStepResult, emglobal, EmscriptenModule, execMain, gatherFiles, loadNative, makeErrorMatcher, moduleInstFn, parseListing, populateFiles, print_fn, putWorkFile, staleFiles } from "../workermain"


export function assembleZMAC(step: BuildStep): BuildStepResult {
  loadNative("zmac");
  var hexout, lstout, binout;
  var errors = [];
  var params = step.params;
  gatherFiles(step, { mainFilePath: "main.asm" });
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
    var ZMAC: EmscriptenModule = emglobal.zmac({
      instantiateWasm: moduleInstFn('zmac'),
      noInitialRun: true,
      //logReadFiles:true,
      print: print_fn,
      printErr: makeErrorMatcher(errors, /([^( ]+)\s*[(](\d+)[)]\s*:\s*(.+)/, 2, 3, step.path),
    });
    var FS = ZMAC.FS;
    populateFiles(step, FS);
    // TODO: don't know why CIM (hexary) doesn't work
    execMain(step, ZMAC, ['-z', '-c', '--oo', 'lst,cim', step.path]);
    if (errors.length) {
      return { errors: errors };
    }
    lstout = FS.readFile("zout/" + lstpath, { encoding: 'utf8' });
    binout = FS.readFile("zout/" + binpath, { encoding: 'binary' });
    putWorkFile(binpath, binout);
    putWorkFile(lstpath, lstout);
    if (!anyTargetChanged(step, [binpath, lstpath]))
      return;
    //  230: 1739+7+x   017A  1600      L017A: LD      D,00h
    var lines = parseListing(lstout, /\s*(\d+):\s*([0-9a-f]+)\s+([0-9a-f]+)\s+(.+)/i, 1, 2, 3);
    var listings: CodeListingMap = {};
    listings[lstpath] = { lines: lines };
    // parse symbol table
    var symbolmap = {};
    var sympos = lstout.indexOf('Symbol Table:');
    if (sympos > 0) {
      var symout = lstout.slice(sympos + 14);
      symout.split('\n').forEach(function (l) {
        var m = l.match(/(\S+)\s+([= ]*)([0-9a-f]+)/i);
        if (m) {
          symbolmap[m[1]] = parseInt(m[3], 16);
        }
      });
    }
    return {
      output: binout,
      listings: listings,
      errors: errors,
      symbolmap: symbolmap
    };
  }
}

