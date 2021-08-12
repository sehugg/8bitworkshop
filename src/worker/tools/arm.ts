
import { hex } from "../../common/util";
import { WorkerResult, CodeListingMap, WorkerError, SourceLine } from "../../common/workertypes";
import { anyTargetChanged, BuildStep, BuildStepResult, emglobal, EmscriptenModule, execMain, gatherFiles, getPrefix, getWorkFileAsString, loadNative, makeErrorMatcher, moduleInstFn, populateFiles, putWorkFile, re_crlf, staleFiles } from "../workermain"

export function assembleARMIPS(step: BuildStep): WorkerResult {
    loadNative("armips");
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.asm" });
    var objpath = "main.bin";
    var lstpath = step.prefix + ".lst";
    var sympath = step.prefix + ".sym";
    //test.armips(3) error: Parse error '.arm'
    var error_fn = makeErrorMatcher(errors, /^(.+?)\((\d+)\)\s+(fatal error|error|warning):\s+(.+)/, 2, 4, step.path, 1);

    if (staleFiles(step, [objpath])) {
        var args = [step.path, '-temp', lstpath, '-sym', sympath, '-erroronwarning'];
        var armips: EmscriptenModule = emglobal.armips({
            instantiateWasm: moduleInstFn('armips'),
            noInitialRun: true,
            print: error_fn,
            printErr: error_fn,
        });

        var FS = armips.FS;
        var code = getWorkFileAsString(step.path);
        code = `.arm.little :: .create "${objpath}",0 :: ${code}
  .close`;
        putWorkFile(step.path, code);
        populateFiles(step, FS);
        execMain(step, armips, args);
        if (errors.length)
            return { errors: errors };

        var objout = FS.readFile(objpath, { encoding: 'binary' }) as Uint8Array;
        putWorkFile(objpath, objout);
        if (!anyTargetChanged(step, [objpath]))
            return;

        var symbolmap = {};
        var segments = [];
        var listings: CodeListingMap = {};
        var lstout = FS.readFile(lstpath, { encoding: 'utf8' }) as string;
        var lines = lstout.split(re_crlf);
        //00000034 .word 0x11223344                                             ; /vidfill.armips line 25
        var re_asmline = /^([0-9A-F]+) (.+?); [/](.+?) line (\d+)/;
        var lastofs = -1;
        for (var line of lines) {
            var m;
            if (m = re_asmline.exec(line)) {
                var path = m[3];
                var path2 = getPrefix(path) + '.lst'; // TODO: don't rename listing
                var lst = listings[path2];
                if (lst == null) { lst = listings[path2] = { lines: [] }; }
                var ofs = parseInt(m[1], 16);
                if (lastofs == ofs) {
                    lst.lines.pop(); // get rid of duplicate offset
                } else if (ofs > lastofs) {
                    var lastline = lst.lines[lst.lines.length - 1];
                    if (lastline && !lastline.insns) {
                        var insns = objout.slice(lastofs, ofs).reverse();
                        lastline.insns = Array.from(insns).map((b) => hex(b, 2)).join('');
                    }
                }
                lst.lines.push({
                    path: path,
                    line: parseInt(m[4]),
                    offset: ofs
                });
                lastofs = ofs;
            }
        }
        //listings[lstpath] = {lines:lstlines, text:lstout};

        var symout = FS.readFile(sympath, { encoding: 'utf8' }) as string;
        //0000000C loop2
        //00000034 .dbl:0004
        var re_symline = /^([0-9A-F]+)\s+(.+)/;
        for (var line of symout.split(re_crlf)) {
            var m;
            if (m = re_symline.exec(line)) {
                symbolmap[m[2]] = parseInt(m[1], 16);
            }
        }

        return {
            output: objout, //.slice(0),
            listings: listings,
            errors: errors,
            symbolmap: symbolmap,
            segments: segments
        };
    }
}

export function assembleVASMARM(step: BuildStep): BuildStepResult {
    loadNative("vasmarm_std");
    /// error 2 in line 8 of "gfxtest.c": unknown mnemonic <ew>
    /// error 3007: undefined symbol <XXLOOP>
    /// TODO: match undefined symbols
    var re_err1 = /^(fatal error|error|warning)? (\d+) in line (\d+) of "(.+)": (.+)/;
    var re_err2 = /^(fatal error|error|warning)? (\d+): (.+)/;
    var re_undefsym = /symbol <(.+?)>/;
    var errors: WorkerError[] = [];
    var undefsyms = [];
    function findUndefinedSymbols(line: string) {
        // find undefined symbols in line
        undefsyms.forEach((sym) => {
            if (line.indexOf(sym) >= 0) {
                errors.push({
                    path: curpath,
                    line: curline,
                    msg: "Undefined symbol: " + sym,
                })
            }
        });
    }
    function match_fn(s) {
        let matches = re_err1.exec(s);
        if (matches) {
            errors.push({
                line: parseInt(matches[3]),
                path: matches[4],
                msg: matches[5],
            });
        } else {
            matches = re_err2.exec(s);
            if (matches) {
                let m = re_undefsym.exec(matches[3]);
                if (m) {
                    undefsyms.push(m[1]);
                } else {
                    errors.push({
                        line: 0,
                        msg: s,
                    });
                }
            } else {
                console.log(s);
            }
        }
    }

    gatherFiles(step, { mainFilePath: "main.asm" });
    var objpath = step.prefix + ".bin";
    var lstpath = step.prefix + ".lst";

    if (staleFiles(step, [objpath])) {
        var args = ['-Fbin', '-m7tdmi', '-x', '-wfail', step.path, '-o', objpath, '-L', lstpath];
        var vasm: EmscriptenModule = emglobal.vasm({
            instantiateWasm: moduleInstFn('vasmarm_std'),
            noInitialRun: true,
            print: match_fn,
            printErr: match_fn,
        });

        var FS = vasm.FS;
        populateFiles(step, FS);
        execMain(step, vasm, args);
        if (errors.length) {
            return { errors: errors };
        }

        if (undefsyms.length == 0) {
            var objout = FS.readFile(objpath, { encoding: 'binary' });
            putWorkFile(objpath, objout);
            if (!anyTargetChanged(step, [objpath]))
                return;
        }

        var lstout = FS.readFile(lstpath, { encoding: 'utf8' });
        // 00:00000018 023020E0        	    14:  eor r3, r0, r2
        // Source: "vidfill.vasm"
        // 00: ".text" (0-40)
        // LOOP                            00:00000018
        // STACK                            S:20010000
        var symbolmap = {};
        var segments = []; // TODO
        var listings: CodeListingMap = {};
        // TODO: parse listings
        var re_asmline = /^(\d+):([0-9A-F]+)\s+([0-9A-F ]+)\s+(\d+)([:M])/;
        var re_secline = /^(\d+):\s+"(.+)"/;
        var re_nameline = /^Source:\s+"(.+)"/;
        var re_symline = /^(\w+)\s+(\d+):([0-9A-F]+)/;
        var re_emptyline = /^\s+(\d+)([:M])/;
        var curpath = step.path;
        var curline = 0;
        var sections = {};
        // map file and section indices -> names
        var lines: string[] = lstout.split(re_crlf);
        // parse lines
        var lstlines: SourceLine[] = [];
        for (var line of lines) {
            var m;
            if (m = re_secline.exec(line)) {
                sections[m[1]] = m[2];
            } else if (m = re_nameline.exec(line)) {
                curpath = m[1];
            } else if (m = re_symline.exec(line)) {
                symbolmap[m[1]] = parseInt(m[3], 16);
            } else if (m = re_asmline.exec(line)) {
                if (m[5] == ':') {
                    curline = parseInt(m[4]);
                } else {
                    // TODO: macro line
                }
                lstlines.push({
                    path: curpath,
                    line: curline,
                    offset: parseInt(m[2], 16),
                    insns: m[3].replaceAll(' ', '')
                });
                findUndefinedSymbols(line);
            } else if (m = re_emptyline.exec(line)) {
                curline = parseInt(m[1]);
                findUndefinedSymbols(line);
            } else {
                //console.log(line);
            }
        }
        listings[lstpath] = { lines: lstlines, text: lstout };
        // catch-all if no error generated
        if (undefsyms.length && errors.length == 0) {
            errors.push({
                line: 0,
                msg: 'Undefined symbols: ' + undefsyms.join(', ')
            })
        }

        return {
            output: objout, //.slice(0x34),
            listings: listings,
            errors: errors,
            symbolmap: symbolmap,
            segments: segments
        };
    }
}

