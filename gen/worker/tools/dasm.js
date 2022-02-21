"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileBatariBasic = exports.assembleDASM = void 0;
const workermain_1 = require("../workermain");
function parseDASMListing(lstpath, lsttext, listings, errors, unresolved) {
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
    for (let line of lsttext.split(workermain_1.re_crlf)) {
        lstline++;
        let linem = lineMatch.exec(line + "    ");
        if (linem && linem[1] != null) {
            let linenum = parseInt(linem[1]);
            let filename = linem[2];
            let offset = parseInt(linem[3], 16);
            let insns = linem[4];
            let restline = linem[5];
            if (insns && insns.startsWith('?'))
                insns = null;
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
            }
            else {
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
                }
                else {
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
        let errm = workermain_1.re_msvc.exec(line);
        if (errm) {
            errors.push({
                path: errm[1],
                line: parseInt(errm[2]),
                msg: errm[4]
            });
        }
    }
}
function assembleDASM(step) {
    (0, workermain_1.load)("dasm");
    var re_usl = /(\w+)\s+0000\s+[?][?][?][?]/;
    var unresolved = {};
    var errors = [];
    var errorMatcher = (0, workermain_1.msvcErrorMatcher)(errors);
    function match_fn(s) {
        // TODO: what if s is not string? (startsWith is not a function)
        var matches = re_usl.exec(s);
        if (matches) {
            var key = matches[1];
            if (key != 'NO_ILLEGAL_OPCODES') { // TODO
                unresolved[matches[1]] = 0;
            }
        }
        else if (s.startsWith("Warning:")) {
            errors.push({ line: 0, msg: s.substr(9) });
        }
        else if (s.startsWith("unable ")) {
            errors.push({ line: 0, msg: s });
        }
        else if (s.startsWith("segment: ")) {
            errors.push({ line: 0, msg: "Segment overflow: " + s.substring(9) });
        }
        else if (s.toLowerCase().indexOf('error:') >= 0) {
            errors.push({ line: 0, msg: s.trim() });
        }
        else {
            errorMatcher(s);
        }
    }
    var Module = workermain_1.emglobal.DASM({
        noInitialRun: true,
        print: match_fn
    });
    var FS = Module.FS;
    (0, workermain_1.populateFiles)(step, FS, {
        mainFilePath: 'main.a'
    });
    var binpath = step.prefix + '.bin';
    var lstpath = step.prefix + '.lst';
    var sympath = step.prefix + '.sym';
    (0, workermain_1.execMain)(step, Module, [step.path, '-f3',
        "-l" + lstpath,
        "-o" + binpath,
        "-s" + sympath]);
    var alst = FS.readFile(lstpath, { 'encoding': 'utf8' });
    // parse main listing, get errors and listings for each file
    var listings = {};
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
    }
    catch (e) {
        console.log(e);
        errors.push({ line: 0, msg: "No symbol table generated, maybe segment overflow?" });
        return { errors: errors };
    }
    (0, workermain_1.putWorkFile)(binpath, aout);
    (0, workermain_1.putWorkFile)(lstpath, alst);
    (0, workermain_1.putWorkFile)(sympath, asym);
    // return unchanged if no files changed
    // TODO: what if listing or symbols change?
    if (!(0, workermain_1.anyTargetChanged)(step, [binpath /*, lstpath, sympath*/]))
        return;
    var symbolmap = {};
    for (var s of asym.split("\n")) {
        var toks = s.split(/\s+/);
        if (toks && toks.length >= 2 && !toks[0].startsWith('-')) {
            symbolmap[toks[0]] = parseInt(toks[1], 16);
        }
    }
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
exports.assembleDASM = assembleDASM;
function preprocessBatariBasic(code) {
    (0, workermain_1.load)("bbpreprocess");
    var bbout = "";
    function addbbout_fn(s) {
        bbout += s;
        bbout += "\n";
    }
    var BBPRE = workermain_1.emglobal.preprocess({
        noInitialRun: true,
        //logReadFiles:true,
        print: addbbout_fn,
        printErr: workermain_1.print_fn,
        noFSInit: true,
    });
    var FS = BBPRE.FS;
    (0, workermain_1.setupStdin)(FS, code);
    BBPRE.callMain([]);
    console.log("preprocess " + code.length + " -> " + bbout.length + " bytes");
    return bbout;
}
function compileBatariBasic(step) {
    (0, workermain_1.load)("bb2600basic");
    var params = step.params;
    // stdout
    var asmout = "";
    function addasmout_fn(s) {
        asmout += s;
        asmout += "\n";
    }
    // stderr
    var re_err1 = /[(](\d+)[)]:?\s*(.+)/;
    var errors = [];
    var errline = 0;
    function match_fn(s) {
        console.log(s);
        var matches = re_err1.exec(s);
        if (matches) {
            errline = parseInt(matches[1]);
            errors.push({
                line: errline,
                msg: matches[2]
            });
        }
    }
    (0, workermain_1.gatherFiles)(step, { mainFilePath: "main.bas" });
    var destpath = step.prefix + '.asm';
    if ((0, workermain_1.staleFiles)(step, [destpath])) {
        var BB = workermain_1.emglobal.bb2600basic({
            noInitialRun: true,
            //logReadFiles:true,
            print: addasmout_fn,
            printErr: match_fn,
            noFSInit: true,
            TOTAL_MEMORY: 64 * 1024 * 1024,
        });
        var FS = BB.FS;
        (0, workermain_1.populateFiles)(step, FS);
        // preprocess, pipe file to stdin
        var code = (0, workermain_1.getWorkFileAsString)(step.path);
        code = preprocessBatariBasic(code);
        (0, workermain_1.setupStdin)(FS, code);
        (0, workermain_1.setupFS)(FS, '2600basic');
        (0, workermain_1.execMain)(step, BB, ["-i", "/share", step.path]);
        if (errors.length)
            return { errors: errors };
        // build final assembly output from include file list
        var includesout = FS.readFile("includes.bB", { encoding: 'utf8' });
        var redefsout = FS.readFile("2600basic_variable_redefs.h", { encoding: 'utf8' });
        var includes = includesout.trim().split("\n");
        var combinedasm = "";
        var splitasm = asmout.split("bB.asm file is split here");
        for (var incfile of includes) {
            var inctext;
            if (incfile == "bB.asm")
                inctext = splitasm[0];
            else if (incfile == "bB2.asm")
                inctext = splitasm[1];
            else
                inctext = FS.readFile("/share/includes/" + incfile, { encoding: 'utf8' });
            console.log(incfile, inctext.length);
            combinedasm += "\n\n;;;" + incfile + "\n\n";
            combinedasm += inctext;
        }
        // TODO: ; bB.asm file is split here
        (0, workermain_1.putWorkFile)(destpath, combinedasm);
        (0, workermain_1.putWorkFile)("2600basic.h", FS.readFile("/share/includes/2600basic.h"));
        (0, workermain_1.putWorkFile)("2600basic_variable_redefs.h", redefsout);
    }
    return {
        nexttool: "dasm",
        path: destpath,
        args: [destpath],
        files: [destpath, "2600basic.h", "2600basic_variable_redefs.h"],
        bblines: true,
    };
}
exports.compileBatariBasic = compileBatariBasic;
//# sourceMappingURL=dasm.js.map