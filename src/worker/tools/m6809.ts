import { CodeListingMap, WorkerError } from "../../common/workertypes";
import { BuildStep, BuildStepResult, load, emglobal, print_fn, populateFiles, execMain, putWorkFile, parseListing, loadNative, gatherFiles, staleFiles, moduleInstFn, getWorkFileAsString, preprocessMCPP, fixParamsWithDefines, msvcErrorMatcher, populateExtraFiles, anyTargetChanged, parseSourceLines } from "../workermain";
import { EmscriptenModule } from "../workermain";

// http://datapipe-blackbeltsystems.com/windows/flex/asm09.html
export function assembleXASM6809(step: BuildStep): BuildStepResult {
    load("xasm6809");
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
    var Module: EmscriptenModule = emglobal.xasm6809({
        noInitialRun: true,
        //logReadFiles:true,
        print: match_fn,
        printErr: print_fn
    });
    var FS = Module.FS;
    //setupFS(FS);
    populateFiles(step, FS, {
        mainFilePath: 'main.asm'
    });
    var binpath = step.prefix + '.bin';
    var lstpath = step.prefix + '.lst'; // in stdout
    execMain(step, Module, ["-c", "-l", "-s", "-y", "-o=" + binpath, step.path]);
    if (errors.length)
        return { errors: errors };
    var aout = FS.readFile(binpath, { encoding: 'binary' });
    if (aout.length == 0) {
        errors.push({ line: 0, msg: "Empty output file" });
        return { errors: errors };
    }
    putWorkFile(binpath, aout);
    putWorkFile(lstpath, alst);
    // TODO: symbol map
    //mond09     0000     
    var symbolmap = {};
    //00005  W 0003 [ 8] A6890011            lda   >PALETTE,x
    //00012    0011      0C0203              fcb   12,2,3
    var asmlines = parseListing(alst, /^\s*([0-9]+) .+ ([0-9A-F]+)\s+\[([0-9 ]+)\]\s+([0-9A-F]+) (.*)/i, 1, 2, 4, 3);
    var listings: CodeListingMap = {};
    listings[step.prefix + '.lst'] = { lines: asmlines, text: alst };
    return {
        output: aout,
        listings: listings,
        errors: errors,
        symbolmap: symbolmap,
    };
}

export function compileCMOC(step: BuildStep): BuildStepResult {
    loadNative("cmoc");
    var params = step.params;
    // stderr
    var re_err1 = /^[/]*([^:]*):(\d+): (.+)$/;
    var errors: WorkerError[] = [];
    var errline = 0;
    function match_fn(s) {
        var matches = re_err1.exec(s);
        if (matches) {
            errors.push({
                line: parseInt(matches[2]),
                msg: matches[3],
                path: matches[1] || step.path
            });
        } else {
            console.log(s);
        }
    }
    gatherFiles(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + '.s';
    if (staleFiles(step, [destpath])) {
        var args = ['-S', '-Werror', '-V',
            '-I/share/include',
            '-I.',
            step.path];
        var CMOC: EmscriptenModule = emglobal.cmoc({
            instantiateWasm: moduleInstFn('cmoc'),
            noInitialRun: true,
            //logReadFiles:true,
            print: match_fn,
            printErr: match_fn,
        });
        // load source file and preprocess
        var code = getWorkFileAsString(step.path);
        var preproc = preprocessMCPP(step, null);
        if (preproc.errors) {
            return { errors: preproc.errors }
        }
        else code = preproc.code;
        // set up filesystem
        var FS = CMOC.FS;
        //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
        populateFiles(step, FS);
        FS.writeFile(step.path, code);
        fixParamsWithDefines(step.path, params);
        if (params.extra_compile_args) {
            args.unshift.apply(args, params.extra_compile_args);
        }
        execMain(step, CMOC, args);
        if (errors.length)
            return { errors: errors };
        var asmout = FS.readFile(destpath, { encoding: 'utf8' });
        if (step.params.set_stack_end)
            asmout = asmout.replace('stack space in bytes', `\n lds #${step.params.set_stack_end}\n`)
        putWorkFile(destpath, asmout);
    }
    return {
        nexttool: "lwasm",
        path: destpath,
        args: [destpath],
        files: [destpath],
    };
}

export function assembleLWASM(step: BuildStep): BuildStepResult {
    loadNative("lwasm");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.s" });
    var objpath = step.prefix + ".o";
    var lstpath = step.prefix + ".lst";
    const isRaw = step.path.endsWith('.asm');
    if (staleFiles(step, [objpath, lstpath])) {
        var objout, lstout;
        var args = ['-9', '-I/share/asminc', '-o' + objpath, '-l' + lstpath, step.path];
        args.push(isRaw ? '-r' : '--obj');
        var LWASM: EmscriptenModule = emglobal.lwasm({
            instantiateWasm: moduleInstFn('lwasm'),
            noInitialRun: true,
            //logReadFiles:true,
            print: print_fn,
            printErr: msvcErrorMatcher(errors),
        });
        var FS = LWASM.FS;
        //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
        populateFiles(step, FS);
        fixParamsWithDefines(step.path, step.params);
        execMain(step, LWASM, args);
        if (errors.length)
            return { errors: errors };
        objout = FS.readFile(objpath, { encoding: 'binary' });
        lstout = FS.readFile(lstpath, { encoding: 'utf8' });
        putWorkFile(objpath, objout);
        putWorkFile(lstpath, lstout);
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

export function linkLWLINK(step: BuildStep): BuildStepResult {
    loadNative("lwlink");
    var params = step.params;
    gatherFiles(step);
    var binpath = "main";
    if (staleFiles(step, [binpath])) {
        var errors = [];
        var LWLINK: EmscriptenModule = emglobal.lwlink({
            instantiateWasm: moduleInstFn('lwlink'),
            noInitialRun: true,
            //logReadFiles:true,
            print: print_fn,
            printErr: function (s) {
                if (s.startsWith("Warning:"))
                    console.log(s);
                else
                    errors.push({ msg: s, line: 0 });
            }
        });
        var FS = LWLINK.FS;
        //setupFS(FS, '65-'+getRootBasePlatform(step.platform));
        populateFiles(step, FS);
        populateExtraFiles(step, FS, params.extra_link_files);
        var libargs = params.extra_link_args || [];
        var args = [
            '-L.',
            '--entry=program_start',
            '--raw',
            '--output=main',
            '--map=main.map'].concat(libargs, step.args);
        console.log(args);
        execMain(step, LWLINK, args);
        if (errors.length)
            return { errors: errors };
        var aout = FS.readFile("main", { encoding: 'binary' });
        var mapout = FS.readFile("main.map", { encoding: 'utf8' });
        putWorkFile("main", aout);
        putWorkFile("main.map", mapout);
        // return unchanged if no files changed
        if (!anyTargetChanged(step, ["main", "main.map"]))
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
        var listings: CodeListingMap = {};
        for (var fn of step.files) {
            if (fn.endsWith('.lst')) {
                // TODO
                var lstout = FS.readFile(fn, { encoding: 'utf8' });
                var asmlines = parseListing(lstout, /^([0-9A-F]+)\s+([0-9A-F]+)\s+[(]\s*(.+?)[)]:(\d+) (.*)/i, 4, 1, 2, 3, re_function, re_segment);
                for (let l of asmlines) {
                    l.offset += symbolmap[l.func] || 0;
                }
                // * Line //threed.c:117: init of variable e
                var srclines = parseSourceLines(lstout, /Line .+?:(\d+)/i, /^([0-9A-F]{4})/i, re_function, re_segment);
                for (let l of srclines) {
                    l.offset += symbolmap[l.func] || 0;
                }
                putWorkFile(fn, lstout);
                // strip out left margin
                lstout = lstout.split('\n').map(l => l.substring(0,15) + l.substring(56)).join('\n')
                // TODO: you have to get rid of all source lines to get asm listing
                listings[fn] = {
                    asmlines: srclines.length ? asmlines : null,
                    lines: srclines.length ? srclines : asmlines,
                    text: lstout
                };
            }
        }
        return {
            output: aout, //.slice(0),
            listings: listings,
            errors: errors,
            symbolmap: symbolmap,
            segments: segments
        };
    }
}

