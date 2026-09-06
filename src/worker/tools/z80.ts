import { CodeListingMap, WorkerError } from "../../common/workertypes";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, putWorkFile, anyTargetChanged, store } from "../builder";
import { makeErrorMatcher, parseListing } from "../listingutils";
import { re_crlf } from "../listingutils";
import { WASIRunner } from "../../common/wasi/wasishim";
import { loadWASMBinary } from "../wasmutils";

let wasiModule: WebAssembly.Module | null = null;

export function assembleZMAC(step: BuildStep): BuildStepResult {
  let errors: WorkerError[] = [];
  var params = step.params;
  gatherFiles(step, { mainFilePath: "main.asm" });
  var lstpath = step.prefix + ".lst";
  var binpath = step.prefix + ".cim";
  if (staleFiles(step, [binpath])) {
    if (!wasiModule) {
      wasiModule = new WebAssembly.Module(loadWASMBinary("zmac"));
    }
    const wasi = new WASIRunner();
    wasi.initSync(wasiModule);
    for (let file of step.files) {
      wasi.fs.putFile("./" + file, store.getFileData(file));
    }
    wasi.addPreopenDirectory(".");
    /*
  error1.asm(4) : 'l18d4' Undeclared
         JP      L18D4

  error1.asm(11): warning: 'foobar' treated as label (instruction typo?)
      Add a colon or move to first column to stop this warning.
  1 errors (see listing if no diagnostics appeared here)
    */
    const matcher = makeErrorMatcher(errors, /([^( ]+)\s*[(](\d+)[)]\s*:\s*(.+)/, 2, 3, step.path);
    // TODO: don't know why CIM (hexary) doesn't work
    wasi.setArgs(['zmac', '-z', '-c', '--oo', 'lst,cim', step.path]);
    try {
      wasi.run();
    } catch (e) {
      errors.push({ line: 0, msg: "" + e });
    }
    const stderr = wasi.fds[2].getBytesAsString();
    for (let line of stderr.split(re_crlf)) {
      matcher(line);
    }
    if (errors.length) {
      return { errors: errors };
    }
    let lstout: string, binout: Uint8Array;
    try {
      lstout = wasi.fs.getFile("./zout/" + lstpath).getBytesAsString();
      binout = wasi.fs.getFile("./zout/" + binpath).getBytes();
    } catch (e) {
      errors.push({ line: 0, msg: "No output generated, maybe a fatal assembly error?" });
      return { errors: errors };
    }
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
