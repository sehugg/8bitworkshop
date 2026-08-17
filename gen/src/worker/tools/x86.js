"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileSmallerC = compileSmallerC;
exports.assembleYASM = assembleYASM;
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasmutils_1 = require("../wasmutils");
const mcpp_1 = require("./mcpp");
// http://www.techhelpmanual.com/829-program_startup___exit.html
function compileSmallerC(step) {
    (0, wasmutils_1.loadNative)("smlrc");
    var params = step.params;
    // stderr
    var re_err1 = /^Error in "[/]*(.+)" [(](\d+):(\d+)[)]/;
    var errors = [];
    var errline = 0;
    var errpath = step.path;
    function match_fn(s) {
        var matches = re_err1.exec(s);
        if (matches) {
            errline = parseInt(matches[2]);
            errpath = matches[1];
        }
        else {
            errors.push({
                line: errline,
                msg: s,
                path: errpath,
            });
        }
    }
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + '.asm';
    if ((0, builder_1.staleFiles)(step, [destpath])) {
        var args = ['-seg16',
            //'-nobss',
            '-no-externs',
            step.path, destpath];
        var smlrc = wasmutils_1.emglobal.smlrc({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('smlrc'),
            noInitialRun: true,
            //logReadFiles:true,
            print: match_fn,
            printErr: match_fn,
        });
        // load source file and preprocess
        var code = (0, builder_1.getWorkFileAsString)(step.path);
        var preproc = (0, mcpp_1.preprocessMCPP)(step, null);
        if (preproc.errors) {
            return { errors: preproc.errors };
        }
        else
            code = preproc.code;
        // set up filesystem
        var FS = smlrc.FS;
        //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
        (0, builder_1.populateFiles)(step, FS);
        FS.writeFile(step.path, code);
        (0, builder_1.fixParamsWithDefines)(step.path, params);
        if (params.extra_compile_args) {
            args.unshift.apply(args, params.extra_compile_args);
        }
        (0, wasmutils_1.execMain)(step, smlrc, args);
        if (errors.length)
            return { errors: errors };
        var asmout = FS.readFile(destpath, { encoding: 'utf8' });
        (0, builder_1.putWorkFile)(destpath, asmout);
    }
    return {
        nexttool: "yasm",
        path: destpath,
        args: [destpath],
        files: [destpath],
    };
}
function assembleYASM(step) {
    (0, wasmutils_1.loadNative)("yasm");
    var errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.asm" });
    var objpath = step.prefix + ".exe";
    var lstpath = step.prefix + ".lst";
    var mappath = step.prefix + ".map";
    if ((0, builder_1.staleFiles)(step, [objpath])) {
        var args = ['-X', 'vc',
            '-a', 'x86', '-f', 'dosexe', '-p', 'nasm',
            '-D', 'freedos',
            //'-g', 'dwarf2',
            //'-I/share/asminc',
            '-o', objpath, '-l', lstpath, '--mapfile=' + mappath,
            step.path];
        // return yasm/*.ready*/
        var YASM = wasmutils_1.emglobal.yasm({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('yasm'),
            noInitialRun: true,
            //logReadFiles:true,
            print: wasmutils_1.print_fn,
            printErr: (0, listingutils_1.msvcErrorMatcher)(errors),
        });
        var FS = YASM.FS;
        //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
        (0, builder_1.populateFiles)(step, FS);
        //fixParamsWithDefines(step.path, step.params);
        (0, wasmutils_1.execMain)(step, YASM, args);
        if (errors.length)
            return { errors: errors };
        var objout, lstout, mapout;
        objout = FS.readFile(objpath, { encoding: 'binary' });
        lstout = FS.readFile(lstpath, { encoding: 'utf8' });
        mapout = FS.readFile(mappath, { encoding: 'utf8' });
        (0, builder_1.putWorkFile)(objpath, objout);
        (0, builder_1.putWorkFile)(lstpath, lstout);
        //putWorkFile(mappath, mapout);
        if (!(0, builder_1.anyTargetChanged)(step, [objpath]))
            return;
        var symbolmap = {};
        var segments = [];
        var lines = (0, listingutils_1.parseListing)(lstout, /\s*(\d+)\s+([0-9a-f]+)\s+([0-9a-f]+)\s+(.+)/i, 1, 2, 3);
        var listings = {};
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
//# sourceMappingURL=x86.js.map