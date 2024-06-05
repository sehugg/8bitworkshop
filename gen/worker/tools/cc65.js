"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileCC65 = exports.linkLD65 = exports.assembleCA65 = void 0;
const util_1 = require("../../common/util");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasmutils_1 = require("../wasmutils");
/*
000000r 1               .segment        "CODE"
000000r 1               .proc	_rasterWait: near
000000r 1               ; int main() { return mul2(2); }
000000r 1                       .dbg    line, "main.c", 3
000014r 1                      	.dbg	  func, "main", "00", extern, "_main"
000000r 1  A2 00                ldx     #$00
00B700  1               BOOT2:
00B700  1  A2 01         ldx #1 ;track
00B725  1  00           IBLASTDRVN: .byte 0
00B726  1  xx xx        IBSECSZ: .res 2
00BA2F  1  2A 2B E8 2C   HEX "2A2BE82C2D2E2F303132F0F133343536"
*/
function parseCA65Listing(asmfn, code, symbols, segments, params, dbg, listings) {
    var _a;
    var segofs = 0;
    var offset = 0;
    var dbgLineMatch = /^([0-9A-F]+)([r]?)\s+(\d+)\s+[.]dbg\s+(\w+), "([^"]+)", (.+)/;
    var funcLineMatch = /"(\w+)", (\w+), "(\w+)"/;
    var insnLineMatch = /^([0-9A-F]+)([r]?)\s{1,2}(\d+)\s{1,2}([0-9A-Frx ]{11})\s+(.*)/;
    var segMatch = /[.]segment\s+"(\w+)"/i;
    var origlines = [];
    var lines = origlines;
    var linenum = 0;
    let curpath = asmfn || '';
    // TODO: only does .c functions, not all .s files
    for (var line of code.split(listingutils_1.re_crlf)) {
        var dbgm = dbgLineMatch.exec(line);
        if (dbgm && dbgm[1]) {
            var dbgtype = dbgm[4];
            offset = parseInt(dbgm[1], 16);
            curpath = dbgm[5];
            // new file?
            if (curpath && listings) {
                let l = listings[curpath];
                if (!l)
                    l = listings[curpath] = { lines: [] };
                lines = l.lines;
            }
            if (dbgtype == 'func') {
                var funcm = funcLineMatch.exec(dbgm[6]);
                if (funcm) {
                    var funcofs = symbols[funcm[3]];
                    if (typeof funcofs === 'number') {
                        segofs = funcofs - offset;
                        //console.log(funcm[3], funcofs, '-', offset);
                    }
                }
            }
        }
        if (dbg && dbgm && dbgtype == 'line') {
            //console.log(dbgm[5], dbgm[6], offset, segofs);
            lines.push({
                path: dbgm[5],
                line: parseInt(dbgm[6]),
                offset: offset + segofs,
                insns: null
            });
        }
        let linem = insnLineMatch.exec(line);
        let topfile = linem && linem[3] == '1';
        if (topfile) {
            let insns = ((_a = linem[4]) === null || _a === void 0 ? void 0 : _a.trim()) || '';
            // skip extra insns for macro expansions
            if (!(insns != '' && linem[5] == '')) {
                linenum++;
            }
            if (linem[1]) {
                var offset = parseInt(linem[1], 16);
                if (insns.length) {
                    //console.log(dbg, curpath, linenum, offset, segofs, insns);
                    if (!dbg) {
                        lines.push({
                            path: curpath,
                            line: linenum,
                            offset: offset + segofs,
                            insns: insns,
                            iscode: true // TODO: can't really tell unless we parse it
                        });
                    }
                }
                else {
                    var sym = null;
                    var label = linem[5];
                    if (label === null || label === void 0 ? void 0 : label.endsWith(':')) {
                        sym = label.substring(0, label.length - 1);
                    }
                    else if (label === null || label === void 0 ? void 0 : label.toLowerCase().startsWith('.proc')) {
                        sym = label.split(' ')[1];
                    }
                    if (sym && !sym.startsWith('@')) {
                        var symofs = symbols[sym];
                        if (typeof symofs === 'number') {
                            segofs = symofs - offset;
                            //console.log(sym, segofs, symofs, '-', offset);
                        }
                    }
                }
            }
        }
    }
    return origlines;
}
function assembleCA65(step) {
    (0, wasmutils_1.loadNative)("ca65");
    var errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.s" });
    var objpath = step.prefix + ".o";
    var lstpath = step.prefix + ".lst";
    if ((0, builder_1.staleFiles)(step, [objpath, lstpath])) {
        var objout, lstout;
        var CA65 = wasmutils_1.emglobal.ca65({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('ca65'),
            noInitialRun: true,
            //logReadFiles:true,
            print: wasmutils_1.print_fn,
            printErr: (0, listingutils_1.makeErrorMatcher)(errors, /(.+?):(\d+): (.+)/, 2, 3, step.path, 1),
        });
        var FS = CA65.FS;
        (0, wasmutils_1.setupFS)(FS, '65-' + (0, util_1.getRootBasePlatform)(step.platform));
        (0, builder_1.populateFiles)(step, FS);
        (0, builder_1.fixParamsWithDefines)(step.path, step.params);
        var args = ['-v', '-g', '-I', '/share/asminc', '-o', objpath, '-l', lstpath, step.path];
        args.unshift.apply(args, ["-D", "__8BITWORKSHOP__=1"]);
        if (step.mainfile) {
            args.unshift.apply(args, ["-D", "__MAIN__=1"]);
        }
        (0, wasmutils_1.execMain)(step, CA65, args);
        if (errors.length) {
            let listings = {};
            // TODO? change extension to .lst
            //listings[step.path] = { lines:[], text:getWorkFileAsString(step.path) };
            return { errors, listings };
        }
        objout = FS.readFile(objpath, { encoding: 'binary' });
        lstout = FS.readFile(lstpath, { encoding: 'utf8' });
        (0, builder_1.putWorkFile)(objpath, objout);
        (0, builder_1.putWorkFile)(lstpath, lstout);
    }
    return {
        linktool: "ld65",
        files: [objpath, lstpath],
        args: [objpath]
    };
}
exports.assembleCA65 = assembleCA65;
function linkLD65(step) {
    var _a, _b;
    (0, wasmutils_1.loadNative)("ld65");
    var params = step.params;
    (0, builder_1.gatherFiles)(step);
    var binpath = "main";
    if ((0, builder_1.staleFiles)(step, [binpath])) {
        var errors = [];
        var LD65 = wasmutils_1.emglobal.ld65({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('ld65'),
            noInitialRun: true,
            //logReadFiles:true,
            print: wasmutils_1.print_fn,
            printErr: function (s) { errors.push({ msg: s, line: 0 }); }
        });
        var FS = LD65.FS;
        (0, wasmutils_1.setupFS)(FS, '65-' + (0, util_1.getRootBasePlatform)(step.platform));
        (0, builder_1.populateFiles)(step, FS);
        (0, builder_1.populateExtraFiles)(step, FS, params.extra_link_files);
        // populate .cfg file, if it is a custom one
        if (builder_1.store.hasFile(params.cfgfile)) {
            (0, builder_1.populateEntry)(FS, params.cfgfile, builder_1.store.getFileEntry(params.cfgfile), null);
        }
        var libargs = params.libargs || [];
        var cfgfile = params.cfgfile;
        var args = ['--cfg-path', '/share/cfg',
            '--lib-path', '/share/lib',
            '-C', cfgfile,
            '-Ln', 'main.vice',
            //'--dbgfile', 'main.dbg', // TODO: get proper line numbers
            '-o', 'main',
            '-m', 'main.map'].concat(step.args, libargs);
        //console.log(args);
        (0, wasmutils_1.execMain)(step, LD65, args);
        if (errors.length)
            return { errors: errors };
        var aout = FS.readFile("main", { encoding: 'binary' });
        var mapout = FS.readFile("main.map", { encoding: 'utf8' });
        var viceout = FS.readFile("main.vice", { encoding: 'utf8' });
        // correct binary for PCEngine
        if (step.platform == 'pce' && aout.length > 0x2000) {
            // move 8 KB from end to front
            let newrom = new Uint8Array(aout.length);
            newrom.set(aout.slice(aout.length - 0x2000), 0);
            newrom.set(aout.slice(0, aout.length - 0x2000), 0x2000);
            aout = newrom;
        }
        //var dbgout = FS.readFile("main.dbg", {encoding:'utf8'});
        (0, builder_1.putWorkFile)("main", aout);
        (0, builder_1.putWorkFile)("main.map", mapout);
        (0, builder_1.putWorkFile)("main.vice", viceout);
        // return unchanged if no files changed
        if (!(0, builder_1.anyTargetChanged)(step, ["main", "main.map", "main.vice"]))
            return;
        // parse symbol map (TODO: omit segments, constants)
        var symbolmap = {};
        for (var s of viceout.split("\n")) {
            var toks = s.split(" ");
            if (toks[0] == 'al') {
                let ident = toks[2].substr(1);
                if (ident.length != 5 || !ident.startsWith('L')) { // no line numbers
                    let ofs = parseInt(toks[1], 16);
                    symbolmap[ident] = ofs;
                }
            }
        }
        var segments = [];
        // TODO: CHR, banks, etc
        let re_seglist = /(\w+)\s+([0-9A-F]+)\s+([0-9A-F]+)\s+([0-9A-F]+)\s+([0-9A-F]+)/;
        let parseseglist = false;
        let m;
        for (let s of mapout.split('\n')) {
            if (parseseglist && (m = re_seglist.exec(s))) {
                let seg = m[1];
                let start = parseInt(m[2], 16);
                let size = parseInt(m[4], 16);
                let type = '';
                // TODO: better id of ram/rom
                if (seg.startsWith('CODE') || seg == 'STARTUP' || seg == 'RODATA' || seg.endsWith('ROM'))
                    type = 'rom';
                else if (seg == 'ZP' || seg == 'DATA' || seg == 'BSS' || seg.endsWith('RAM'))
                    type = 'ram';
                segments.push({ name: seg, start, size, type });
            }
            if (s == 'Segment list:')
                parseseglist = true;
            if (s == '')
                parseseglist = false;
        }
        // build listings
        var listings = {};
        for (var fn of step.files) {
            if (fn.endsWith('.lst')) {
                var lstout = FS.readFile(fn, { encoding: 'utf8' });
                lstout = lstout.split('\n\n')[1] || lstout; // remove header
                (0, builder_1.putWorkFile)(fn, lstout);
                //const asmpath = fn.replace(/\.lst$/, '.ca65'); // TODO! could be .s
                let isECS = ((_b = (_a = step.debuginfo) === null || _a === void 0 ? void 0 : _a.systems) === null || _b === void 0 ? void 0 : _b.Init) != null; // TODO
                if (isECS) {
                    var asmlines = [];
                    var srclines = parseCA65Listing(fn, lstout, symbolmap, segments, params, true, listings);
                    listings[fn] = {
                        lines: [],
                        text: lstout
                    };
                }
                else {
                    var asmlines = parseCA65Listing(fn, lstout, symbolmap, segments, params, false);
                    var srclines = parseCA65Listing('', lstout, symbolmap, segments, params, true);
                    listings[fn] = {
                        asmlines: srclines.length ? asmlines : null,
                        lines: srclines.length ? srclines : asmlines,
                        text: lstout
                    };
                }
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
exports.linkLD65 = linkLD65;
function compileCC65(step) {
    (0, wasmutils_1.loadNative)("cc65");
    var params = step.params;
    // stderr
    var re_err1 = /(.*?):(\d+): (.+)/;
    var errors = [];
    var errline = 0;
    function match_fn(s) {
        console.log(s);
        var matches = re_err1.exec(s);
        if (matches) {
            errline = parseInt(matches[2]);
            errors.push({
                line: errline,
                msg: matches[3],
                path: matches[1]
            });
        }
    }
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + '.s';
    if ((0, builder_1.staleFiles)(step, [destpath])) {
        var CC65 = wasmutils_1.emglobal.cc65({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('cc65'),
            noInitialRun: true,
            //logReadFiles:true,
            print: wasmutils_1.print_fn,
            printErr: match_fn,
        });
        var FS = CC65.FS;
        (0, wasmutils_1.setupFS)(FS, '65-' + (0, util_1.getRootBasePlatform)(step.platform));
        (0, builder_1.populateFiles)(step, FS, {
            mainFilePath: step.path,
            processFn: (path, code) => {
                if (typeof code === 'string') {
                    code = (0, builder_1.processEmbedDirective)(code);
                }
                return code;
            }
        });
        (0, builder_1.fixParamsWithDefines)(step.path, params);
        var args = [
            '-I', '/share/include',
            '-I', '.',
            "-D", "__8BITWORKSHOP__",
        ];
        if (params.define) {
            params.define.forEach((x) => args.push('-D' + x));
        }
        if (step.mainfile) {
            args.unshift.apply(args, ["-D", "__MAIN__"]);
        }
        var customArgs = params.extra_compiler_args || ['-T', '-g', '-Oirs', '-Cl', '-W', '-pointer-sign,-no-effect'];
        args = args.concat(customArgs, args);
        args.push(step.path);
        //console.log(args);
        (0, wasmutils_1.execMain)(step, CC65, args);
        if (errors.length)
            return { errors: errors };
        var asmout = FS.readFile(destpath, { encoding: 'utf8' });
        (0, builder_1.putWorkFile)(destpath, asmout);
    }
    return {
        nexttool: "ca65",
        path: destpath,
        args: [destpath],
        files: [destpath],
    };
}
exports.compileCC65 = compileCC65;
//# sourceMappingURL=cc65.js.map