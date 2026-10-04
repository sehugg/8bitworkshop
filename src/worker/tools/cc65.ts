
import { defineArgs, extraArgsFor, linkSymbolArgs, getSharedFileSystemName } from "../../common/toolmeta";
import { CodeListingMap, WorkerError } from "../../common/workertypes";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, populateFiles, fixParamsWithDefines, applyAsmProjectParams, putWorkFile, populateExtraFiles, store, populateEntry, anyTargetChanged, processEmbedDirective } from "../builder";
import { re_crlf, makeErrorMatcher, hasErrors } from "../listingutils";
import { parseCC65DbgSizes } from "./cc65dbg";
import { wasiFSAdapter, runWASITool, checkExitCode, readWASIOutput, readWASIOutputString } from "../wasiutils";

// the WASI builds look for their data under share/cc65 in the per-platform
// cc65-fs-<platform>.zip, preopened at '.'
const CC65_SHARE = 'share/cc65';

// cc65/ca65/ld65 report both errors and non-fatal warnings as
// "<file>:<line>: <Warning|Error>: <msg>" on stderr; makeErrorMatcher marks the
// warnings, which don't fail a build.
const re_cc65_warning = /:\s*Warning:/;
// warnings from our prebuilt libraries (crt0.o, neslib2.lib) that the user can't act on
const re_ld65_ignored = /Symbol 'sp' is deprecated/;

const wasiModules: { [tool: string]: WebAssembly.Module } = {};

/**
 * Run cc65, ca65 or ld65 on a fresh WASI runner layered over the platform's
 * cc65 filesystem. `populate` copies the step's inputs into the runner first.
 * Returns the runner (for reading outputs) and its stderr lines.
 */
async function runCC65Tool(step: BuildStep, tool: string, args: string[],
    populate: (fs: ReturnType<typeof wasiFSAdapter>) => void) {
    const fsname = getSharedFileSystemName('cc65', step.platform);
    if (!fsname || !fsname.startsWith('wasi:'))
        throw new Error("No cc65 filesystem for platform " + step.platform);
    return runWASITool(tool, args, { sharedFS: fsname.substring(5), populate });
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
function parseCA65Listing(asmfn: string, code: string, symbols, segments, params, dbg: boolean, listings?: CodeListingMap) {
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
    for (var line of code.split(re_crlf)) {
        var dbgm = dbgLineMatch.exec(line);
        if (dbgm && dbgm[1]) {
            var dbgtype = dbgm[4];
            offset = parseInt(dbgm[1], 16);
            curpath = dbgm[5];
            // new file?
            if (curpath && listings) {
                let l = listings[curpath];
                if (!l) l = listings[curpath] = {lines:[]};
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
            let insns = linem[4]?.trim() || '';
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
                } else {
                    var sym = null;
                    var label = linem[5];
                    if (label?.endsWith(':')) {
                        sym = label.substring(0, label.length-1);
                    } else if (label?.toLowerCase().startsWith('.proc')) {
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

export async function assembleCA65(step: BuildStep): Promise<BuildStepResult> {
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.s" });
    var objpath = step.prefix + ".o";
    var lstpath = step.prefix + ".lst";
    // the link step reads these params, so they have to be settled even when
    // the object file is up to date and nothing below runs
    if (step.mainfile) {
        applyAsmProjectParams(step.params);   // an asm project, not a C one
    }
    fixParamsWithDefines(step.path, step.params);
    if (staleFiles(step, [objpath, lstpath])) {
        var args = ['-v', '-g', '-I', CC65_SHARE + '/asminc', '-o', objpath, '-l', lstpath, step.path];
        args.unshift.apply(args, ["-D", "__8BITWORKSHOP__=1"]);
        if (step.mainfile) {
            args.unshift.apply(args, ["-D", "__MAIN__=1"]);
        }
        // //#symbol as / //#flag as (insert before the source filename).
        // platform defines (params.define) only reach the compiler step otherwise,
        // so a hand-written .ca65/.s project would never see e.g. __ATARI5200__
        var extra = defineArgs('ca65', step.params.define)
            .concat(defineArgs('ca65', step.params.symbols && step.params.symbols.assembler))
            .concat(extraArgsFor('ca65', step.params.buildArgs));
        args.splice(args.length - 1, 0, ...extra);
        const { wasi, errno, stderr } = await runCC65Tool(step, 'ca65', args, (fs) => populateFiles(step, fs));
        stderr.forEach(makeErrorMatcher(errors, /(.+?):(\d+): (.+)/, 2, 3, step.path, 1));
        checkExitCode('ca65', errno, stderr, errors);
        if (hasErrors(errors)) {
            let listings : CodeListingMap = {};
            // TODO? change extension to .lst
            //listings[step.path] = { lines:[], text:getWorkFileAsString(step.path) };
            return { errors, listings };
        }
        putWorkFile(objpath, readWASIOutput(wasi, objpath));
        putWorkFile(lstpath, readWASIOutputString(wasi, lstpath));
    }
    return {
        linktool: "ld65",
        files: [objpath, lstpath],
        args: [objpath],
        warnings: errors
    };
}

export async function linkLD65(step: BuildStep): Promise<BuildStepResult> {
    var params = step.params;
    gatherFiles(step);
    var binpath = "main";
    if (staleFiles(step, [binpath])) {
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
        args.push.apply(args, linkSymbolArgs('ld65', params.symbols && params.symbols.linker));
        args.push.apply(args, extraArgsFor('ld65', params.buildArgs));
        const { wasi, errno, stderr } = await runCC65Tool(step, 'ld65', args, (fs) => {
            populateFiles(step, fs);
            populateExtraFiles(step, fs, params.extra_link_files);
            // populate .cfg file, if it is a custom one
            if (store.hasFile(params.cfgfile)) {
                populateEntry(fs, params.cfgfile, store.getFileEntry(params.cfgfile), null);
            }
        });
        // any non-warning ld65 message fails the build
        for (let s of stderr) {
            if (re_ld65_ignored.test(s)) continue;
            errors.push({ msg: s, line: 0, ...(re_cc65_warning.test(s) && { severity: 'warning' as const }) });
        }
        checkExitCode('ld65', errno, stderr, errors);
        if (hasErrors(errors))
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
        putWorkFile("main", aout);
        putWorkFile("main.map", mapout);
        putWorkFile("main.vice", viceout);
        // return unchanged if no files changed
        if (!anyTargetChanged(step, ["main", "main.map", "main.vice"]))
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
            let dbgsyms = parseCC65DbgSizes(readWASIOutputString(wasi, "main.dbg"), params.ignore_segments);
            symbolsizes = dbgsyms.sizes;
            // labels outside CPU address space (e.g. NES CHR) would alias real addresses
            for (let name of dbgsyms.ignored) delete symbolmap[name];
        } catch (e) {
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
                if (params.ignore_segments?.includes(seg)) continue;
                let start = parseInt(m[2], 16);
                let size = parseInt(m[4], 16);
                let type = '';
                // TODO: better id of ram/rom
                if (seg.startsWith('CODE') || seg == 'STARTUP' || seg == 'RODATA' || seg.endsWith('ROM')) type = 'rom';
                else if (seg == 'ZP' || seg == 'DATA' || seg == 'BSS' || seg.endsWith('RAM')) type = 'ram';
                segments.push({ name: seg, start, size, type });
            }
            if (s == 'Segment list:') parseseglist = true;
            if (s == '') parseseglist = false;
        }
        // build listings
        var listings: CodeListingMap = {};
        for (var fn of step.files) {
            if (fn.endsWith('.lst')) {
                var lstout = readWASIOutputString(wasi, fn);
                lstout = lstout.split('\n\n')[1] || lstout; // remove header
                putWorkFile(fn, lstout);
                //const asmpath = fn.replace(/\.lst$/, '.ca65'); // TODO! could be .s
                let isECS = step.debuginfo?.systems?.Init != null; // TODO
                if (isECS) {
                    var asmlines = [];
                    var srclines = parseCA65Listing(fn, lstout, symbolmap, segments, params, true, listings);
                    listings[fn] = {
                        lines: [],
                        text: lstout
                    }
                } else {
                    var asmlines = parseCA65Listing(fn, lstout, symbolmap, segments, params, false);
                    var srclines = parseCA65Listing('', lstout, symbolmap, segments, params, true);
                    listings[fn] = {
                        asmlines: srclines.length ? asmlines : null,
                        lines: srclines.length ? srclines : asmlines,
                        text: lstout
                    }
                }
            }
        }
        return {
            output: aout, //.slice(0),
            listings: listings,
            warnings: errors,
            symbolmap: symbolmap,
            symbolsizes: symbolsizes,
            segments: segments
        };
    }
}

// Older projects carry their own copy of neslib.h with "#define NULL 0", which
// now clashes with the ((void*)0) from cc65's <stddef.h>. Guard it.
const re_define_null = /^([ \t]*)#[ \t]*define[ \t]+NULL[ \t]+(?:0|0[uU]?[lL]?|\(\s*void\s*\*\s*\)\s*0|\(\(\s*void\s*\*\s*\)\s*0\s*\))[ \t]*(?=\r?$)/gm;
export function fixLegacyNullDefine(code: string): string {
    return code.replace(re_define_null, '$1#ifndef NULL\n$1#define NULL ((void*)0)\n$1#endif');
}

export async function compileCC65(step: BuildStep): Promise<BuildStepResult> {
    var params = step.params;
    var errors: WorkerError[] = [];
    gatherFiles(step, { mainFilePath: "main.c" });
    var destpath = step.prefix + '.s';
    // the link step reads these params, so they have to be settled even when
    // the assembly file is up to date and nothing below runs
    fixParamsWithDefines(step.path, params);
    if (staleFiles(step, [destpath])) {
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
        args.push.apply(args, defineArgs('cc65', params.symbols && params.symbols.compiler));
        args.push.apply(args, extraArgsFor('cc65', params.buildArgs));
        var customArgs = params.extra_compiler_args || ['-T', '-g', '-Oirs', '-Cl', '-W', '-pointer-sign,-no-effect,-unreachable-code'];
        // cc65 V2.19-3867 parses inline asm into code entries and a new
        // optimizer step (OptLoadStore1) removes a store that follows a load
        // from the same address -- wrong for hardware registers and
        // self-modifying code. The old cc65 never touched inline asm; keep
        // that behavior by disabling just this new step.
        args = args.concat(customArgs, ['--disable-opt', 'OptLoadStore1'], args);
        args.push(step.path);
        const { wasi, errno, stderr } = await runCC65Tool(step, 'cc65', args, (fs) => {
            const processFn = (path, code) => {
                if (typeof code === 'string') {
                    code = processEmbedDirective(code);
                    if (/(^|\/)neslib\.h$/.test(path)) code = fixLegacyNullDefine(code);
                }
                return code;
            };
            populateFiles(step, fs, { mainFilePath: step.path, processFn });
            populateExtraFiles(step, fs, params.extra_compile_files, processFn);
        });
        stderr.forEach(makeErrorMatcher(errors, /(.*?):(\d+): (.+)/, 2, 3, step.path, 1));
        checkExitCode('cc65', errno, stderr, errors);
        if (hasErrors(errors)) return { errors };
        putWorkFile(destpath, readWASIOutputString(wasi, destpath));
    }
    return {
        nexttool: "ca65",
        path: destpath,
        args: [destpath],
        files: [destpath],
        warnings: errors,
    };
}
