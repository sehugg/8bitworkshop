
import { WorkerError, CodeListingMap } from "../../common/workertypes";
import { anyTargetChanged, BuildStep, BuildStepResult, emglobal, EmscriptenModule, execMain, gatherFiles, loadNative, makeErrorMatcher, moduleInstFn, parseListing, populateFiles, print_fn, putWorkFile, staleFiles } from "../workermain"


// http://www.nespowerpak.com/nesasm/
export function assembleNESASM(step: BuildStep): BuildStepResult {
    loadNative("nesasm");
    var re_filename = /\#\[(\d+)\]\s+(\S+)/;
    var re_insn = /\s+(\d+)\s+([0-9A-F]+):([0-9A-F]+)/;
    var re_error = /\s+(.+)/;
    var errors: WorkerError[] = [];
    var state = 0;
    var lineno = 0;
    var filename;
    function match_fn(s) {
        var m;
        switch (state) {
            case 0:
                m = re_filename.exec(s);
                if (m) {
                    filename = m[2];
                }
                m = re_insn.exec(s);
                if (m) {
                    lineno = parseInt(m[1]);
                    state = 1;
                }
                break;
            case 1:
                m = re_error.exec(s);
                if (m) {
                    errors.push({ path: filename, line: lineno, msg: m[1] });
                    state = 0;
                }
                break;
        }
    }
    var Module: EmscriptenModule = emglobal.nesasm({
        instantiateWasm: moduleInstFn('nesasm'),
        noInitialRun: true,
        print: match_fn
    });
    var FS = Module.FS;
    populateFiles(step, FS, {
        mainFilePath: 'main.a'
    });
    var binpath = step.prefix + '.nes';
    var lstpath = step.prefix + '.lst';
    var sympath = step.prefix + '.fns';
    execMain(step, Module, [step.path, '-s', "-l", "2"]);
    // parse main listing, get errors and listings for each file
    var listings: CodeListingMap = {};
    try {
        var alst = FS.readFile(lstpath, { 'encoding': 'utf8' });
        //   16  00:C004  8E 17 40    STX $4017    ; disable APU frame IRQ
        var asmlines = parseListing(alst, /^\s*(\d+)\s+([0-9A-F]+):([0-9A-F]+)\s+([0-9A-F ]+?)  (.*)/i, 1, 3, 4);
        putWorkFile(lstpath, alst);
        listings[lstpath] = {
            lines: asmlines,
            text: alst
        };
    } catch (e) {
        //
    }
    if (errors.length) {
        return { errors: errors };
    }
    // read binary rom output and symbols
    var aout, asym;
    aout = FS.readFile(binpath);
    try {
        asym = FS.readFile(sympath, { 'encoding': 'utf8' });
    } catch (e) {
        console.log(e);
        errors.push({ line: 0, msg: "No symbol table generated, maybe missing ENDM or segment overflow?" });
        return { errors: errors }
    }
    putWorkFile(binpath, aout);
    putWorkFile(sympath, asym);
    if (alst) putWorkFile(lstpath, alst); // listing optional (use LIST)
    // return unchanged if no files changed
    if (!anyTargetChanged(step, [binpath, sympath]))
        return;
    // parse symbols
    var symbolmap = {};
    for (var s of asym.split("\n")) {
        if (!s.startsWith(';')) {
            var m = /(\w+)\s+=\s+[$]([0-9A-F]+)/.exec(s);
            if (m) {
                symbolmap[m[1]] = parseInt(m[2], 16);
            }
        }
    }
    return {
        output: aout,
        listings: listings,
        errors: errors,
        symbolmap: symbolmap,
    };
}


/*
------+-------------------+-------------+----+---------+------+-----------------------+-------------------------------------------------------------------
Line | # File       Line | Line Type   | MX |  Reloc  | Size | Address   Object Code |  Source Code                                                      
------+-------------------+-------------+----+---------+------+-----------------------+-------------------------------------------------------------------
  1 |  1 zap.asm      1 | Unknown     | ?? |         |   -1 | 00/FFFF               |             broak                       
  2 |  1 zap.asm      2 | Comment     | ?? |         |   -1 | 00/FFFF               | * SPACEGAME
  
    => [Error] Impossible to decode address mode for instruction 'BNE  KABOOM!' (line 315, file 'zap.asm') : The number of element in 'KABOOM!' is even (should be value [operator value [operator value]...]).
    => [Error] Unknown line 'foo' in source file 'zap.asm' (line 315)
        => Creating Object file 'pcs.bin'
        => Creating Output file 'pcs.bin_S01__Output.txt'

*/
export function assembleMerlin32(step: BuildStep): BuildStepResult {
    loadNative("merlin32");
    var errors = [];
    var lstfiles = [];
    gatherFiles(step, { mainFilePath: "main.lnk" });
    var objpath = step.prefix + ".bin";
    if (staleFiles(step, [objpath])) {
        var args = ['-v', step.path];
        var merlin32: EmscriptenModule = emglobal.merlin32({
            instantiateWasm: moduleInstFn('merlin32'),
            noInitialRun: true,
            print: (s: string) => {
                var m = /\s*=>\s*Creating Output file '(.+?)'/.exec(s);
                if (m) {
                    lstfiles.push(m[1]);
                }
                var errpos = s.indexOf('Error');
                if (errpos >= 0) {
                    s = s.slice(errpos + 6).trim();
                    var mline = /\bline (\d+)\b/.exec(s);
                    var mpath = /\bfile '(.+?)'/.exec(s);
                    errors.push({
                        line: parseInt(mline[1]) || 0,
                        msg: s,
                        path: mpath[1] || step.path,
                    });
                }
            },
            printErr: print_fn,
        });
        var FS = merlin32.FS;
        populateFiles(step, FS);
        execMain(step, merlin32, args);
        if (errors.length)
            return { errors: errors };

        var errout = null;
        try {
            errout = FS.readFile("error_output.txt", { encoding: 'utf8' });
        } catch (e) {
            //
        }

        var objout = FS.readFile(objpath, { encoding: 'binary' });
        putWorkFile(objpath, objout);
        if (!anyTargetChanged(step, [objpath]))
            return;

        var symbolmap = {};
        var segments = [];
        var listings: CodeListingMap = {};
        lstfiles.forEach((lstfn) => {
            var lst = FS.readFile(lstfn, { encoding: 'utf8' }) as string;
            lst.split('\n').forEach((line) => {
                var toks = line.split(/\s*\|\s*/);
                if (toks && toks[6]) {
                    var toks2 = toks[1].split(/\s+/);
                    var toks3 = toks[6].split(/[:/]/, 4);
                    var path = toks2[1];
                    if (path && toks2[2] && toks3[1]) {
                        var lstline = {
                            line: parseInt(toks2[2]),
                            offset: parseInt(toks3[1].trim(), 16),
                            insns: toks3[2],
                            cycles: null,
                            iscode: false // TODO
                        };
                        var lst = listings[path];
                        if (!lst) listings[path] = lst = { lines: [] };
                        lst.lines.push(lstline);
                        //console.log(path,toks2,toks3);
                    }
                }
            });
        });
        return {
            output: objout, //.slice(0),
            listings: listings,
            errors: errors,
            symbolmap: symbolmap,
            segments: segments
        };
    }
}

// README.md:2:5: parse error, expected: statement or variable assignment, integer variable, variable assignment
export function compileFastBasic(step: BuildStep): BuildStepResult {
    // TODO: fastbasic-fp?
    loadNative("fastbasic-int");
    var params = step.params;
    gatherFiles(step, { mainFilePath: "main.fb" });
    var destpath = step.prefix + '.s';
    var errors = [];
    if (staleFiles(step, [destpath])) {
        var fastbasic: EmscriptenModule = emglobal.fastbasic({
            instantiateWasm: moduleInstFn('fastbasic-int'),
            noInitialRun: true,
            print: print_fn,
            printErr: makeErrorMatcher(errors, /(.+?):(\d+):(\d+):\s*(.+)/, 2, 4, step.path, 1),
        });
        var FS = fastbasic.FS;
        populateFiles(step, FS);
        var libfile = 'fastbasic-int.lib'
        params.libargs = [libfile];
        params.cfgfile = params.fastbasic_cfgfile;
        //params.extra_compile_args = ["--asm-define", "NO_SMCODE"];
        params.extra_link_files = [libfile, params.cfgfile];
        //fixParamsWithDefines(step.path, params);
        var args = [step.path, destpath];
        execMain(step, fastbasic, args);
        if (errors.length)
            return { errors: errors };
        var asmout = FS.readFile(destpath, { encoding: 'utf8' });
        putWorkFile(destpath, asmout);
    }
    return {
        nexttool: "ca65",
        path: destpath,
        args: [destpath],
        files: [destpath],
    };
}

