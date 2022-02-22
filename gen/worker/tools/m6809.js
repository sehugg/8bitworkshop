"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkLWLINK = exports.assembleLWASM = exports.compileCMOC = exports.assembleXASM6809 = void 0;
const workermain_1 = require("../workermain");
// http://datapipe-blackbeltsystems.com/windows/flex/asm09.html
function assembleXASM6809(step) {
    (0, workermain_1.load)("xasm6809");
    var alst = "";
    var lasterror = null;
    var errors = [];
    function match_fn(s) {
        alst += s;
        alst += "\n";
        if (lasterror) {
            var line = parseInt(s.slice(0, 5)) || 0;
            errors.push({
                line: line,
                msg: lasterror
            });
            lasterror = null;
        }
        else if (s.startsWith("***** ")) {
            lasterror = s.slice(6);
        }
    }
    var Module = workermain_1.emglobal.xasm6809({
        noInitialRun: true,
        //logReadFiles:true,
        print: match_fn,
        printErr: workermain_1.print_fn
    });
    var FS = Module.FS;
    //setupFS(FS);
    (0, workermain_1.populateFiles)(step, FS, {
        mainFilePath: 'main.asm'
    });
    var binpath = step.prefix + '.bin';
    var lstpath = step.prefix + '.lst'; // in stdout
    (0, workermain_1.execMain)(step, Module, ["-c", "-l", "-s", "-y", "-o=" + binpath, step.path]);
    if (errors.length)
        return { errors: errors };
    var aout = FS.readFile(binpath, { encoding: 'binary' });
    if (aout.length == 0) {
        errors.push({ line: 0, msg: "Empty output file" });
        return { errors: errors };
    }
    (0, workermain_1.putWorkFile)(binpath, aout);
    (0, workermain_1.putWorkFile)(lstpath, alst);
    // TODO: symbol map
    //mond09     0000     
    var symbolmap = {};
    //00005  W 0003 [ 8] A6890011            lda   >PALETTE,x
    //00012    0011      0C0203              fcb   12,2,3
    var asmlines = (0, workermain_1.parseListing)(alst, /^\s*([0-9]+) .+ ([0-9A-F]+)\s+\[([0-9 ]+)\]\s+([0-9A-F]+) (.*)/i, 1, 2, 4, 3);
    var listings = {};
    listings[step.prefix + '.lst'] = { lines: asmlines, text: alst };
    return {
        output: aout,
        listings: listings,
        errors: errors,
        symbolmap: symbolmap,
    };
}
exports.assembleXASM6809 = assembleXASM6809;
function compileCMOC(step) {
    (0, workermain_1.loadNative)("cmoc");
    var params = step.params;
    // stderr
    var re_err1 = /^[/]*([^:]*):(\d+): (.+)$/;
    var errors = [];
    var errline = 0;
    function match_fn(s) {
        var matches = re_err1.exec(s);
        if (matches) {
            errors.push({
                line: parseInt(matches[2]),
                msg: matches[3],
                path: matches[1] || step.path
            });
        }
        else {
            console.log(s);
        }
    }
    (0, workermain_1.gatherFiles)(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + '.s';
    if ((0, workermain_1.staleFiles)(step, [destpath])) {
        var args = ['-S', '-Werror', '-V',
            '-I/share/include',
            '-I.',
            step.path];
        var CMOC = workermain_1.emglobal.cmoc({
            instantiateWasm: (0, workermain_1.moduleInstFn)('cmoc'),
            noInitialRun: true,
            //logReadFiles:true,
            print: match_fn,
            printErr: match_fn,
        });
        // load source file and preprocess
        var code = (0, workermain_1.getWorkFileAsString)(step.path);
        var preproc = (0, workermain_1.preprocessMCPP)(step, null);
        if (preproc.errors) {
            return { errors: preproc.errors };
        }
        else
            code = preproc.code;
        // set up filesystem
        var FS = CMOC.FS;
        //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
        (0, workermain_1.populateFiles)(step, FS);
        FS.writeFile(step.path, code);
        (0, workermain_1.fixParamsWithDefines)(step.path, params);
        if (params.extra_compile_args) {
            args.unshift.apply(args, params.extra_compile_args);
        }
        (0, workermain_1.execMain)(step, CMOC, args);
        if (errors.length)
            return { errors: errors };
        var asmout = FS.readFile(destpath, { encoding: 'utf8' });
        if (step.params.set_stack_end)
            asmout = asmout.replace('stack space in bytes', `\n lds #${step.params.set_stack_end}\n`);
        (0, workermain_1.putWorkFile)(destpath, asmout);
    }
    return {
        nexttool: "lwasm",
        path: destpath,
        args: [destpath],
        files: [destpath],
    };
}
exports.compileCMOC = compileCMOC;
function assembleLWASM(step) {
    (0, workermain_1.loadNative)("lwasm");
    var errors = [];
    (0, workermain_1.gatherFiles)(step, { mainFilePath: "main.s" });
    var objpath = step.prefix + ".o";
    var lstpath = step.prefix + ".lst";
    const isRaw = step.path.endsWith('.asm');
    if ((0, workermain_1.staleFiles)(step, [objpath, lstpath])) {
        var objout, lstout;
        var args = ['-9', '-I/share/asminc', '-o' + objpath, '-l' + lstpath, step.path];
        args.push(isRaw ? '-r' : '--obj');
        var LWASM = workermain_1.emglobal.lwasm({
            instantiateWasm: (0, workermain_1.moduleInstFn)('lwasm'),
            noInitialRun: true,
            //logReadFiles:true,
            print: workermain_1.print_fn,
            printErr: (0, workermain_1.msvcErrorMatcher)(errors),
        });
        var FS = LWASM.FS;
        //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
        (0, workermain_1.populateFiles)(step, FS);
        (0, workermain_1.fixParamsWithDefines)(step.path, step.params);
        (0, workermain_1.execMain)(step, LWASM, args);
        if (errors.length)
            return { errors: errors };
        objout = FS.readFile(objpath, { encoding: 'binary' });
        lstout = FS.readFile(lstpath, { encoding: 'utf8' });
        (0, workermain_1.putWorkFile)(objpath, objout);
        (0, workermain_1.putWorkFile)(lstpath, lstout);
        if (isRaw) {
            return {
                output: objout
            };
        }
    }
    return {
        linktool: "lwlink",
        files: [objpath, lstpath],
        args: [objpath]
    };
}
exports.assembleLWASM = assembleLWASM;
function linkLWLINK(step) {
    (0, workermain_1.loadNative)("lwlink");
    var params = step.params;
    (0, workermain_1.gatherFiles)(step);
    var binpath = "main";
    if ((0, workermain_1.staleFiles)(step, [binpath])) {
        var errors = [];
        var LWLINK = workermain_1.emglobal.lwlink({
            instantiateWasm: (0, workermain_1.moduleInstFn)('lwlink'),
            noInitialRun: true,
            //logReadFiles:true,
            print: workermain_1.print_fn,
            printErr: function (s) {
                if (s.startsWith("Warning:"))
                    console.log(s);
                else
                    errors.push({ msg: s, line: 0 });
            }
        });
        var FS = LWLINK.FS;
        //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
        (0, workermain_1.populateFiles)(step, FS);
        (0, workermain_1.populateExtraFiles)(step, FS, params.extra_link_files);
        var libargs = params.extra_link_args || [];
        var args = [
            '-L.',
            '--entry=program_start',
            '--raw',
            '--output=main',
            '--map=main.map'
        ].concat(libargs, step.args);
        console.log(args);
        (0, workermain_1.execMain)(step, LWLINK, args);
        if (errors.length)
            return { errors: errors };
        var aout = FS.readFile("main", { encoding: 'binary' });
        var mapout = FS.readFile("main.map", { encoding: 'utf8' });
        (0, workermain_1.putWorkFile)("main", aout);
        (0, workermain_1.putWorkFile)("main.map", mapout);
        // return unchanged if no files changed
        if (!(0, workermain_1.anyTargetChanged)(step, ["main", "main.map"]))
            return;
        // parse symbol map
        //console.log(mapout);
        var symbolmap = {};
        var segments = [];
        for (var s of mapout.split("\n")) {
            var toks = s.split(" ");
            // TODO: use regex
            if (toks[0] == 'Symbol:') {
                let ident = toks[1];
                let ofs = parseInt(toks[4], 16);
                if (ident && ofs >= 0
                    && !ident.startsWith("l_")
                    //&& !/^L\d+$/.test(ident)
                    && !ident.startsWith('funcsize_')
                    && !ident.startsWith('funcend_')) {
                    symbolmap[ident] = ofs;
                }
            }
            else if (toks[0] == 'Section:') {
                let seg = toks[1];
                let segstart = parseInt(toks[5], 16);
                let segsize = parseInt(toks[7], 16);
                segments.push({ name: seg, start: segstart, size: segsize });
            }
        }
        // build listings
        const re_segment = /\s*SECTION\s+(\w+)/i;
        const re_function = /\s*([0-9a-f]+).+?(\w+)\s+EQU\s+[*]/i;
        var listings = {};
        for (var fn of step.files) {
            if (fn.endsWith('.lst')) {
                // TODO
                var lstout = FS.readFile(fn, { encoding: 'utf8' });
                var asmlines = (0, workermain_1.parseListing)(lstout, /^([0-9A-F]+)\s+([0-9A-F]+)\s+[(]\s*(.+?)[)]:(\d+) (.*)/i, 4, 1, 2, 3, re_function, re_segment);
                for (let l of asmlines) {
                    l.offset += symbolmap[l.func] || 0;
                }
                // * Line //threed.c:117: init of variable e
                var srclines = (0, workermain_1.parseSourceLines)(lstout, /Line .+?:(\d+)/i, /^([0-9A-F]{4})/i, re_function, re_segment);
                for (let l of srclines) {
                    l.offset += symbolmap[l.func] || 0;
                }
                (0, workermain_1.putWorkFile)(fn, lstout);
                // strip out left margin
                lstout = lstout.split('\n').map(l => l.substring(0, 15) + l.substring(56)).join('\n');
                // TODO: you have to get rid of all source lines to get asm listing
                listings[fn] = {
                    asmlines: srclines.length ? asmlines : null,
                    lines: srclines.length ? srclines : asmlines,
                    text: lstout
                };
            }
        }
        return {
            output: aout,
            listings: listings,
            errors: errors,
            symbolmap: symbolmap,
            segments: segments
        };
    }
}
exports.linkLWLINK = linkLWLINK;
//# sourceMappingURL=m6809.js.map