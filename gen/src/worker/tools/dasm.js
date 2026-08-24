"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.re_usl = void 0;
exports.expandTabs = expandTabs;
exports.parseDASMListingLine = parseDASMListingLine;
exports.parseDASMListing = parseDASMListing;
exports.parseSymbolMap = parseSymbolMap;
exports.parseDASMOutput = parseDASMOutput;
exports.dedupeErrors = dedupeErrors;
exports.assembleDASM = assembleDASM;
const wasishim_1 = require("../../common/wasi/wasishim");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasmutils_1 = require("../wasmutils");
// DASM writes its listing (-l) in a fixed-column layout, with tabs padding out
// the columns. Once the tabs are expanded to 8-column stops the fields are:
//
//   ....... U....  ....  ..........*............ .............................
//   0      7 9     14    31         42          43            54
//   |      | |     |     |          |           |             mnemonic+operands
//   |      | |     |     |          |           label
//   |      | |     |     |          '*' = more bytes than fit, '-' = line skipped
//   |      | |     |     emitted bytes
//   |      | |     "????" when the address is not (yet) resolvable
//   |      | address; anything outside a segment gets the 5-digit address
//   |      | 10000, which shifts every column to its right along with it
//   |      segment flag ('U' = uninitialized segment)
//   line number within the current file
//
// Older DASM builds put the source file name in a column of its own, so every
// line said which file (or macro) it came from. That column is gone; the file
// being listed is now tracked by "------- FILE <name> LEVEL <n> PASS <n>"
// banners, and macro expansions are only recognizable by their line numbers
// restarting at 0 (the invocation) then 1..n (the macro body).
const COL_BYTES = 31;
const COL_OVERFLOW = 42;
const COL_LABEL = 43;
const COL_MNEMONIC = 54;
const re_fileMarker = /^-------\s+FILE\s+(.+?)(?:\s+LEVEL\s+(\d+)\s+PASS\s+(\d+))?\s*$/;
const re_lineStart = /^\s*(\d+) (.)([0-9a-f]+)( \?{4})?/i;
const re_equ = /\bequ\b/i;
const re_mac = /\bMAC\s+(\S+)/i;
const re_endm = /^ENDM\b/i;
// REPEAT/REPEND make the line number jump backwards inside the block being
// repeated, which would otherwise look like the end of a macro expansion.
const re_repeat = /^REPE(AT|ND)\b/i;
function expandTabs(s, tabsize = 8) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
        if (s[i] === '\t') {
            do {
                out += ' ';
            } while (out.length % tabsize);
        }
        else {
            out += s[i];
        }
    }
    return out;
}
// Split one listing line into its fields, or return null if it isn't one.
function parseDASMListingLine(rawline) {
    const line = expandTabs(rawline);
    const m = re_lineStart.exec(line);
    if (!m)
        return null;
    const linenum = parseInt(m[1]);
    const uninit = m[2] === 'U';
    const offset = parseInt(m[3], 16);
    const unresolved = m[4] != null;
    // an over-wide address pushes everything after it along by the same amount
    const shift = Math.max(0, m[3].length - 4);
    const mnemcol = COL_MNEMONIC + shift;
    let insns = line.substring(COL_BYTES + shift, COL_OVERFLOW + shift).trim();
    // an unresolved address or an uninitialized segment emits nothing
    if (!insns || uninit || unresolved)
        insns = null;
    const rest = line.substring(COL_LABEL + shift).trim();
    let op = line.substring(mnemcol).trim();
    // a label longer than its column pushes the mnemonic to the right
    if (line.length > mnemcol && line.charAt(mnemcol - 1) !== ' ') {
        const sp = rest.search(/\s/);
        op = sp < 0 ? '' : rest.substring(sp).trim();
    }
    return { linenum, offset, insns, rest, op };
}
function parseDASMListing(lstpath, lsttext, listings, errors, unresolved) {
    const macros = {};
    // files we've descended into via include, innermost last
    const filestack = [];
    // macro expansions we're inside of, innermost last
    const macstack = [];
    let curfile = '';
    let lastline = 0; // last line number seen in curfile
    let pendingInclude = false;
    let pendingMac = null;
    let lstline = 0;
    let lstlist = listings[lstpath];
    function macroLastLine(depth) {
        return depth > 0 ? macstack[depth - 1].lastline : lastline;
    }
    for (let rawline of lsttext.split(listingutils_1.re_crlf)) {
        lstline++;
        // "------- FILE x LEVEL n PASS n" enters a file, "------- FILE x" returns to one
        let filem = re_fileMarker.exec(rawline);
        if (filem) {
            if (filem[2] != null) {
                // the include directive itself occupies the parent's next line
                filestack.push({ file: curfile, lastline: lastline + 1 });
                lastline = 0;
                pendingInclude = true;
            }
            else {
                let prev;
                while (filestack.length) {
                    prev = filestack.pop();
                    if (prev.file === filem[1])
                        break;
                }
                lastline = prev ? prev.lastline : 0;
                pendingInclude = false;
            }
            curfile = filem[1];
            macstack.length = 0;
            pendingMac = null;
            continue;
        }
        let linem = parseDASMListingLine(rawline);
        if (linem) {
            const { linenum, offset, insns, rest, op } = linem;
            // the first line of an included file is the include directive itself
            if (pendingInclude && linenum === 0) {
                pendingInclude = false;
                continue;
            }
            pendingInclude = false;
            // don't use listing yet
            if (lstlist && lstlist.lines) {
                lstlist.lines.push({
                    line: lstline,
                    offset: offset,
                    insns: insns,
                    iscode: true,
                });
            }
            // unwind macro expansions that this line can't belong to
            while (macstack.length) {
                const top = macstack[macstack.length - 1];
                const len = macros[top.name] ? macros[top.name].len : 0;
                const finished = len > 0 && top.lastline >= len - 1;
                const inbody = !len || linenum <= len - 1;
                if (linenum === 0) {
                    // a nested invocation, unless the macro has run to its ENDM
                    if (!finished)
                        break;
                }
                else if (linenum === top.lastline + 1 && inbody) {
                    break; // the next line of the macro body
                }
                else if (!finished && inbody && re_repeat.test(op)) {
                    break; // REPEAT/REPEND jumps backwards within the macro
                }
                macstack.pop();
            }
            let lst = listings[curfile];
            // where in the user's sources this listing line came from
            let srcpath = curfile;
            let srcline = linenum;
            if (linenum === 0) {
                // macro invocation: charge it to the line that invoked it
                const depth = macstack.length;
                const callerline = macroLastLine(depth) + 1;
                if (depth > 0)
                    macstack[depth - 1].lastline = callerline;
                else
                    lastline = callerline;
                srcline = callerline;
                if (lst && lst.lines && depth === 0) {
                    lst.lines.push({
                        line: callerline,
                        offset: offset,
                        insns: insns,
                        iscode: true,
                    });
                }
                const macname = op.split(/\s+/)[0].toLowerCase();
                macstack.push({ name: macname, lastline: 0 });
            }
            else if (macstack.length) {
                // inside a macro body: charge it to the macro's definition
                const top = macstack[macstack.length - 1];
                top.lastline = linenum;
                const mac = macros[top.name];
                if (mac) {
                    srcpath = mac.file;
                    srcline = mac.line + linenum;
                }
                const maclst = mac && listings[mac.file];
                if (insns && maclst && maclst.lines) {
                    maclst.lines.push({
                        path: mac.file,
                        line: mac.line + linenum,
                        offset: offset,
                        insns: insns,
                        iscode: true,
                    });
                }
            }
            else {
                lastline = linenum;
                // look for MAC/ENDM so macro bodies can be mapped back to their source
                let macm = re_mac.exec(op);
                if (macm) {
                    pendingMac = { name: macm[1].toLowerCase(), line: linenum };
                    macros[pendingMac.name] = { line: linenum, file: curfile, len: 0 };
                }
                else if (pendingMac && re_endm.test(op)) {
                    macros[pendingMac.name].len = linenum - pendingMac.line;
                    pendingMac = null;
                }
                else if (insns && rest && !rest.match(re_equ) && lst && lst.lines) {
                    lst.lines.push({
                        line: linenum,
                        offset: offset,
                        insns: insns,
                        iscode: rest[0] != '.'
                    });
                }
            }
            // TODO: better symbol test (word boundaries)
            // TODO: ignore IFCONST and IFNCONST usage
            for (let key in unresolved) {
                let l = rest || rawline;
                // find the identifier substring
                let pos = l.indexOf(key);
                if (pos >= 0) {
                    // strip the comment, if any
                    let cmt = l.indexOf(';');
                    if (cmt < 0 || cmt > pos) {
                        // make sure identifier is flanked by non-word chars
                        if (new RegExp("\\b" + key + "\\b").exec(l)) {
                            errors.push({
                                path: srcpath,
                                line: srcline,
                                msg: "Unresolved symbol '" + key + "'"
                            });
                        }
                    }
                }
            }
        }
        // DASM 2.20.16 copies its diagnostics into the listing too
        let errm = listingutils_1.re_msvc.exec(rawline);
        if (errm) {
            errors.push({
                path: errm[1],
                line: parseInt(errm[2]),
                msg: errm[4]
            });
        }
    }
}
exports.re_usl = /(\w+)\s+0000\s+[?][?][?][?]/;
function parseSymbolMap(asym) {
    var symbolmap = {};
    for (var s of asym.split("\n")) {
        var toks = s.split(/\s+/);
        if (toks && toks.length >= 2 && !toks[0].startsWith('-')) {
            symbolmap[toks[0]] = parseInt(toks[1], 16);
        }
    }
    return symbolmap;
}
// Determine likely origin address from listing
function getMinListingOffset(listings) {
    let minOffset;
    for (let key in listings) {
        let lst = listings[key];
        if (lst && lst.lines) {
            for (let line of lst.lines) {
                if (line.iscode && line.offset > 0) {
                    if (minOffset === undefined || line.offset < minOffset) {
                        minOffset = line.offset;
                    }
                }
            }
        }
    }
    return minOffset;
}
// Scan DASM's stdout for unresolved symbols and messages it doesn't report in
// the listing. Returns the "Fatal assembly error" summary, if any, which is
// only worth showing when nothing more specific was found.
function parseDASMOutput(stdout, errors, unresolved) {
    const matcher = (0, listingutils_1.msvcErrorMatcher)(errors);
    let fatal = null;
    for (let line of stdout.split(listingutils_1.re_crlf)) {
        let matches = exports.re_usl.exec(line);
        if (matches) {
            let key = matches[1];
            if (key != 'NO_ILLEGAL_OPCODES') { // TODO
                unresolved[key] = 0;
            }
        }
        else if (listingutils_1.re_msvc.test(line)) {
            matcher(line);
        }
        else if (line.startsWith("Warning:")) {
            errors.push({ line: 0, msg: line.substr(9) });
        }
        else if (line.startsWith("unable ")) {
            errors.push({ line: 0, msg: line });
        }
        else if (line.startsWith("segment: ")) {
            errors.push({ line: 0, msg: "Segment overflow: " + line.substring(9) });
        }
        else if (line.startsWith("Fatal assembly error:")) {
            fatal = line.trim();
        }
        else if (line.toLowerCase().indexOf('error:') >= 0) {
            errors.push({ line: 0, msg: line.trim() });
        }
        else {
            matcher(line);
        }
    }
    return fatal;
}
// DASM reports the same diagnostic on stdout and again in the listing
function dedupeErrors(errors) {
    const seen = {};
    return errors.filter((e) => {
        const key = e.path + '\n' + e.line + '\n' + e.msg;
        if (seen[key])
            return false;
        seen[key] = true;
        return true;
    });
}
let wasiModule = null;
function assembleDASM(step) {
    let errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: 'main.a' });
    if (!wasiModule) {
        wasiModule = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)("dasm-wasisdk"));
    }
    const binpath = step.prefix + '.bin';
    const lstpath = step.prefix + '.lst';
    const sympath = step.prefix + '.sym';
    const wasi = new wasishim_1.WASIRunner();
    wasi.initSync(wasiModule);
    for (let file of step.files) {
        wasi.fs.putFile("./" + file, builder_1.store.getFileData(file));
    }
    wasi.addPreopenDirectory(".");
    wasi.setArgs(['dasm', step.path, '-f3',
        "-l" + lstpath,
        "-o" + binpath,
        "-s" + sympath]);
    // DASM 2.20.16 traps in ShowSymbols() when the program defines no symbols,
    // after the listing and binary are already written, so hold onto the crash
    // and only report it if we come up empty.
    let crash = null;
    try {
        wasi.run();
    }
    catch (e) {
        crash = "" + e;
    }
    const stdout = wasi.fds[1].getBytesAsString();
    const unresolved = {};
    const fatal = parseDASMOutput(stdout, errors, unresolved);
    const listings = {};
    for (let path of step.files) {
        listings[path] = { lines: [] };
    }
    // parse main listing, get errors and listings for each file
    let alst;
    try {
        alst = wasi.fs.getFile("./" + lstpath).getBytesAsString();
    }
    catch (e) {
        console.log(e);
        if (fatal)
            errors.push({ line: 0, msg: fatal });
        if (crash)
            errors.push({ line: 0, msg: crash });
        if (!errors.length)
            errors.push({ line: 0, msg: "No listing generated, maybe fatal assembly error?" });
        return { errors: errors };
    }
    parseDASMListing(lstpath, alst, listings, errors, unresolved);
    errors = dedupeErrors(errors);
    // the fatal summary only helps when we found nothing more specific
    if (fatal && !errors.length)
        errors.push({ line: 0, msg: fatal });
    if (errors.length) {
        return { errors: errors };
    }
    // read binary rom output and symbols
    let aout;
    let asym;
    try {
        aout = wasi.fs.getFile("./" + binpath).getBytes();
    }
    catch (e) {
        console.log(e);
        if (crash)
            errors.push({ line: 0, msg: crash });
        errors.push({ line: 0, msg: "No binary output generated, maybe segment overflow?" });
        return { errors: errors };
    }
    try {
        asym = wasi.fs.getFile("./" + sympath).getBytesAsString();
    }
    catch (e) {
        // a program with no symbols at all just has no symbol table
        asym = '';
    }
    (0, builder_1.putWorkFile)(binpath, aout);
    (0, builder_1.putWorkFile)(lstpath, alst);
    (0, builder_1.putWorkFile)(sympath, asym);
    // return unchanged if no files changed
    // TODO: what if listing or symbols change?
    if (!(0, builder_1.anyTargetChanged)(step, [binpath /*, lstpath, sympath*/]))
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
        origin: getMinListingOffset(listings),
    };
}
//# sourceMappingURL=dasm.js.map