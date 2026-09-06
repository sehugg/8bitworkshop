import { WorkerError, CodeListingMap } from "../../common/workertypes";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, getWorkFileAsString, populateFiles, fixParamsWithDefines, putWorkFile, anyTargetChanged, store } from "../builder";
import { msvcErrorMatcher, parseListing, re_crlf } from "../listingutils";
import { EmscriptenModule, emglobal, execMain, loadNative, moduleInstFn, print_fn, loadWASMBinary } from "../wasmutils";
import { WASIRunner } from "../../common/wasi/wasishim";
import { preprocessMCPP } from "./mcpp";

// http://www.techhelpmanual.com/829-program_startup___exit.html
let wasiModule: WebAssembly.Module | null = null;

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
  var errors: WorkerError[] = [];
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
    if (!wasiModule) {
      wasiModule = new WebAssembly.Module(loadWASMBinary("yasm"));
    }
    const wasi = new WASIRunner();
    wasi.initSync(wasiModule);
    for (let file of step.files) {
      wasi.fs.putFile("./" + file, store.getFileData(file));
    }
    wasi.addPreopenDirectory(".");
    wasi.setArgs(['yasm', ...args]);
    try {
      wasi.run();
    } catch (e) {
      errors.push({ line: 0, msg: "" + e });
    }
    const stderr = wasi.fds[2].getBytesAsString();
    const matcher = msvcErrorMatcher(errors);
    for (let line of stderr.split(re_crlf)) {
      matcher(line);
    }
    if (errors.length)
      return { errors: errors };
    var objout, lstout, mapout;
    try {
      objout = wasi.fs.getFile("./" + objpath).getBytes();
      lstout = wasi.fs.getFile("./" + lstpath).getBytesAsString();
      mapout = wasi.fs.getFile("./" + mappath).getBytesAsString();
    } catch (e) {
      errors.push({ line: 0, msg: "No output generated, maybe a fatal assembly error?" });
      return { errors: errors };
    }
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

