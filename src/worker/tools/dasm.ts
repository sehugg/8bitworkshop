import { WASIRunner } from "../../common/wasi/wasishim";
import { CodeListingMap, WorkerError } from "../../common/workertypes";
import { BuildStep, BuildStepResult, populateFiles, putWorkFile, anyTargetChanged, store } from "../builder";
import { msvcErrorMatcher, re_crlf, re_msvc } from "../listingutils";
import { execMain, emglobal, EmscriptenModule, load, loadWASMBinary } from "../wasmutils";

function parseDASMListing(lstpath: string, lsttext: string, listings: CodeListingMap, errors: WorkerError[], unresolved: {}) {
    // TODO: this gets very slow
    // TODO: macros that are on adjacent lines don't get offset addresses
    //        4  08ee		       a9 00	   start      lda	#01workermain.js:23:5
    let lineMatch = /\s*(\d+)\s+(\S+)\s+([0-9a-f]+)\s+([?0-9a-f][?0-9a-f ]+)?\s+(.+)?/i;
    let equMatch = /\bequ\b/i;
    let macroMatch = /\bMAC\s+(\S+)?/i;
    let lastline = 0;
    let macros = {};
    let lstline = 0;
    let lstlist = listings[lstpath];
    for (let line of lsttext.split(re_crlf)) {
        lstline++;
        let linem = lineMatch.exec(line + "    ");
        if (linem && linem[1] != null) {
            let linenum = parseInt(linem[1]);
            let filename = linem[2];
            let offset = parseInt(linem[3], 16);
            let insns = linem[4];
            let restline = linem[5];
            if (insns && insns.startsWith('?')) insns = null;
            // don't use listing yet
            if (lstlist && lstlist.lines) {
                lstlist.lines.push({
                    line: lstline,
                    offset: offset,
                    insns: insns,
                    iscode: true,
                });
            }
            // inside of a file?
            let lst = listings[filename];
            if (lst) {
                var lines = lst.lines;
                // look for MAC statement
                let macmatch = macroMatch.exec(restline);
                if (macmatch) {
                    macros[macmatch[1]] = { line: parseInt(linem[1]), file: linem[2].toLowerCase() };
                }
                else if (insns && restline && !restline.match(equMatch)) {
                    lines.push({
                        line: linenum,
                        offset: offset,
                        insns: insns,
                        iscode: restline[0] != '.'
                    });
                }
                lastline = linenum;
            } else {
                // inside of macro?
                let mac = macros[filename.toLowerCase()];
                // macro invocation in main file
                if (mac && linenum == 0) {
                    lines.push({
                        line: lastline + 1,
                        offset: offset,
                        insns: insns,
                        iscode: true
                    });
                }
                if (insns && mac) {
                    let maclst = listings[mac.file];
                    if (maclst && maclst.lines) {
                        maclst.lines.push({
                            path: mac.file,
                            line: mac.line + linenum,
                            offset: offset,
                            insns: insns,
                            iscode: true
                        });
                    }
                    // TODO: a listing file can't include other files
                } else {
                    // inside of macro or include file
                    if (insns && linem[3] && lastline > 0) {
                        lines.push({
                            line: lastline + 1,
                            offset: offset,
                            insns: null
                        });
                    }
                }
            }
            // TODO: better symbol test (word boundaries)
            // TODO: ignore IFCONST and IFNCONST usage
            for (let key in unresolved) {
                let l = restline || line;
                // find the identifier substring
                let pos = l.indexOf(key);
                if (pos >= 0) {
                    // strip the comment, if any
                    let cmt = l.indexOf(';');
                    if (cmt < 0 || cmt > pos) {
                        // make sure identifier is flanked by non-word chars
                        if (new RegExp("\\b" + key + "\\b").exec(l)) {
                            errors.push({
                                path: filename,
                                line: linenum,
                                msg: "Unresolved symbol '" + key + "'"
                            });
                        }
                    }
                }
            }
        }
        let errm = re_msvc.exec(line);
        if (errm) {
            errors.push({
                path: errm[1],
                line: parseInt(errm[2]),
                msg: errm[4]
            })
        }
    }
}

var re_usl = /(\w+)\s+0000\s+[?][?][?][?]/;

function parseSymbolMap(asym: string) {
    var symbolmap = {};
    for (var s of asym.split("\n")) {
        var toks = s.split(/\s+/);
        if (toks && toks.length >= 2 && !toks[0].startsWith('-')) {
            symbolmap[toks[0]] = parseInt(toks[1], 16);
        }
    }
    return symbolmap;
}

export function assembleDASM(step: BuildStep): BuildStepResult {
    load("dasm");
    var unresolved = {};
    var errors = [];
    var errorMatcher = msvcErrorMatcher(errors);
    function match_fn(s: string) {
        // TODO: what if s is not string? (startsWith is not a function)
        var matches = re_usl.exec(s);
        if (matches) {
            var key = matches[1];
            if (key != 'NO_ILLEGAL_OPCODES') { // TODO
                unresolved[matches[1]] = 0;
            }
        } else if (s.startsWith("Warning:")) {
            errors.push({ line: 0, msg: s.substr(9) });
        } else if (s.startsWith("unable ")) {
            errors.push({ line: 0, msg: s });
        } else if (s.startsWith("segment: ")) {
            errors.push({ line: 0, msg: "Segment overflow: " + s.substring(9) });
        } else if (s.toLowerCase().indexOf('error:') >= 0) {
            errors.push({ line: 0, msg: s.trim() });
        } else {
            errorMatcher(s);
        }
    }
    var Module: EmscriptenModule = emglobal.DASM({
        noInitialRun: true,
        print: match_fn
    });
    var FS = Module.FS;
    populateFiles(step, FS, {
        mainFilePath: 'main.a'
    });
    var binpath = step.prefix + '.bin';
    var lstpath = step.prefix + '.lst';
    var sympath = step.prefix + '.sym';
    execMain(step, Module, [step.path, '-f3',
    "-l" + lstpath,
    "-o" + binpath,
    "-s" + sympath]);
    var alst = FS.readFile(lstpath, { 'encoding': 'utf8' });
    // parse main listing, get errors and listings for each file
    var listings: CodeListingMap = {};
    //listings[lstpath] = {lines:[], text:alst};
    for (let path of step.files) {
        listings[path] = { lines: [] };
    }
    parseDASMListing(lstpath, alst, listings, errors, unresolved);
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
        errors.push({ line: 0, msg: "No symbol table generated, maybe segment overflow?" });
        return { errors: errors }
    }
    putWorkFile(binpath, aout);
    putWorkFile(lstpath, alst);
    putWorkFile(sympath, asym);
    // return unchanged if no files changed
    // TODO: what if listing or symbols change?
    if (!anyTargetChanged(step, [binpath/*, lstpath, sympath*/]))
        return;
    const symbolmap = parseSymbolMap(asym);
    // for bataribasic (TODO)
    if (step['bblines']) {
        let lst = listings[step.path];
        if (lst) {
            lst.asmlines = lst.lines;
            lst.text = alst;
            lst.lines = [];
        }
    }
    return {
        output: aout,
        listings: listings,
        errors: errors,
        symbolmap: symbolmap,
    };
}

let wasiModule: WebAssembly.Module | null = null;

export function assembleDASM2(step: BuildStep): BuildStepResult {
    const errors = [];
    if (!wasiModule) {
        wasiModule = new WebAssembly.Module(loadWASMBinary("dasm-wasisdk"));
    }
    const binpath = 'a.out';
    const lstpath = step.prefix + '.lst';
    const sympath = step.prefix + '.sym';
    const wasi = new WASIRunner();
    wasi.initSync(wasiModule);
    for (let file of step.files) {
        wasi.fs.putFile("./" + file, store.getFileData(file));
    }
    wasi.addPreopenDirectory(".");
    wasi.setArgs(['dasm', step.path, '-f3', "-l" + lstpath, "-s" + sympath]);
    try {
        wasi.run();
    } catch (e) {
        errors.push(e);
    }
    const stdout = wasi.fds[1].getBytesAsString();
    //const stderr = wasi.fds[2].getBytesAsString();
    const matcher = msvcErrorMatcher(errors);
    const unresolved = {};
    for (let line of stdout.split("\n")) {
        matcher(line);
        let m = re_usl.exec(line);
        if (m) {
            unresolved[m[1]] = 0;
        }
    }
    const alst = wasi.fs.getFile("./" + lstpath).getBytesAsString();
    const listings: CodeListingMap = {};
    for (let path of step.files) {
        listings[path] = { lines: [] };
    }
    parseDASMListing(lstpath, alst, listings, errors, unresolved);
    if (errors.length) {
        return { errors: errors };
    }
    const asym = wasi.fs.getFile("./" + sympath).getBytesAsString();
    const symbolmap = parseSymbolMap(asym);
    const output = wasi.fs.getFile("./" + binpath).getBytes();
    return {
        output,
        errors,
        listings,
        symbolmap
    };
}
