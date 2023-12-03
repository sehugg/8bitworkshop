import { WorkerError, CodeListingMap } from "../../common/workertypes";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, getWorkFileAsString, populateFiles, fixParamsWithDefines, putWorkFile, anyTargetChanged } from "../builder";
import { msvcErrorMatcher, parseListing } from "../listingutils";
import { EmscriptenModule, emglobal, execMain, loadNative, moduleInstFn, print_fn } from "../wasmutils";
import { preprocessMCPP } from "./mcpp";

// http://www.techhelpmanual.com/829-program_startup___exit.html
export function compileSmallerC(step: BuildStep): BuildStepResult {
  loadNative("smlrc");
  var params = step.params;
  // stderr
  var re_err1 = /^Error in "[/]*(.+)" [(](\d+):(\d+)[)]/;
  var errors: WorkerError[] = [];
  var errline = 0;
  var errpath = step.path;
  function match_fn(s) {
    var matches = re_err1.exec(s);
    if (matches) {
      errline = parseInt(matches[2]);
      errpath = matches[1];
    } else {
      errors.push({
        line: errline,
        msg: s,
        path: errpath,
      });
    }
  }
  gatherFiles(step, { mainFilePath: "main.c" });
  var destpath = step.prefix + '.asm';
  if (staleFiles(step, [destpath])) {
    var args = ['-seg16',
      //'-nobss',
      '-no-externs',
      step.path, destpath];
    var smlrc: EmscriptenModule = emglobal.smlrc({
      instantiateWasm: moduleInstFn('smlrc'),
      noInitialRun: true,
      //logReadFiles:true,
      print: match_fn,
      printErr: match_fn,
    });
    // load source file and preprocess
    var code = getWorkFileAsString(step.path);
    var preproc = preprocessMCPP(step, null);
    if (preproc.errors) {
      return { errors: preproc.errors };
    }
    else code = preproc.code;
    // set up filesystem
    var FS = smlrc.FS;
    //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
    populateFiles(step, FS);
    FS.writeFile(step.path, code);
    fixParamsWithDefines(step.path, params);
    if (params.extra_compile_args) {
      args.unshift.apply(args, params.extra_compile_args);
    }
    execMain(step, smlrc, args);
    if (errors.length)
      return { errors: errors };
    var asmout = FS.readFile(destpath, { encoding: 'utf8' });
    putWorkFile(destpath, asmout);
  }
  return {
    nexttool: "yasm",
    path: destpath,
    args: [destpath],
    files: [destpath],
  };
}

export function assembleYASM(step: BuildStep): BuildStepResult {
  loadNative("yasm");
  var errors = [];
  gatherFiles(step, { mainFilePath: "main.asm" });
  var objpath = step.prefix + ".exe";
  var lstpath = step.prefix + ".lst";
  var mappath = step.prefix + ".map";
  if (staleFiles(step, [objpath])) {
    var args = ['-X', 'vc',
      '-a', 'x86', '-f', 'dosexe', '-p', 'nasm',
      '-D', 'freedos',
      //'-g', 'dwarf2',
      //'-I/share/asminc',
      '-o', objpath, '-l', lstpath, '--mapfile=' + mappath,
      step.path];
    // return yasm/*.ready*/
    var YASM: EmscriptenModule = emglobal.yasm({
      instantiateWasm: moduleInstFn('yasm'),
      noInitialRun: true,
      //logReadFiles:true,
      print: print_fn,
      printErr: msvcErrorMatcher(errors),
    });
    var FS = YASM.FS;
    //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
    populateFiles(step, FS);
    //fixParamsWithDefines(step.path, step.params);
    execMain(step, YASM, args);
    if (errors.length)
      return { errors: errors };
    var objout, lstout, mapout;
    objout = FS.readFile(objpath, { encoding: 'binary' });
    lstout = FS.readFile(lstpath, { encoding: 'utf8' });
    mapout = FS.readFile(mappath, { encoding: 'utf8' });
    putWorkFile(objpath, objout);
    putWorkFile(lstpath, lstout);
    //putWorkFile(mappath, mapout);
    if (!anyTargetChanged(step, [objpath]))
      return;
    var symbolmap = {};
    var segments = [];
    var lines = parseListing(lstout, /\s*(\d+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+(.+)/i, 1, 2, 3);
    var listings: CodeListingMap = {};
    listings[lstpath] = { lines: lines, text: lstout };
    return {
      output: objout, //.slice(0),
      listings: listings,
      errors: errors,
      symbolmap: symbolmap,
      segments: segments
    };
  }
}

