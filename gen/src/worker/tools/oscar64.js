"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileOscar64 = compileOscar64;
const wasishim_1 = require("../../common/wasi/wasishim");
const toolmeta_1 = require("../../common/toolmeta");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const oscar64parse_1 = require("./oscar64parse");
const wasiutils_1 = require("../wasiutils");
const wasmutils_1 = require("../wasmutils");
let oscar64_fs = null;
let wasiModule = null;
// read a file from the WASI fs by name, falling back to matching on the given
// suffix (oscar64 may pick a different output extension than the one requested).
function getWasiFileAsString(wasi, suffix) {
    const exact = wasi.fs.getFile(suffix);
    if (exact)
        return exact.getBytesAsString();
    for (const fd of wasi.fs.getFiles()) {
        if (fd.name.endsWith(suffix)) {
            return fd.getBytesAsString();
        }
    }
    return null;
}
async function compileOscar64(step) {
    const errors = [];
    (0, builder_1.gatherFiles)(step, { mainFilePath: "main.c" });
    const destpath = "./" + (step.path || "main.c").replace(/\.[^.]+$/, ".prg");
    if ((0, builder_1.staleFiles)(step, [destpath])) {
        if (!oscar64_fs) {
            oscar64_fs = await (0, wasiutils_1.loadWASIFilesystemZip)("oscar64-fs.zip");
        }
        if (!wasiModule) {
            wasiModule = new WebAssembly.Module((0, wasmutils_1.loadWASMBinary)("oscar64"));
        }
        const wasi = new wasishim_1.WASIRunner();
        wasi.initSync(wasiModule);
        wasi.fs.setParent(oscar64_fs);
        for (let file of step.files) {
            wasi.fs.putFile("./" + file, builder_1.store.getFileData(file));
        }
        wasi.addPreopenDirectory("include");
        wasi.addPreopenDirectory(".");
        // build with source-level debug info and no optimization, so inlined
        // helpers (e.g. neslib's pal_col/vram_adr) keep their call-site line
        // info and the editor can show hex offsets for every line. User build
        // args are appended after this, so -O1/-O2 still override it.
        let args = ["oscar64", "-O1", "-Oz", "-Op", "-Ox", "-g", "-ii=include", "-o=" + destpath];
        args.push.apply(args, (0, toolmeta_1.defineArgs)('oscar64', step.params && step.params.define));
        args.push.apply(args, (0, toolmeta_1.defineArgs)('oscar64', step.params && step.params.symbols && step.params.symbols.compiler));
        args.push.apply(args, (0, toolmeta_1.extraArgsFor)('oscar64', step.params && step.params.buildArgs));
        args.push(step.path);
        // linked sources are compiled and linked in this same invocation
        if (step.linkfiles)
            args.push.apply(args, step.linkfiles);
        wasi.setArgs(args);
        try {
            wasi.run();
        }
        catch (e) {
            errors.push(e);
        }
        let stdout = wasi.fds[1].getBytesAsString();
        let stderr = wasi.fds[2].getBytesAsString();
        console.log('stdout', stdout);
        console.log('stderr', stderr);
        // oscar64 reports the source filename when a build has more than one
        // source: "/lib.c(2, 14) : error 3005: ...". Global errors omit it:
        // "(58, 17) : error 3001: Could not open source file. 'stdlib.c'".
        const matcher = (0, listingutils_1.makeErrorMatcher)(errors, /^\s*(.*?)\((\d+),\s+(\d+)\)\s+: error (\d+): (.+)/, 2, 5, step.path, 1);
        const matcher2 = (0, listingutils_1.makeErrorMatcher)(errors, /oscar64: error (\d+): (.+)/, 0, 2, step.path);
        for (let line of stderr.split('\n')) {
            matcher(line);
            matcher2(line);
        }
        // strip the leading '/' oscar64 puts on paths so they match the
        // project's filenames (editor error markers match by suffix)
        for (let err of errors) {
            if (err.path && err.path.startsWith('/'))
                err.path = err.path.substring(1);
        }
        if (errors.length) {
            return { errors };
        }
        // oscar64 picks the output extension from the target machine/format
        // (e.g. .xex for the atari target), ignoring the one we asked for.
        const prefix = destpath.replace(/\.[^.]+$/, '');
        let outpath = destpath;
        for (const ext of [".xex", ".prg", ".crt", ".bin", ".nes"]) {
            if (wasi.fs.getFile(prefix + ext)) {
                outpath = prefix + ext;
                break;
            }
        }
        const output = wasi.fs.getFile(outpath).getBytes();
        (0, builder_1.putWorkFile)(destpath, output);
        // read and parse oscar64 auxiliary output files (.map, .lbl, .asm)
        let mapout = getWasiFileAsString(wasi, prefix + ".map") || getWasiFileAsString(wasi, ".map");
        let lblout = getWasiFileAsString(wasi, prefix + ".lbl") || getWasiFileAsString(wasi, ".lbl");
        // banked targets (NES) emit a Mesen label file (.mlb) instead of a VICE .lbl
        let mlbout = getWasiFileAsString(wasi, prefix + ".mlb") || getWasiFileAsString(wasi, ".mlb");
        let asmout = getWasiFileAsString(wasi, prefix + ".asm") || getWasiFileAsString(wasi, ".asm");
        let segments = [];
        let symbolmap = {};
        if (mapout) {
            let parsed = (0, oscar64parse_1.parseOscar64Map)(mapout);
            segments = parsed.segments;
            symbolmap = parsed.symbolmap;
            (0, builder_1.putWorkFile)(prefix + ".map", mapout);
        }
        if (lblout) {
            // merge any extra symbols from the .lbl file
            symbolmap = Object.assign((0, oscar64parse_1.parseOscar64Lbl)(lblout), symbolmap);
            (0, builder_1.putWorkFile)(prefix + ".lbl", lblout);
        }
        if (mlbout) {
            (0, builder_1.putWorkFile)(prefix + ".mlb", mlbout);
        }
        let listings = {};
        if (asmout) {
            let { srclines, asmlines } = (0, oscar64parse_1.parseOscar64Listing)(asmout, step.path);
            let lstpath = prefix.replace(/^\.\//, '') + '.lst';
            (0, builder_1.putWorkFile)(prefix + ".asm", asmout);
            listings[lstpath] = {
                lines: srclines,
                asmlines: asmlines,
                text: asmout,
            };
        }
        return {
            output,
            errors,
            listings,
            symbolmap,
            segments,
        };
    }
}
//# sourceMappingURL=oscar64.js.map