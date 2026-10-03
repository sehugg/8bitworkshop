"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assembleCA65 = assembleCA65;
exports.linkLD65 = linkLD65;
exports.compileCC65 = compileCC65;
const toolmeta_1 = require("../../common/toolmeta");
const wasishim_1 = require("../../common/wasi/wasishim");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const cc65dbg_1 = require("./cc65dbg");
const wasmutils_1 = require("../wasmutils");
const wasiutils_1 = require("../wasiutils");
// the WASI builds look for their data under share/cc65 in the per-platform
// cc65-fs-<platform>.zip, preopened at '.'
const CC65_SHARE = 'share/cc65';
// cc65/ca65/ld65 report both errors and non-fatal warnings as
// "<file>:<line>: <Warning|Error>: <msg>" on stderr; skip the warnings so a
// clean build with only style/deprecation warnings doesn't fail.
const re_cc65_warning = /:\s*Warning:/;
const wasiModules = {};
/**
 * Run cc65, ca65 or ld65 on a fresh WASI runner layered over the platform's
 * cc65 filesystem. `populate` copies the step's inputs into the runner first.
 * Returns the runner (for reading outputs) and its stderr lines.
 */
async function runCC65Tool(step, tool, args, populate) {
    const fsname = (0, toolmeta_1.getSharedFileSystemName)('cc65', step.platform);
    if (!fsname || !fsname.startsWith('wasi:'))
        throw new Error("No cc65 filesystem for platform " + step.platform);
    const sharefs = await (0, wasmutils_1.ensureWasiFilesystem)(fsname.substring(5));
    if (!sharefs)
        throw new Error("Could not load cc65 filesystem " + fsname);
    if (!wasiModules[tool]) {
        wasiModules[tool] = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)(tool));
    }
    const wasi = new wasishim_1.WASIRunner();
    wasi.initSync(wasiModules[tool]);
    wasi.fs.setParent(sharefs);
    populate((0, wasiutils_1.wasiFSAdapter)(wasi));
    wasi.addPreopenDirectory(".");
    wasi.setArgs([tool, ...args]);
    const errno = wasi.run();
    console.log('exec', tool, args.join(' '));
    const stdout = wasi.fds[1].getBytesAsString();
    if (stdout)
        console.log(stdout);
    const stderr = wasi.fds[2].getBytesAsString().split(listingutils_1.re_crlf).filter(s => s != '');
    return { wasi, errno, stderr };
}
/** Report a failed tool run that printed no parseable error message. */
function checkExitCode(tool, errno, stderr, errors) {
    if (errno && !errors.length) {
        errors.push({ line: 0, msg: tool + " exited with code " + errno + (stderr.length ? ": " + stderr.join('\n') : '') });
    }
}
function readWASIOutput(wasi, path) {
    const fd = wasi.fs.getFile(path);
    if (!fd)
        throw new Error("Missing output file " + path);
    return fd.getBytes().slice();
}
function readWASIOutputString(wasi, path) {
    return new TextDecoder().decode(readWASIOutput(wasi, path));
}
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
async function assembleCA65(step) {
    var errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.s" });
    var objpath = step.prefix + ".o";
    var lstpath = step.prefix + ".lst";
    // the link step reads these params, so they have to be settled even when
    // the object file is up to date and nothing below runs
    if (step.mainfile) {
        (0, builder_1.applyAsmProjectParams)(step.params); // an asm project, not a C one
    }
    (0, builder_1.fixParamsWithDefines)(step.path, step.params);
    if ((0, builder_1.staleFiles)(step, [objpath, lstpath])) {
        var args = ['-v', '-g', '-I', CC65_SHARE + '/asminc', '-o', objpath, '-l', lstpath, step.path];
        args.unshift.apply(args, ["-D", "__8BITWORKSHOP__=1"]);
        if (step.mainfile) {
            args.unshift.apply(args, ["-D", "__MAIN__=1"]);
        }
        // //#symbol as / //#flag as (insert before the source filename).
        // platform defines (params.define) only reach the compiler step otherwise,
        // so a hand-written .ca65/.s project would never see e.g. __ATARI5200__
        var extra = (0, toolmeta_1.defineArgs)('ca65', step.params.define)
            .concat((0, toolmeta_1.defineArgs)('ca65', step.params.symbols && step.params.symbols.assembler))
            .concat((0, toolmeta_1.extraArgsFor)('ca65', step.params.buildArgs));
        args.splice(args.length - 1, 0, ...extra);
        const { wasi, errno, stderr } = await runCC65Tool(step, 'ca65', args, (fs) => (0, builder_1.populateFiles)(step, fs));
        stderr.filter(s => !re_cc65_warning.test(s)).forEach((0, listingutils_1.makeErrorMatcher)(errors, /(.+?):(\d+): (.+)/, 2, 3, step.path, 1));
        checkExitCode('ca65', errno, stderr, errors);
        if (errors.length) {
            let listings = {};
            // TODO? change extension to .lst
            //listings[step.path] = { lines:[], text:getWorkFileAsString(step.path) };
            return { errors, listings };
        }
        (0, builder_1.putWorkFile)(objpath, readWASIOutput(wasi, objpath));
        (0, builder_1.putWorkFile)(lstpath, readWASIOutputString(wasi, lstpath));
    }
    return {
        linktool: "ld65",
        files: [objpath, lstpath],
        args: [objpath]
    };
}
async function linkLD65(step) {
    var _a, _b, _c;
    var params = step.params;
    (0, builder_1.gatherFiles)(step);
    var binpath = "main";
    if ((0, builder_1.staleFiles)(step, [binpath])) {
        var errors = [];
        var libargs = params.libargs || [];
        var cfgfile = params.cfgfile;
        var args = ['--cfg-path', CC65_SHARE + '/cfg',
            '--lib-path', CC65_SHARE + '/lib',
            '-C', cfgfile,
            '-Ln', 'main.vice',
            '--dbgfile', 'main.dbg',
            '-o', 'main',
            '-m', 'main.map'].concat(step.args, libargs);
        // //#symbol ld (symbols not already merged into libargs) and //#flag ld
        args.push.apply(args, (0, toolmeta_1.linkSymbolArgs)('ld65', params.symbols && params.symbols.linker));
        args.push.apply(args, (0, toolmeta_1.extraArgsFor)('ld65', params.buildArgs));
        const { wasi, errno, stderr } = await runCC65Tool(step, 'ld65', args, (fs) => {
            (0, builder_1.populateFiles)(step, fs);
            (0, builder_1.populateExtraFiles)(step, fs, params.extra_link_files);
            // populate .cfg file, if it is a custom one
            if (builder_1.store.hasFile(params.cfgfile)) {
                (0, builder_1.populateEntry)(fs, params.cfgfile, builder_1.store.getFileEntry(params.cfgfile), null);
            }
        });
        // any non-warning ld65 message fails the build; again, "Warning:"-severity
        // output (e.g. the sp->c_sp deprecation from our prebuilt crt0.o/neslib2.lib)
        // is non-fatal noise the user can't act on.
        for (let s of stderr) {
            if (re_cc65_warning.test(s))
                continue;
            errors.push({ msg: s, line: 0 });
        }
        checkExitCode('ld65', errno, stderr, errors);
        if (errors.length)
            return { errors: errors };
        var aout = readWASIOutput(wasi, "main");
        var mapout = readWASIOutputString(wasi, "main.map");
        var viceout = readWASIOutputString(wasi, "main.vice");
        // correct binary for PCEngine
        if (step.platform == 'pce' && aout.length > 0x2000) {
            // move 8 KB from end to front
            let newrom = new Uint8Array(aout.length);
            newrom.set(aout.slice(aout.length - 0x2000), 0);
            newrom.set(aout.slice(0, aout.length - 0x2000), 0x2000);
            aout = newrom;
        }
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
        // symbol sizes from the linker debug file
        var symbolsizes = {};
        try {
            let dbgsyms = (0, cc65dbg_1.parseCC65DbgSizes)(readWASIOutputString(wasi, "main.dbg"), params.ignore_segments);
            symbolsizes = dbgsyms.sizes;
            // labels outside CPU address space (e.g. NES CHR) would alias real addresses
            for (let name of dbgsyms.ignored)
                delete symbolmap[name];
        }
        catch (e) {
            console.log("could not parse main.dbg", e);
        }
        var segments = [];
        // TODO: CHR, banks, etc
        let re_seglist = /(\w+)\s+([0-9A-F]+)\s+([0-9A-F]+)\s+([0-9A-F]+)\s+([0-9A-F]+)/;
        let parseseglist = false;
        let m;
        for (let s of mapout.split('\n')) {
            if (parseseglist && (m = re_seglist.exec(s))) {
                let seg = m[1];
                if ((_a = params.ignore_segments) === null || _a === void 0 ? void 0 : _a.includes(seg))
                    continue;
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
                var lstout = readWASIOutputString(wasi, fn);
                lstout = lstout.split('\n\n')[1] || lstout; // remove header
                (0, builder_1.putWorkFile)(fn, lstout);
                //const asmpath = fn.replace(/\.lst$/, '.ca65'); // TODO! could be .s
                let isECS = ((_c = (_b = step.debuginfo) === null || _b === void 0 ? void 0 : _b.systems) === null || _c === void 0 ? void 0 : _c.Init) != null; // TODO
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
            symbolsizes: symbolsizes,
            segments: segments
        };
    }
}
async function compileCC65(step) {
    var params = step.params;
    var errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + '.s';
    // the link step reads these params, so they have to be settled even when
    // the assembly file is up to date and nothing below runs
    (0, builder_1.fixParamsWithDefines)(step.path, params);
    if ((0, builder_1.staleFiles)(step, [destpath])) {
        var args = [
            '-I', CC65_SHARE + '/include',
            '-I', '.',
            "-D", "__8BITWORKSHOP__",
        ];
        if (params.define) {
            params.define.forEach((x) => args.push('-D' + x));
        }
        if (step.mainfile) {
            args.unshift.apply(args, ["-D", "__MAIN__"]);
        }
        // //#symbol c / //#flag c
        args.push.apply(args, (0, toolmeta_1.defineArgs)('cc65', params.symbols && params.symbols.compiler));
        args.push.apply(args, (0, toolmeta_1.extraArgsFor)('cc65', params.buildArgs));
        var customArgs = params.extra_compiler_args || ['-T', '-g', '-Oirs', '-Cl', '-W', '-pointer-sign,-no-effect,-unreachable-code'];
        // cc65 V2.19-3867 parses inline asm into code entries and a new
        // optimizer step (OptLoadStore1) removes a store that follows a load
        // from the same address -- wrong for hardware registers and
        // self-modifying code. The old cc65 never touched inline asm; keep
        // that behavior by disabling just this new step.
        args = args.concat(customArgs, ['--disable-opt', 'OptLoadStore1'], args);
        args.push(step.path);
        const { wasi, errno, stderr } = await runCC65Tool(step, 'cc65', args, (fs) => {
            (0, builder_1.populateFiles)(step, fs, {
                mainFilePath: step.path,
                processFn: (path, code) => {
                    if (typeof code === 'string') {
                        code = (0, builder_1.processEmbedDirective)(code);
                    }
                    return code;
                }
            });
            (0, builder_1.populateExtraFiles)(step, fs, params.extra_compile_files);
        });
        stderr.filter(s => !re_cc65_warning.test(s)).forEach((0, listingutils_1.makeErrorMatcher)(errors, /(.*?):(\d+): (.+)/, 2, 3, step.path, 1));
        checkExitCode('cc65', errno, stderr, errors);
        if (errors.length)
            return { errors };
        (0, builder_1.putWorkFile)(destpath, readWASIOutputString(wasi, destpath));
    }
    return {
        nexttool: "ca65",
        path: destpath,
        args: [destpath],
        files: [destpath],
    };
}
//# sourceMappingURL=cc65.js.map