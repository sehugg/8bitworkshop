import { Worker } from "node:worker_threads";
import { defineArgs, extraArgsFor, linkSymbolArgs } from "../../common/toolmeta";
import { CodeListingMap, WorkerError } from "../../common/workertypes";
import { BuildStep, BuildStepResult, gatherFiles, staleFiles, populateFiles, putWorkFile, populateExtraFiles, anyTargetChanged, getWorkFileAsString, fixParamsWithDefines } from "../builder";
import { parseListing, parseSourceLines, msvcErrorMatcher } from "../listingutils";
import { EmscriptenModule, emglobal, execMain, loadNative, moduleInstFn, print_fn, setupFS, setupStdin } from "../wasmutils";
import { preprocessMCPP } from "./mcpp";

function hexToArray(s, ofs) {
    var buf = new ArrayBuffer(s.length / 2);
    var arr = new Uint8Array(buf);
    for (var i = 0; i < arr.length; i++) {
        arr[i] = parseInt(s.slice(i * 2 + ofs, i * 2 + ofs + 2), 16);
    }
    return arr;
}

/**
 * Banked ROM layout, following the GBDK/devkitSMS convention: the linker places
 * bank N's area at the virtual address (N << 16) | window, and the ROM image
 * holds bank N at file offset N * size.
 */
export interface ROMBanking {
    size: number;   // bytes per bank (power of 2)
    window: number; // CPU address the switchable bank is mapped at
}

/** Linker `-b` args for each `_CODE_N` area (N > 0) the object files declare. */
export function bankedAreaArgs(rels: string[], banking: ROMBanking): string[] {
    let banks = new Set<number>();
    for (let rel of rels) {
        let re = /^A _CODE_(\d+) /gm, m;
        while ((m = re.exec(rel))) {
            let n = parseInt(m[1]);
            if (n > 0) banks.add(n);
        }
    }
    let args = [];
    for (let n of Array.from(banks).sort((a, b) => a - b))
        args.push('-b', `_CODE_${n}=0x${((n << 16) | banking.window).toString(16)}`);
    return args;
}

/**
 * Convert Intel HEX to a ROM image of rom_size bytes. With banking, records
 * above 64 KB are placed by bank, and the image grows to the next power of 2
 * that holds the highest bank.
 */
export function parseIHX(ihx: string, rom_start: number, rom_size: number, errors: WorkerError[], banking?: ROMBanking) {
    var output = new Uint8Array(new ArrayBuffer(rom_size));
    var upper = 0; // from type 04 (extended linear address) records
    for (var s of ihx.split("\n")) {
        if (s[0] == ':') {
            var arr = hexToArray(s, 1);
            var count = arr[0];
            var address = upper + (arr[1] << 8) + arr[2];
            var offset = address - rom_start;
            var rectype = arr[3];
            if (rectype == 0) {
                if (banking && address >= 0x10000) {
                    let bank = address >>> 16;
                    let low = address & 0xffff;
                    if (low < banking.window || low + count > banking.window + banking.size) {
                        errors.push({line:0, msg:`Bank ${bank} overflows its 0x${banking.size.toString(16)}-byte window at 0x${low.toString(16)}`});
                        continue;
                    }
                    offset = bank * banking.size + low - banking.window;
                    if (offset + count > output.length) {
                        let newsize = output.length;
                        while (newsize < offset + count) newsize *= 2;
                        let grown = new Uint8Array(newsize);
                        grown.set(output);
                        output = grown;
                    }
                }
                // The linker also emits records for whatever it placed outside
                // the ROM -- initialized data, or a GSINIT area that landed in
                // the _DATA area's RAM. Those bytes are not part of the ROM
                // image; reading past the end of output to check them yields
                // undefined, which used to be reported as an overlap.
                if (offset < 0 || offset + count > output.length) {
                    console.log(`skipping IHX record outside ROM: 0x${address.toString(16)} +${count}`);
                    continue;
                }
                if (output[offset] !== 0) {
                    errors.push({line:0,msg:`IHX overlap offset 0x${(offset).toString(16)}`});
                }
                for (var i = 0; i < count; i++) {
                    output[i + offset] = arr[4 + i];
                }
            } else if (rectype == 1) {
                break;
            } else if (rectype == 4) {
                upper = ((arr[4] << 8) | arr[5]) << 16;
            } else {
                console.log(s); // unknown record type
            }
        }
    }
    return output;
}

function errorMatcherSDASZ80(path: string, errors: WorkerError[]) {
    //?ASxxxx-Error-<o> in line 1 of main.asm null
    //              <o> .org in REL area or directive / mnemonic error
    // ?ASxxxx-Error-<q> in line 1627 of cosmic.asm
    //    <q> missing or improper operators, terminators, or delimiters
    var match_asm_re1 = / in line (\d+) of (\S+)/; // TODO
    var match_asm_re2 = / <\w> (.+)/; // TODO
    var errline = 0;
    var errpath = path;
    var match_asm_fn = (s: string) => {
        var m = match_asm_re1.exec(s);
        if (m) {
            errline = parseInt(m[1]);
            errpath = m[2];
        } else {
            m = match_asm_re2.exec(s);
            if (m) {
                errors.push({
                    line: errline,
                    path: errpath,
                    msg: m[1]
                });
            }
        }
    }
    return match_asm_fn;
}

async function assembleSDAS(step: BuildStep, tool: 'sdasz80' | 'sdasgb'): Promise<BuildStepResult> {
    loadNative(tool);
    var objout, lstout, symout;
    var errors = [];
    gatherFiles(step, { mainFilePath: "main.asm" });
    var objpath = step.prefix + ".rel";
    var lstpath = step.prefix + ".lst";
    if (staleFiles(step, [objpath, lstpath])) {
        const match_asm_fn = errorMatcherSDASZ80(step.path, errors);
        var AS: EmscriptenModule = emglobal[tool]({
            instantiateWasm: moduleInstFn(tool),
            noInitialRun: true,
            //logReadFiles:true,
            print: match_asm_fn,
            printErr: match_asm_fn,
        });
        // old-style Emscripten modules return the Module object, whose .then()
        // only resolves after main() runs; newer MODULARIZE factories return a Promise
        if (AS instanceof Promise) AS = await AS;
        var FS = AS.FS;
        populateFiles(step, FS);
        execMain(step, AS, ['-plosgffwy', step.path]);
        if (errors.length) {
            return { errors: errors };
        }
        objout = FS.readFile(objpath, { encoding: 'utf8' });
        lstout = FS.readFile(lstpath, { encoding: 'utf8' });
        putWorkFile(objpath, objout);
        putWorkFile(lstpath, lstout);
    }
    return {
        linktool: "sdldz80",
        files: [objpath, lstpath],
        args: [objpath]
    };
    //symout = FS.readFile("main.sym", {encoding:'utf8'});
}

export function assembleSDASZ80(step: BuildStep): Promise<BuildStepResult> {
    return assembleSDAS(step, 'sdasz80');
}

export function assembleSDASGB(step: BuildStep): Promise<BuildStepResult> {
    return assembleSDAS(step, 'sdasgb');
}

export function linkSDLDZ80(step: BuildStep) {
    loadNative("sdldz80");
    const arch = step.params.arch || 'z80';
    var errors = [];
    gatherFiles(step);
    var binpath = "main.ihx";
    if (staleFiles(step, [binpath])) {
        //?ASlink-Warning-Undefined Global '__divsint' referenced by module 'main'
        var match_aslink_re = /\?ASlink-(\w+)-(.+)/;
        var match_aslink_fn = (s: string) => {
            var matches = match_aslink_re.exec(s);
            if (matches) {
                errors.push({
                    line: 0,
                    msg: matches[2]
                });
            }
        }
        var params = step.params;
        var LDZ80: EmscriptenModule = emglobal.sdldz80({
            instantiateWasm: moduleInstFn('sdldz80'),
            noInitialRun: true,
            //logReadFiles:true,
            print: match_aslink_fn,
            printErr: match_aslink_fn,
        });
        var FS = LDZ80.FS;
        setupFS(FS, 'sdcc');
        populateFiles(step, FS);
        populateExtraFiles(step, FS, params.extra_link_files);
        // TODO: coleco hack so that -u flag works
        if (step.platform.startsWith("coleco")) {
            FS.writeFile('crt0.rel', FS.readFile('/share/lib/coleco/crt0.rel', { encoding: 'utf8' }));
            FS.writeFile('crt0.lst', '\n'); // TODO: needed so -u flag works
        }
        var args = ['-mjwxyu',
            '-i', 'main.ihx',
            '-b', '_CODE=0x' + (params.codeseg_start||params.code_start).toString(16),
            '-b', '_DATA=0x' + params.data_start.toString(16),
            '-k', arch === 'z80' ? '/share/lib/z80' : '.', // sm83.lib copied to current (.) directory
            '-l', arch];
        if (params.extra_link_args)
            args.push.apply(args, params.extra_link_args);
        // //#symbol ld (sdldz80 uses -g sym=expr) and //#flag ld
        args.push.apply(args, linkSymbolArgs('sdldz80', params.symbols && params.symbols.linker));
        args.push.apply(args, extraArgsFor('sdldz80', params.buildArgs));
        var objargs = step.args;
        if (params.rom_banking) {
            // place each #pragma bank N area, unless a //#flag ld already did
            let banked = objargs.filter((fn) => fn.endsWith('.rel') && bankedAreaArgs([getWorkFileAsString(fn)], params.rom_banking).length);
            let bargs = bankedAreaArgs(banked.map(getWorkFileAsString), params.rom_banking);
            for (let i = 0; i < bargs.length; i += 2) {
                let area = bargs[i + 1].split('=')[0] + '=';
                if (!args.some((a) => a.startsWith(area)))
                    args.push(bargs[i], bargs[i + 1]);
            }
            // Link banked objects just before the last bank 0 object. The
            // linker writes an IHX extended address record when it flushes
            // buffered data, using the address width of the module it is
            // reading at that moment; the XL2 (16-bit) libraries come last, so
            // the last object's upper address is lost -- harmless for bank 0.
            // The first objects stay first: they set the area order crt0 needs.
            let rest = objargs.filter((fn) => !banked.includes(fn));
            if (banked.length && rest.length)
                objargs = rest.slice(0, -1).concat(banked, rest.slice(-1));
        }
        args.push.apply(args, objargs);
        //console.log(args);
        execMain(step, LDZ80, args);
        if (errors.length) {
            return { errors: errors };
        }
        var hexout = FS.readFile("main.ihx", { encoding: 'utf8' });
        var noiout = FS.readFile("main.noi", { encoding: 'utf8' });
        putWorkFile("main.ihx", hexout);
        putWorkFile("main.noi", noiout);
        // return unchanged if no files changed
        if (!anyTargetChanged(step, ["main.ihx", "main.noi"]))
            return;
        // parse binary file
        var binout = parseIHX(hexout, params.rom_start !== undefined ? params.rom_start : params.code_start, params.rom_size, errors, params.rom_banking);
        if (errors.length) {
            return { errors: errors };
        }
        // parse listings
        var listings: CodeListingMap = {};
        for (var fn of step.files) {
            if (fn.endsWith('.lst')) {
                var rstout = FS.readFile(fn.replace('.lst', '.rst'), { encoding: 'utf8' });
                //   0000 21 02 00      [10]   52 	ld	hl, #2
                var asmlines = parseListing(rstout, /^\s*([0-9A-F]{4,6})\s+([0-9A-F][0-9A-F r]*[0-9A-F])\s+\[([0-9 ]+)\]?\s+(\d+) (.*)/i, 4, 1, 2, 3);
                var srclines = parseSourceLines(rstout, /^\s+\d+ ;<stdin>:(\d+):/i, /^\s*([0-9A-F]{4,6})/i);
                putWorkFile(fn, rstout);
                // TODO: you have to get rid of all source lines to get asm listing
                listings[fn] = {
                    asmlines: srclines.length ? asmlines : null,
                    lines: srclines.length ? srclines : asmlines,
                    text: rstout
                };
            }
        }
        // parse symbol map
        var symbolmap = {};
        for (var s of noiout.split("\n")) {
            var toks = s.split(" ");
            if (toks[0] == 'DEF' && !toks[1].startsWith("A$")) {
                symbolmap[toks[1]] = parseInt(toks[2], 16);
            }
        }
        // build segment map
        var seg_re = /^s__(\w+)$/;
        var segments = [];
        // TODO: use stack params for stack segment
        for (let ident in symbolmap) {
            let m = seg_re.exec(ident);
            if (m) {
                let seg = m[1];
                let segstart = symbolmap[ident]; // s__SEG
                let segsize = symbolmap['l__' + seg]; // l__SEG
                if (segstart >= 0 && segsize > 0) {
                    var type = null;
                    if (['INITIALIZER', 'GSINIT', 'GSFINAL'].includes(seg)) type = 'rom';
                    else if (seg.startsWith('CODE')) type = 'rom';
                    else if (['DATA', 'INITIALIZED'].includes(seg)) type = 'ram';
                    if (type == 'rom' || segstart > 0) // ignore HEADER0, CABS0, etc (TODO?)
                        segments.push({ name: seg, start: segstart, size: segsize, type: type });
                }
            }
        }
        // gameboy: fix up header for the final ROM size, compute checksum
        if (step.params.arch === 'gbz80') {
            if (binout.length > 0x8000) {
                // ROM size code n means 32 KB << n
                binout[0x148] = Math.log2(binout.length / 0x8000);
                // a ROM-only cart can't switch banks; MBC5 accepts MBC1-style bank writes
                if (binout[0x147] === 0) binout[0x147] = 0x19;
            }
            var checksum = 0;
            for (var address = 0x0134; address <= 0x014C; address++) {
                checksum = checksum - binout[address] - 1;
            }
            binout[0x14D] = checksum & 0xff;
        }
        return {
            output: binout,
            listings: listings,
            errors: errors,
            symbolmap: symbolmap,
            segments: segments
        };
    }
}

/**
 * sdcc 3.6.5 compiles a __banked call to `call banked_call; .dw _fn; .dw 0`,
 * with a "PENDING: bank support" comment where the bank number belongs. Supply
 * it the way later sdcc versions do: a file with `#pragma bank N` defines
 * `b_fn == N` for each function, and call sites reference `b_fn`.
 */
export function fixBankedCalls(asm: string): string {
    asm = asm.replace(/^(\s*\.dw\s+(_\w+)\s*\n\s*\.dw\s+)0\s*; PENDING: bank support/gm,
        (_m, head, fn) => head + 'b' + fn);
    let m = /^\s*\.area\s+_CODE_(\d+)\b/m.exec(asm);
    if (m && parseInt(m[1]) > 0) {
        let defs = [];
        let re = /^(_\w+)::/gm, f;
        while ((f = re.exec(asm)))
            defs.push(`\t.globl b${f[1]}\nb${f[1]} == ${m[1]}`);
        if (defs.length) asm += '\n' + defs.join('\n') + '\n';
    }
    return asm;
}

export function compileSDCC(step: BuildStep): BuildStepResult {

    gatherFiles(step, {
        mainFilePath: "main.c" // not used
    });
    var params = step.params;
    var isGBZ80 = params.arch === 'gbz80';
    var outpath = step.prefix + ".asm";
    fixParamsWithDefines(step.path, params); // //#symbol, //#flag, //#tooldef
    if (staleFiles(step, [outpath])) {
        var errors = [];
        loadNative('sdcc');
        var SDCC: EmscriptenModule = emglobal.sdcc({
            instantiateWasm: moduleInstFn('sdcc'),
            noInitialRun: true,
            noFSInit: true,
            print: print_fn,
            printErr: msvcErrorMatcher(errors),
            //TOTAL_MEMORY:256*1024*1024,
        });
        var FS = SDCC.FS;
        populateFiles(step, FS);
        // load source file and preprocess
        var code = getWorkFileAsString(step.path);
        var preproc = preprocessMCPP(step, 'sdcc');
        if (preproc.errors) {
            return { errors: preproc.errors };
        }
        else code = preproc.code;
        // pipe file to stdin
        setupStdin(FS, code);
        setupFS(FS, 'sdcc');
        const machineFlags = isGBZ80 ? '-mgbz80' : '-mz80';
        var args = ['--vc', '--std-sdcc99', machineFlags, //'-Wall',
            '--c1mode',
            //'--debug',
            //'-S', 'main.c',
            //'--asm=sdasz80',
            //'--reserve-regs-iy',
            '--less-pedantic',
            ///'--fomit-frame-pointer',
            //'--opt-code-speed',
            //'--max-allocs-per-node', '1000',
            //'--cyclomatic',
            //'--nooverlay',
            //'--nogcse',
            //'--nolabelopt',
            //'--noinvariant',
            //'--noinduction',
            //'--nojtbound',
            //'--noloopreverse',
            '-o', outpath];
        // if "#pragma opt_code" found do not disable optimziations
        if (!isGBZ80 && !/^\s*#pragma\s+opt_code/m.exec(code)) {
            args.push.apply(args, [
                '--oldralloc',
                '--no-peep',
                '--nolospre'
            ]);
        }
        if (params.extra_compile_args) {
            args.push.apply(args, params.extra_compile_args);
        }
        // //#symbol c and //#flag c
        args.push.apply(args, defineArgs('sdcc', params.symbols && params.symbols.compiler));
        args.push.apply(args, extraArgsFor('sdcc', params.buildArgs));
        execMain(step, SDCC, args);
        // TODO: preprocessor errors w/ correct file
        if (errors.length /* && nwarnings < msvc_errors.length*/) {
            return { errors: errors };
        }
        // massage the asm output
        var asmout = FS.readFile(outpath, { encoding: 'utf8' });
        asmout = " .area _HOME\n .area _CODE\n .area _INITIALIZER\n .area _DATA\n .area _INITIALIZED\n .area _BSEG\n .area _BSS\n .area _HEAP\n" + asmout;
        if (isGBZ80) asmout = fixBankedCalls(asmout);
        putWorkFile(outpath, asmout);
    }
    return {
        nexttool: isGBZ80 ? 'sdasgb' : 'sdasz80',
        path: outpath,
        args: [outpath],
        files: [outpath],
    };
}
