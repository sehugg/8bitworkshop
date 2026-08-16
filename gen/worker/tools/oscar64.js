"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compileOscar64 = compileOscar64;
const wasishim_1 = require("../../common/wasi/wasishim");
const builder_1 = require("../builder");
const listingutils_1 = require("../listingutils");
const oscar64parse_1 = require("./oscar64parse");
const wasiutils_1 = require("../wasiutils");
const wasmutils_1 = require("../wasmutils");
let oscar64_fs = null;
let wasiModule = null;
// find a file in the WASI fs whose name ends with the given suffix.
// oscar64 writes files as "./path/name.ext" (or "././name.ext" when the
// output was specified with a "./" prefix), so match on suffix only.
function getWasiFileAsString(wasi, suffix) {
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
        wasi.setArgs(["oscar64", "-v", "-g", "-ii=include", "-o=" + destpath, step.path]);
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
        // (58, 17) : error 3001: Could not open source file. 'stdlib.c'
        const matcher = (0, listingutils_1.makeErrorMatcher)(errors, /\((\d+),\s+(\d+)\)\s+: error (\d+): (.+)/, 1, 4, step.path);
        const matcher2 = (0, listingutils_1.makeErrorMatcher)(errors, /oscar64: error (\d+): (.+)/, 0, 2, step.path);
        for (let line of stderr.split('\n')) {
            matcher(line);
            matcher2(line);
        }
        if (errors.length) {
            return { errors };
        }
        const output = wasi.fs.getFile("./" + destpath).getBytes();
        (0, builder_1.putWorkFile)(destpath, output);
        // read and parse oscar64 auxiliary output files (.map, .lbl, .asm)
        const prefix = destpath.replace(/\.prg$/, '');
        let mapout = getWasiFileAsString(wasi, prefix + ".map") || getWasiFileAsString(wasi, ".map");
        let lblout = getWasiFileAsString(wasi, prefix + ".lbl") || getWasiFileAsString(wasi, ".lbl");
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