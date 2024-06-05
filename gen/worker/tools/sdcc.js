"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileSDCC = exports.linkSDLDZ80 = exports.assembleSDASZ80 = void 0;
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const wasmutils_1 = require("../wasmutils");
const mcpp_1 = require("./mcpp");
function hexToArray(s, ofs) {
    var buf = new ArrayBuffer(s.length / 2);
    var arr = new Uint8Array(buf);
    for (var i = 0; i < arr.length; i++) {
        arr[i] = parseInt(s.slice(i * 2 + ofs, i * 2 + ofs + 2), 16);
    }
    return arr;
}
function parseIHX(ihx, rom_start, rom_size, errors) {
    var output = new Uint8Array(new ArrayBuffer(rom_size));
    var high_size = 0;
    for (var s of ihx.split("\n")) {
        if (s[0] == ':') {
            var arr = hexToArray(s, 1);
            var count = arr[0];
            var address = (arr[1] << 8) + arr[2] - rom_start;
            var rectype = arr[3];
            //console.log(rectype,address.toString(16),count,arr);
            if (rectype == 0) {
                for (var i = 0; i < count; i++) {
                    var b = arr[4 + i];
                    output[i + address] = b;
                }
                if (i + address > high_size)
                    high_size = i + address;
            }
            else if (rectype == 1) {
                break;
            }
            else {
                console.log(s); // unknown record type
            }
        }
    }
    // TODO: return ROM anyway?
    if (high_size > rom_size) {
        //errors.push({line:0, msg:"ROM size too large: 0x" + high_size.toString(16) + " > 0x" + rom_size.toString(16)});
    }
    return output;
}
function assembleSDASZ80(step) {
    (0, wasmutils_1.loadNative)("sdasz80");
    var objout, lstout, symout;
    var errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.asm" });
    var objpath = step.prefix + ".rel";
    var lstpath = step.prefix + ".lst";
    if ((0, builder_1.staleFiles)(step, [objpath, lstpath])) {
        //?ASxxxx-Error-<o> in line 1 of main.asm null
        //              <o> .org in REL area or directive / mnemonic error
        // ?ASxxxx-Error-<q> in line 1627 of cosmic.asm
        //    <q> missing or improper operators, terminators, or delimiters
        var match_asm_re1 = / in line (\d+) of (\S+)/; // TODO
        var match_asm_re2 = / <\w> (.+)/; // TODO
        var errline = 0;
        var errpath = step.path;
        var match_asm_fn = (s) => {
            var m = match_asm_re1.exec(s);
            if (m) {
                errline = parseInt(m[1]);
                errpath = m[2];
            }
            else {
                m = match_asm_re2.exec(s);
                if (m) {
                    errors.push({
                        line: errline,
                        path: errpath,
                        msg: m[1]
                    });
                }
            }
        };
        var ASZ80 = wasmutils_1.emglobal.sdasz80({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('sdasz80'),
            noInitialRun: true,
            //logReadFiles:true,
            print: match_asm_fn,
            printErr: match_asm_fn,
        });
        var FS = ASZ80.FS;
        (0, builder_1.populateFiles)(step, FS);
        (0, wasmutils_1.execMain)(step, ASZ80, ['-plosgffwy', step.path]);
        if (errors.length) {
            return { errors: errors };
        }
        objout = FS.readFile(objpath, { encoding: 'utf8' });
        lstout = FS.readFile(lstpath, { encoding: 'utf8' });
        (0, builder_1.putWorkFile)(objpath, objout);
        (0, builder_1.putWorkFile)(lstpath, lstout);
    }
    return {
        linktool: "sdldz80",
        files: [objpath, lstpath],
        args: [objpath]
    };
    //symout = FS.readFile("main.sym", {encoding:'utf8'});
}
exports.assembleSDASZ80 = assembleSDASZ80;
function linkSDLDZ80(step) {
    (0, wasmutils_1.loadNative)("sdldz80");
    var errors = [];
    (0, builder_1.gatherFiles)(step);
    var binpath = "main.ihx";
    if ((0, builder_1.staleFiles)(step, [binpath])) {
        //?ASlink-Warning-Undefined Global '__divsint' referenced by module 'main'
        var match_aslink_re = /\?ASlink-(\w+)-(.+)/;
        var match_aslink_fn = (s) => {
            var matches = match_aslink_re.exec(s);
            if (matches) {
                errors.push({
                    line: 0,
                    msg: matches[2]
                });
            }
        };
        var params = step.params;
        var LDZ80 = wasmutils_1.emglobal.sdldz80({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('sdldz80'),
            noInitialRun: true,
            //logReadFiles:true,
            print: match_aslink_fn,
            printErr: match_aslink_fn,
        });
        var FS = LDZ80.FS;
        (0, wasmutils_1.setupFS)(FS, 'sdcc');
        (0, builder_1.populateFiles)(step, FS);
        (0, builder_1.populateExtraFiles)(step, FS, params.extra_link_files);
        // TODO: coleco hack so that -u flag works
        if (step.platform.startsWith("coleco")) {
            FS.writeFile('crt0.rel', FS.readFile('/share/lib/coleco/crt0.rel', { encoding: 'utf8' }));
            FS.writeFile('crt0.lst', '\n'); // TODO: needed so -u flag works
        }
        var args = ['-mjwxyu',
            '-i', 'main.ihx', // TODO: main?
            '-b', '_CODE=0x' + params.code_start.toString(16),
            '-b', '_DATA=0x' + params.data_start.toString(16),
            '-k', '/share/lib/z80',
            '-l', 'z80'];
        if (params.extra_link_args)
            args.push.apply(args, params.extra_link_args);
        args.push.apply(args, step.args);
        //console.log(args);
        (0, wasmutils_1.execMain)(step, LDZ80, args);
        if (errors.length) {
            return { errors: errors };
        }
        var hexout = FS.readFile("main.ihx", { encoding: 'utf8' });
        var noiout = FS.readFile("main.noi", { encoding: 'utf8' });
        (0, builder_1.putWorkFile)("main.ihx", hexout);
        (0, builder_1.putWorkFile)("main.noi", noiout);
        // return unchanged if no files changed
        if (!(0, builder_1.anyTargetChanged)(step, ["main.ihx", "main.noi"]))
            return;
        // parse binary file
        var binout = parseIHX(hexout, params.rom_start !== undefined ? params.rom_start : params.code_start, params.rom_size, errors);
        if (errors.length) {
            return { errors: errors };
        }
        // parse listings
        var listings = {};
        for (var fn of step.files) {
            if (fn.endsWith('.lst')) {
                var rstout = FS.readFile(fn.replace('.lst', '.rst'), { encoding: 'utf8' });
                //   0000 21 02 00      [10]   52 	ld	hl, #2
                var asmlines = (0, listingutils_1.parseListing)(rstout, /^\s*([0-9A-F]{4})\s+([0-9A-F][0-9A-F r]*[0-9A-F])\s+\[([0-9 ]+)\]?\s+(\d+) (.*)/i, 4, 1, 2, 3);
                var srclines = (0, listingutils_1.parseSourceLines)(rstout, /^\s+\d+ ;<stdin>:(\d+):/i, /^\s*([0-9A-F]{4})/i);
                (0, builder_1.putWorkFile)(fn, rstout);
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
                    if (['INITIALIZER', 'GSINIT', 'GSFINAL'].includes(seg))
                        type = 'rom';
                    else if (seg.startsWith('CODE'))
                        type = 'rom';
                    else if (['DATA', 'INITIALIZED'].includes(seg))
                        type = 'ram';
                    if (type == 'rom' || segstart > 0) // ignore HEADER0, CABS0, etc (TODO?)
                        segments.push({ name: seg, start: segstart, size: segsize, type: type });
                }
            }
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
exports.linkSDLDZ80 = linkSDLDZ80;
function compileSDCC(step) {
    (0, builder_1.gatherFiles)(step, {
        mainFilePath: "main.c" // not used
    });
    var outpath = step.prefix + ".asm";
    if ((0, builder_1.staleFiles)(step, [outpath])) {
        var errors = [];
        var params = step.params;
        (0, wasmutils_1.loadNative)('sdcc');
        var SDCC = wasmutils_1.emglobal.sdcc({
            instantiateWasm: (0, wasmutils_1.moduleInstFn)('sdcc'),
            noInitialRun: true,
            noFSInit: true,
            print: wasmutils_1.print_fn,
            printErr: (0, listingutils_1.msvcErrorMatcher)(errors),
            //TOTAL_MEMORY:256*1024*1024,
        });
        var FS = SDCC.FS;
        (0, builder_1.populateFiles)(step, FS);
        // load source file and preprocess
        var code = (0, builder_1.getWorkFileAsString)(step.path);
        var preproc = (0, mcpp_1.preprocessMCPP)(step, 'sdcc');
        if (preproc.errors) {
            return { errors: preproc.errors };
        }
        else
            code = preproc.code;
        // pipe file to stdin
        (0, wasmutils_1.setupStdin)(FS, code);
        (0, wasmutils_1.setupFS)(FS, 'sdcc');
        var args = ['--vc', '--std-sdcc99', '-mz80', //'-Wall',
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
        if (!/^\s*#pragma\s+opt_code/m.exec(code)) {
            args.push.apply(args, [
                '--oldralloc',
                '--no-peep',
                '--nolospre'
            ]);
        }
        if (params.extra_compile_args) {
            args.push.apply(args, params.extra_compile_args);
        }
        (0, wasmutils_1.execMain)(step, SDCC, args);
        // TODO: preprocessor errors w/ correct file
        if (errors.length /* && nwarnings < msvc_errors.length*/) {
            return { errors: errors };
        }
        // massage the asm output
        var asmout = FS.readFile(outpath, { encoding: 'utf8' });
        asmout = " .area _HOME\n .area _CODE\n .area _INITIALIZER\n .area _DATA\n .area _INITIALIZED\n .area _BSEG\n .area _BSS\n .area _HEAP\n" + asmout;
        (0, builder_1.putWorkFile)(outpath, asmout);
    }
    return {
        nexttool: "sdasz80",
        path: outpath,
        args: [outpath],
        files: [outpath],
    };
}
exports.compileSDCC = compileSDCC;
//# sourceMappingURL=sdcc.js.map